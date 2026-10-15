/** Electron IPC üzerinden ayar backend'i (atomik JSON, main süreçte). */
import type { SettingsBackend } from '../services/storage/settings-storage';

export class IpcSettingsBackend implements SettingsBackend {
  async load(): Promise<unknown> {
    if (!window.quatra) return null;
    return window.quatra.settings.load();
  }
  async save(data: unknown): Promise<void> {
    if (!window.quatra) return;
    await window.quatra.settings.save(data);
  }
}
