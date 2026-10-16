import { describe, expect, it } from 'vitest';
import {
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
