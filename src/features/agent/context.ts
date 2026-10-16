/**
 * Kısa süreli konuşma bağlamı (V1-10) — son turlar YALNIZ bellekte tutulur, diske yazılmaz.
 * Token bütçesi: tur sayısı + toplam karakter sınırı (prompt şişmesin).
 */

export interface ContextTurn {
  user: string;
  assistant: string;
}

export const CONTEXT_MAX_TURNS = 6;
export const CONTEXT_MAX_CHARS = 4000;

/** Yeni turu ekler; sınır aşılırsa EN ESKİ turlar düşer. */
export function appendContextTurn(
  history: ContextTurn[],
  user: string,
  assistant: string,
  maxTurns = CONTEXT_MAX_TURNS,
  maxChars = CONTEXT_MAX_CHARS,
): ContextTurn[] {
  let turns = [...history, { user, assistant }];
  const charsOf = (h: ContextTurn[]) => h.reduce((a, t) => a + t.user.length + t.assistant.length, 0);
  while (turns.length > maxTurns) turns = turns.slice(1);
  while (turns.length > 1 && charsOf(turns) > maxChars) turns = turns.slice(1);
  return turns;
}

/** Sağlayıcıya gidecek mesaj listesine çevirir (rol sıralı). */
export function contextToMessages(
  history: ContextTurn[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history.flatMap((t) => [
    { role: 'user' as const, content: t.user },
    { role: 'assistant' as const, content: t.assistant },
  ]);
}
