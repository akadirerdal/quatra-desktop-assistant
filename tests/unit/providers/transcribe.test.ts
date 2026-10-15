import { afterEach, describe, expect, it, vi } from 'vitest';
import { transcribeAudio } from '../../../src/providers/groq/transcribe';
import { ProviderError } from '../../../src/providers/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

const audio = new Uint8Array([1, 2, 3, 4]);

describe('transcribeAudio (Groq Whisper)', () => {
  it('başarılı transkript döner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        expect((init.headers as Record<string, string>)['Authorization']).toContain('Bearer ');
        return new Response(JSON.stringify({ text: 'merhaba dünya' }), { status: 200 });
      }),
    );
    const res = await transcribeAudio({ apiKey: 'k', audio, mimeType: 'audio/webm' });
    expect(res.text).toBe('merhaba dünya');
  });

  it('anahtar yoksa auth hatası ve ağ isteği atılmaz', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const err = await transcribeAudio({ apiKey: '', audio, mimeType: 'audio/webm' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('auth');
    expect(mock).not.toHaveBeenCalled();
  });

  it('401 → auth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const err = await transcribeAudio({ apiKey: 'k', audio, mimeType: 'audio/webm' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('auth');
  });

  it('429 → rate_limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    const err = await transcribeAudio({ apiKey: 'k', audio, mimeType: 'audio/webm' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('rate_limit');
  });

  it('ağ hatası → network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const err = await transcribeAudio({ apiKey: 'k', audio, mimeType: 'audio/webm' }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ProviderError).code).toBe('network');
  });
});
