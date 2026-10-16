/**
 * Provider abstraction — UI'dan bağımsız, değiştirilebilir AI sağlayıcı arayüzü.
 * V1: DeepSeek (birincil). V2: Groq (yedek). Bu interface ikisini de kapsar.
 */

/** Sohbet mesajı rolleri (OpenAI uyumlu format). */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  /** Modelin ürettiği argümanlar (JSON string). Çalıştırmadan önce şema ile doğrulanır. */
  arguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/** Modele tanıtılan görev (tool) tanımı. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** Kullanıcı iptali/zaman aşımı için dış sinyal. */
  signal?: AbortSignal;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';

export interface ProviderChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: FinishReason;
}

export interface ModelInfo {
  id: string;
  ownedBy?: string;
}

export interface ConnectionTestResult {
  ok: true;
  model: string;
  latencyMs: number;
}

/** Yapılandırılmış sağlayıcı hatası. Mesajlar kullanıcıya gösterilebilir, secret içermez. */
export type ProviderErrorCode =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'bad_request'
  | 'unsupported'
  | 'server'
  | 'unknown';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Yedek sağlayıcıya geçmeye uygun geçici hatalar (V1-12) — kalıcı hatalarda geçilmez. */
export function isFallbackEligible(code: ProviderErrorCode): boolean {
  return (
    code === 'network' ||
    code === 'timeout' ||
    code === 'server' ||
    code === 'rate_limit' ||
    code === 'auth'
  );
}

/** HTTP durum kodunu yapılandırılmış hataya çevirir (body asla mesaja gömülmez). */
export function mapHttpError(status: number): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('auth', 'API anahtarı geçersiz veya yetkisiz.', status);
  }
  if (status === 402) {
    return new ProviderError('auth', 'Hesapta bakiye yetersiz olabilir.', status);
  }
  if (status === 429) {
    return new ProviderError('rate_limit', 'Hız limitine takıldı, kısa süre sonra yeniden dene.', status);
  }
  if (status === 404) {
    return new ProviderError('unsupported', 'Model bulunamadı veya bu hesapta yok.', status);
  }
  if (status >= 500) {
    return new ProviderError('server', 'Sağlayıcı sunucusu şu an hata veriyor.', status);
  }
  if (status >= 400) {
    return new ProviderError('bad_request', 'İstek geçersiz — model veya parametreler uyumsuz olabilir.', status);
  }
  return new ProviderError('unknown', 'Beklenmeyen sağlayıcı hatası.', status);
}

export interface ProviderAdapter {
  chat(req: ProviderChatRequest): Promise<ProviderChatResponse>;
  chatStream(req: ProviderChatRequest, onDelta: (text: string) => void): Promise<ProviderChatResponse>;
  listModels(): Promise<ModelInfo[]>;
  testConnection(model: string): Promise<ConnectionTestResult>;
}
