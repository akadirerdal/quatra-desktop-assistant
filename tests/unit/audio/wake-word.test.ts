import { describe, expect, it } from 'vitest';
import { matchesWakeWord, similarity } from '../../../src/features/audio/wake-word';

describe('matchesWakeWord', () => {
  it('tam kelimeyi yakalar', () => {
    expect(matchesWakeWord('quatra', 'quatra')).toBe(true);
    expect(matchesWakeWord('Quatra, saat kaç?', 'quatra')).toBe(true);
  });

  it('yaygın telaffuz varyantlarını yakalar', () => {
    expect(matchesWakeWord('kuatra', 'quatra')).toBe(true);
    expect(matchesWakeWord('quatro', 'quatra')).toBe(true);
    expect(matchesWakeWord('kotra', 'quatra')).toBe(true);
  });

  it('alakasız cümleyi yakalamaz', () => {
    expect(matchesWakeWord('bugün hava çok güzel', 'quatra')).toBe(false);
    expect(matchesWakeWord('takvim aç', 'quatra')).toBe(false);
  });

  it('noktalama ve büyük harf sorun değil', () => {
    expect(matchesWakeWord('  QUATRA!  ', 'quatra')).toBe(true);
  });
});

describe('similarity', () => {
  it('aynı kelimede 1, tamamen farklıda düşük döner', () => {
    expect(similarity('quatra', 'quatra')).toBe(1);
    expect(similarity('quatra', 'xyzabc')).toBeLessThan(0.3);
  });
});
