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

/**
 * Unicode güvenli kelime sınırı — JS `\b` ASCII tabanlıdır ve "şehrim" gibi
 * Türkçe harfle başlayan kelimelerde hiç eşleşmez (V1.2-115).
 */
const WORD_EDGE_START = '(?<![\\p{L}\\p{N}_])';
const WORD_EDGE_END = '(?![\\p{L}\\p{N}_])';

/** Kullanıcı mesajında kişisel/uzun vadeli bilgi sinyali var mı? (gereksiz çıkarım çağrılarını önler) */
export function hasMemorySignal(text: string): boolean {
  const patterns: RegExp[] = [
    'ben|benim|beni|bana|bende|benden',
    'adım|ismim|yaşım|doğum|burcum|memleketim|şehrim|okulum|mesleğim|işim|projem|hedefim|planım',
    'hastalığım|alerjim|ilacım|diyetim|rutinim|alışkanlığım|kullandığım|kullanırım',
    'annem|babam|kardeşim|abim|ablam|eşim|oğlum|kızım|köpeğim|kedim|kuşum|evcil',
    'sevdiğim|seviyorum|sevmiyorum|severim|sevmem|nefret|tercih ed|bayılırım|hoşlanmam',
    'hatırla|unutma|aklında tut|not et|not al',
  ].map((alts) => new RegExp(`${WORD_EDGE_START}(?:${alts})${WORD_EDGE_END}`, 'iu'));
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
    return (
      arr
        // Yalnızca string elemanlar kabul edilir; nesneler "[object Object]" olarak kaydedilmesin (V1.2-116).
        .filter((x): x is string => typeof x === 'string')
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && t.length <= 300)
        .slice(0, 8)
    );
  } catch {
    // JSON değil — satır listesi olarak yorumla
  }

  return cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((t) => t.length >= 4 && t.length <= 300 && !/^[[{]/.test(t))
    .slice(0, 8);
}

/**
 * Kayıt karşılaştırması için normalleştirme (küçük harf, noktalama temizliği).
 * NFD + birleşen işaret temizliği Türkçe tutarlılığı sağlar: 'İ'.toLowerCase()
 * 'i'+U+0307 üretir; temizlenmezse "İstanbul" ile "istanbul" eşleşmez (V1.2-064).
 */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
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
  işi: 'meslek',
  iş: 'meslek',
  şehri: 'şehir',
  şehir: 'şehir',
  memleketi: 'şehir',
  memleket: 'şehir',
  doğum: 'doğum',
  'doğum tarihi': 'doğum',
  'doğum günü': 'doğum',
  'doğum yeri': 'doğum yeri',
  hobisi: 'hobi',
  hobileri: 'hobi',
  hobi: 'hobi',
  hobiler: 'hobi',
  'ilgi alanı': 'hobi',
  'ilgi alanları': 'hobi',
  boyu: 'boy',
  boy: 'boy',
  kilosu: 'kilo',
  kilo: 'kilo',
  'kan grubu': 'kan grubu',
  burcu: 'burç',
  burç: 'burç',
  okulu: 'okul',
  okul: 'okul',
  üniversitesi: 'üniversite',
  üniversite: 'üniversite',
  telefonu: 'telefon',
  telefon: 'telefon',
  'e-posta': 'eposta',
  eposta: 'eposta',
  email: 'eposta',
  mail: 'eposta',
};

/** "Kullanıcı 21 yaşında" gibi "anahtar: değer" olmayan doğal ifadelerden tekil anahtar çıkarır (V1.2-063). */
const NATURAL_KEY_PATTERNS: Array<{ re: RegExp; key: string }> = [
  { re: /\b\d{1,3}\s*yaşında\b/iu, key: 'yaş' },
  { re: /\bdoğumlu\b/iu, key: 'doğum' },
  { re: /\bolarak\s+çalışıyor\b/iu, key: 'meslek' },
  { re: /(?:\S+'(?:da|de|ta|te)|\bşehrinde|\bilinde)\s+yaşıyor\b/iu, key: 'şehir' },
  { re: /\b(?:boyu\s*\d{2,3}|\d{2,3}\s*(?:cm|santim))\b/iu, key: 'boy' },
  { re: /\b\d{2,3}\s*(?:kg|kilo)\b/iu, key: 'kilo' },
];

function singularKeyOf(text: string): string | null {
  const m = text.match(/^([^:：\n]{2,30})\s*[:：]/);
  if (!m) return null;
  // Türkçe İ→i̇ artığı temizlenir ki "İşi: ..." anahtarı da tanınsın (V1.2-064).
  const key = m[1]!
    .toLowerCase()
    .replace(/\u0307/g, '')
    .trim()
    .replace(/^kullanıcının\s+|^kullanıcı\s+/, '');
  return SINGULAR_KEY_MAP[key] ?? null;
}

/** Tekil bilgiler (isim, yaş…) eski kaydı değiştirir; farklı türler etkilemez. */
export function shouldReplaceEntry(existing: string, incoming: string): boolean {
  const ke = singularKeyOf(existing) ?? naturalKeyOf(existing);
  const ki = singularKeyOf(incoming) ?? naturalKeyOf(incoming);
  return Boolean(ke && ki && ke === ki);
}

function naturalKeyOf(text: string): string | null {
  return NATURAL_KEY_PATTERNS.find(({ re }) => re.test(text))?.key ?? null;
}
