import { describe, expect, it } from 'vitest';
import {
  isGarbageNameEntry,
  parseExtractedFacts,
  shouldReplaceEntry,
} from '../../../src/services/memory/extraction';

describe('parseExtractedFacts', () => {
  it('JSON dizi ayrıştırır', () => {
    expect(parseExtractedFacts('["Kullanıcının adı: Ali", "Kullanıcı Fenerbahçeli"]')).toEqual([
      'Kullanıcının adı: Ali',
      'Kullanıcı Fenerbahçeli',
    ]);
  });

  it('{"facts":[...]} ayrıştırır', () => {
    expect(parseExtractedFacts('{"facts":["Kullanıcı 21 yaşında"]}')).toEqual([
      'Kullanıcı 21 yaşında',
    ]);
  });

  it('satır listesini ayrıştırır (madde işaretleriyle)', () => {
    expect(parseExtractedFacts('- Kullanıcının kedisi var\n- Kullanıcı çay sever')).toEqual([
      'Kullanıcının kedisi var',
      'Kullanıcı çay sever',
    ]);
  });

  it('boş/çöp girdiyi temizler', () => {
    expect(parseExtractedFacts('')).toEqual([]);
    expect(parseExtractedFacts('x')).toEqual([]);
  });
});

describe('shouldReplaceEntry', () => {
  it('isim kaydı eski değeri değiştirir', () => {
    expect(shouldReplaceEntry('Kullanıcının adı: Ali', 'Kullanıcının adı: Veli')).toBe(true);
  });

  it('farklı tür kayıtları değiştirmez', () => {
    expect(shouldReplaceEntry('Kullanıcı çay sever', 'Kullanıcının adı: Veli')).toBe(false);
  });
});

describe('isGarbageNameEntry', () => {
  it('eski bug kalıntılarını tanır', () => {
    expect(isGarbageNameEntry('Kullanıcının adı: ne')).toBe(true);
    expect(isGarbageNameEntry('Kullanıcının adı: kuatral')).toBe(true);
    expect(isGarbageNameEntry('Kullanıcının adı: ne kuatral')).toBe(true);
  });

  it('geçerli adları korur', () => {
    expect(isGarbageNameEntry('Kullanıcının adı: Ali')).toBe(false);
    expect(isGarbageNameEntry('Kullanıcı çay sever')).toBe(false);
  });
});
