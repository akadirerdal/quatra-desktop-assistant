import { describe, expect, it } from 'vitest';
import { buildMicConstraints, vadThresholdOf } from '../../../src/features/audio/audio-service';
import { sanitizeSettings } from '../../../src/state/settings-schema';

describe('mikrofon filtreleri ve VAD', () => {
  it('varsayılan filtreler açık (gerçek getUserMedia kısıtları)', () => {
    const s = sanitizeSettings(null);
    expect(s.voice.micNoiseSuppression).toBe(true);
    expect(s.voice.micEchoCancellation).toBe(true);
    expect(s.voice.micAutoGain).toBe(true);
    expect(s.voice.vadSensitivity).toBe(5);
    expect(s.voice.bargeIn).toBe(true);
    expect(s.memory.enabled).toBe(true);
  });

  it('kısıt üretici ayarları yansıtır', () => {
    const c = buildMicConstraints({
      micNoiseSuppression: false,
      micEchoCancellation: true,
      micAutoGain: false,
    });
    expect(c.noiseSuppression).toBe(false);
    expect(c.echoCancellation).toBe(true);
    expect(c.autoGainControl).toBe(false);
    expect(c.channelCount).toBe(1);
  });

  it('hassasiyet arttıkça VAD eşiği düşer (daha kolay tetiklenir)', () => {
    expect(vadThresholdOf(1)).toBeGreaterThan(vadThresholdOf(10));
    expect(vadThresholdOf(5)).toBeCloseTo(0.07, 2);
  });
});
