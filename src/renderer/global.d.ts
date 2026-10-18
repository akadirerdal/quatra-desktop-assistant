/** Preload köprüsünün tipi — tek kaynak: electron/preload.ts (V1.2-101: drift olmaması için).
 * Renderer bu tipi yeniden dışa aktarır; elle yazılmış kopya yoktur. */
import type { QuatraBridge as _QuatraBridge } from '../../electron/preload';
export type QuatraBridge = _QuatraBridge;

export type AgentEvent =
  | { type: 'start'; requestId: string }
  | { type: 'sentence'; requestId: string; text: string }
  | { type: 'confirm'; requestId: string; tool: string }
  | { type: 'caption'; requestId: string; text: string }
  | { type: 'media'; requestId: string }
  | { type: 'done'; requestId: string; text: string; iterations: number; toolCalls: number }
  | { type: 'error'; requestId: string; category: string; message: string };

declare global {
  interface Window {
    quatra?: QuatraBridge;
  }
}

export {};
