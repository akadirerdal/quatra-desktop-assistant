/**
 * Yerel komut ayrıştırma — model çağrısı gerekmeden tanınan kullanıcı niyetleri.
 * Sesli komutların güvenilir yakalanması için saf fonksiyonlar (test edilebilir).
 */

export type MemoryIntent =
  | { kind: 'name'; name: string }
  | { kind: 'surname'; surname: string }
  | { kind: 'remember'; text: string }
  | null;

/** "adım ne?" gibi SORULAR yanlışlıkla kayıt kalıbına girmesin. */
export function isNameQuestion(text: string): boolean {
  return (
    /(benim\s+)?(adım|ismim|adın)\s+ne\b/i.test(text) ||
    /\b(adım|ismim|adın)\s+ne\??$/i.test(text.trim())
  );
}

/** Kullanıcı uzun/detaylı yanıt mı istiyor? */
export function isDetailRequest(text: string): boolean {
  return /detaylı|ayrıntılı|uzun uzun|uzun anlat|daha kapsamlı|açıkla|detaya gir/i.test(text);
}

/** Uyku komutu — sohbet biter, «Quatra» beklemeye dönülür (mikrofon açık KALIR). */
export function detectSleepCommand(text: string): boolean {
  return /^(uyu|uykuya (dön|geç)|bekleme moduna geç|beklemeye geç|dinlemeyi bırak|artık dinleme|dinlemeyi kes)(\s|$)/i.test(
    text.trim(),
  );
}

/** Sesli durdurma komutu — Quatra susar, sohbet bağlamı korunur (V1-07).
 *  V1.2-057: "dur" yalnız TEK BAŞINA (veya noktalama sonrası) sayılır; "dur bakalım" komut değildir. */
export function detectStopSpeakingCommand(text: string): boolean {
  const t = text
    .toLowerCase()
    .trim()
    .replace(/[.!?…]+$/u, '');
  const phrase =
    /^(sus|sussana|sus bakalım|sus artık|artık sus|kes sesini|sesini kes|sessiz ol|konuşma|yeter|yeter artık|dur artık)(?:[\s,.!;:]|$)/;
  const bare = /^dur(?:[,.!;]|$)/; // "dur" / "dur." — "dur bakalım" bunu GEÇMEZ
  return phrase.test(t) || bare.test(t);
}

/** Sözlü izin yanıtı — "evet"/"hayır" ailesini çözer (V1-09). Anlaşılmazsa null. */
export function parseConfirmAnswer(text: string): 'yes' | 'no' | null {
  const t = text
    .toLowerCase()
    .trim()
    .replace(/[.!?…]+$/u, '');
  if (
    /^(evet|onaylıyorum|onaylarım|onayla|tamam|olur|kabul|izin ver|tabii|elbette)(?:[\s,.!;:]|$)/.test(
      t,
    )
  ) {
    return 'yes';
  }
  if (
    /^(hayır|yok|iptal|reddet|reddediyorum|vazgeç|istemiyorum|izin verme|olmasın)(?:[\s,.!;:]|$)/.test(
      t,
    )
  ) {
    return 'no';
  }
  return null;
}

/** Hatırlatıcı niyeti (V1-11) — "10 dakika sonra çayı hatırlat" / "1 saat sonra alarm kur". */
export interface ReminderIntent {
  delayMs: number;
  /** Hatırlatılacak söz; boş olabilir ("10 dakika sonra hatırlat"). */
  what: string;
}

const REMINDER_UNIT_MS: Record<string, number> = {
  saniye: 1000,
  sn: 1000,
  dakika: 60_000,
  dk: 60_000,
  saat: 3_600_000,
  sa: 3_600_000,
};

export function parseReminderIntent(text: string): ReminderIntent | null {
  const t = text.trim().replace(/\s+/g, ' ');
  const m =
    /(\d{1,3})\s*(saniye|sn|dakika|dk|saat|sa)\s*(?:(\d{1,3})\s*(dakika|dk|saniye|sn))?\s*sonra\s+(?:bana\s+)?(?:(.*?)\s+)?(?:hatırlat(?:[ıi]r)?|alarm\s*kur\w*)\s*[:,]?\s*(.*)/i.exec(
      t,
    );
  if (!m) return null;
  const first = (REMINDER_UNIT_MS[m[2]!.toLowerCase()] ?? 0) * Number(m[1]);
  const second = m[3] && m[4] ? (REMINDER_UNIT_MS[m[4]!.toLowerCase()] ?? 0) * Number(m[3]) : 0;
  const delayMs = first + second;
  if (delayMs < 2000 || delayMs > 24 * 3_600_000) return null; // 2 sn – 24 saat
  let what = ((m[5] || m[6]) ?? '').trim();
  what = what
    .replace(/^(mısın|misin|musun|müsün)\b\s*/i, '')
    .replace(/^lütfen\b\s*/i, '')
    .replace(/^[:,]\s*/, '')
    .trim();
  return { delayMs, what };
}

/** İsim yerine geçemeyecek fiil/ifade başlangıçları (V1.2-055): "adım adım anlat", "adım at" gibi. */
const NAME_START_VERB =
  /^(adım|at(?=\s|$)|at(?:ma\b|mak\w*|madan\w*|maya\w*|arak\w*|ıyor\w*|tım\w*|ınca\w*)|anlat\w*|açıkla\w*|ilerle\w*|yaklaş\w*|başla\w*|devam\w*)/i;

/** Cümle içinde geçen komut fiilleri — isim olamaz ("uzun uzun anlat" gibi). */
const NAME_ANY_VERB =
  /(^|\s)(anlat\w*|açıkla\w*|özetle\w*|hesapla\w*|çevir\w*|göster\w*|söyle\w*|adım\b|atmak\w*)(\s|$)/i;

/** Ad/soyad alanını temizle ve makul olmayan yakalamaları reddet (V1.2-055). */
function cleanNameField(raw: string): string | null {
  const value = raw
    .replace(/[.!?,]+$/g, '')
    .trim()
    .slice(0, 60);
  if (!value) return null;
  if (!/^[\p{L}\s'.-]+$/u.test(value)) return null; // yalnız harf/isim karakterleri
  if (/^ne\b/i.test(value)) return null; // "adım ne?" sorusu
  if (value.length > 40) return null; // isim olamayacak kadar uzun
  if (value.split(/\s+/).length > 3) return null; // ad (+ ikinci ad) + soyad
  if (NAME_START_VERB.test(value) || NAME_ANY_VERB.test(value)) return null;
  return value;
}

/** "benim adım X" / "hatırla: Y" kalıplarını tanır (sorular hariç). */
export function parseMemoryIntent(text: string): MemoryIntent {
  const t = text.trim();
  if (isNameQuestion(t)) return null;
  const nameMatch = t.match(/^(benim adım|adım|ismim|benim ismim)\s+(.+)$/i);
  if (nameMatch?.[2]) {
    const name = cleanNameField(nameMatch[2]);
    if (name) return { kind: 'name', name };
  }
  const surnameMatch = t.match(/^(benim soyadım|soyadım|soyismim)\s+(.+)$/i);
  if (surnameMatch?.[2]) {
    const surname = cleanNameField(surnameMatch[2]);
    if (surname) return { kind: 'surname', surname };
  }
  const rememberMatch = t.match(
    /^(hatırla|şunu hatırla|not et|not al|aklında tut|unutma|şunu unutma)[,:\s]+(.+)$/i,
  );
  if (rememberMatch?.[2]) {
    return { kind: 'remember', text: rememberMatch[2].trim().slice(0, 500) };
  }
  return null;
}

/** Mod komutlarını tanır. V1.2-056: "sohbet moduna geç" / "normal moduna geç" de eşleşir. */
export function detectModeCommand(text: string): 'pro' | 'flash' | 'toggle' | null {
  const lower = text.toLowerCase();
  if (/(yazılım|proje|kod) modu?na?\s+geç/.test(lower)) return 'pro';
  if (/(normal|sohbet)\s+modu?n?a?\s+geç/.test(lower)) return 'flash';
  if (/mod değiştir/.test(lower)) return 'toggle';
  return null;
}
