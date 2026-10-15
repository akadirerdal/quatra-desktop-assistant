/**
 * Ayarlar store'u — zustand. Kalıcılık backend'den beslenir (DI ile).
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, sanitizeSettings, validateSettings } from './settings-schema';
import type { Settings } from './settings-schema';
import {
  LocalStorageSettingsBackend,
  MemorySettingsBackend,
} from '../services/storage/settings-storage';
import type { SettingsBackend } from '../services/storage/settings-storage';

export type AssistantMode = 'flash' | 'pro';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  loadError: string | null;
  saveError: string | null;

  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  updateProvider: (patch: Partial<Settings['provider']>) => Promise<void>;
  restoreDefaults: () => Promise<void>;
}

let backend: SettingsBackend | null = null;

/** Test ve farklı ortamlar için backend enjeksiyonu. */
export function setSettingsBackend(b: SettingsBackend): void {
  backend = b;
}

function defaultBackend(): SettingsBackend {
  if (backend) return backend;
  if (typeof window !== 'undefined' && window.localStorage) {
    // Dev modu fallback'i; Electron'da preload üzerinden IPC backend kurulur.
    backend = new LocalStorageSettingsBackend();
    return backend;
  }
  backend = new MemorySettingsBackend();
  return backend;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  loadError: null,
  saveError: null,

  load: async () => {
    try {
      const raw = await defaultBackend().load();
      const settings = sanitizeSettings(raw);
      set({ settings, loaded: true, loadError: null });
    } catch (e) {
      set({ loaded: true, loadError: e instanceof Error ? e.message : 'Ayarlar yüklenemedi' });
    }
  },

  update: async (patch) => {
    const candidate = { ...get().settings, ...patch };
    const result = validateSettings(candidate);
    if (!result.ok) {
      set({ saveError: result.issues.join('; ') });
      return;
    }
    try {
      await defaultBackend().save(result.value);
      set({ settings: result.value, saveError: null });
    } catch (e) {
      set({ saveError: e instanceof Error ? e.message : 'Ayarlar kaydedilemedi' });
    }
  },

  updateProvider: async (patch) => {
    await get().update({ provider: { ...get().settings.provider, ...patch } });
  },

  restoreDefaults: async () => {
    try {
      await defaultBackend().save(DEFAULT_SETTINGS);
      set({ settings: DEFAULT_SETTINGS, saveError: null });
    } catch (e) {
      set({ saveError: e instanceof Error ? e.message : 'Varsayılanlara dönülemedi' });
    }
  },
}));

/** Aktif moda göre model adı (mode pill + agent için). */
export function activeModel(settings: Settings, mode: AssistantMode): string {
  return mode === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
}
