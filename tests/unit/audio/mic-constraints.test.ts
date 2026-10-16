import { describe, expect, it } from 'vitest';
import {
  buildMicConstraints,
  micPermissionHint,
  minPeakOf,
  vadThresholdOf,
} from '../../../src/features/audio/audio-service';
import { sanitizeSettings } from '../../../src/state/settings-schema';

describe('mikrofon filtreleri ve VAD', () => {
  it('varsayılan filtreler açık (gerçek getUserMedia kısıtları)', () => {
    const s = sanitizeSettings(null);
    expect(s.voice.micNoiseSuppression).toBe(true);
    expect(s.voice.micEchoCancellation).toBe(true);
    expect(s.voice.micAutoGain).toBe(true);
    expect(s.voice.vadSensitivity).toBe(5);
    expect(s.voice.bargeIn).toBe(true);
    expect(s.voice.micGainLevel).toBe('off');
    expect(s.voice.micGateLevel).toBe('off');
    expect(s.voice.inputDeviceId).toBe('');
    expect(s.voice.sleepAfterSec).toBe(5);
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

  it('seçili cihaz kısıta exact olarak girer; seçim yoksa cihaz kısıtı olmaz', () => {
    const base = { micNoiseSuppression: true, micEchoCancellation: true, micAutoGain: true };
    expect(buildMicConstraints(base, 'mic-123').deviceId).toEqual({ exact: 'mic-123' });
    expect(buildMicConstraints(base).deviceId).toBeUndefined();
  });

  it('hassasiyet arttıkça VAD eşiği düşer (daha kolay tetiklenir)', () => {
    expect(vadThresholdOf(1)).toBeGreaterThan(vadThresholdOf(10));
    expect(vadThresholdOf(5)).toBeCloseTo(0.07, 2);
  });

  it('hayalet koruması: minPeak hassasiyetle ters orantılı ve 0.1-0.22 aralığında', () => {
    expect(minPeakOf(1)).toBeGreaterThan(minPeakOf(10));
    expect(minPeakOf(5)).toBeCloseTo(0.16, 2);
    expect(minPeakOf(10)).toBeCloseTo(0.1, 2);
  });
});

describe('mikrofon izni ipucu', () => {
  it('macOS’ta Sistem Ayarları yolunu gösterir', () => {
    expect(micPermissionHint('MacIntel')).toContain('Sistem Ayarları');
    expect(micPermissionHint('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toContain(
      'Sistem Ayarları',
    );
  });

  it('Windows’ta Windows Ayarlar yolunu gösterir', () => {
    expect(micPermissionHint('Win32')).toContain('Windows Ayarlar');
  });
});
