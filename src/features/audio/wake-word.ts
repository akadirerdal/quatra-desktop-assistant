/**
 * Uyandırma kelimesi ("Quatra") — gerçek VAD + Whisper transkript ile.
 * Sürekli dinler: kısa konuşma patlamalarını kaydeder, metne çevirir,
 * içinde uyandırma kelimesi (fuzzy eşleşmeli) varsa tetikler.
 * Aynı anda komut kaydı yapılmaz; mikrofon tek noktadan yönetilir.
 */
import type { AudioService } from './audio-service';

/** Bilinen telaffuz varyantları — fuzzy eşleşmeye ek güvenlik ağı. */
const WAKE_ALIASES = [
  'quatra',
  'kuatra',
  'quatro',
  'quatre',
  'kutra',
  'katra',
  'kotra',
  'kvatra',
  'kvatra',
  'kuatre',
];

/** Normalize + bulanık eşleşme: "kuatra", "quatro", "kotra" gibi telaffuzları da yakalar. */
export function matchesWakeWord(transcript: string, wakeWord: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const target = norm(wakeWord)[0] ?? 'quatra';
  const tokens = norm(transcript);
  return tokens.some(
    (t) =>
      t === target ||
      WAKE_ALIASES.includes(t) ||
      similarity(t, target) >= 0.66 ||
      (t.length > 3 && t.includes(target)) ||
      (target.length > 3 && target.includes(t)),
  );
}

/** Küçük Levenshtein tabanlı benzerlik (0..1). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return 1 - dp[m]![n]! / Math.max(m, n);
}

export interface WakeWordCallbacks {
  onWake: (transcript: string) => void;
  onError: (message: string) => void;
  /** Dinleme döngüsü ilerledikçe durum bilgisi */
  onState?: (state: 'armed' | 'burst' | 'error') => void;
}

export interface WakeWordOptions {
  wakeWord: string;
  /** Her patlama en fazla bu kadar kaydedilir. */
  burstMaxMs?: number;
  /** Uyandıktan sonra bu süre yeni tetikleme aranmaz (komut kaydı zamanı). */
  cooldownMs?: number;
}

export class WakeWordService {
  private running = false;
  private paused = false;

  constructor(
    private readonly audio: AudioService,
    private readonly options: WakeWordOptions,
    private readonly callbacks: WakeWordCallbacks,
  ) {}

  async start(): Promise<boolean> {
    if (this.running) return true;
    const micOk = await this.audio.ensureMic();
    if (!micOk) return false;
    this.running = true;
    this.callbacks.onState?.('armed');
    void this.loop();
    return true;
  }

  stop(): void {
    this.running = false;
  }

  /** Komut dinlerken/konuşurken uyandırma aramayı duraklat. */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.callbacks.onState?.('armed');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async loop(): Promise<void> {
    const burstMaxMs = this.options.burstMaxMs ?? 3500;
    const cooldownMs = this.options.cooldownMs ?? 2500;

    while (this.running) {
      if (this.paused) {
        await sleep(300);
        continue;
      }
      this.callbacks.onState?.('armed');
      const outcome = await this.audio.recordCommand({
        maxMs: burstMaxMs,
        silenceMs: 800,
        waitStartMs: 60_000, // uzun bekleme: kullanıcı ne zaman konuşursa
        threshold: 0.06,
      });
      if (!this.running) return;
      if (outcome.kind === 'error') {
        this.callbacks.onState?.('error');
        this.callbacks.onError(outcome.message);
        await sleep(2000);
        continue;
      }
      if (outcome.kind === 'silence') {
        await sleep(150);
        continue;
      }
      this.callbacks.onState?.('burst');
      const res = await this.audio.transcribe(outcome.result.audio);
      if (!this.running) return;
      if (!res.ok) {
        this.callbacks.onState?.('error');
        this.callbacks.onError(res.message);
        await sleep(2500);
        continue;
      }
      if (matchesWakeWord(res.text, this.options.wakeWord)) {
        this.paused = true; // komut kaydı başlayana dek yeni burst yok
        this.callbacks.onWake(res.text);
        await sleep(cooldownMs);
        this.paused = false;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
