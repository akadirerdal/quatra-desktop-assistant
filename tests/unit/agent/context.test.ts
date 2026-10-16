import { describe, expect, it } from 'vitest';
import { appendContextTurn, contextToMessages } from '../../../src/features/agent/context';

describe('kısa süreli bağlam (V1-10)', () => {
  it('turları sırayla ekler', () => {
    let h = appendContextTurn([], 'a', 'b');
    h = appendContextTurn(h, 'c', 'd');
    expect(h).toEqual([
      { user: 'a', assistant: 'b' },
      { user: 'c', assistant: 'd' },
    ]);
  });

  it('tur sınırını aşınca en eskileri düşer', () => {
    let h: ReturnType<typeof appendContextTurn> = [];
    for (let i = 1; i <= 8; i++) h = appendContextTurn(h, `u${i}`, `a${i}`, 3, 10_000);
    expect(h.length).toBe(3);
    expect(h[0]!.user).toBe('u6');
    expect(h[2]!.assistant).toBe('a8');
  });

  it('karakter bütçesi aşılınca en eskiler düşer', () => {
    let h: ReturnType<typeof appendContextTurn> = [];
    h = appendContextTurn(h, 'x'.repeat(100), 'y'.repeat(100), 6, 250);
    h = appendContextTurn(h, 'z'.repeat(50), 'w'.repeat(50), 6, 250);
    expect(h.length).toBe(1);
    expect(h[0]!.user.startsWith('z')).toBe(true);
  });

  it('mesajlara rol sırasıyla çevirir', () => {
    const msgs = contextToMessages([{ user: 'u', assistant: 'a' }]);
    expect(msgs).toEqual([
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ]);
  });
});
