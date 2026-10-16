/**
 * Asistan denetleyicisi v2 — ses, agent, uyandırma ve global kısayol orkestrasyonu.
 * Akış: (uyandırma | kısayol | mic butonu) → kayıt (VAD) → Whisper → agent → caption → TTS.
 * Interruption: yeni istek eskisini iptal eder; konuşurken uyandırma aranmaz.
 */
import { useAssistantStore, TASK_DONE_LINGER_MS } from '../../state/assistant-store';
import { useSettingsStore, activeModel } from '../../state/settings-store';
import { AudioService } from '../audio/audio-service';
import { WakeWordService, matchesWakeWord } from '../audio/wake-word';
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

  constructor() {
    this.audio = new AudioService(
      (msg) => this.onAudioError(msg),
      () => this.onTtsEnd(),
    );
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
            onWake: () => {
              useAssistantStore.getState().setCaption(strings.wakeDetected);
              void this.startCommandCapture('wake');
            },
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

  /** Kısayol/buton/uyandırma ile komut kaydını başlatır. */
  async startCommandCapture(source: 'ptt' | 'button' | 'wake' | 'followup'): Promise<void> {
    const st = useAssistantStore.getState();
    if (this.listening || st.mutedByUser) return;
    if (st.status === 'speaking') {
      this.interrupt();
    }
    this.followToken += 1; // bekleyen takip zamanlayıcısını iptal et
    this.listening = true;
    this.wake?.pause();
    this.audio.stopSpeaking();
    st.setStatus('listening');
    st.setCaption(
      source === 'wake'
        ? strings.wakeListening
        : source === 'followup'
          ? strings.followUpListening
          : strings.captionListening,
    );

    try {
      const outcome = await this.audio.recordCommand({
        maxMs: 15_000,
        silenceMs: source === 'followup' ? 1000 : 1100,
        waitStartMs: source === 'wake' ? 8000 : source === 'followup' ? 5000 : 6000,
      });
      if (outcome.kind === 'silence') {
        st.setStatus('idle');
        st.setCaption(
          source === 'followup'
            ? ''
            : source === 'wake'
              ? strings.wakeHeardNothing
              : strings.sttFailed,
        );
        return;
      }
      if (outcome.kind === 'error') {
        this.onAudioError(outcome.message);
        return;
      }
      st.setStatus('processing');
      st.setCaption(strings.transcribing);
      const res = await this.audio.transcribe(outcome.result.audio);
      if (!res.ok) {
        this.onAudioError(res.message);
        return;
      }
      st.setCaption(res.text);
      this.send(res.text);
    } finally {
      this.listening = false;
      if (this.wake?.isRunning()) this.wake.resume();
    }
  }

  /**
   * Sürekli sohbet: cevap bittiğinde (TTS dahil) kendiliğinden tekrar dinlemeye geç.
   * Kullanıcı sessiz kalırsa sohbet biter; "Quatra" demeye gerek kalmaz.
   */
  private scheduleFollowUp(): void {
    const token = ++this.followToken;
    setTimeout(() => {
      if (token !== this.followToken) return;
      const st = useAssistantStore.getState();
      const settings = useSettingsStore.getState().settings;
      if (!settings.voice.continuous) return;
      if (st.mutedByUser || st.status !== 'idle') return;
      void this.startCommandCapture('followup');
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
    this.audio.stopSpeaking();
    void window.quatra?.agent.cancel();
    const st = useAssistantStore.getState();
    st.setStatus('idle');
  }

  setMuted(muted: boolean): void {
    const st = useAssistantStore.getState();
    st.setMuted(muted);
    if (muted) {
      this.followToken += 1;
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

    // Uyandırma kelimesi + tek kelime komut ("quatra" tek başına)
    if (matchesWakeWord(lower, settings.activation.wakeWord) && lower.trim().split(/\s+/).length <= 2) {
      this.sayLocal(strings.wakeReady);
      return;
    }

    // Yerel mod komutları — sağlayıcıya gitmeden anında geçiş.
    if (/(yazılım|proje|kod) moduna geç/.test(lower)) {
      assistant.setMode('pro');
      this.sayLocal(`Yazılım moduna geçildi: ${settings.provider.proModel}`);
      return;
    }
    if (/(normal|sohbet) moda? geç/.test(lower)) {
      assistant.setMode('flash');
      this.sayLocal(`Normal moda geçildi: ${settings.provider.flashModel}`);
      return;
    }
    if (/mod değiştir/.test(lower)) {
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
      })
      .catch(() => {
        assistant.updateTask(taskId, { state: 'error', detail: strings.taskFailed });
        assistant.setStatus('error');
      });
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
          this.audio.speak(event.text, settings.voice.rate, settings.voice.pitch, settings.voice.voiceName);
        } else {
          this.scheduleFollowUp();
        }
        break;
      }
      case 'error': {
        store.setConnection('failed', event.message);
        store.setStatus('error');
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
  }

  private onTtsEnd(): void {
    const store = useAssistantStore.getState();
    if (store.status === 'speaking') store.setStatus('idle');
    if (this.wake?.isRunning()) this.wake.resume();
    // Sürekli sohbet: cevap okunduktan sonra kendiliğinden dinlemeye dön.
    this.scheduleFollowUp();
  }

  private sayLocal(text: string): void {
    const settings = useSettingsStore.getState().settings;
    const store = useAssistantStore.getState();
    store.setCaption(text);
    if (settings.voice.autoSpeak) {
      this.audio.speak(text, settings.voice.rate, settings.voice.pitch, settings.voice.voiceName);
    }
  }

  testVoice(text: string): void {
    const settings = useSettingsStore.getState().settings;
    this.audio.speak(text, settings.voice.rate, settings.voice.pitch, settings.voice.voiceName);
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
