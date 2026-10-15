/** Preload köprüsünün tipi — renderer yalnızca bunu görür (Node yok). */
export interface QuatraBridge {
  version: string;
  settings: {
    load(): Promise<unknown>;
    save(data: unknown): Promise<{ ok: boolean }>;
  };
  credentials: {
    has(): Promise<boolean>;
    available(): Promise<boolean>;
    set(key: string): Promise<{ ok: boolean; error?: string }>;
    clear(): Promise<{ ok: boolean }>;
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
    }): Promise<{ started: boolean }>;
    cancel(): Promise<{ ok: boolean }>;
    onEvent(handler: (event: AgentEvent) => void): () => void;
  };
  tools: {
    pickDirectory(): Promise<string | null>;
  };
  app: {
    version(): Promise<string>;
    rendererReady(): void;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}

export type AgentEvent =
  | { type: 'start'; requestId: string }
  | { type: 'caption'; requestId: string; text: string }
  | { type: 'done'; requestId: string; text: string; iterations: number; toolCalls: number }
  | { type: 'error'; requestId: string; category: string; message: string };

declare global {
  interface Window {
    quatra?: QuatraBridge;
  }
}

export {};
