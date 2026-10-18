import { afterEach, describe, expect, it, vi } from 'vitest';
import { mem0Add, mem0Search } from '../../../electron/mem0-service';
import { ProviderError } from '../../../src/providers/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mem0 REST entegrasyonu', () => {
  it('mem0Add doğru endpoint + auth başlığıyla çağrılır', async () => {
    const mock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(
        String(init.headers && (init.headers as Record<string, string>)['Authorization']),
      ).toBe('Token test-key');
      const body = JSON.parse(String(init.body)) as { messages?: unknown[] };
      expect(body.messages).toHaveLength(2);
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', mock);
    const res = await mem0Add('test-key', [
      { role: 'user', content: 'benim adım Ali' },
      { role: 'assistant', content: 'memun oldum' },
    ]);
    expect(res.ok).toBe(true);
    expect(String(mock.mock.calls[0]?.[0])).toContain('/memories/');
  });

  it('mem0Add 401 → auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    const err = await mem0Add('k', [{ role: 'user', content: 'x' }]).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('auth');
  });

  it('mem0Search sonuçları ayrıştırır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ results: [{ memory: 'Kullanıcının adı: Ali', score: 0.9 }] }),
            {
              status: 200,
            },
          ),
      ),
    );
    const results = await mem0Search('k', 'adım ne', 3);
    expect(results).toHaveLength(1);
    expect(results[0]?.memory).toBe('Kullanıcının adı: Ali');
  });

  it('anahtar yoksa istek atılmaz', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const err = await mem0Search('', 'x').then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('auth');
    expect(mock).not.toHaveBeenCalled();
  });
});
