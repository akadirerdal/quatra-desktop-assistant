/**
 * Ayarlar kalıcılığı — backend interface + bellek içi implementasyon (test/dev).
 * Electron'da gerçek backend IPC üzerinden main süreçteki atomik JSON dosyasıdır.
 * API anahtarı BURADAN GEÇMEZ — credentials vault ayrıdır.
 */
export interface SettingsBackend {
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
}

export class MemorySettingsBackend implements SettingsBackend {
  private data: unknown = null;
  constructor(initial: unknown = null) {
    this.data = initial;
  }
  async load(): Promise<unknown> {
    return this.data;
  }
  async save(data: unknown): Promise<void> {
    this.data = data;
  }
}

/** localStorage tabanlı backend — SADECE tarayıcı geliştirme modu içindir; secret yazılmaz. */
export class LocalStorageSettingsBackend implements SettingsBackend {
  constructor(private readonly storageKey = 'quatra.settings') {}
  async load(): Promise<unknown> {
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null; // bozuk → defaults'a düş
    }
  }
  async save(data: unknown): Promise<void> {
    window.localStorage.setItem(this.storageKey, JSON.stringify(data));
  }
}
