/**
 * DeepSeek adapter — gerçek API entegrasyonu (OpenAI uyumlu format).
 * https://api-docs.deepseek.com
 *
 * Güvenlik kuralları:
 * - API anahtarı callback ile gelir, hiçbir yerde tutulmaz/loglanmaz.
 * - Hata mesajları sabit metinlerdir; sağlayıcı yanıtı asla kullanıcıya olduğu gibi gitmez.
 * - Timeout + AbortController + bounded backoff retry (sadece 429 ve 5xx için).
 */
import type {
  ChatMessage,
  ConnectionTestResult,
  FinishReason,
  ModelInfo,
  ProviderAdapter,
  ProviderChatRequest,
  ProviderChatResponse,
  TokenUsage,
  ToolCall,
} from '../types';
import { mapHttpError, ProviderError } from '../types';

export interface DeepSeekClientOptions {
  /** Varsayılan: https://api.deepseek.com */
  baseUrl?: string;
  /** Anahtarı güvenli kaynaktan (credentials vault) döner. Never log it. */
  getApiKey: () => string | Promise<string>;
  timeoutMs?: number;
  maxRetries?: number;
  /** Test ortamında küçültülebilir; gerçek kullanımda üssel artar. */
  retryDelayMs?: number;
}

interface DeepSeekChoice {
  finish_reason: string | null;
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      function?: { name?: string; arguments?: string };
    }>;
  };
  delta?: {
    content?: string | null;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      function?: { name?: string; arguments?: string };
    }>;
  };
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function toUsage(raw: DeepSeekResponse['usage']): TokenUsage | undefined {
  if (!raw || typeof raw.prompt_tokens !== 'number' || typeof raw.completion_tokens !== 'number') {
    return undefined;
  }
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens: raw.total_tokens ?? raw.prompt_tokens + raw.completion_tokens,
  };
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

type MessageToolCalls = NonNullable<DeepSeekChoice['message']>['tool_calls'];

function toToolCalls(calls: MessageToolCalls | undefined): ToolCall[] {
  return (calls ?? [])
    .filter((c) => c.id && c.function?.name)
    .map((c) => ({
      id: c.id,
      name: c.function?.name ?? '',
      arguments: c.function?.arguments ?? '{}',
    }));
}

function toFinishReason(raw: string | null): FinishReason {
  switch (raw) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool_calls':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'unknown';
  }
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) ||
    (typeof DOMException !== 'undefined' && e instanceof DOMException)
  );
}

export class DeepSeekClient implements ProviderAdapter {
  private readonly baseUrl: string;
  private readonly getApiKey: () => string | Promise<string>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: DeepSeekClientOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.getApiKey = options.getApiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  async chat(req: ProviderChatRequest): Promise<ProviderChatResponse> {
    return this.withRetry(() => this.chatOnce(req), req.signal);
  }

  async chatStream(
    req: ProviderChatRequest,
    onDelta: (text: string) => void,
  ): Promise<ProviderChatResponse> {
    // Stream'ler tekrarlanmaz (non-idempotent); iptal/zaman aşımı dışarı taşar.
    const { signal, controller, timer } = this.prepareSignal(req.signal);
    try {
      const res = await this.request(
        'POST',
        '/chat/completions',
        {
          ...this.buildBody(req),
          stream: true,
        },
        signal,
      );
      if (!res.ok) throw mapHttpError(res.status);
      return await this.readStream(res, onDelta, signal);
    } catch (e) {
      throw this.normalizeError(e, req.signal);
    } finally {
      clearTimeout(timer);
      if (!req.signal) controller.abort();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const { signal, controller, timer } = this.prepareSignal(undefined);
    try {
      const res = await this.request('GET', '/models', undefined, signal);
      if (!res.ok) throw mapHttpError(res.status);
      const data = (await res.json()) as { data?: Array<{ id?: string; owned_by?: string }> };
      return (data.data ?? [])
        .filter((m) => typeof m.id === 'string')
        .map((m) => ({ id: m.id as string, ownedBy: m.owned_by }));
    } catch (e) {
      throw this.normalizeError(e, undefined);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  async testConnection(model: string): Promise<ConnectionTestResult> {
    const started = Date.now();
    await this.chat({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 1,
    });
    return { ok: true, model, latencyMs: Date.now() - started };
  }

  // ---------------------------------------------------------------- private

  private async withRetry(
    fn: () => Promise<ProviderChatResponse>,
    userSignal?: AbortSignal,
  ): Promise<ProviderChatResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (userSignal?.aborted) {
        throw new ProviderError('cancelled', 'İstek iptal edildi.');
      }
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        const retryable =
          e instanceof ProviderError && (e.code === 'rate_limit' || e.code === 'server');
        if (!retryable || attempt === this.maxRetries || userSignal?.aborted) throw e;
        const delay = Math.min(this.retryDelayMs * 2 ** attempt, 16_000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  private async chatOnce(req: ProviderChatRequest): Promise<ProviderChatResponse> {
    const { signal, controller, timer } = this.prepareSignal(req.signal);
    try {
      const res = await this.request('POST', '/chat/completions', this.buildBody(req), signal);
      if (!res.ok) throw mapHttpError(res.status);
      const data = (await res.json()) as DeepSeekResponse;
      const choice = data.choices?.[0];
      const message = choice?.message;
      const toolCalls = toToolCalls(message?.tool_calls);
      return {
        content: message?.content ?? '',
        toolCalls: toolCalls.length ? toolCalls : undefined,
        finishReason: toFinishReason(choice?.finish_reason ?? null),
        usage: toUsage(data.usage),
      };
    } catch (e) {
      throw this.normalizeError(e, req.signal);
    } finally {
      clearTimeout(timer);
      if (!req.signal) controller.abort();
    }
  }

  private buildBody(req: ProviderChatRequest): Record<string, unknown> {
    const messages = req.messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.toolCalls
        ? {
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          }
        : {}),
    }));
    const body: Record<string, unknown> = { model: req.model, messages };
    if (req.tools?.length) body.tools = req.tools;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    return body;
  }

  private prepareSignal(userSignal?: AbortSignal): {
    signal: AbortSignal;
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = userSignal
      ? AbortSignal.any([userSignal, controller.signal])
      : controller.signal;
    return { signal, controller, timer };
  }

  private async request(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Response> {
    const key = await this.getApiKey();
    if (!key) throw new ProviderError('auth', 'API anahtarı ayarlanmamış.');
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  }

  private normalizeError(e: unknown, userSignal?: AbortSignal): ProviderError {
    if (e instanceof ProviderError) return e;
    if (isAbortError(e)) {
      if (userSignal?.aborted) {
        return new ProviderError('cancelled', 'İstek iptal edildi.');
      }
      return new ProviderError('timeout', 'Sağlayıcı zaman aşımına uğradı.');
    }
    if (e instanceof TypeError) {
      return new ProviderError('network', 'Ağ bağlantısı kurulamadı — interneti kontrol et.');
    }
    return new ProviderError('unknown', 'Beklenmeyen bir hata oluştu.');
  }

  /** SSE akışını okur; delta'ları onDelta'ya verir, son cevabı döner. */
  private async readStream(
    res: Response,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<ProviderChatResponse> {
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let finishReason: FinishReason = 'unknown';
    let usage: TokenUsage | undefined;
    const streamToolCalls = new Map<number, { id?: string; name?: string; args?: string }>();

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const data = JSON.parse(payload) as DeepSeekResponse;
        const maybeUsage = toUsage(data.usage);
        if (maybeUsage) usage = maybeUsage;
        const choice = data.choices?.[0];
        if (!choice) return;
        if (choice.finish_reason) finishReason = toFinishReason(choice.finish_reason);
        const deltaText = choice.delta?.content ?? '';
        if (deltaText) {
          content += deltaText;
          onDelta(deltaText);
        }
        for (const tc of choice.delta?.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const cur = streamToolCalls.get(idx) ?? {};
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args = (cur.args ?? '') + tc.function.arguments;
          streamToolCalls.set(idx, cur);
        }
      } catch {
        // Tek bozuk satır akışı öldürmez; bir sonraki satırla devam eder.
      }
    };

    if (!res.body) throw new ProviderError('network', 'Akış alınamadı.');
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (signal.aborted) throw new ProviderError('cancelled', 'İstek iptal edildi.');
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    for (const line of buffer.split('\n')) handleLine(line);

    const toolCalls: ToolCall[] = [...streamToolCalls.values()]
      .filter((t) => t.id && t.name)
      .map((t) => ({ id: t.id as string, name: t.name as string, arguments: t.args ?? '{}' }));

    return { content, toolCalls: toolCalls.length ? toolCalls : undefined, finishReason, usage };
  }
}
