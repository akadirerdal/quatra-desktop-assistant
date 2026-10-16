import { describe, expect, it } from 'vitest';
import { MIC_BAR_MIN, MIC_BAR_SPREAD, eqBarScales } from '../../../src/features/assistant/mic-eq';

describe('ekolayzır çubuk matematiği', () => {
  it('sıfır seviyede tüm çubuklar dip değerde durur (uydurma hareket yok)', () => {
    for (const s of eqBarScales(0)) expect(s).toBe(MIC_BAR_MIN);
  });

  it('tam seviyede desen büyür ve 1 tavanını aşmaz', () => {
    const s = eqBarScales(1);
    expect(s.length).toBe(MIC_BAR_SPREAD.length);
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(MIC_BAR_MIN);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...s)).toBeGreaterThan(0.9);
  });

  it('seviye arttıkça monoton büyür', () => {
    const a = eqBarScales(0.2);
    const b = eqBarScales(0.7);
    for (let i = 0; i < a.length; i += 1) expect(b[i]).toBeGreaterThanOrEqual(a[i]);
  });

  it('geçersiz girdiler güvenli (NaN / negatif / sonsuz / aşırı)', () => {
    for (const s of eqBarScales(Number.NaN)) expect(s).toBe(MIC_BAR_MIN);
    for (const s of eqBarScales(-3)) expect(s).toBe(MIC_BAR_MIN);
    for (const s of eqBarScales(Number.POSITIVE_INFINITY)) expect(s).toBe(MIC_BAR_MIN);
    for (const s of eqBarScales(9)) expect(s).toBeLessThanOrEqual(1);
  });
});
