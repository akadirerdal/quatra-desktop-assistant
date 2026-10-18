import { describe, expect, it } from 'vitest';
import {
  hasMemorySignal,
  isGarbageEntry,
  isNearDuplicate,
  normalizeForCompare,
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
    expect(parseExtractedFacts('[]')).toEqual([]);
  });

  it('dizideki string olmayan elemanları atar ("[object Object]" yazılmaz)', () => {
    expect(
      parseExtractedFacts('[{"fact":"Kullanıcı 21 yaşında"}, "Kullanıcı Fenerbahçeli"]'),
    ).toEqual(['Kullanıcı Fenerbahçeli']);
    expect(parseExtractedFacts('{"facts":["Kullanıcı çay sever",{"fact":"x"}]}')).toEqual([
      'Kullanıcı çay sever',
    ]);
  });
});

describe('hasMemorySignal', () => {
  it('kişisel bilgi mesajlarını tanır', () => {
    expect(hasMemorySignal('benim adım Ali')).toBe(true);
    expect(hasMemorySignal('kedim Karabaş çok tatlı')).toBe(true);
    expect(hasMemorySignal('çayı şekersiz severim')).toBe(true);
    expect(hasMemorySignal('hatırla: yarın toplantı var')).toBe(true);
  });

  it('Türkçe harfle başlayan ekleri de tanır (ASCII \\b kaçağı)', () => {
    // "şehrim" ş ile başladığı için eski /\\b...\\b/ deseniyle hiç eşleşmiyordu (V1.2-115).
    expect(hasMemorySignal('şehrim İstanbul')).toBe(true);
    expect(hasMemorySignal('çok seviyorum bu şarkıyı')).toBe(true);
  });

  it('günlük sohbeti sinyal saymaz', () => {
    expect(hasMemorySignal('bugün hava nasıl')).toBe(false);
    expect(hasMemorySignal('saat kaç')).toBe(false);
    expect(hasMemorySignal('teşekkürler')).toBe(false);
  });
});

describe('normalizeForCompare', () => {
  it('Türkçe İ/ı tutarlılığını sağlar', () => {
    expect(normalizeForCompare('İstanbul')).toBe('istanbul');
    expect(normalizeForCompare('ışık')).toBe('isik');
  });
});

describe('isNearDuplicate', () => {
  it('noktalama/büyük-küçük harf farkını yok sayar', () => {
    expect(isNearDuplicate('Kullanıcı çay sever.', 'kullanıcı çay sever')).toBe(true);
  });

  it('İstanbul ↔ istanbul yakın kopya sayılır', () => {
    expect(isNearDuplicate('Kullanıcı İstanbul', 'kullanıcı istanbul')).toBe(true);
  });

  it('farklı kayıtları ayırır', () => {
    expect(isNearDuplicate('Kullanıcının adı: Ali', 'Kullanıcı Fenerbahçeli')).toBe(false);
  });
});

describe('shouldReplaceEntry', () => {
  it('isim kaydı eski değeri değiştirir', () => {
    expect(shouldReplaceEntry('Kullanıcının adı: Ali', 'Kullanıcının adı: Veli')).toBe(true);
  });

  it('yaş kaydı da güncellenir', () => {
    expect(shouldReplaceEntry('Kullanıcının yaşı: 20', 'Kullanıcının yaşı: 21')).toBe(true);
  });

  it('genişletilmiş anahtar seti: doğum, meslek, şehir, hobi', () => {
    expect(
      shouldReplaceEntry(
        'Kullanıcının doğum tarihi: 1 Ocak 1990',
        'Kullanıcının doğum günü: 2 Şubat',
      ),
    ).toBe(true);
    expect(shouldReplaceEntry('Kullanıcının mesleği: öğretmen', 'Kullanıcının işi: aşçı')).toBe(
      true,
    );
    expect(shouldReplaceEntry('Kullanıcının şehri: Ankara', 'Kullanıcının memleketi: İzmir')).toBe(
      true,
    );
    expect(
      shouldReplaceEntry('Kullanıcının hobileri: satranç', 'Kullanıcının hobisi: futbol'),
    ).toBe(true);
  });

  it('doğal ifadeler de tekil anahtar taşır (V1.2-063)', () => {
    expect(shouldReplaceEntry('Kullanıcının yaşı: 20', 'Kullanıcı 21 yaşında')).toBe(true);
    expect(
      shouldReplaceEntry('Kullanıcının mesleği: öğretmen', 'Kullanıcı doktor olarak çalışıyor'),
    ).toBe(true);
    expect(shouldReplaceEntry('Kullanıcının şehri: Ankara', "Kullanıcı İzmir'de yaşıyor")).toBe(
      true,
    );
  });

  it('farklı tür kayıtları değiştirmez', () => {
    expect(shouldReplaceEntry('Kullanıcı çay sever', 'Kullanıcının adı: Veli')).toBe(false);
    expect(shouldReplaceEntry('Kullanıcı çay sever', 'Kullanıcı 21 yaşında')).toBe(false);
  });
});

describe('isGarbageEntry', () => {
  it('eski bug kalıntılarını tanır', () => {
    expect(isGarbageEntry('Kullanıcının adı: ne')).toBe(true);
    expect(isGarbageEntry('Kullanıcının adı: kuatral')).toBe(true);
    expect(isGarbageEntry('Kullanıcının adı: ne kuatral')).toBe(true);
  });

  it('asistan meta kayıtlarını tanır', () => {
    expect(isGarbageEntry('Asistan kullanıcıya Efendim diyor')).toBe(true);
  });

  it('geçerli kayıtları korur', () => {
    expect(isGarbageEntry('Kullanıcının adı: Ali')).toBe(false);
    expect(isGarbageEntry('Kullanıcı çay sever')).toBe(false);
    expect(isGarbageEntry('Kullanıcının yaşı: 21')).toBe(false);
  });
});
