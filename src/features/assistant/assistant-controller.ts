/**
 * Asistan denetleyicisi v2 — ses, agent, uyandırma ve global kısayol orkestrasyonu.
 * Akış: (uyandırma | kısayol | mic butonu) → kayıt (VAD) → Whisper → agent → caption → TTS.
 * Interruption: yeni istek eskisini iptal eder; konuşurken uyandırma aranmaz.
 */
import { useAssistantStore, TASK_DONE_LINGER_MS } from '../../state/assistant-store';
import { useSettingsStore, activeModel } from '../../state/settings-store';
import { AudioService, type RecordOutcome } from '../audio/audio-service';
import { WakeWordService, matchesWakeWord, extractCommandAfterWake } from '../audio/wake-word';
import {
  parseMemoryIntent,
  detectModeCommand,
  isNameQuestion,
  isDetailRequest,
  detectSleepCommand,
  detectStopSpeakingCommand,
  parseConfirmAnswer,
  parseReminderIntent,
} from './commands';
import { strings } from '../../renderer/strings';
import type { AgentEvent } from '../../renderer/global';

/** Araç adlarının kullanıcıya dönük Türkçe etiketleri (sözlü izin sorusu için). */
const TOOL_LABELS: Record<string, string> = {
  not_al: 'not yazma',
  open_app: 'uygulama açma',
  open_url: 'bağlantı açma',
  clipboard_yaz: 'panoya yazma',
  clipboard_oku: 'pano okuma',
  sysinfo: 'sistem bilgisi',
  hafiza_kaydet: 'hafızaya kaydetme',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

export class AssistantController {
  private audio: AudioService;
  private wake: WakeWordService | null = null;
  private offline = false;
  private detachAgent: (() => void) | null = null;
  private detachShortcut: (() => void) | null = null;
  private listening = false;
  private lastPttAt = 0;
  private registeredCombo: string | null = null;
  private followToken = 0;
  private conversationActive = false;
  private pendingWakeCapture = false;
  private pendingSleep = false;
  private greetingIndex = 0;
  private currentRequestId: string | null = null;
  private streamedSpeech = false;
  private pendingConfirmActive = false;
  private pendingConfirmRetries = 0;
  private pendingConfirmTool = '';
  private pendingConfirmRequestId: string | null = null;
  private reminderTimers: Array<ReturnType<typeof setTimeout>> = [];

  constructor() {
    this.audio = new AudioService(
      (msg) => this.onAudioError(msg),
      () => this.onTtsEnd(),
      (msg) => window.quatra?.log.info('audio', msg),
    );
    // Söz kesme: mikrofon döngüsü kullanıcının konuştuğunu yakalarsa buraya gelir.
    this.audio.setBargeHandler(() => this.onBarge());
    this.detachAgent = window.quatra?.agent.onEvent((e) => this.onAgentEvent(e)) ?? null;
    this.detachShortcut =
      window.quatra?.shortcut.onTrigger(() => {
        // Çift tetikleme koruması (register aynı kısayolu iki kez alabilir)
        const now = Date.now();
        if (now - this.lastPttAt < 400) return;
        this.lastPttAt = now;
        void this.startCommandCapture('ptt');
      }) ?? null;

    window.addEventListener('online', () => {
      this.offline = false;
      useAssistantStore.getState().setConnection('unknown', null);
    });
    window.addEventListener('offline', () => {
      this.offline = true;
      useAssistantStore.getState().setConnection('offline', null);
    });
    this.offline = !navigator.onLine;
  }

  dispose(): void {
    for (const timer of this.reminderTimers) clearTimeout(timer);
    this.reminderTimers = [];
    this.detachAgent?.();
    this.detachShortcut?.();
    this.wake?.stop();
    this.audio.stopAll();
    this.audio.stopSpeaking();
  }

  /** Ayarlar değiştikçe etkinleştirme yöntemini uygular (global kısayol / uyandırma). */
  async syncActivation(): Promise<void> {
    const s = useSettingsStore.getState().settings;
    const mode = s.activation.mode;

    // Global kısayol
    if (mode === 'push_to_talk') {
      const combo = s.activation.pushToTalkKey;
      if (this.registeredCombo !== combo) {
        const res = await window.quatra?.shortcut.register(combo);
        if (res?.ok) {
          this.registeredCombo = combo;
        } else {
          this.registeredCombo = null;
          if (res?.message) useAssistantStore.getState().setCaption(res.message);
        }
      }
    } else if (this.registeredCombo) {
      await window.quatra?.shortcut.register(''); // boş = kaldır
      this.registeredCombo = null;
    }

    // Uyandırma kelimesi
    if (mode === 'wake_word') {
      const hasGroq = (await window.quatra?.credentials.has('groq')) ?? false;
      if (!hasGroq) {
        useAssistantStore.getState().setCaption(strings.wakeNeedsGroq);
        return;
      }
      if (!this.wake) {
        this.wake = new WakeWordService(
          this.audio,
          { wakeWord: s.activation.wakeWord },
          {
            onWake: (transcript) => this.onWakeDetected(transcript),
            onError: (msg) => {
              const st = useAssistantStore.getState();
              if (st.status === 'idle') st.setCaption(msg);
            },
          },
        );
      }
      await this.wake.start();
    } else if (this.wake) {
      this.wake.stop();
      this.wake = null;
      if (!this.listening) this.audio.stopAll();
    }
  }

  /** TTS başlat (barge izlemesi AudioService'in mikrofon döngüsündedir). */
  private speakText(text: string): void {
    const settings = useSettingsStore.getState().settings;
    this.audio.speak(text, settings.voice.rate, settings.voice.pitch, settings.voice.voiceName);
  }

  /** Kullanıcı Quatra konuşurken sözünü böldü → çalma durur, hemen dinlenir. */
  private onBarge(): void {
    window.quatra?.log.info('barge', 'kullanıcı sözü böldü — dinlemeye geçiliyor');
    this.audio.stopSpeaking();
    void window.quatra?.agent.cancel();
    const st = useAssistantStore.getState();
    st.setStatus('idle');
    void this.startCommandCapture('barge');
  }

  /**
   * Uyandırma kelimesi duyuldu. Cümlede kelimeden sonra komut varsa ("quatra saat kaç")
   * doğrudan o komut işlenir — kullanıcı iki kez konuşmak zorunda kalmaz.
   */
  private onWakeDetected(transcript: string): void {
    const word = useSettingsStore.getState().settings.activation.wakeWord;
    const rest = extractCommandAfterWake(transcript, word);
    useAssistantStore.getState().setCaption(strings.wakeDetected);
    if (rest && rest.trim().length >= 2) {
      this.conversationActive = true;
      this.wake?.pause(); // cooldown sonrası mikrofonu sohbete bırakır
      window.quatra?.log.info('wake', `uyandırma + komut (${rest.length} karakter)`);
      const st = useAssistantStore.getState();
      st.setCaption(rest.trim());
      st.setStatus('processing');
      this.send(rest.trim());
    } else {
      // Sadece "quatra" dendi → kısa karşılama ("Efendim?") + dinlemeye geç.
      const greetings = [strings.wakeGreeting, strings.wakeGreetingAlt];
      const greeting = greetings[this.greetingIndex % greetings.length]!;
      this.greetingIndex += 1;
      this.pendingWakeCapture = true;
      this.conversationActive = true;
      this.wake?.pause();
      this.sayLocal(greeting);
    }
  }

  /** Kısayol/buton/uyandırma ile komut kaydını başlatır. */
  async startCommandCapture(source: 'ptt' | 'button' | 'wake' | 'followup' | 'barge'): Promise<void> {
    const st = useAssistantStore.getState();
    if (this.listening || st.mutedByUser) return;
    if (st.status === 'speaking') {
      this.interrupt();
    }

    // Mikrofon meşgulse (örn. uyandırma servisi bekliyorsa) nazikçe devral.
    if (this.audio.isRecording()) {
      this.wake?.pause();
      this.audio.cancelRecording();
      await new Promise((r) => setTimeout(r, 180));
    }
    if (this.audio.isRecording()) {
      // Hâlâ meşgul — hata göstermeden kısa süre sonra tekrar denenebilir.
      st.setCaption('Bir saniye… mikrofon hazırlanıyor.');
      return;
    }

    this.followToken += 1; // bekleyen takip zamanlayıcısını iptal et
    this.conversationActive = true;
    this.listening = true;
    this.wake?.pause();
    this.audio.stopSpeaking();
    st.setStatus('listening');
    st.setCaption(
      source === 'wake'
        ? strings.wakeListening
        : source === 'followup' || source === 'barge'
          ? strings.followUpListening
          : strings.captionListening,
    );

    try {
      const outcome = await this.audio.recordCommand({
        maxMs: 15_000,
        silenceMs: source === 'followup' || source === 'barge' ? 1000 : 1100,
        waitStartMs:
          source === 'wake'
            ? 8000
            : source === 'followup' || source === 'barge'
              ? useSettingsStore.getState().settings.voice.sleepAfterSec * 1000
              : 6000,
      });
      if (outcome.kind === 'busy') {
        st.setStatus('idle');
        return; // sessizce çık — hata değil
      }
      if (outcome.kind === 'silence') {
        st.setStatus('idle');
        if (source === 'followup' || source === 'barge') {
          // Sessizlik = sohbet bitti; uyandırma beklemeye dön.
          this.conversationActive = false;
          st.setCaption('');
        } else if (source === 'wake') {
          this.conversationActive = false;
          st.setCaption(strings.wakeHeardNothing);
        } else {
          this.conversationActive = false;
          st.setCaption(strings.sttFailed);
        }
        return;
      }
      if (outcome.kind === 'error') {
        this.conversationActive = false;
        this.onAudioError(outcome.message);
        return;
      }
      st.setStatus('processing');
      st.setCaption(strings.transcribing);
      const res = await this.audio.transcribe(outcome.result.audio);
      if (!res.ok) {
        this.conversationActive = false;
        this.onAudioError(res.message);
        return;
      }
      const heard = res.text.trim();
      if (!heard) {
        // Sessiz/gürültü kaydı ya da filtrelenmiş hayalet kalıp ("Altyazı M.K." gibi):
        // boş istek agent'a GİTMEZ; sessizlik dalıyla aynı davranış uygulanır.
        st.setStatus('idle');
        this.conversationActive = false;
        if (source === 'followup' || source === 'barge') {
          st.setCaption('');
        } else if (source === 'wake') {
          st.setCaption(strings.wakeHeardNothing);
        } else {
          st.setCaption(strings.sttFailed);
        }
        return;
      }
      st.setCaption(heard);
      this.send(heard);
    } finally {
      this.listening = false;
      // Sohbet sürüyorsa uyandırma servisi bekler (çakışma olmaz);
      // sohbet bittiyse "Quatra" beklemeye geri döner.
      if (!this.conversationActive && this.wake?.isRunning()) this.wake.resume();
    }
  }

  /**
   * Sürekli sohbet: cevap bittiğinde (TTS dahil) kendiliğinden tekrar dinlemeye geç.
   * Kullanıcı sessiz kalırsa sohbet biter; "Quatra" demeye gerek kalmaz.
   */
  private scheduleFollowUp(): void {
    const token = ++this.followToken;
    setTimeout(() => {
      void (async () => {
        if (token !== this.followToken) return;
        const st = useAssistantStore.getState();
        const settings = useSettingsStore.getState().settings;
        if (!settings.voice.continuous) {
          this.conversationActive = false;
          if (this.wake?.isRunning()) this.wake.resume();
          return;
        }
        if (st.mutedByUser || st.status !== 'idle') return;
        // Uyandırma servisi mikrofonu ele geçirmişse nazikçe devral
        // (yoksa kullanıcının sözleri uyandırma döngüsünde kaybolur).
        if (this.audio.isRecording()) {
          this.wake?.pause();
          this.audio.cancelRecording();
          await new Promise((r) => setTimeout(r, 200));
        }
        if (useAssistantStore.getState().status !== 'idle') return;
        void this.startCommandCapture('followup');
      })();
    }, 500);
  }

  /** Sohbeti bitir ve «Quatra» bekleyişine dön — mikrofon açık kalır (V1-04). */
  private goToSleep(): void {
    this.conversationActive = false;
    this.followToken += 1; // bekleyen takip dinlemesini iptal et
    const settings = useSettingsStore.getState().settings;
    const st = useAssistantStore.getState();
    if (settings.voice.autoSpeak) {
      this.pendingSleep = true;
      this.sayLocal(strings.sleepAck);
    } else {
      st.setCaption(strings.sleepAck);
      st.setStatus('idle');
      if (this.wake?.isRunning()) this.wake.resume();
    }
  }

  /** Sözlü izin sorusu (V1-09) — araç adı Türkçe etikete çevrilir. */
  private confirmQuestion(tool: string): string {
    return `${strings.confirmAsk} ${toolLabel(tool)}. ${strings.confirmYesNo}`;
  }

  /** Anlaşılmayan onay yanıtı → bir kez daha sor; ikinci kez anlaşılmazsa güvenli taraf: yapma. */
  private askConfirmAgain(): void {
    this.pendingConfirmRetries += 1;
    if (this.pendingConfirmRetries >= 2) {
      this.resolvePendingConfirm(false);
      return;
    }
    const question = this.confirmQuestion(this.pendingConfirmTool);
    useAssistantStore.getState().setCaption(question);
    if (useSettingsStore.getState().settings.voice.autoSpeak) {
      this.speakText(question);
    } else {
      this.scheduleFollowUp();
    }
  }

  /** Onay kararını ana sürece iletir; bekleyiş durumunu kapatır. */
  private resolvePendingConfirm(approved: boolean): void {
    const requestId = this.pendingConfirmRequestId;
    this.pendingConfirmActive = false;
    this.pendingConfirmRetries = 0;
    this.pendingConfirmTool = '';
    this.pendingConfirmRequestId = null;
    if (!requestId) return;
    const store = useAssistantStore.getState();
    store.setCaption(approved ? strings.confirmApproved : strings.confirmDenied);
    store.setStatus('processing');
    const res = window.quatra?.agent.confirm(requestId, approved);
    void res?.then((r) => {
      if (!r?.handled) {
        useAssistantStore.getState().setCaption(strings.confirmNoResponse);
      }
    });
  }

  /** Yerel hatırlatıcı (V1-11) — sesli onay + görsel görev balonu; süre dolunca sesle haber. */
  private scheduleReminder(delayMs: number, what: string): void {
    const store = useAssistantStore.getState();
    const label =
      delayMs < 60_000 ? `${Math.round(delayMs / 1000)} sn` : `${Math.round(delayMs / 60_000)} dk`;
    const taskId = store.pushTask({
      title: what ? `⏰ ${what}` : '⏰ Hatırlatma',
      detail: `${strings.reminderPending} (${label})`,
      state: 'running',
    });
    this.wake?.pause();
    this.sayLocal(strings.reminderSet.replace('{time}', label));
    const timer = setTimeout(() => {
      const st = useAssistantStore.getState();
      st.updateTask(taskId, { state: 'done', detail: strings.reminderDone });
      setTimeout(() => useAssistantStore.getState().removeTask(taskId), TASK_DONE_LINGER_MS);
      this.wake?.pause();
      this.sayLocal(what ? `${strings.reminderFired}: ${what}` : strings.reminderFiredPlain);
    }, delayMs);
    this.reminderTimers.push(timer);
  }

  /** Kullanıcı "dinle" dedi (buton). */
  toggleListening(): void {
    const st = useAssistantStore.getState();
    if (this.listening) {
      st.setStatus('idle');
      this.listening = false;
      this.audio.stopAll(); // watchdog — kayıt yarıda kesilir
      this.wake?.resume();
      return;
    }
    if (st.mutedByUser) return;
    void this.startCommandCapture('button');
  }

  interrupt(): void {
    this.followToken += 1; // takip döngüsünü durdur
    this.conversationActive = false;
    this.audio.cancelRecording();
    this.audio.stopSpeaking();
    void window.quatra?.agent.cancel();
    const st = useAssistantStore.getState();
    st.setStatus('idle');
    if (this.wake?.isRunning()) this.wake.resume();
  }

  setMuted(muted: boolean): void {
    const st = useAssistantStore.getState();
    st.setMuted(muted);
    if (muted) {
      this.followToken += 1;
      this.conversationActive = false;
      this.wake?.pause();
      this.audio.stopAll();
      this.listening = false;
      st.setStatus('muted');
    } else {
      st.setStatus('idle');
      void this.syncActivation();
    }
  }

  /** Metin isteğini agent'a iletir. */
  send(text: string): void {
    const settings = useSettingsStore.getState().settings;
    const assistant = useAssistantStore.getState();
    const lower = text.toLowerCase();

    // "adım ne?" gibi sorular → hafızadan yanıt (yanlışlıkla kayıt değil!)
    if (isNameQuestion(text)) {
      void this.answerNameQuestion();
      return;
    }

    // Yerel hafıza komutları (isim + hatırla)
    const memIntent = parseMemoryIntent(text);
    if (memIntent?.kind === 'name') {
      void this.saveMemory(`Kullanıcının adı: ${memIntent.name}`);
      return;
    }
    if (memIntent?.kind === 'surname') {
      void this.saveMemory(`Kullanıcının soyadı: ${memIntent.surname}`);
      return;
    }
    if (memIntent?.kind === 'remember') {
      void this.saveMemory(memIntent.text);
      return;
    }
    if (/neler? hatırlıyorsun|hafızada ne var|hafızanı göster/.test(lower)) {
      void this.readMemory();
      return;
    }

    // Uyku komutu: sohbeti bitir, «Quatra» beklemeye dön (mikrofon açık kalır).
    if (detectSleepCommand(text)) {
      this.goToSleep();
      return;
    }

    // Sözlü izin yanıtı ("evet"/"hayır") — bekleyen onaya bağlanır (V1-09).
    if (this.pendingConfirmActive) {
      const answer = parseConfirmAnswer(text);
      if (answer) {
        this.resolvePendingConfirm(answer === 'yes');
      } else {
        this.askConfirmAgain();
      }
      return;
    }

    // "Sus" — sesli durdurma (V1-07): konuşmayı kes; sohbet sürüyorsa dinlemeye dön.
    if (detectStopSpeakingCommand(text)) {
      const st0 = useAssistantStore.getState();
      const wasSpeaking = st0.status === 'speaking' || this.audio.isSpeaking();
      this.stopSpeaking();
      useAssistantStore.getState().setCaption(
        wasSpeaking ? strings.stoppedSpeaking : strings.alreadySilent,
      );
      if (this.conversationActive && !useAssistantStore.getState().mutedByUser) {
        this.scheduleFollowUp();
      }
      return;
    }

    // Hatırlatıcı (V1-11): "10 dakika sonra ... hatırlat" — modele gitmeden yerel zamanlayıcı.
    const reminder = parseReminderIntent(text);
    if (reminder) {
      this.scheduleReminder(reminder.delayMs, reminder.what);
      return;
    }

    // Uyandırma kelimesi + tek kelime komut ("quatra" tek başına)
    if (matchesWakeWord(lower, settings.activation.wakeWord) && lower.trim().split(/\s+/).length <= 2) {
      this.sayLocal(strings.wakeReady);
      return;
    }

    // Yerel mod komutları — sağlayıcıya gitmeden anında geçiş.
    const modeCmd = detectModeCommand(text);
    if (modeCmd === 'pro') {
      assistant.setMode('pro');
      this.sayLocal(`Yazılım moduna geçildi: ${settings.provider.proModel}`);
      return;
    }
    if (modeCmd === 'flash') {
      assistant.setMode('flash');
      this.sayLocal(`Normal moda geçildi: ${settings.provider.flashModel}`);
      return;
    }
    if (modeCmd === 'toggle') {
      const next = assistant.mode === 'flash' ? 'pro' : 'flash';
      assistant.setMode(next);
      const model = next === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
      this.sayLocal(`Mod değiştirildi: ${next === 'pro' ? 'Düşünceli' : 'Hızlı'} — ${model}`);
      return;
    }

    if (this.offline) {
      assistant.setConnection('offline', null);
      this.sayLocal(strings.offlineNote);
      return;
    }

    const model = activeModel(settings, assistant.mode);
    const taskId = assistant.pushTask({
      title: text.slice(0, 80),
      detail: strings.taskRunning,
      state: 'running',
    });
    assistant.setStatus('processing');
    assistant.setCaption('');

    void window.quatra?.agent
      .run({
        text,
        model,
        temperature: settings.provider.temperature,
        maxTokens: settings.provider.maxTokens,
        personality: settings.personality || undefined,
        useMemory: settings.memory.enabled,
        memoryEngine: settings.memory.engine,
        autoLearn: settings.memory.autoLearn,
        detailed: isDetailRequest(text),
        retainTranscripts: settings.privacy.retainTranscripts,
      })
      .catch(() => {
        assistant.updateTask(taskId, { state: 'error', detail: strings.taskFailed });
        assistant.setStatus('error');
      });
  }

  /** "hatırla: ..." komutu — kaydı yerel hafızaya yazar (hiçbir servise gitmez). */
  private async saveMemory(text: string): Promise<void> {
    window.quatra?.log.info('memory', `kayıt eklendi (${text.length} karakter)`);
    const res = await window.quatra?.memory.add(text, 'user');
    if (res?.ok) {
      this.sayLocal(strings.memorySaved);
    } else {
      this.sayLocal(strings.memorySaveFailed);
    }
  }

  /** "neler hatırlıyorsun" — kayıtları listeler. */
  private async readMemory(): Promise<void> {
    const entries = await window.quatra?.memory.list();
    if (!entries || entries.length === 0) {
      this.sayLocal(strings.memoryEmpty);
      return;
    }
    const recent = entries.slice(-5).map((e) => `- ${e.text}`).join('\n');
    this.sayLocal(`${strings.memoryListPrefix} ${entries.length} kayıt:\n${recent}`);
  }

  /** "adım ne?" → hafızadaki isim kaydından yanıt verir (çöp kayıtları atlar). */
  private async answerNameQuestion(): Promise<void> {
    const entries = (await window.quatra?.memory.list()) ?? [];
    const nameEntries = entries.filter((e) => e.text.toLowerCase().includes('kullanıcının adı'));
    const nameEntry = nameEntries[nameEntries.length - 1]; // EN SON geçerli kayıt
    if (nameEntry) {
      const name = nameEntry.text.replace(/kullanıcının adı\s*[:：]\s*/i, '').trim();
      if (name && name !== 'ne' && !/^quatra/i.test(name)) {
        this.sayLocal(`${strings.nameAnswer} ${name}.`);
        return;
      }
    }
    this.sayLocal(strings.nameUnknown);
  }

  private onAgentEvent(event: AgentEvent): void {
    const store = useAssistantStore.getState();
    switch (event.type) {
      case 'start':
        this.currentRequestId = event.requestId;
        this.streamedSpeech = false;
        store.setStatus('processing');
        break;
      case 'caption':
        store.setCaption(event.text);
        break;
      case 'sentence': {
        // Akış cümlesi (V1-06): yalnız GÜNCEL istek ve aktif akış sırasında okunur.
        if (event.requestId !== this.currentRequestId) break;
        const status = useAssistantStore.getState().status;
        if (status !== 'processing' && status !== 'speaking') break;
        if (!useSettingsStore.getState().settings.voice.autoSpeak) break;
        this.streamedSpeech = true;
        this.wake?.pause();
        useAssistantStore.getState().setCaption(event.text);
        this.speakText(event.text); // çalma sırasına girer — cümleler akıcı okunur
        break;
      }
      case 'confirm': {
        // Sözlü izin (V1-09): ekranda kutu YOK; Quatra sesle sorar, cevabı sesle dinler.
        this.currentRequestId = event.requestId;
        this.pendingConfirmActive = true;
        this.pendingConfirmRetries = 0;
        this.pendingConfirmTool = event.tool;
        this.pendingConfirmRequestId = event.requestId;
        this.conversationActive = true; // onay turu sohbetin parçasıdır
        const question = this.confirmQuestion(event.tool);
        store.setCaption(question);
        this.wake?.pause();
        if (useSettingsStore.getState().settings.voice.autoSpeak) {
          this.speakText(question); // bitince onTtsEnd → takip dinlemesi (yanıtı bekler)
        } else {
          this.scheduleFollowUp();
        }
        break;
      }
      case 'done': {
        store.setCaption(event.text);
        const task = store.tasks.find((t) => t.state === 'running');
        if (task) {
          store.updateTask(task.id, { state: 'done', detail: strings.taskDone });
          setTimeout(() => store.removeTask(task.id), TASK_DONE_LINGER_MS);
        }
        const settings = useSettingsStore.getState().settings;
        if (settings.voice.autoSpeak && !this.streamedSpeech) {
          store.setStatus('idle');
          this.wake?.pause();
          this.speakText(event.text);
        } else if (!settings.voice.autoSpeak) {
          store.setStatus('idle');
          this.scheduleFollowUp();
        }
        // Otomatik okuma + akış: cümleler çalıyor/sırada — durum 'speaking' kalır,
        // ses bitince onTtsEnd takip dinlemesini başlatır.
        this.streamedSpeech = false;
        break;
      }
      case 'error': {
        this.streamedSpeech = false;
        this.audio.stopSpeaking(); // akıştan kalan cümleler de sussun
        store.setConnection('failed', event.message);
        store.setStatus('error');
        this.conversationActive = false;
        if (this.wake?.isRunning()) this.wake.resume();
        const task = store.tasks.find((t) => t.state === 'running');
        if (task) {
          store.updateTask(task.id, { state: 'error', detail: event.message });
          setTimeout(() => store.removeTask(task.id), TASK_DONE_LINGER_MS);
        }
        store.setCaption(event.message);
        // Net sesli hata (V1-12): kullanıcı sessiz kalmaz.
        if (useSettingsStore.getState().settings.voice.autoSpeak) {
          this.wake?.pause();
          this.speakText(event.message);
        }
        break;
      }
    }
  }

  private onAudioError(message: string): void {
    const store = useAssistantStore.getState();
    this.conversationActive = false;
    store.setCaption(message);
    store.setStatus('error');
    setTimeout(() => {
      if (useAssistantStore.getState().status === 'error') {
        useAssistantStore
          .getState()
          .setStatus(useAssistantStore.getState().mutedByUser ? 'muted' : 'idle');
      }
    }, 4500);
    this.listening = false;
    if (this.wake?.isRunning()) this.wake.resume();
  }

  private onTtsEnd(): void {
    const store = useAssistantStore.getState();
    if (store.status === 'speaking') store.setStatus('idle');
    // Karşılama ("Efendim?") bitti → dinlemeye geç.
    if (this.pendingWakeCapture) {
      this.pendingWakeCapture = false;
      if (!store.mutedByUser) {
        void this.startCommandCapture('wake');
        return;
      }
    }
    // Sohbet hâlâ sürüyorsa uyandırma servisi BEKLEMEDE kalır (mikrofonu sohbete bırakır).
    // Yalnızca sohbet bittiğinde "Quatra" beklemeye döner.
    if (this.wake?.isRunning() && !this.conversationActive) this.wake.resume();
    // Uyku onayı okundu → takip dinlemesi başlatma (V1-04).
    if (this.pendingSleep) {
      this.pendingSleep = false;
      return;
    }
    // Sürekli sohbet: cevap okunduktan sonra kendiliğinden dinlemeye dön.
    this.scheduleFollowUp();
  }

  private sayLocal(text: string): void {
    const settings = useSettingsStore.getState().settings;
    const store = useAssistantStore.getState();
    store.setCaption(text);
    if (settings.voice.autoSpeak) {
      this.speakText(text);
    }
  }

  testVoice(text: string): void {
    this.speakText(text);
  }

  stopSpeaking(): void {
    this.followToken += 1;
    this.audio.stopSpeaking();
    useAssistantStore.getState().setStatus('idle');
    if (this.wake?.isRunning()) this.wake.resume();
  }

  // ---------------------------------------------------------------- mikrofon testi (Ayarlar)

  /** Test oturumu: uyandırma döngüsünü duraklat, mikrofonu GÜNCEL ayarlarla yeniden aç. */
  async startMicTest(): Promise<{ ok: boolean; message?: string; deviceLabel?: string }> {
    if (this.listening) {
      return { ok: false, message: 'Şu anda dinleme sürüyor — bir saniye sonra dene.' };
    }
    this.wake?.pause();
    if (this.audio.isRecording()) {
      this.audio.cancelRecording();
      await new Promise((r) => setTimeout(r, 200));
    }
    this.audio.stopAll(); // cihaz/kazanç/kapı değişiklikleri bir sonraki açılışta uygulanır
    const ok = await this.audio.ensureMic();
    if (!ok) return { ok: false, message: strings.micTestFailed };
    return { ok: true, deviceLabel: this.audio.activeMicLabel() };
  }

  /** Test kaydı — sabit süre, VAD kuralları devre dışı. */
  recordMicTest(ms = 3000): Promise<RecordOutcome> {
    return this.audio.recordCommand({ fixedMs: ms, maxMs: ms + 1500 });
  }

  /** Test bitti — kaynakları bırak, uyandırma bekleyişine dön. */
  endMicTest(): void {
    this.audio.cancelRecording();
    this.audio.stopAll();
    if (this.wake?.isRunning()) this.wake.resume();
  }

  get audioService(): AudioService {
    return this.audio;
  }
}
