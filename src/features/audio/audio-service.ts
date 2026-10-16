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
import { useSettingsStore } from '../../state/settings-store';
import { gainValueOf, gateDecision, gateThresholdOf } from './mic-levels';

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
  /** Sabit süre kayıt (mikrofon testi): sessizlik/konuşma kurallarını atlar, bu süre sonunda durur. */
  fixedMs?: number;
}

export type RecordOutcome =
  | { kind: 'ok'; result: RecordedCommand }
  | { kind: 'silence' } // hiç konuşma algılanmadı
  | { kind: 'busy' } // başka bir kayıt sürüyor (hata değil; caller bekler/atlar)
  | { kind: 'error'; message: string };

/** Hassasiyet (1..10) → VAD eşiği (düşük değer = daha hassas). */
export function buildMicConstraints(
  voice: {
    micNoiseSuppression: boolean;
    micEchoCancellation: boolean;
    micAutoGain: boolean;
  },
  deviceId = '',
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: voice.micEchoCancellation,
    noiseSuppression: voice.micNoiseSuppression,
    autoGainControl: voice.micAutoGain,
    channelCount: 1,
  };
  if (deviceId) constraints.deviceId = { exact: deviceId };
  return constraints;
}

/** Hassasiyet (1..10) → VAD eşiği (düşük değer = daha hassas). */
export function vadThresholdOf(sensitivity: number): number {
  const s = Math.min(10, Math.max(1, sensitivity));
  return 0.03 + (10 - s) * 0.008; // 1 → 0.102 · 5 → 0.07 · 10 → 0.03
}

/** Hayalet transkript koruması: bu tepe seviyesinin altındaki kayıtlar sessizlik sayılır. */
export function minPeakOf(sensitivity: number): number {
  const s = Math.min(10, Math.max(1, sensitivity));
  return 0.10 + (10 - s) * 0.012; // 5 → 0.16 · 10 → 0.10 · 1 → 0.208
}

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
  private gainNode: GainNode | null = null;
  private processedStream: MediaStream | null = null;
  private gateOpenUntil = 0;
  private lastResumeAt = 0;
  private raf = 0;
  private currentLevel = 0;
  private recording = false;
  private cancelRequested = false;
  private playCtx: AudioContext | null = null;
  private playingSource: AudioBufferSourceNode | null = null;
  private speakRaf = 0;
  private speakSeq = 0;
  private speakQueue: Array<{ text: string; rate: number; pitch: number; voiceName: string }> = [];
  private pendingPlay = false;
  private playStartedAt = 0;
  private burstMs = 0;
  private bargeFired = false;
  private bargeLogCount = 0;
  private bargeLastLogAt = 0;
  private bargeCallback: (() => void) | null = null;

  /** Söz kesme işleyicisi — mikrofon döngüsü kullanıcı konuşmasını yakalayınca çağırır. */
  setBargeHandler(cb: (() => void) | null): void {
    this.bargeCallback = cb;
  }

  constructor(
    private readonly onError: (message: string) => void,
    private readonly onTtsEnd: () => void,
    private readonly onLog?: (message: string) => void,
  ) {}

  private logEvent(message: string): void {
    this.onLog?.(message);
  }

  /** Mikrofon erişimi — gerekirse açar; izin reddi dürüst hatayla bildirilir. */
  async ensureMic(): Promise<boolean> {
    // Ölü akış: cihaz çıkarıldıysa/değiştiyse track 'ended' olur; o akışla kayıt
    // sonsuza dek sessiz kalırdı → bırak ve yeniden aç.
    if (this.stream && !this.stream.getAudioTracks().some((t) => t.readyState === 'live')) {
      this.logEvent('mikrofon akışı koptu (cihaz değişimi) — yeniden açılıyor');
      this.releaseMic();
    }
    if (this.stream) return true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.onError('Mikrofon bulunamadı.');
        return false;
      }
      const voice = useSettingsStore.getState().settings.voice;
      const constraints = buildMicConstraints(voice, voice.inputDeviceId);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      } catch (e) {
        // Seçili cihaz artık yoksa varsayılana düş — dürüst günlükle.
        if (e instanceof DOMException && e.name === 'OverconstrainedError' && voice.inputDeviceId) {
          this.logEvent('seçili mikrofon bulunamadı — varsayılan cihaza düşüldü');
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: buildMicConstraints(voice),
          });
        } else {
          throw e;
        }
      }
      this.logEvent(
        `mic açıldı — gürültü:${constraints.noiseSuppression ? 'A' : 'K'} yankı:${constraints.echoCancellation ? 'A' : 'K'} kazanç:${constraints.autoGainControl ? 'A' : 'K'} cihaz:${voice.inputDeviceId ? 'seçili' : 'varsayılan'}`,
      );
    } catch (e) {
      const denied =
        e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this.logEvent(`mic HATA: ${denied ? 'izin reddedildi' : String(e)}`);
      this.onError(
        denied
          ? 'Mikrofon izni reddedildi. Windows Ayarlar → Gizlilik → Mikrofon’dan izin ver.'
          : 'Mikrofon bulunamadı.',
      );
      return false;
    }
    try {
      this.audioCtx = new AudioContext();
      // Askıya alınmış bağlam (cihaz değişimi, uyku/uyanma sonrası) sesi tümden keser.
      if ((this.audioCtx.state as string) !== 'running') {
        void this.audioCtx.resume().catch(() => undefined);
      }
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      // Kayıt zinciri: kaynak → kazanç → kayıt çıkışı.
      // Analyser HAM kaynağa bağlanır (kazançtan ÖNCE): VAD, barge-in ve gürültü
      // kapısı kararı ham seviyeye göre verilir. Kazançtan SONRA ölçülseydi kapı
      // kapandığı an seviye ~0 okunur ve kapı bir daha açılamazdı (kilitlenme).
      this.gainNode = this.audioCtx.createGain();
      const dest = this.audioCtx.createMediaStreamDestination();
      source.connect(this.analyser);
      source.connect(this.gainNode);
      this.gainNode.connect(dest);
      this.processedStream = dest.stream;
      this.startLevelLoop();
    } catch {
      // WebAudio kurulamazsa seviye 0 kalır — görsel dürüst nefes animasyonuna düşer.
    }
    return true;
  }

  private startLevelLoop(): void {
    const data = new Uint8Array(this.analyser?.frequencyBinCount ?? 256);
    let lastTick = performance.now();
    const tick = () => {
      if (this.analyser) {
        const now = performance.now();
        // Bağlam sonradan askıya düşerse (cihaz değişimi / uyku sonrası) kendiliğinden
        // toparla — askıdaki bağlam tam sessizlik üretir, mikrofon "ölü" görünür.
        if (
          this.audioCtx &&
          (this.audioCtx.state as string) !== 'running' &&
          now - this.lastResumeAt > 1500
        ) {
          this.lastResumeAt = now;
          void this.audioCtx.resume().catch(() => undefined);
        }
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        this.currentLevel = Math.sqrt(sum / data.length) * 3;

        // ---- Yazılım katmanı: kademeli ek kazanç + gürültü kapısı ----
        // Karar HAM seviyeyle verilir (analyser kazançtan önce tap'li) — kapı kendini kilitleyemez.
        if (this.gainNode && this.audioCtx) {
          const voice = useSettingsStore.getState().settings.voice;
          const gain = gainValueOf(voice.micGainLevel);
          const gate = gateThresholdOf(voice.micGateLevel);
          const decision = gateDecision(this.currentLevel, gate, now, this.gateOpenUntil);
          this.gateOpenUntil = decision.openUntilMs;
          this.gainNode.gain.setTargetAtTime(
            decision.open ? gain : 0,
            this.audioCtx.currentTime,
            0.04,
          );
        }

        // ---- Barge-in tespiti (söz kesme) ----
        // Bu döngü her karede çalıştığı için React durumundan bağımsız, kaçırılamaz.
        const dt = Math.min(now - lastTick, 100);
        lastTick = now;
        if (
          this.bargeCallback &&
          !this.bargeFired &&
          (this.pendingPlay || this.playingSource !== null)
        ) {
          const voice = useSettingsStore.getState().settings.voice;
          if (voice.bargeIn && now - this.playStartedAt > 600) {
            const thr = vadThresholdOf(voice.vadSensitivity) * 0.85;
            const loud = this.currentLevel > 0.3; // kesin kullanıcı sesi: hızlı tetikleme
            if (this.currentLevel > thr || loud) {
              this.burstMs += loud ? dt * 2 : dt;
            } else {
              this.burstMs = 0;
            }
            // Teşhis: saniyede bir seviye/eşik durumu (en fazla 5 satır).
            if (this.bargeLogCount < 5 && now - this.bargeLastLogAt > 1000) {
              this.bargeLastLogAt = now;
              this.bargeLogCount += 1;
              this.logEvent(
                `barge-izleme: seviye=${this.currentLevel.toFixed(2)} eşik=${thr.toFixed(3)} birikim=${this.burstMs.toFixed(0)}ms`,
              );
            }
            if (this.burstMs > 250) {
              this.bargeFired = true;
              this.burstMs = 0;
              this.logEvent('barge: kullanıcı konuşuyor — çalma durdurulacak');
              this.bargeCallback();
            }
          }
        }
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
    const fixedMs = options.fixedMs;

    if (this.recording) return { kind: 'busy' };
    if (!(await this.ensureMic())) return { kind: 'error', message: 'Mikrofon açılamadı.' };
    if (typeof MediaRecorder === 'undefined') {
      return { kind: 'error', message: 'Bu ortamda ses kaydı desteklenmiyor.' };
    }

    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      // Kayıt İŞLENMİŞ akıştan alınır (ek kazanç + gürültü kapısı gerçekten uygulanır).
      recorder = new MediaRecorder(
        this.processedStream ?? this.stream!,
        mime ? { mimeType: mime } : undefined,
      );
    } catch {
      return { kind: 'error', message: 'Ses kaydı başlatılamadı.' };
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const started = performance.now();
    this.recording = true;
    this.cancelRequested = false;
    let sawSpeech = false;
    let peak = 0;
    let lastVoiceAt = started;
    // Uyarlanabilir gürültü tabanı: sessiz ortam seviyesini ölçer, eşiği ona göre yükseltir.
    let ambient = 0.04;
    const baseThreshold =
      options.threshold ?? vadThresholdOf(useSettingsStore.getState().settings.voice.vadSensitivity);
    const minPeak = minPeakOf(useSettingsStore.getState().settings.voice.vadSensitivity);

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
        const fixed = fixedMs !== undefined;
        const silent = !sawSpeech && !fixed;
        const tooQuiet = !fixed && peak < minPeak;
        const effectiveOutcome = this.cancelRequested
          ? 'iptal'
          : silent
            ? 'sessizlik'
            : tooQuiet
              ? `çok-sessiz(tepe=${peak.toFixed(2)}<${minPeak.toFixed(2)})`
              : null;
        if (this.cancelRequested || chunks.length === 0 || silent || tooQuiet) {
          this.cancelRequested = false;
          this.logEvent(`kayıt sonu: ${effectiveOutcome ?? 'sessizlik'}`);
          settle({ kind: 'silence' });
          return;
        }
        const blob = new Blob(chunks, { type: mime || 'audio/webm' });
        const durationMs = performance.now() - started;
        this.logEvent(`kayıt tamam: ${Math.round(durationMs)}ms, tepe=${peak.toFixed(2)}`);
        settle({
          kind: 'ok',
          result: { audio: blob, durationMs, peakLevel: peak },
        });
      };

      // VAD: konuşma başlangıcı/bitişi ve süre sınırlarını izler; bitince kaydı durdurur.
      const watchId = setInterval(() => {
        const now = performance.now();
        peak = Math.max(peak, this.currentLevel);
        // Uyarlanabilir eşik: ortam gürültüsü yükselirse hayalet tetikleme engellenir.
        const effectiveThreshold = Math.max(baseThreshold, ambient * 2.8);
        if (this.currentLevel >= effectiveThreshold) {
          sawSpeech = true;
          lastVoiceAt = now;
        } else if (this.currentLevel < baseThreshold) {
          ambient = ambient * 0.92 + this.currentLevel * 0.08;
        }
        const stopRecorder = () => {
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            settle({ kind: 'error', message: 'Kayıt durdurulamadı.' });
          }
        };
        if (this.cancelRequested) {
          stopRecorder();
          return;
        }
        // Sabit süreli kayıt (mikrofon testi): süre dolunca koşulsuz dur — VAD kuralları devre dışı.
        if (fixedMs !== undefined && now - started > fixedMs) {
          stopRecorder();
          return;
        }
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

  /** Devam eden kaydı nazikçe iptal et (uyandırma → PTT geçişi gibi). */
  cancelRecording(): void {
    if (!this.recording) return;
    this.cancelRequested = true;
    // watch döngüsü 60ms'de bir çalışır; recorder'ı hemen durduracak bir işaret yeterli değil,
    // bu yüzden stop'u doğrudan tetiklemek için kısa bir yol: recording bayrağını bırakma onstop'ta olur.
  }

  isRecording(): boolean {
    return this.recording;
  }

  /** Kaydı Groq Whisper ile metne çevirir (main süreç üzerinden). */
  async transcribe(audio: Blob): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
    if (!window.quatra) {
      return { ok: false, message: 'Ses tanıma yalnızca masaüstü uygulamasında çalışır.' };
    }
    try {
      const started = Date.now();
      const buffer = await audio.arrayBuffer();
      const res = await window.quatra.stt.transcribe(buffer, audio.type || 'audio/webm', 'tr');
      if (res.ok && res.text) {
        this.logEvent(`STT ok (${Date.now() - started}ms)`);
        return { ok: true, text: res.text };
      }
      this.logEvent(`STT HATA: ${res.message ?? 'boş sonuç'}`);
      return { ok: false, message: res.message ?? 'Sesin anlaşılamadı.' };
    } catch {
      this.logEvent('STT HATA: istisna');
      return { ok: false, message: 'Ses tanıma başarısız oldu.' };
    }
  }

  // ---------------------------------------------------------------- TTS

  /** Motor dağıtıcı: Edge Neural (önerilen) veya sistem TTS'i.
   *  Konuşma sürerken gelen metinler SIRAYA alınır → streaming cümleleri akıcı okunur. */
  speak(text: string, rate: number, pitch: number, voiceName: string): void {
    if (this.isSpeaking() || this.pendingPlay) {
      this.speakQueue.push({ text, rate, pitch, voiceName });
      return;
    }
    this.startSpeak(text, rate, pitch, voiceName);
  }

  private startSpeak(text: string, rate: number, pitch: number, voiceName: string): void {
    // Durum HEMEN 'speaking' olur; barge-in sentez beklerken de çalışır.
    const seq = ++this.speakSeq;
    this.pendingPlay = true;
    this.bargeFired = false;
    // performance.now() — barge tespitindeki zaman karşılaştırmalarıyla AYNI taban (Date.now değil!).
    this.playStartedAt = performance.now();
    this.bargeLogCount = 0;
    useAssistantStore.getState().setStatus('speaking');
    const engine = useSettingsStore.getState().settings.voice.ttsEngine;
    if (engine === 'edge' && window.quatra) {
      void this.speakEdge(text, rate, pitch, voiceName, seq);
      return;
    }
    this.speakSystem(text, rate, pitch, voiceName, seq);
  }

  /** Sıradaki cümleye geç; kuyruk bittiyse konuşma turu KAPANIR (onTtsEnd). */
  private nextSpeak(): void {
    const next = this.speakQueue.shift();
    if (next) {
      this.startSpeak(next.text, next.rate, next.pitch, next.voiceName);
      return;
    }
    this.onTtsEnd();
  }

  /**
   * Edge Neural oynatma — GERÇEK çıkış analyser'ı ile (speakLevel gerçek sinyal olur).
   * Hata durumunda oturum akışı ölmez: sistem TTS'ine düşer.
   */
  private async speakEdge(
    text: string,
    rate: number,
    pitch: number,
    voiceName: string,
    seq: number,
  ): Promise<void> {
    this.logEvent(`TTS: Edge (${voiceName || 'otomatik'})`);
    const res = await window.quatra?.tts.synthesize(text, voiceName, rate, pitch);
    if (seq !== this.speakSeq) {
      this.pendingPlay = false;
      return; // araya yeni komut/işlem girdi — çalma
    }
    if (!res || !res.ok || !res.audio) {
      this.logEvent(`TTS Edge HATA: ${res?.message ?? 'boş'} → sistem sesine düşüldü`);
      this.onError(
        res?.message
          ? `${res.message} — sistem sesine geçildi.`
          : 'Edge sesi alınamadı — sistem sesine geçildi.',
      );
      this.speakSystem(text, rate, pitch, voiceName, seq);
      return;
    }
    try {
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(res.audio.slice(0));
      if (seq !== this.speakSeq) {
        this.pendingPlay = false;
        void ctx.close().catch(() => undefined);
        return; // iptal edildi — çalma
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const outAnalyser = ctx.createAnalyser();
      outAnalyser.fftSize = 256;
      source.connect(outAnalyser);
      outAnalyser.connect(ctx.destination);
      this.playCtx = ctx;
      this.playingSource = source;
      this.pendingPlay = false; // gerçek çalma başladı — barge playingSource üzerinden izlenir

      const data = new Uint8Array(outAnalyser.frequencyBinCount);
      useAssistantStore.getState().setStatus('speaking');
      const tick = () => {
        outAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
        const st = useAssistantStore.getState();
        st.setLevels(st.micLevel, rms);
        this.speakRaf = requestAnimationFrame(tick);
      };
      this.speakRaf = requestAnimationFrame(tick);

      const finish = () => {
        cancelAnimationFrame(this.speakRaf);
        this.speakRaf = 0;
        this.playingSource = null;
        this.pendingPlay = false;
        void ctx.close().catch(() => undefined);
        this.playCtx = null;
        const st = useAssistantStore.getState();
        st.setLevels(st.micLevel, 0);
        this.nextSpeak();
      };
      source.onended = finish;
      source.start();
    } catch {
      this.onError('Ses çözülemedi — sistem sesine geçildi.');
      this.speakSystem(text, rate, pitch, voiceName, seq);
    }
  }

  /** Sistem TTS'i (çevrimdışı yedek). */
  private speakSystem(text: string, rate: number, pitch: number, voiceName: string, seq: number): void {
    if (!('speechSynthesis' in window)) {
      this.onError('Bu sistemde ses çıkışı (TTS) yok. Cevap yazılı olarak gösterildi.');
      this.nextSpeak(); // kuyruk kilitli kalmasın
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
      if (seq !== this.speakSeq) return;
      useAssistantStore.getState().setStatus('speaking');
    };
    utterance.onend = () => {
      this.pendingPlay = false;
      if (seq !== this.speakSeq) return;
      this.nextSpeak();
    };
    utterance.onerror = () => {
      this.pendingPlay = false;
      if (seq !== this.speakSeq) return;
      useAssistantStore.getState().setStatus('idle');
      this.onError('Ses çalınamadı — cevap ekranda gösterildi.');
      this.nextSpeak();
    };
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    this.speakSeq += 1; // devam eden/gelmekte olan oynatmayı iptal et
    this.speakQueue = []; // sırada bekleyen (streaming) cümleler de iptal
    this.pendingPlay = false;
    this.bargeFired = true; // bu konuşma turu için tekrar tetikleme
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try {
      if (this.playingSource) {
        this.playingSource.onended = null;
        this.playingSource.stop();
        this.playingSource = null;
      }
      cancelAnimationFrame(this.speakRaf);
      this.speakRaf = 0;
      void this.playCtx?.close().catch(() => undefined);
      this.playCtx = null;
    } catch {
      // yok say
    }
  }

  isSpeaking(): boolean {
    return (
      ('speechSynthesis' in window && window.speechSynthesis.speaking) || this.playingSource !== null
    );
  }

  /** Gerçek cihaz sesleri — uydurma ses listesi yok. */
  availableVoices(): Array<{ name: string; lang: string }> {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
  }

  /** Mikrofon kaynaklarını serbest bırak (idempotent; gerekirse yeniden açılır). */
  private releaseMic(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    try {
      this.analyser?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      // düğüm zaten kopuksa yok say
    }
    this.analyser = null;
    this.gainNode = null;
    this.processedStream = null;
    this.gateOpenUntil = 0;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.currentLevel = 0;
    useAssistantStore.getState().setLevels(0, 0);
  }

  /** Watchdog: tüm kaynakları serbest bırak. */
  stopAll(): void {
    this.stopSpeaking();
    this.releaseMic();
    this.recording = false;
  }

  isMicOpen(): boolean {
    return this.stream !== null;
  }

  /** Aktif mikrofonun etiketi (izin sonrası gerçek ad; yoksa dürüst genel ad). */
  activeMicLabel(): string {
    const track = this.stream?.getAudioTracks()[0];
    return track?.label || 'Varsayılan mikrofon';
  }
}
