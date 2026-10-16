/**
 * Kademeli mikrofon ayarları — yazılım kazanç ve gürültü kapısı eşlemeleri.
 * Saf fonksiyonlar; kayıt zincirinde gerçekten uygulanır, testlerde doğrulanır.
 */

export type MicLevelStep = 'off' | 'low' | 'mid' | 'high';

/** Yazılım kazanç çarpanı (1 = değişiklik yok). */
export function gainValueOf(level: MicLevelStep): number {
  switch (level) {
    case 'low':
      return 1.5;
    case 'mid':
      return 2.2;
    case 'high':
      return 3.2;
    default:
      return 1;
  }
}

/** Gürültü kapısı eşiği (0 = kapı yok; bu RMS altındaki anlar kayıtta kısılır). */
export function gateThresholdOf(level: MicLevelStep): number {
  switch (level) {
    case 'low':
      return 0.02;
    case 'mid':
      return 0.035;
    case 'high':
      return 0.055;
    default:
      return 0;
  }
}

/** Kapı açıldıktan sonra kısa sessizliklerde açık kalma süresi (hece araları kapanmasın). */
export const GATE_HOLD_MS = 400;

/**
 * Gürültü kapısının tek karelik kararı — yalnızca HAM seviye ile çağrılır.
 * Kazançtan sonra ölçülürse kapı kapandığı an seviye ~0 okunur ve bir daha
 * açılamaz (kendini kilitler). Ham seviye eşiği geçince tutuş penceresi yenilenir.
 */
export function gateDecision(
  rawLevel: number,
  gate: number,
  nowMs: number,
  openUntilMs: number,
): { open: boolean; openUntilMs: number } {
  if (gate === 0) return { open: true, openUntilMs: 0 };
  if (rawLevel >= gate) return { open: true, openUntilMs: nowMs + GATE_HOLD_MS };
  return { open: nowMs < openUntilMs, openUntilMs };
}
