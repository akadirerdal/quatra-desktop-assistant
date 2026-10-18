/**
 * Ortak `QuatraBridge` mock üreticisi (V1.2-026).
 *
 * - Tip tek kaynaktan gelir: `electron/preload` (`import type` — preload testte ÇALIŞMAZ,
 *   bu yüzden `electron` bağımlılığı gerekmez).
 * - `satisfies QuatraBridge` sayesinde eksik alan (ör. `platform`, `tts.synthesize`,
 *   `agent.confirm`, `app.askMicAccess`, `memory.*`) DERLEME hatası verir; elle yazılan
 *   fake'lerin sessizce sürüklenmesi imkânsızlaşır.
 * - Bölüm bazlı override: `createBridgeMock({ platform: 'darwin' })` gibi; verilen bölüm
 *   eksikse yine derleme hatası alınır.
 */
import { vi } from 'vitest';
import type { QuatraBridge } from '../../electron/preload';

/** Testlerin kullanacağı mock köprü tipi (üretim tipiyle birebir aynı şekil). */
export type BridgeMock = QuatraBridge;

export function createBridgeMock(overrides: Partial<QuatraBridge> = {}): QuatraBridge {
  const base = {
    version: '0.1.0-test',
    platform: 'win32',
    settings: {
      load: vi.fn(async () => null),
      save: vi.fn(async () => ({ ok: true })),
      exportFile: vi.fn(async () => ({ ok: true, canceled: true })),
      importFile: vi.fn(async () => ({ ok: true, canceled: true })),
    },
    credentials: {
      has: vi.fn(async () => false),
      available: vi.fn(async () => true),
      set: vi.fn(async () => ({ ok: true })),
      clear: vi.fn(async () => ({ ok: true })),
    },
    stt: {
      transcribe: vi.fn(async () => ({ ok: true, text: 'test' })),
    },
    tts: {
      voices: vi.fn(async () => ({ ok: false, message: 'test köprüsü' })),
      synthesize: vi.fn(async () => ({ ok: false, message: 'test köprüsü' })),
    },
    shortcut: {
      register: vi.fn(async () => ({ ok: true })),
      onTrigger: vi.fn(() => () => undefined),
    },
    provider: {
      test: vi.fn(async () => ({ ok: true, latencyMs: 5 })),
      models: vi.fn(async () => ({
        ok: true,
        models: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }],
      })),
    },
    agent: {
      run: vi.fn(async () => ({ started: true })),
      cancel: vi.fn(async () => ({ ok: true })),
      confirm: vi.fn(async () => ({ ok: true, handled: true })),
      clearContext: vi.fn(async () => ({ ok: true })),
      onEvent: vi.fn(() => () => undefined),
    },
    tools: {
      pickDirectory: vi.fn(async () => null),
    },
    app: {
      version: vi.fn(async () => '0.1.0-test'),
      rendererReady: vi.fn(),
      getLaunchAtLogin: vi.fn(async () => ({ ok: true, supported: false, enabled: false })),
      setLaunchAtLogin: vi.fn(async () => ({ ok: false, supported: false })),
      askMicAccess: vi.fn(async () => ({ ok: true, granted: true })),
      onCommand: vi.fn(() => () => undefined),
    },
    log: {
      openLogs: vi.fn(async () => ({ ok: true })),
      path: vi.fn(async () => ({ ok: true })),
      clear: vi.fn(async () => ({ ok: true })),
      read: vi.fn(async () => ({ ok: true, lines: [] as string[] })),
      rendererError: vi.fn(),
      info: vi.fn(),
    },
    audit: {
      list: vi.fn(async () => ({ ok: true, entries: [] })),
      clear: vi.fn(async () => ({ ok: true })),
    },
    usage: {
      get: vi.fn(async () => ({
        ok: true,
        month: '2026-10',
        monthUsage: { prompt: 0, completion: 0, requests: 0 },
        total: { prompt: 0, completion: 0, requests: 0 },
      })),
    },
    notes: {
      lastBackup: vi.fn(async () => ({ ok: true, record: null })),
      restore: vi.fn(async () => ({ ok: false, message: 'yok' })),
    },
    privacy: {
      clearTranscripts: vi.fn(async () => ({ ok: true })),
    },
    memory: {
      list: vi.fn(async () => []),
      add: vi.fn(async () => ({ ok: true })),
      remove: vi.fn(async () => ({ ok: true })),
      clear: vi.fn(async () => ({ ok: true })),
    },
    window: {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
    },
  } satisfies QuatraBridge;

  return { ...base, ...overrides };
}

/** Mock'u `window.quatra`'ya kurar (jsdom testleri için). */
export function installBridgeMock(overrides: Partial<QuatraBridge> = {}): QuatraBridge {
  const bridge = createBridgeMock(overrides);
  (window as unknown as { quatra?: QuatraBridge }).quatra = bridge;
  return bridge;
}

/** Kurulu mock köprüyü kaldırır. */
export function removeBridgeMock(): void {
  delete (window as unknown as { quatra?: QuatraBridge }).quatra;
}
