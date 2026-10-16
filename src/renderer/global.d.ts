/** Preload köprüsünün tipi — renderer yalnızca bunu görür (Node yok). */
export interface QuatraBridge {
  version: string;
  settings: {
    load(): Promise<unknown>;
    save(data: unknown): Promise<{ ok: boolean }>;
    exportFile(): Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }>;
    importFile(): Promise<{ ok: boolean; canceled?: boolean; message?: string }>;
  };
  credentials: {
    has(id: string): Promise<boolean>;
    available(): Promise<boolean>;
    set(id: string, key: string): Promise<{ ok: boolean; error?: string }>;
    clear(id: string): Promise<{ ok: boolean }>;
  };
  stt: {
    transcribe(
      audio: ArrayBuffer,
      mimeType: string,
      language?: string,
    ): Promise<{ ok: boolean; text?: string; code?: string; message?: string }>;
  };
  tts: {
    voices(): Promise<{
      ok: boolean;
      voices?: Array<{ shortName: string; locale: string; gender: string }>;
      code?: string;
      message?: string;
    }>;
    synthesize(
      text: string,
      voice: string,
      rate: number,
      pitch: number,
    ): Promise<{ ok: boolean; audio?: ArrayBuffer; mime?: string; code?: string; message?: string }>;
  };
  shortcut: {
    register(accelerator: string): Promise<{ ok: boolean; message?: string }>;
    onTrigger(handler: () => void): () => void;
  };
  provider: {
    test(model: string): Promise<{ ok: boolean; code?: string; message?: string; latencyMs?: number }>;
    models(): Promise<{ ok: boolean; code?: string; message?: string; models?: Array<{ id: string }> }>;
  };
  agent: {
    run(req: {
      text: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
      personality?: string;
      useMemory?: boolean;
      detailed?: boolean;
      memoryEngine?: 'local' | 'mem0';
      autoLearn?: boolean;
      retainTranscripts?: boolean;
    }): Promise<{ started: boolean }>;
    cancel(): Promise<{ ok: boolean }>;
    confirm(requestId: string, approved: boolean): Promise<{ ok: boolean; handled: boolean }>;
    clearContext(): Promise<{ ok: boolean }>;
    onEvent(handler: (event: AgentEvent) => void): () => void;
  };
  tools: {
    pickDirectory(): Promise<string | null>;
  };
  app: {
    version(): Promise<string>;
    rendererReady(): void;
    getLaunchAtLogin(): Promise<{ ok: boolean; supported: boolean; enabled: boolean }>;
    setLaunchAtLogin(
      enabled: boolean,
    ): Promise<{ ok: boolean; supported: boolean; enabled?: boolean; message?: string }>;
    onCommand(handler: (cmd: { name: 'toggle-mic' | 'open-settings' }) => void): () => void;
  };
  log: {
    openLogs(): Promise<{ ok: boolean; path?: string; message?: string }>;
    path(): Promise<{ ok: boolean; path?: string; dir?: string }>;
    clear(): Promise<{ ok: boolean }>;
    rendererError(level: 'warn' | 'error', message: string): void;
    info(scope: string, message: string): void;
  };
  audit: {
    list(): Promise<{
      ok: boolean;
      entries: Array<{ ts: string; tool: string; ok: boolean; detail: string; ms: number }>;
    }>;
    clear(): Promise<{ ok: boolean }>;
  };
  usage: {
    get(): Promise<{
      ok: boolean;
      month: string;
      monthUsage: { prompt: number; completion: number; requests: number };
      total: { prompt: number; completion: number; requests: number };
    }>;
  };
  notes: {
    lastBackup(): Promise<{ ok: boolean; record: { target: string; backup: string; ts: string } | null }>;
    restore(): Promise<{ ok: boolean; message: string }>;
  };
  privacy: {
    clearTranscripts(): Promise<{ ok: boolean }>;
  };
  memory: {
    list(): Promise<Array<{ id: string; text: string; createdAt: string; source: string }>>;
    add(
      text: string,
      source: 'user' | 'assistant',
    ): Promise<{ ok: boolean; entry?: { id: string; text: string; createdAt: string; source: string } }>;
    remove(id: string): Promise<{ ok: boolean }>;
    clear(): Promise<{ ok: boolean }>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}

export type AgentEvent =
  | { type: 'start'; requestId: string }
  | { type: 'sentence'; requestId: string; text: string }
  | { type: 'confirm'; requestId: string; tool: string }
  | { type: 'caption'; requestId: string; text: string }
  | { type: 'done'; requestId: string; text: string; iterations: number; toolCalls: number }
  | { type: 'error'; requestId: string; category: string; message: string };

declare global {
  interface Window {
    quatra?: QuatraBridge;
  }
}

export {};
