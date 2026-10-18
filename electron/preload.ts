/**
 * Preload — dar ve sabit köprü. Renderer'da Node erişimi YOK.
 * API anahtarı bu köprüden GEÇMEZ (sadece var/yok bilgisi).
 */
import { contextBridge, ipcRenderer } from 'electron';

const quatra = {
  version: '0.1.0',

  /** Çalışılan platform (salt okunur) — arayüz platforma göre uyum sağlar. */
  platform: process.platform,

  settings: {
    load: (): Promise<unknown> => ipcRenderer.invoke('settings:load'),
    save: (data: unknown): Promise<{ ok: boolean }> => ipcRenderer.invoke('settings:save', data),
    exportFile: (): Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }> =>
      ipcRenderer.invoke('settings:export'),
    importFile: (): Promise<{ ok: boolean; canceled?: boolean; message?: string }> =>
      ipcRenderer.invoke('settings:import'),
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
    ): Promise<{
      ok: boolean;
      audio?: ArrayBuffer;
      mime?: string;
      code?: string;
      message?: string;
    }> => ipcRenderer.invoke('tts:synthesize', text, voice, rate, pitch),
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
    test: (
      model: string,
    ): Promise<{ ok: boolean; code?: string; message?: string; latencyMs?: number }> =>
      ipcRenderer.invoke('provider:test', model),
    models: (): Promise<{
      ok: boolean;
      code?: string;
      message?: string;
      models?: Array<{ id: string }>;
    }> => ipcRenderer.invoke('provider:models'),
  },

  agent: {
    run: (req: {
      text: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
      personality?: string;
      useMemory?: boolean;
      memoryEngine?: 'local' | 'mem0';
      autoLearn?: boolean;
      detailed?: boolean;
      retainTranscripts?: boolean;
    }): Promise<{ started: boolean }> => ipcRenderer.invoke('agent:run', req),
    cancel: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('agent:cancel'),
    confirm: (requestId: string, approved: boolean): Promise<{ ok: boolean; handled: boolean }> =>
      ipcRenderer.invoke('agent:confirm', requestId, approved),
    clearContext: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('agent:clear-context'),
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
    getLaunchAtLogin: (): Promise<{ ok: boolean; supported: boolean; enabled: boolean }> =>
      ipcRenderer.invoke('app:login-item-get'),
    setLaunchAtLogin: (
      enabled: boolean,
    ): Promise<{ ok: boolean; supported: boolean; enabled?: boolean; message?: string }> =>
      ipcRenderer.invoke('app:login-item-set', enabled),
    askMicAccess: (): Promise<{ ok: boolean; granted: boolean }> =>
      ipcRenderer.invoke('app:mic-access'),
    onCommand: (handler: (cmd: { name: 'toggle-mic' | 'open-settings' }) => void): (() => void) => {
      const listener = (_e: unknown, cmd: { name: 'toggle-mic' | 'open-settings' }) => handler(cmd);
      ipcRenderer.on('app:command', listener);
      return () => ipcRenderer.removeListener('app:command', listener);
    },
  },

  log: {
    openLogs: (): Promise<{ ok: boolean; path?: string; message?: string }> =>
      ipcRenderer.invoke('log:open'),
    path: (): Promise<{ ok: boolean; path?: string; dir?: string }> =>
      ipcRenderer.invoke('log:path'),
    clear: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('log:clear'),
    rendererError: (level: 'warn' | 'error', message: string): void =>
      ipcRenderer.send('log:renderer', level, 'renderer', message),
    info: (scope: string, message: string): void =>
      ipcRenderer.send('log:renderer', 'info', scope, message),
  },

  audit: {
    list: (): Promise<{
      ok: boolean;
      entries: Array<{ ts: string; tool: string; ok: boolean; detail: string; ms: number }>;
    }> => ipcRenderer.invoke('audit:list'),
    clear: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('audit:clear'),
  },

  usage: {
    get: (): Promise<{
      ok: boolean;
      month: string;
      monthUsage: { prompt: number; completion: number; requests: number };
      total: { prompt: number; completion: number; requests: number };
    }> => ipcRenderer.invoke('usage:get'),
  },

  notes: {
    lastBackup: (): Promise<{
      ok: boolean;
      record: { target: string; backup: string; ts: string } | null;
    }> => ipcRenderer.invoke('notes:last-backup'),
    restore: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('notes:restore'),
  },

  privacy: {
    clearTranscripts: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('privacy:clear-transcripts'),
  },

  memory: {
    list: (): Promise<Array<{ id: string; text: string; createdAt: string; source: string }>> =>
      ipcRenderer.invoke('memory:list'),
    add: (
      text: string,
      source: 'user' | 'assistant',
    ): Promise<{
      ok: boolean;
      entry?: { id: string; text: string; createdAt: string; source: string };
    }> => ipcRenderer.invoke('memory:add', text, source),
    remove: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('memory:remove', id),
    clear: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('memory:clear'),
  },

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('quatra', quatra);

export type QuatraBridge = typeof quatra;
