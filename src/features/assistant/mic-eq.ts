/**
 * Mikrofon ekolayzır — saf seviye matematiği (UI'sız, test dostu).
 * Çubuklar uydurma hareket etmez: gerçek seviye → çubuk ölçeği dönüşümü burada.
 */

/** Çubuk başına sabit çarpan — organik ama deterministik desen. */
export const MIC_BAR_SPREAD = [0.62, 1, 0.84, 0.5];

/** Çubuğun en küçük ölçeği (scaleY; 0.14 ≈ %14). */
export const MIC_BAR_MIN = 0.14;

/** Gerçek seviye (0..1) → 4 çubuk ölçeği (MIC_BAR_MIN..1). Geçersiz girdi güvenli. */
export function eqBarScales(level: number): number[] {
  const l = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  return MIC_BAR_SPREAD.map((m) => Math.min(1, Math.max(MIC_BAR_MIN, MIC_BAR_MIN + l * 0.9 * m)));
}
