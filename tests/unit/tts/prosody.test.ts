import { describe, expect, it } from 'vitest';
import { prosodyOf } from '../../../electron/tts-service';

describe('Edge TTS prosody eşlemesi', () => {
  it('nötr değerler +0% / +0Hz olur', () => {
    expect(prosodyOf(1, 1)).toEqual({ rate: '+0%', pitch: '+0Hz' });
  });

  it('hız çarpanı yüzdeye çevrilir', () => {
    expect(prosodyOf(1.5, 1).rate).toBe('+50%');
    expect(prosodyOf(0.5, 1).rate).toBe('-50%');
  });

  it('perde Hz cinsine çevrilir', () => {
    expect(prosodyOf(1, 1.2).pitch).toBe('+10Hz');
    expect(prosodyOf(1, 0.8).pitch).toBe('-10Hz');
  });
});
