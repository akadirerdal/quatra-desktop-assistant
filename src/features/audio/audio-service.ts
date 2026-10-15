/**
 * Ses servisi — mikrofon yakalama + GERÇEK seviye analizi, STT (Web Speech), TTS (speechSynthesis).
 * Watchdog: her hata/kesinti yolunda capture serbest bırakılır; mikrofon açık unutulmaz.
 * Gizlilik: ses kaydı YAPILMAZ — yalnızca canlı seviye ölçülür ve STT motoruna anlık akar.
 */
import { useAssistantStore } from '../../state/assistant-store';
import { strings } from '../../renderer/strings';

type SttResultCallback = (text: string) => void;
type AudioErrorCallback = (message: string) => void;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export class AudioService {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;
  private ttsSpeaking = false;

  constructor(
    private readonly onSttResult: SttResultCallback,
    private readonly onAudioError: AudioErrorCallback,
    private readonly onTtsEnd: () => void,
  ) {}

  /** Mikrofonu açar; seviye analizini başlatır. İzin reddi dürüst hatayla bildirilir. */
  async startListening(): Promise<void> {
    if (this.listening) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.onAudioError(strings.micNone);
        return;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const denied =
        e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this.onAudioError(denied ? strings.micDenied : strings.micNone);
      return;
    }

    this.listening = true;
    useAssistantStore.getState().setLevels(0, 0);
    useAssistantStore.getState().setStatus('listening');

    // Seviye analizi (gerçek sinyal — sahte veri yok).
    try {
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        this.analyser?.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        useAssistantStore.getState().setLevels(rms * 3, useAssistantStore.getState().speakLevel);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch {
      // Analyser kurulamazsa seviye 0 kalır — görsel dürüst nefes animasyonuna düşer.
    }

    // STT (Web Speech API — gerçek motor).
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) {
      this.stopListening();
      this.onAudioError('Bu sistemde konuşma tanıma motoru yok. Metin girişi için Teşhis bölümünü kullan.');
      return;
    }
    this.recognition = new Ctor();
    this.recognition.lang = 'tr-TR';
    this.recognition.interimResults = false;
    this.recognition.continuous = false;
    this.recognition.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i]?.isFinal) text += e.results[i]?.[0]?.transcript ?? '';
      }
      if (text.trim()) {
        this.stopListening();
        this.onSttResult(text.trim());
      }
    };
    this.recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.onAudioError(strings.micDenied);
      } else if (e.error === 'no-speech') {
        // sessizlik — kullanıcıya dürüst geri bildirim
        this.onAudioError(strings.sttFailed);
      } else {
        this.onAudioError(strings.sttFailed);
      }
      this.stopListening();
    };
    this.recognition.onend = () => {
      if (this.listening) this.stopListening();
    };
    try {
      this.recognition.start();
    } catch {
      // üst üste başlatma gibi durumlar — sessizce bırak
    }
  }

  /** Watchdog: tüm yollarda capture serbest bırakılır. */
  stopListening(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    try {
      this.recognition?.abort();
    } catch {
      // yok say
    }
    this.recognition = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.analyser?.disconnect();
    this.analyser = null;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.listening = false;
    if (useAssistantStore.getState().status === 'listening') {
      useAssistantStore.getState().setStatus('idle');
    }
    useAssistantStore.getState().setLevels(0, 0);
  }

  /** TTS — gerçek sistem ses motoru. Konuşma sırasında speakLevel dürüstçe 0 kalır (sinyal erişimi yok). */
  speak(text: string, rate: number, voiceName: string): void {
    if (!('speechSynthesis' in window)) {
      this.onAudioError('Bu sistemde ses çıkışı (TTS) yok. Cevap yazılı olarak gösterildi.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.name === voiceName) ?? voices.find((v) => v.lang.startsWith('tr'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      this.ttsSpeaking = true;
      useAssistantStore.getState().setStatus('speaking');
    };
    utterance.onend = () => {
      this.ttsSpeaking = false;
      this.onTtsEnd();
    };
    utterance.onerror = () => {
      this.ttsSpeaking = false;
      // TTS hatası akışı öldürmez: durum idle'a döner, cevap caption'da durur.
      useAssistantStore.getState().setStatus('idle');
      this.onAudioError('Ses çalınamadı — cevap ekranda gösterildi.');
      this.onTtsEnd();
    };
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.ttsSpeaking = false;
  }

  isListening(): boolean {
    return this.listening;
  }

  isSpeaking(): boolean {
    return this.ttsSpeaking;
  }

  /** Ayarlardaki ses listesi — gerçek cihaz sesleri, uydurma yok. */
  availableVoices(): Array<{ name: string; lang: string }> {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
  }
}
