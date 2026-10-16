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
