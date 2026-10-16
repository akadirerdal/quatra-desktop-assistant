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
  return /(benim\s+)?(adım|ismim|adın)\s+ne\b/i.test(text) || /\b(adım|ismim|adın)\s+ne\??$/i.test(text.trim());
}

/** Kullanıcı uzun/detaylı yanıt mı istiyor? */
export function isDetailRequest(text: string): boolean {
  return /detaylı|ayrıntılı|uzun uzun|uzun anlat|daha kapsamlı|açıkla|detaya gir/i.test(text);
}

/** "benim adım X" / "hatırla: Y" kalıplarını tanır (sorular hariç). */
export function parseMemoryIntent(text: string): MemoryIntent {
  const t = text.trim();
  if (isNameQuestion(t)) return null;
  const nameMatch = t.match(/^(benim adım|adım|ismim|benim ismim)\s+(.+)$/i);
  if (nameMatch?.[2]) {
    const name = nameMatch[2].replace(/[.!?,]+$/g, '').trim().slice(0, 60);
    if (name && !/^ne\b/i.test(name)) return { kind: 'name', name };
  }
  const surnameMatch = t.match(/^(benim soyadım|soyadım|soyismim)\s+(.+)$/i);
  if (surnameMatch?.[2]) {
    const surname = surnameMatch[2].replace(/[.!?,]+$/g, '').trim().slice(0, 60);
    if (surname && !/^ne\b/i.test(surname)) return { kind: 'surname', surname };
  }
  const rememberMatch = t.match(
    /^(hatırla|şunu hatırla|not et|not al|aklında tut|unutma|şunu unutma)[,:\s]+(.+)$/i,
  );
  if (rememberMatch?.[2]) {
    return { kind: 'remember', text: rememberMatch[2].trim().slice(0, 500) };
  }
  return null;
}

/** Mod komutlarını tanır. */
export function detectModeCommand(text: string): 'pro' | 'flash' | 'toggle' | null {
  const lower = text.toLowerCase();
  if (/(yazılım|proje|kod) moduna geç/.test(lower)) return 'pro';
  if (/(normal|sohbet) moda? geç/.test(lower)) return 'flash';
  if (/mod değiştir/.test(lower)) return 'toggle';
  return null;
}
