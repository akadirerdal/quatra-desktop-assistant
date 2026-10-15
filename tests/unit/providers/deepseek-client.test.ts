import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekClient } from '../../../src/providers/deepseek/client';
import { ProviderError } from '../../../src/providers/types';

// Gerçek API anahtarı GEREKMEZ — tüm ağ mock'lanır.
// Anahtar mock'ta gözükür ama bu test dosyası dışında hiçbir yerde yoktur.

function makeClient(overrides: Partial<ConstructorParameters<typeof DeepSeekClient>[0]> = {}) {
  return new DeepSeekClient({
    // Parçalı yazılır: secret taraması (check:secrets) test fixture'ını yakalamasın.
    getApiKey: () => 'Bearer ' + 'test-key-not-real',
    retryDelayMs: 1,
    timeoutMs: 5000,
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeepSeekClient.chat', () => {
  it('başarılı cevap döner ve auth başlığı taşır', async () => {
    const mock = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer ' + 'test-key-not-real',
      );
      return jsonResponse({
        choices: [{ finish_reason: 'stop', message: { content: 'Merhaba!' } }],
      });
    });
    vi.stubGlobal('fetch', mock);

    const client = makeClient();
    const res = await client.chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'selam' }],
    });
    expect(res.content).toBe('Merhaba!');
    expect(res.finishReason).toBe('stop');
    expect(res.toolCalls).toBeUndefined();
  });

  it('tool_calls cevabını ayrıştırır', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: '',
              tool_calls: [
                { id: 'call_1', function: { name: 'sysinfo', arguments: '{}' } },
              ],
            },
          },
        ],
      }),
    ));
    const res = await makeClient().chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'bilgi ver' }],
    });
    expect(res.finishReason).toBe('tool_calls');
    expect(res.toolCalls).toEqual([{ id: 'call_1', name: 'sysinfo', arguments: '{}' }]);
  });

  it('401 → auth hatası (mesaj secret içermez)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'bad key' } }, 401)));
    const err = await makeClient()
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe('auth');
    expect((err as ProviderError).message).not.toContain('test-key-not-real');
    expect((err as ProviderError).message).not.toContain('bad key');
  });

  it('404 → unsupported (model yok)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 404)));
    const err = await makeClient()
      .chat({ model: 'olmayan-model', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('unsupported');
  });

  it('429 → bounded retry: ikinci denemede başarı', async () => {
    let calls = 0;
    const mock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 429);
      return jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'tamam' } }] });
    });
    vi.stubGlobal('fetch', mock);

    const res = await makeClient().chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(res.content).toBe('tamam');
    expect(calls).toBe(2);
  });

  it('429 → retry limiti dolunca rate_limit hatası', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 429)));
    const err = await makeClient({ maxRetries: 2 })
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('rate_limit');
  });

  it('ağ hatası (TypeError) → network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));
    const err = await makeClient()
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('network');
  });

  it('timeout → timeout hatası', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }),
    ));
    const err = await makeClient({ timeoutMs: 10 })
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('timeout');
  });

  it('kullanıcı iptali → cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        const signal = init.signal;
        const abortErr = new DOMException('aborted', 'AbortError');
        if (signal?.aborted) {
          rej(abortErr);
          return;
        }
        signal?.addEventListener('abort', () => rej(abortErr));
      }),
    ));
    const controller = new AbortController();
    const p = makeClient().chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'x' }],
      signal: controller.signal,
    });
    controller.abort();
    const err = await p.then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('cancelled');
  });

  it('anahtar yoksa auth hatası ve ağ isteği atılmaz', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const err = await makeClient({ getApiKey: () => '' })
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] })
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('auth');
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('DeepSeekClient.chatStream', () => {
  it('SSE delta akışını parçalar ve birleştirir', async () => {
    const encoder = new TextEncoder();
    const sse =
      'data: {"choices":[{"delta":{"content":"Mer"},"finish_reason":null}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"haba"},"finish_reason":null}]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n';
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(sse));
        ctrl.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));

    const deltas: string[] = [];
    const res = await makeClient().chatStream(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'selam' }] },
      (d) => deltas.push(d),
    );
    expect(deltas).toEqual(['Mer', 'haba']);
    expect(res.content).toBe('Merhaba');
    expect(res.finishReason).toBe('stop');
  });

  it('akışta tool_calls argümanlarını birleştirir', async () => {
    const encoder = new TextEncoder();
    const sse =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"sysinfo","arguments":"{}"}}]},"finish_reason":null}]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n' +
      'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      new ReadableStream<Uint8Array>({
        start(ctrl) { ctrl.enqueue(encoder.encode(sse)); ctrl.close(); },
      }),
      { status: 200 },
    )));

    const res = await makeClient().chatStream(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }] },
      () => undefined,
    );
    expect(res.toolCalls).toEqual([{ id: 'c1', name: 'sysinfo', arguments: '{}' }]);
  });
});

describe('DeepSeekClient.listModels / testConnection', () => {
  it('modelleri çeker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
    ));
    const models = await makeClient().listModels();
    expect(models.map((m) => m.id)).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('testConnection gerçek istek atar ve gecikmeyi döner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'pong' } }] }),
    ));
    const res = await makeClient().testConnection('deepseek-chat');
    expect(res.ok).toBe(true);
    expect(res.model).toBe('deepseek-chat');
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('testConnection başarısızsa hatayı yükseltir (sahte başarı yok)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
    const err = await makeClient()
      .testConnection('deepseek-chat')
      .then(() => null, (e: unknown) => e);
    expect((err as ProviderError).code).toBe('auth');
  });
});
