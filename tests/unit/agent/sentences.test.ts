import { describe, expect, it } from 'vitest';
import { takeSentences } from '../../../src/features/agent/sentences';

describe('takeSentences — akış cümle ayırıcı', () => {
  it('tamamlanmış cümleyi ayırır, kalanı tamponda bırakır', () => {
    const r = takeSentences('Merhaba dünya. Nasılsın');
    expect(r.sentences).toEqual(['Merhaba dünya.']);
    expect(r.rest).toBe('Nasılsın');
  });

  it('metin sonundaki noktalama cümleyi tamamlar', () => {
    expect(takeSentences('Tamamdır!').sentences).toEqual(['Tamamdır!']);
  });

  it('ara sayıları bölmez (3.5)', () => {
    const r = takeSentences('Fiyat 3.5 TL.');
    expect(r.sentences).toEqual(['Fiyat 3.5 TL.']);
  });

  it('force=true akış bitince kalanı tek parça döner', () => {
    const r = takeSentences('devamı var', true);
    expect(r.sentences).toEqual(['devamı var']);
    expect(r.rest).toBe('');
  });

  it('birden fazla cümleyi sırayla ayırır', () => {
    const r = takeSentences('Bir. İki? Üç… kalan');
    expect(r.sentences).toEqual(['Bir.', 'İki?', 'Üç…']);
    expect(r.rest).toBe('kalan');
  });

  it('boş tamponda hiçbir şey döndürmez', () => {
    expect(takeSentences('').sentences).toEqual([]);
    expect(takeSentences('  ', true).sentences).toEqual([]);
  });
});
