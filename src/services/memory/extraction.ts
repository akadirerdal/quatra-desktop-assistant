/**
 * Hafıza çıkarımı — kalıcı olguların ayrıştırılması ve kalite filtreleri.
 * Saf fonksiyonlar; Electron'suz, test edilebilir.
 *
 * İnsan hafızası ilkesi: yalnızca UZUN VADELİ değer taşıyan şeyler tutulur
 * (kimlik, kalıcı tercihler, ilişkiler, önemli tarihler, sağlık);
 * günlük sohbet, sorular ve geçici durumlar kaydedilmez.
 */

/** Otomatik öğrenme için modele verilen katı çıkarım talimatı. */
export const EXTRACTION_PROMPT = [
  'Sen bir hafıza çıkarıcısısın. Aşağıdaki konuşmadan YALNIZCA kullanıcı hakkında uzun vadeli',
  'değer taşıyan olguları çıkar.',
  '',
  'KAYDET:',
  '- Kimlik: isim, yaş, meslek, şehir, okul',
  '- Kalıcı tercihler ve alışkanlıklar (ör. "çayı şekersiz içer")',
  '- İlişkiler: aile, arkadaşlar, evcil hayvanlar',
  '- Önemli tarihler ve planlar (doğum günü, sınav, taşınma)',
  '- Sağlık: alerji, ilaç, süregelen rahatsızlık',
  '',
  'KAYDETME:',
  '- Sorular, selamlaşmalar, teşekkürler, sohbet dolgusu',
  '- Geçici durumlar (hava durumu, "şu an yorgunum", bugünkü işler)',
  '- Asistanla ilgili veya tekrarlanan bilgiler',
  '- Konuşmada açıkça geçmeyen, tahmin gerektiren şeyler',
  '',
  'Kurallar:',
  '- Her olgu kısa, üçüncü şahıs ve Türkçe olsun: "Kullanıcının adı: Ali", "Kullanıcı çayı şekersiz içer".',
  '- Yalnızca kullanıcının söylediklerinden çıkar.',
  '- Uygun olgu yoksa boş dizi döndür.',
  'Yanıtın YALNIZCA JSON dizi olsun: ["...", "..."] veya []',
].join('\n');

/** Kullanıcı mesajında kişisel/uzun vadeli bilgi sinyali var mı? (gereksiz çıkarım çağrılarını önler) */
export function hasMemorySignal(text: string): boolean {
  const patterns: RegExp[] = [
    /\b(ben|benim|beni|bana|bende|benden)\b/i,
    /\b(adım|ismim|yaşım|doğum|burcum|memleketim|şehrim|okulum|mesleğim|işim|projem|hedefim|planım)\b/i,
    /\b(hastalığım|alerjim|ilacım|diyetim|rutinim|alışkanlığım|kullandığım|kullanırım)\b/i,
    /\b(annem|babam|kardeşim|abim|ablam|eşim|oğlum|kızım|köpeğim|kedim|kuşum|evcil)\b/i,
    /\b(sevdiğim|seviyorum|sevmiyorum|severim|sevmem|nefret|tercih ed|bayılırım|hoşlanmam)\b/i,
    /\b(hatırla|unutma|aklında tut|not et|not al)\b/i,
  ];
  return patterns.some((re) => re.test(text));
}

/** Model çıktısından olgu listesini ayrıştırır (JSON dizi veya düz satır listesi). */
export function parseExtractedFacts(raw: string): string[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];

  // 1) JSON dene: [..] veya {"facts":[..]}
  try {
    const json = JSON.parse(cleaned) as unknown;
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { facts?: unknown }).facts)
        ? (json as { facts: unknown[] }).facts
        : [];
    return arr
      .map((x) => String(x).trim())
      .filter((t) => t.length >= 4 && t.length <= 300)
      .slice(0, 8);
  } catch {
    // JSON değil — satır listesi olarak yorumla
  }

  return cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((t) => t.length >= 4 && t.length <= 300 && !/^[[{]/.test(t))
    .slice(0, 8);
}

/** Kayıt karşılaştırması için normalleştirme (küçük harf, noktalama temizliği). */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?,;:"'()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aynı bilginin farklı yazımlarını tanır (ör. "Kullanıcı çay sever." ↔ "kullanıcı çay sever"). */
export function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Kısa kayıtlarda içerme kontrolü riskli; yalnızca yeterince uzunlarda uygula.
  return na.length >= 12 && nb.length >= 12 && (na.includes(nb) || nb.includes(na));
}

const NAME_STOPLIST = ['ne', 'kuatral', 'kuatra', 'quatra', 'yok', 'bilmiyorum', 'bilmiyim'];

/** Çöp kayıtları tanır: eski bug kalıntıları ("adı: ne"), asistan meta kayıtları, anlamsızlar. */
export function isGarbageEntry(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return true;
  const lower = t.toLowerCase();

  // Ad kaydı kalıntıları
  const m = lower.match(/kullanıcının adı\s*[:：]\s*(.+)$/);
  if (m) {
    const name = m[1]!.trim();
    if (NAME_STOPLIST.some((w) => name === w || name.startsWith(`${w} `))) return true;
    if (name.length > 40 || /^quatra/.test(name)) return true;
  }

  // Asistanın kendisiyle ilgili kayıtlar kullanıcı hafızasına girmez.
  if (/^(asistan|quatra)\b/i.test(lower)) return true;

  return false;
}

const SINGULAR_KEY_MAP: Record<string, string> = {
  adı: 'ad',
  ad: 'ad',
  isim: 'ad',
  ismi: 'ad',
  soyadı: 'soyad',
  soyad: 'soyad',
  yaşı: 'yaş',
  yaş: 'yaş',
  mesleği: 'meslek',
  meslek: 'meslek',
  şehri: 'şehir',
  memleketi: 'şehir',
};

function singularKeyOf(text: string): string | null {
  const m = text.toLowerCase().match(/^([^:：\n]{2,30})\s*[:：]/);
  if (!m) return null;
  const key = m[1]!.trim().replace(/^kullanıcının\s+|^kullanıcı\s+/, '');
  return SINGULAR_KEY_MAP[key] ?? null;
}

/** Tekil bilgiler (isim, yaş…) eski kaydı değiştirir; farklı türler etkilemez. */
export function shouldReplaceEntry(existing: string, incoming: string): boolean {
  const ke = singularKeyOf(existing);
  const ki = singularKeyOf(incoming);
  return Boolean(ke && ki && ke === ki);
}
