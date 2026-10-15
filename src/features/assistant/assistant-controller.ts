/**
 * Asistan denetleyicisi — UI, ses ve agent arasındaki orkestrasyon.
 * Akış: dinle → STT → görev balonu aç → agent (main) → caption → TTS → idle.
 * Interruption: yeni istek eskisini iptal eder; üst üste konuşma olmaz.
 * Mod komutları: "yazılım moduna geç", "normal moda geç", "mod değiştir".
 */
import { useAssistantStore, TASK_DONE_LINGER_MS } from '../../state/assistant-store';
import { useSettingsStore, activeModel } from '../../state/settings-store';
import { AudioService } from '../audio/audio-service';
import { strings } from '../../renderer/strings';
import type { AgentEvent } from '../../renderer/global';

type TaskId = string;

export class AssistantController {
  private audio: AudioService;
  private offline = false;
  private detach: (() => void) | null = null;

  constructor() {
    this.audio = new AudioService(
      (text) => this.onSttResult(text),
      (msg) => this.onAudioError(msg),
      () => this.onTtsEnd(),
    );
    this.detach = window.quatra?.agent.onEvent((e) => this.onAgentEvent(e)) ?? null;

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
    this.detach?.();
    this.audio.stopListening();
    this.audio.stopSpeaking();
  }

  /** Kullanıcı "dinle" dedi (buton veya PTT). */
  toggleListening(): void {
    const store = useAssistantStore.getState();
    if (store.status === 'listening') {
      this.audio.stopListening();
      store.setStatus('idle');
      return;
    }
    if (store.status === 'speaking') {
      this.interrupt();
      return;
    }
    if (store.mutedByUser) return;
    store.setCaption(strings.captionListening);
    void this.audio.startListening();
  }

  interrupt(): void {
    this.audio.stopSpeaking();
    void window.quatra?.agent.cancel();
    const store = useAssistantStore.getState();
    store.setStatus('idle');
    if (!store.mutedByUser) {
      this.toggleListening();
    }
  }

  setMuted(muted: boolean): void {
    useAssistantStore.getState().setMuted(muted);
    if (muted) {
      this.audio.stopListening();
      useAssistantStore.getState().setStatus('muted');
    } else {
      useAssistantStore.getState().setStatus('idle');
    }
  }

  /** Metin/ses isteğini agent'a iletir. */
  send(text: string): void {
    const settings = useSettingsStore.getState().settings;
    const assistant = useAssistantStore.getState();

    // Yerel mod komutları — sağlayıcıya gitmeden anında geçiş.
    const lower = text.toLowerCase();
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
      this.sayLocal(`Mod değiştirildi: ${next === 'pro' ? 'Yazılım' : 'Normal'} — ${model}`);
      return;
    }

    if (this.offline) {
      assistant.setConnection('offline', null);
      this.sayLocal(strings.offlineNote);
      return;
    }

    const model = activeModel(settings, assistant.mode);
    const taskId: TaskId = assistant.pushTask({ title: text.slice(0, 80), detail: strings.taskRunning, state: 'running' });
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

  private onSttResult(text: string): void {
    useAssistantStore.getState().setCaption(text);
    this.send(text);
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
          this.audio.speak(event.text, settings.voice.rate, settings.voice.voiceName);
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
        if (event.category === 'auth' || event.category === 'rate_limit') {
          store.setCaption(event.message);
        }
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
        useAssistantStore.getState().setStatus(useAssistantStore.getState().mutedByUser ? 'muted' : 'idle');
      }
    }, 4000);
  }

  private onTtsEnd(): void {
    const store = useAssistantStore.getState();
    if (store.status === 'speaking') store.setStatus('idle');
  }

  /** Yerel bildirim — kısa süreliğine durum gösterip sesli söyler. */
  private sayLocal(text: string): void {
    const settings = useSettingsStore.getState().settings;
    const store = useAssistantStore.getState();
    store.setCaption(text);
    if (settings.voice.autoSpeak) {
      this.audio.speak(text, settings.voice.rate, settings.voice.voiceName);
    }
  }

  testVoice(text: string): void {
    const settings = useSettingsStore.getState().settings;
    this.audio.speak(text, settings.voice.rate, settings.voice.voiceName);
  }

  stopSpeaking(): void {
    this.audio.stopSpeaking();
    useAssistantStore.getState().setStatus('idle');
  }

  get audioService(): AudioService {
    return this.audio;
  }
}
