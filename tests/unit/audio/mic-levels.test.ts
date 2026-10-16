import { describe, expect, it } from 'vitest';
import {
  GATE_HOLD_MS,
  gateDecision,
  gainValueOf,
  gateThresholdOf,
  type MicLevelStep,
} from '../../../src/features/audio/mic-levels';

describe('kademeli mikrofon ayarları', () => {
  it('kazanç kademeleri artan çarpan verir; off = etkisiz', () => {
    const levels: MicLevelStep[] = ['off', 'low', 'mid', 'high'];
    const values = levels.map(gainValueOf);
    expect(values[0]).toBe(1);
    expect(values[1]).toBeGreaterThan(1);
    expect(values[2]).toBeGreaterThan(values[1]!);
    expect(values[3]).toBeGreaterThan(values[2]!);
  });

  it('kapı eşikleri artar; off = kapı yok', () => {
    const levels: MicLevelStep[] = ['off', 'low', 'mid', 'high'];
    const values = levels.map(gateThresholdOf);
    expect(values[0]).toBe(0);
    expect(values[1]).toBeGreaterThan(0);
    expect(values[2]).toBeGreaterThan(values[1]!);
    expect(values[3]).toBeGreaterThan(values[2]!);
  });
});

describe('gürültü kapısı kararı (gateDecision)', () => {
  it('kapı kapalıyken (off) her zaman açıktır', () => {
    expect(gateDecision(0, 0, 1000, 0)).toEqual({ open: true, openUntilMs: 0 });
  });

  it('ham seviye eşiği geçince kapı açılır ve tutuş penceresi başlar', () => {
    const d = gateDecision(0.05, 0.02, 1000, 0);
    expect(d.open).toBe(true);
    expect(d.openUntilMs).toBe(1000 + GATE_HOLD_MS);
  });

  it('tutuş penceresinde sessizlikte bile açık kalır, pencere bitince kapanır', () => {
    expect(gateDecision(0, 0.02, 1000 + GATE_HOLD_MS - 1, 1000 + GATE_HOLD_MS).open).toBe(true);
    expect(gateDecision(0, 0.02, 1000 + GATE_HOLD_MS, 1000 + GATE_HOLD_MS).open).toBe(false);
  });

  it('kapı kapalıyken YENİ konuşma ham seviyeyle yeniden açar (kilitlenme yok)', () => {
    // Eski hata: seviye kazançtan SONRA ölçülüyordu → kapı kapanınca hep ~0 okunur,
    // bir daha açılamazdı. Ham seviyeyle konuşma kapıyı her zaman yeniden açar.
    const d = gateDecision(0.3, 0.02, 5000, 1200);
    expect(d.open).toBe(true);
    expect(d.openUntilMs).toBe(5000 + GATE_HOLD_MS);
  });
});
