/**
 * mem0 Platform entegrasyonu (https://github.com/mem0ai/mem0 — Apache-2.0).
 * Bulut REST API'si doğrudan kullanılır (SDK bağımlılığı yok, bundle güvenli).
 * Kullanıcı anahtarı yalnızca main süreçte okunur; veriler mem0 bulutuna gider
 * (ayarlarda açıkça belirtilir — varsayılan motor YEREL kalır).
 */
import { ProviderError } from '../src/providers/types';

const MEM0_BASE = 'https://api.mem0.ai/v1';
const USER_ID = 'quatra-desktop-user';
// V1.2-030: asılı istek asistanı süresiz bekletmesin.
const MEM0_TIMEOUT_MS = 15_000;

export interface Mem0Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Dış iptal sinyali + zaman aşımını birleştirir. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(MEM0_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function isAbortError(e: unknown): boolean {
  const name = (e as { name?: unknown } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/** Zaman aşımlı/iptal edilebilir fetch — tüm mem0 istekleri buradan geçer. */
async function mem0Fetch(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: withTimeout(signal) });
  } catch (e) {
    if (isAbortError(e)) {
      if (signal?.aborted) throw new ProviderError('cancelled', 'mem0 isteği iptal edildi.');
      throw new ProviderError('timeout', 'mem0 isteği zaman aşımına uğradı.');
    }
    throw new ProviderError('network', 'mem0 bağlantısı kurulamadı — interneti kontrol et.');
  }
}

export async function mem0Add(
  apiKey: string,
  messages: Mem0Message[],
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey) throw new ProviderError('auth', 'mem0 anahtarı ayarlanmamış.');
  const res = await mem0Fetch(
    `${MEM0_BASE}/memories/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ messages, user_id: USER_ID }),
    },
    signal,
  );
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('auth', 'mem0 anahtarı geçersiz.', res.status);
    }
    throw new ProviderError('server', 'mem0 ekleme isteği başarısız.', res.status);
  }
  return { ok: true };
}

export interface Mem0SearchResult {
  memory: string;
  score?: number;
}

export async function mem0Search(
  apiKey: string,
  query: string,
  topK = 6,
  signal?: AbortSignal,
): Promise<Mem0SearchResult[]> {
  if (!apiKey) throw new ProviderError('auth', 'mem0 anahtarı ayarlanmamış.');
  const res = await mem0Fetch(
    `${MEM0_BASE}/memories/search/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ query, user_id: USER_ID, top_k: topK }),
    },
    signal,
  );
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('auth', 'mem0 anahtarı geçersiz.', res.status);
    }
    throw new ProviderError('server', 'mem0 arama isteği başarısız.', res.status);
  }
  const data = (await res.json()) as { results?: Array<{ memory?: string; score?: number }> };
  return (data.results ?? [])
    .filter((r) => typeof r.memory === 'string' && r.memory.trim())
    .map((r) => ({ memory: r.memory as string, score: r.score }));
}
