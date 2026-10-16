/**
 * Asistan denetleyicisi v2 — ses, agent, uyandırma ve global kısayol orkestrasyonu.
 * Akış: (uyandırma | kısayol | mic butonu) → kayıt (VAD) → Whisper → agent → caption → TTS.
 * Interruption: yeni istek eskisini iptal eder; konuşurken uyandırma aranmaz.
 */
import { useAssistantStore, TASK_DONE_LINGER_MS } from '../../state/assistant-store';
import { useSettingsStore, activeModel } from '../../state/settings-store';
import { AudioService } from '../audio/audio-service';
import { WakeWordService, matchesWakeWord, extractCommandAfterWake } from '../audio/wake-word';
import { parseMemoryIntent, detectModeCommand, isNameQuestion, isDetailRequest } from './commands';
import { strings } from '../../renderer/strings';
import type { AgentEvent } from '../../renderer/global';

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
  private greetingIndex = 0;

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
          source === 'wake' ? 8000 : source === 'followup' || source === 'barge' ? 5000 : 6000,
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
      st.setCaption(res.text);
      this.send(res.text);
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
    if (memIntent?.kind === 'remember') {
      void this.saveMemory(memIntent.text);
      return;
    }
    if (/neler? hatırlıyorsun|hafızada ne var|hafızanı göster/.test(lower)) {
      void this.readMemory();
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
        detailed: isDetailRequest(text),
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
        store.setStatus('processing');
        break;
      case 'caption':
        store.setCaption(event.text);
        break;
      case 'done': {
        store.setCaption(event.text);
        store.setStatus('idle');
        const task = store.tasks.find((t) => t.state === 'running');
        if (task) {
          store.updateTask(task.id, { state: 'done', detail: strings.taskDone });
          setTimeout(() => store.removeTask(task.id), TASK_DONE_LINGER_MS);
        }
        const settings = useSettingsStore.getState().settings;
        if (settings.voice.autoSpeak) {
          this.wake?.pause();
          this.speakText(event.text);
        } else {
          this.scheduleFollowUp();
        }
        break;
      }
      case 'error': {
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

  get audioService(): AudioService {
    return this.audio;
  }
}
