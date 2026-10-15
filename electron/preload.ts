/**
 * Preload — dar ve sabit köprü. Renderer'da Node erişimi YOK.
 * API anahtarı bu köprüden GEÇMEZ (sadece var/yok bilgisi).
 */
import { contextBridge, ipcRenderer } from 'electron';

const quatra = {
  version: '0.1.0',

  settings: {
    load: (): Promise<unknown> => ipcRenderer.invoke('settings:load'),
    save: (data: unknown): Promise<{ ok: boolean }> => ipcRenderer.invoke('settings:save', data),
  },

  credentials: {
    has: (): Promise<boolean> => ipcRenderer.invoke('credentials:has'),
    available: (): Promise<boolean> => ipcRenderer.invoke('credentials:available'),
    set: (key: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('credentials:set', key),
    clear: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('credentials:clear'),
  },

  provider: {
    test: (model: string): Promise<{ ok: boolean; code?: string; message?: string; latencyMs?: number }> =>
      ipcRenderer.invoke('provider:test', model),
    models: (): Promise<{ ok: boolean; code?: string; message?: string; models?: Array<{ id: string }> }> =>
      ipcRenderer.invoke('provider:models'),
  },

  agent: {
    run: (req: { text: string; model: string; temperature?: number; maxTokens?: number; personality?: string }): Promise<{ started: boolean }> =>
      ipcRenderer.invoke('agent:run', req),
    cancel: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('agent:cancel'),
    onEvent: (handler: (event: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown) => handler(payload);
      ipcRenderer.on('agent:event', listener);
      return () => ipcRenderer.removeListener('agent:event', listener);
    },
  },

  tools: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('tools:pickDirectory'),
  },

  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    rendererReady: (): void => ipcRenderer.send('app:renderer-ready'),
  },

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('quatra', quatra);

export type QuatraBridge = typeof quatra;
