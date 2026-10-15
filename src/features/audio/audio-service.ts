/**
 * Ses servisi v2 — gerçek mikrofon kaydı + VAD + Groq Whisper (IPC) + TTS.
 *
 * Neden Web Speech değil: Electron'da Chromium'un konuşma tanıma servisi
 * (Google API anahtarları gömülü olmadığı için) çalışmaz. Bu yüzden ses
 * MediaRecorder ile kaydedilir ve MAIN süreçte Groq Whisper'a gönderilir.
 *
 * Gizlilik: ses diske yazılmaz; yalnızca bellekte tutulup transkripsiyon için
 * gönderilir (kullanıcı Groq anahtarını kendi ekler, ayarlarda açıkça yazar).
 *
 * Watchdog: her hata/kesinti yolunda mikrofon serbest bırakılır.
 */
import { useAssistantStore } from '../../state/assistant-store';

export interface RecordedCommand {
  audio: Blob;
  durationMs: number;
  peakLevel: number;
}

export interface RecordOptions {
  /** Azami kayıt süresi (ms). */
  maxMs?: number;
  /** Bu süre sessizlikte kayıt biter (ms). */
  silenceMs?: number;
  /** Konuşma başlamazsa bu süre içinde vazgeç (ms). */
  waitStartMs?: number;
  /** Seviye eşiği (0..1). */
  threshold?: number;
}

export type RecordOutcome =
  | { kind: 'ok'; result: RecordedCommand }
  | { kind: 'silence' } // hiç konuşma algılanmadı
  | { kind: 'error'; message: string };

const DEFAULT_THRESHOLD = 0.05;

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export class AudioService {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private currentLevel = 0;
  private recording = false;

  constructor(
    private readonly onError: (message: string) => void,
    private readonly onTtsEnd: () => void,
  ) {}

  /** Mikrofon erişimi — gerekirse açar; izin reddi dürüst hatayla bildirilir. */
  async ensureMic(): Promise<boolean> {
    if (this.stream) return true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.onError('Mikrofon bulunamadı.');
        return false;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const denied =
        e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this.onError(
        denied
          ? 'Mikrofon izni reddedildi. Windows Ayarlar → Gizlilik → Mikrofon’dan izin ver.'
          : 'Mikrofon bulunamadı.',
      );
      return false;
    }
    try {
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      this.startLevelLoop();
    } catch {
      // Analyser kurulamazsa seviye 0 kalır — görsel dürüst nefes animasyonuna düşer.
    }
    return true;
  }

  private startLevelLoop(): void {
    const data = new Uint8Array(this.analyser?.frequencyBinCount ?? 256);
    const tick = () => {
      if (this.analyser) {
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        this.currentLevel = Math.sqrt(sum / data.length) * 3;
      }
      useAssistantStore.getState().setLevels(this.currentLevel, useAssistantStore.getState().speakLevel);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /**
   * Komut kaydı — VAD eşliğinde: konuşma başlar, sessizlik gelince biter.
   * Hiç konuşma yoksa 'silence' döner (uydurma transkript yok).
   */
  async recordCommand(options: RecordOptions = {}): Promise<RecordOutcome> {
    const maxMs = options.maxMs ?? 15_000;
    const silenceMs = options.silenceMs ?? 1100;
    const waitStartMs = options.waitStartMs ?? 6000;
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;

    if (this.recording) return { kind: 'error', message: 'Zaten kayıt var.' };
    if (!(await this.ensureMic())) return { kind: 'error', message: 'Mikrofon açılamadı.' };
    if (typeof MediaRecorder === 'undefined') {
      return { kind: 'error', message: 'Bu ortamda ses kaydı desteklenmiyor.' };
    }

    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(this.stream!, mime ? { mimeType: mime } : undefined);
    } catch {
      return { kind: 'error', message: 'Ses kaydı başlatılamadı.' };
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const started = performance.now();
    this.recording = true;
    let sawSpeech = false;
    let peak = 0;
    let lastVoiceAt = started;

    return await new Promise<RecordOutcome>((resolve) => {
      let settled = false;
      const stopWatch: { fn?: () => void } = {};

      const settle = (outcome: RecordOutcome) => {
        if (settled) return;
        settled = true;
        stopWatch.fn?.();
        this.recording = false;
        resolve(outcome);
      };

      recorder.onstop = () => {
        if (!sawSpeech || chunks.length === 0) {
          settle({ kind: 'silence' });
          return;
        }
        const blob = new Blob(chunks, { type: mime || 'audio/webm' });
        settle({
          kind: 'ok',
          result: { audio: blob, durationMs: performance.now() - started, peakLevel: peak },
        });
      };

      // VAD: konuşma başlangıcı/bitişi ve süre sınırlarını izler; bitince kaydı durdurur.
      const watchId = setInterval(() => {
        const now = performance.now();
        peak = Math.max(peak, this.currentLevel);
        if (this.currentLevel >= threshold) {
          sawSpeech = true;
          lastVoiceAt = now;
        }
        const stopRecorder = () => {
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            settle({ kind: 'error', message: 'Kayıt durdurulamadı.' });
          }
        };
        if (!sawSpeech && now - started > waitStartMs) {
          stopRecorder();
          return;
        }
        if (sawSpeech && now - lastVoiceAt > silenceMs) {
          stopRecorder();
          return;
        }
        if (now - started > maxMs) {
          stopRecorder();
        }
      }, 60);
      stopWatch.fn = () => clearInterval(watchId);

      try {
        recorder.start();
      } catch {
        settle({ kind: 'error', message: 'Ses kaydı başlatılamadı.' });
      }
    });
  }

  /** Kaydı Groq Whisper ile metne çevirir (main süreç üzerinden). */
  async transcribe(audio: Blob): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
    if (!window.quatra) {
      return { ok: false, message: 'Ses tanıma yalnızca masaüstü uygulamasında çalışır.' };
    }
    try {
      const buffer = await audio.arrayBuffer();
      const res = await window.quatra.stt.transcribe(buffer, audio.type || 'audio/webm', 'tr');
      if (res.ok && res.text) return { ok: true, text: res.text };
      return { ok: false, message: res.message ?? 'Sesin anlaşılamadı.' };
    } catch {
      return { ok: false, message: 'Ses tanıma başarısız oldu.' };
    }
  }

  // ---------------------------------------------------------------- TTS

  speak(text: string, rate: number, pitch: number, voiceName: string): void {
    if (!('speechSynthesis' in window)) {
      this.onError('Bu sistemde ses çıkışı (TTS) yok. Cevap yazılı olarak gösterildi.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = rate;
    utterance.pitch = pitch;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.name === voiceName) ?? voices.find((v) => v.lang.startsWith('tr'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      useAssistantStore.getState().setStatus('speaking');
    };
    utterance.onend = () => {
      this.onTtsEnd();
    };
    utterance.onerror = () => {
      useAssistantStore.getState().setStatus('idle');
      this.onError('Ses çalınamadı — cevap ekranda gösterildi.');
      this.onTtsEnd();
    };
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  isSpeaking(): boolean {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }

  /** Gerçek cihaz sesleri — uydurma ses listesi yok. */
  availableVoices(): Array<{ name: string; lang: string }> {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
  }

  /** Watchdog: tüm kaynakları serbest bırak. */
  stopAll(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.analyser?.disconnect();
    this.analyser = null;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.recording = false;
    useAssistantStore.getState().setLevels(0, 0);
  }

  isMicOpen(): boolean {
    return this.stream !== null;
  }
}
