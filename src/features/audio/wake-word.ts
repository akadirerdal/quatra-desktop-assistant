/**
 * Uyandırma kelimesi ("Quatra") — gerçek VAD + Whisper transkript ile.
 * Sürekli dinler: kısa konuşma patlamalarını kaydeder, metne çevirir,
 * içinde uyandırma kelimesi (fuzzy eşleşmeli) varsa tetikler.
 * Aynı anda komut kaydı yapılmaz; mikrofon tek noktadan yönetilir.
 */
import type { AudioService } from './audio-service';

/** Bilinen telaffuz varyantları — fuzzy eşleşmeye ek güvenlik ağı (yalnız VARSAYILAN kelimede). */
const WAKE_ALIASES = [
  'quatra',
  'kuatra',
  'quatro',
  'quatre',
  'kutra',
  'katra',
  'kotra',
  'kvatra',
  'kuatre',
  'quadra',
  'kwadra',
  'cuatra',
  'quatru',
  'kwatera',
  'quadrat',
];

/** Telaffuz alias'ları yalnızca varsayılan kelime için geçerli — kullanıcı özel kelime seçtiyse uygulanmaz. */
function aliasesFor(target: string): readonly string[] {
  return target === 'quatra' ? WAKE_ALIASES : [];
}

/** Normalize + bulanık eşleşme: "kuatra", "quatro", "kotra" gibi telaffuzları da yakalar. */
export function matchesWakeWord(transcript: string, wakeWord: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const target = norm(wakeWord)[0] ?? 'quatra';
  const aliases = aliasesFor(target);
  const tokens = norm(transcript);
  return tokens.some(
    (t) =>
      t === target ||
      aliases.includes(t) ||
      (t.length >= 4 &&
        (t[0] === 'q' || t[0] === 'k' || t[0] === 'c') &&
        similarity(t, target) >= 0.5) ||
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

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Ham metindeki kelimeleri bitiş konumlarıyla döner (uyandırma sonrası dilim için). */
function tokenizeWithEnd(s: string): Array<{ token: string; end: number }> {
  const out: Array<{ token: string; end: number }> = [];
  for (const m of s.matchAll(/[\p{L}\p{N}]+/gu)) {
    out.push({ token: m[0].toLowerCase(), end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

/**
 * "quatra benim adım Ali" → uyandırma kelimesinden SONRASINI komut olarak döner.
 * Böylece bütün cümle tek seferde yakalanır; kullanıcı iki kez konuşmak zorunda kalmaz.
 */
export function extractCommandAfterWake(transcript: string, wakeWord: string): string {
  const target = tokenize(wakeWord)[0] ?? 'quatra';
  const aliases = aliasesFor(target);
  const hit = tokenizeWithEnd(transcript).find(
    ({ token }) => token === target || aliases.includes(token) || similarity(token, target) >= 0.66,
  );
  if (!hit) return '';
  // Dilim HAM metinden yapılır: normalize token indeksini ham split'e uygulamak
  // noktalama yüzünden kayıyor, komuta uyandırma kelimesi/tire kalıyordu.
  // Yalnız baş/son noktalama-bozluk kalıntısı temizlenir (kelime içi korunur).
  return transcript
    .slice(hit.end)
    .replace(/^[\s\p{P}\p{S}]+/u, '')
    .replace(/[\s\p{P}\p{S}]+$/u, '');
}

export interface WakeWordCallbacks {
  onWake: (transcript: string) => void;
  onError: (message: string) => void;
  /** Dinleme döngüsü ilerledikçe durum bilgisi */
  onState?: (state: 'armed' | 'burst' | 'error') => void;
  /** Her burst transkripti (teşhis için) — uyandırma eşleşmese de loglanır. */
  onTranscript?: (text: string) => void;
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
  /** Dış istek (sohbet) mikrofonu tutuyorsa cooldown sonrası otomatik açılma engellenir. */
  private holdRequested = false;
  /** Başlatma sözü — hızlı ardışık start() çağrıları iki dinleme döngüsü açmasın (single-flight). */
  private starting: Promise<boolean> | null = null;
  /** start() beklerken stop() çağrılırsa başlatma iptal edilir. */
  private startToken = 0;
  /** V1.2-mic: sustur/hold unutulursa mikrofon sonsuza dek kapalı kalmasın — güvenlik ağı. */
  private holdSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly audio: AudioService,
    private readonly options: WakeWordOptions,
    private readonly callbacks: WakeWordCallbacks,
  ) {}

  async start(): Promise<boolean> {
    if (this.running) return true;
    if (!this.starting) {
      const token = ++this.startToken;
      this.starting = (async () => {
        const micOk = await this.audio.ensureMic();
        // Bu sırada stop() çağrıldıysa mikrofon açıldıysa bile dinleme başlatılmaz.
        if (!micOk || token !== this.startToken) return false;
        this.running = true;
        this.callbacks.onState?.('armed');
        void this.loop();
        return true;
      })().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  stop(): void {
    this.startToken += 1; // bekleyen start() iptal
    this.running = false;
    if (this.holdSafetyTimer) {
      clearTimeout(this.holdSafetyTimer);
      this.holdSafetyTimer = null;
    }
    // Bloke eden recordCommand'ı hemen sonlandır (V1.2-001): aksi hâlde eski
    // servis döngüsü 60 sn daha dinlemeye devam eder ve dispose edilmiş
    // controller üzerinde onWake tetikler.
    try {
      this.audio.cancelRecording();
    } catch {
      // sessiz
    }
  }

  /** Sohbet/komut sırasında uyandırma aramayı duraklat (cooldown sonrası açılmaz). */
  pause(): void {
    this.holdRequested = true;
    this.paused = true;
    // Güvenlik ağı: controller resume çağırmayı unutsa bile mikrofon 20 sn sonra yeniden devreye girsin.
    if (this.holdSafetyTimer) clearTimeout(this.holdSafetyTimer);
    this.holdSafetyTimer = setTimeout(() => {
      this.holdSafetyTimer = null;
      if (this.running && this.holdRequested) {
        this.holdRequested = false;
        this.paused = false;
        this.callbacks.onState?.('armed');
      }
    }, 20_000);
  }

  resume(): void {
    if (this.holdSafetyTimer) {
      clearTimeout(this.holdSafetyTimer);
      this.holdSafetyTimer = null;
    }
    this.holdRequested = false;
    this.paused = false;
    this.callbacks.onState?.('armed');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async loop(): Promise<void> {
    const burstMaxMs = this.options.burstMaxMs ?? 2000;
    const cooldownMs = this.options.cooldownMs ?? 2500;

    while (this.running) {
      if (this.paused) {
        // Güvenlik ağı: holdRequested temizlendi ama paused unutulduysa kendini toparla.
        if (!this.holdRequested && !this.audio.isRecording()) {
          this.paused = false;
          this.callbacks.onState?.('armed');
        } else {
          await sleep(300);
          if (!this.running) return;
          continue;
        }
      }
      this.callbacks.onState?.('armed');
      const outcome = await this.audio.recordCommand({
        maxMs: burstMaxMs,
        silenceMs: 500,
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
      if (outcome.kind === 'busy') {
        // Başka bir kayıt sürüyor (komut/sohbet) — hata değil; sessizce bekle.
        await sleep(400);
        continue;
      }
      if (outcome.kind === 'silence') {
        await sleep(150);
        if (!this.running) return;
        continue;
      }
      // Çok kısa/sessiz patlamaları Whisper'a gönderme — gereksiz istek + rate limit (V1.2-mic).
      if (
        outcome.kind === 'ok' &&
        (outcome.result.durationMs < 700 || outcome.result.peakLevel < 0.15)
      ) {
        await sleep(150);
        continue;
      }
      this.callbacks.onState?.('burst');
      const res = await this.audio.transcribe(outcome.result.audio, 'en');
      if (!this.running) return;
      this.callbacks.onTranscript?.(res.ok ? res.text : `[HATA: ${res.message}]`);
      if (!res.ok) {
        this.callbacks.onState?.('error');
        this.callbacks.onError(res.message);
        // Hız limitinde Groq kotası dolmuş — 15 sn bekle, arka arkaya istek atma.
        const rateLimited = /hız limiti|rate.?limit|429/i.test(res.message);
        await sleep(rateLimited ? 15000 : 2500);
        if (!this.running) return;
        continue;
      }
      const matched = matchesWakeWord(res.text, this.options.wakeWord);
      if (matched) this.callbacks.onTranscript?.(`>>> EŞLEŞTİ (${this.options.wakeWord})`);
      if (matched) {
        this.paused = true; // komut akışı bitene dek yeni burst yok
        try {
          this.callbacks.onWake(res.text);
        } catch (e) {
          this.callbacks.onError(`onWake hatası: ${String(e)}`);
        }
        await sleep(cooldownMs);
        if (!this.running) return;
        if (!this.holdRequested) this.paused = false;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
