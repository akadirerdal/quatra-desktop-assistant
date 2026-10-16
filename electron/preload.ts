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
    has: (id: string): Promise<boolean> => ipcRenderer.invoke('credentials:has', id),
    available: (): Promise<boolean> => ipcRenderer.invoke('credentials:available'),
    set: (id: string, key: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('credentials:set', id, key),
    clear: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('credentials:clear', id),
  },

  stt: {
    transcribe: (
      audio: ArrayBuffer,
      mimeType: string,
      language?: string,
    ): Promise<{ ok: boolean; text?: string; code?: string; message?: string }> =>
      ipcRenderer.invoke('stt:transcribe', audio, mimeType, language),
  },

  tts: {
    voices: (): Promise<{
      ok: boolean;
      voices?: Array<{ shortName: string; locale: string; gender: string }>;
      code?: string;
      message?: string;
    }> => ipcRenderer.invoke('tts:voices'),
    synthesize: (
      text: string,
      voice: string,
      rate: number,
      pitch: number,
    ): Promise<{ ok: boolean; audio?: ArrayBuffer; mime?: string; code?: string; message?: string }> =>
      ipcRenderer.invoke('tts:synthesize', text, voice, rate, pitch),
  },

  shortcut: {
    register: (accelerator: string): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('shortcut:register', accelerator),
    onTrigger: (handler: () => void): (() => void) => {
      const listener = () => handler();
      ipcRenderer.on('ptt:trigger', listener);
      return () => ipcRenderer.removeListener('ptt:trigger', listener);
    },
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

  log: {
    openLogs: (): Promise<{ ok: boolean; path?: string; message?: string }> =>
      ipcRenderer.invoke('log:open'),
    path: (): Promise<{ ok: boolean; path?: string; dir?: string }> => ipcRenderer.invoke('log:path'),
    rendererError: (level: 'warn' | 'error', message: string): void =>
      ipcRenderer.send('log:renderer', level, message),
  },

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('quatra', quatra);

export type QuatraBridge = typeof quatra;
