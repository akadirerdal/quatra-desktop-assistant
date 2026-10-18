/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Uyandırma kelimesi — Web Speech API (Chromium/Electron yerleşik) tabanlı.
 * Groq Whisper'a istek atmaz: tarayıcı motoru sürekli dinler, ara sonuçları anında verir.
 * Rate limit ve hallüsinasyon sorunları olmaz; internet gerektirir.
 *
 * V1.2: Whisper-burst yaklaşımının (wake-word.ts) yerine bu servis kullanılır.
 * Arayüz WakeWordService ile aynıdır (start/stop/pause/resume/isRunning).
 */
import type { AudioService } from './audio-service';
import { matchesWakeWord, type WakeService } from './wake-word';

export interface WebSpeechWakeCallbacks {
  onWake: (transcript: string) => void;
  onError: (message: string) => void;
  onState?: (state: 'armed' | 'burst' | 'error') => void;
  onTranscript?: (text: string) => void;
}

export interface WebSpeechWakeOptions {
  wakeWord: string;
  cooldownMs?: number;
}

type SpeechRecognitionCtor = new () => any;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechWakeService implements WakeService {
  private recognition: any = null;
  private running = false;
  private paused = false;
  private holdRequested = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    _audio: AudioService,
    private readonly options: WebSpeechWakeOptions,
    private readonly callbacks: WebSpeechWakeCallbacks,
  ) {}

  async start(): Promise<boolean> {
    if (this.running) return true;
    const Ctor = getCtor();
    if (!Ctor) {
      this.callbacks.onError('Bu ortamda ses tanıma (Web Speech) desteklenmiyor.');
      return false;
    }
    if (this.disposed) return false;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'tr-TR';
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      if (this.paused || !this.running) return;
      let transcript = '';
      let hasFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]!;
        transcript += r[0]!.transcript + ' ';
        if (r.isFinal) hasFinal = true;
      }
      transcript = transcript.trim();
      if (!transcript) return;
      // Ara sonuçlarda (hasFinal=false) uyandırma tetiklenmez — yanlış tetiklemeyi önler.
      if (!hasFinal) {
        this.callbacks.onTranscript?.(`(ara) ${transcript}`);
        return;
      }
      this.callbacks.onTranscript?.(transcript);
      if (matchesWakeWord(transcript, this.options.wakeWord)) {
        this.callbacks.onTranscript?.(`>>> EŞLEŞTİ (${this.options.wakeWord})`);
        this.paused = true;
        this.holdRequested = true;
        try {
          rec.stop();
        } catch {
          // yok say
        }
        this.callbacks.onWake(transcript);
        setTimeout(() => {
          if (this.running && this.holdRequested) {
            this.holdRequested = false;
            this.paused = false;
            this.startRecognition();
          }
        }, 20_000);
      }
    };

    rec.onerror = (event: any) => {
      // 'no-speech' / 'aborted' normal; diğerleri loglanır.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.callbacks.onState?.('error');
        this.callbacks.onError(`Ses tanıma hatası: ${event.error}`);
      }
      if (event.error === 'not-allowed') {
        // fatal: izin yok; yeniden deneme
        this.running = false;
      }
    };

    rec.onend = () => {
      // Tarayıcı sessizlikte otomatik durdurur; çalışıyorsak yeniden başlat.
      if (this.running && !this.paused && !this.disposed) {
        this.restartTimer = setTimeout(() => this.startRecognition(), 300);
      }
    };

    this.recognition = rec;
    this.running = true;
    this.callbacks.onState?.('armed');
    try {
      rec.start();
      return true;
    } catch (e) {
      this.running = false;
      this.recognition = null;
      this.callbacks.onError(`Ses tanıma başlatılamadı: ${String(e)}`);
      return false;
    }
  }

  private startRecognition(): void {
    if (!this.running || this.paused || this.disposed || !this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      // zaten çalışıyor olabilir — yok say
    }
  }

  stop(): void {
    this.disposed = true;
    this.running = false;
    this.paused = false;
    this.holdRequested = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try {
      this.recognition?.stop();
    } catch {
      // yok say
    }
    this.recognition = null;
  }

  pause(): void {
    this.holdRequested = true;
    this.paused = true;
    try {
      this.recognition?.stop();
    } catch {
      // yok say
    }
  }

  resume(): void {
    this.holdRequested = false;
    this.paused = false;
    this.callbacks.onState?.('armed');
    if (this.running && !this.disposed) {
      // recognition'ı yeniden başlat
      const Ctor = getCtor();
      if (!Ctor || !this.recognition) {
        // recognition null ise yeniden oluştur
        void this.start();
        return;
      }
      try {
        this.recognition.start();
      } catch {
        // zaten çalışıyor
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
