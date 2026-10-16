/**
 * Hafıza bilgi çıkarımı — model yanıtından kalıcı olguları ayrıştırır (saf, test edilebilir).
 * Model JSON dizi veya satır listesi dönebilir; ikisi de desteklenir.
 */
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
      .filter((t) => t.length >= 2 && t.length <= 500)
      .slice(0, 10);
  } catch {
    // JSON değil — satır listesi olarak yorumla
  }

  return cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').replace(/^(fact|olgu)\s*[:：]\s*/i, '').trim())
    .filter((t) => t.length >= 2 && t.length <= 500 && !/^(\{|\[)/.test(t))
    .slice(0, 10);
}

/** Ad gibi tekil kayıtları günceller: eski değerleri temizler, yenisiyle değiştirir. */
export function shouldReplaceEntry(existing: string, incoming: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  const ex = norm(existing);
  const inc = norm(incoming);
  const prefixes = ['kullanıcının adı', 'kullanıcı adı', 'adı'];
  const exPrefix = prefixes.find((p) => ex.startsWith(p));
  const incPrefix = prefixes.find((p) => inc.startsWith(p));
  return Boolean(exPrefix && incPrefix && exPrefix === incPrefix);
}

/** Çöp ad kayıtlarını tanır (eski bug kalıntıları: "adı: ne", "adı: ne kuatral"…). */
export function isGarbageNameEntry(text: string): boolean {
  const stoplist = ['ne', 'kuatral', 'kuatra', 'quatra', 'yok', 'bilmiyorum'];
  const m = text.toLowerCase().match(/kullanıcının adı\s*[:：]\s*(.+)$/);
  if (!m) return false;
  const name = m[1]!.trim().toLowerCase();
  return (
    stoplist.some((w) => name === w || name.startsWith(`${w} `)) ||
    name.length > 40 ||
    /^quatra/.test(name)
  );
}
