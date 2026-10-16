/**
 * Yerel komut ayrıştırma — model çağrısı gerekmeden tanınan kullanıcı niyetleri.
 * Sesli komutların güvenilir yakalanması için saf fonksiyonlar (test edilebilir).
 */

export type MemoryIntent =
  | { kind: 'name'; name: string }
  | { kind: 'remember'; text: string }
  | null;

/** "benim adım X" / "hatırla: Y" kalıplarını tanır. */
export function parseMemoryIntent(text: string): MemoryIntent {
  const t = text.trim();
  const nameMatch = t.match(/^(benim adım|adım|ismim|benim ismim|adın ne olsun)\s+(.+)$/i);
  if (nameMatch?.[2]) {
    const name = nameMatch[2].replace(/[.!?,]+$/g, '').trim().slice(0, 60);
    if (name) return { kind: 'name', name };
  }
  const rememberMatch = t.match(/^(hatırla|şunu hatırla|not et|aklında tut)[,:\s]+(.+)$/i);
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
