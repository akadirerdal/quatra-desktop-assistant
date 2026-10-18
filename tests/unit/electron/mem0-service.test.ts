/**
 * electron/mem0-service — zaman aşımı/iptal sinyali ve hata eşlemesi (V1.2-030).
 * fetch mock'lanır; ağa çıkılmaz.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mem0Add, mem0Search } from '../../../electron/mem0-service';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('mem0-service', () => {
  it("arama sonuçlarını filtreler ve birleşik abort sinyalini fetch'e verir", async () => {
    const ac = new AbortController();
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [{ memory: ' ad ', score: 0.5 }, { memory: '   ' }] }),
    );
    const out = await mem0Search('k', 'sorgu', 6, ac.signal);
    expect(out).toEqual([{ memory: ' ad ', score: 0.5 }]);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('boş anahtar ağa çıkmadan auth hatası verir', async () => {
    await expect(mem0Search('', 'q')).rejects.toMatchObject({ code: 'auth' });
    await expect(mem0Add('', [])).rejects.toMatchObject({ code: 'auth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dış iptal sinyali cancelled hatasına çevrilir', async () => {
    const ac = new AbortController();
    ac.abort();
    fetchMock.mockImplementation(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    await expect(mem0Search('k', 'q', 6, ac.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('zaman aşımı (TimeoutError) timeout hatasına çevrilir', async () => {
    fetchMock.mockImplementation(async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    });
    await expect(mem0Add('k', [{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('ağ hatası (TypeError) network hatasına çevrilir', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(mem0Search('k', 'q')).rejects.toMatchObject({ code: 'network' });
  });

  it('401 yanıtı auth hatasına çevrilir', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'nope' }, 401));
    await expect(mem0Search('k', 'q')).rejects.toMatchObject({ code: 'auth', status: 401 });
  });
});
