/**
 * Ayarlar store'u — zustand. Kalıcılık backend'den beslenir (DI ile).
 *
 * Yazma stratejisi (V1.2-010): `update` önce durumu iyimser biçimde `set` eder
 * (UI anında tepki verir), diske yazım debounce ile toplanır ve yazma kuyruğunda
 * son-durum-kazanır kuralıyla serileştirilir. Böylece slider'ın her input olayı
 * ayrı bir dosya yazımı tetiklemez ve hızlı ardışık değişiklikler kaybolmaz.
 */
import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  recoverSettings,
  sanitizeSettingsWithReport,
  validateSettings,
} from './settings-schema';
import type { Settings } from './settings-schema';
import {
  LocalStorageSettingsBackend,
  MemorySettingsBackend,
} from '../services/storage/settings-storage';
import type { SettingsBackend } from '../services/storage/settings-storage';

export type AssistantMode = 'flash' | 'pro';

/** Slider her input olayında update çağırır; yazımlar bu süre boyunca birleştirilir. */
const SAVE_DEBOUNCE_MS = 400;

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

/** Uzun hata listelerini panelde gösterilebilir tek satıra indirir. */
function summarize(issues: string[]): string {
  const shown = issues.slice(0, 4).join('; ');
  return issues.length > 4 ? `${shown} …` : shown;
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Diske yazılmayı bekleyen en son durum — yenisi gelince eskisi düşer (son-durum-kazanır). */
  let pendingSave: Settings | null = null;
  /** Yazma kuyruğu: her yazım öncekinin bitmesini bekler. */
  let writeQueue: Promise<void> = Promise.resolve();
  /** saveError kaynağı: doğrulama hatası bir sonraki başarılı yazımda silinmesin (V1.2-011). */
  let errorSource: 'validation' | 'save' | null = null;

  function cancelDebounce(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  /** Debounce'u beklemeden bekleyen son durumu yazar; kuyruk boşalana kadar beklenebilir. */
  function flushPendingSave(): Promise<void> {
    cancelDebounce();
    writeQueue = writeQueue.then(async () => {
      while (pendingSave !== null) {
        const value = pendingSave;
        pendingSave = null;
        try {
          await defaultBackend().save(value);
          // Doğrulama hatası mesajı korunur; disk hatası başarılı yazımla temizlenir.
          if (errorSource === 'save') {
            errorSource = null;
            set({ saveError: null });
          }
        } catch (e) {
          errorSource = 'save';
          set({ saveError: e instanceof Error ? e.message : 'Ayarlar kaydedilemedi' });
        }
      }
    });
    return writeQueue;
  }

  /** Yazımı debounce'lar: hızlı ardışık değişiklikler tek yazıma iner (V1.2-010). */
  function scheduleSave(value: Settings): void {
    pendingSave = value;
    cancelDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void flushPendingSave();
    }, SAVE_DEBOUNCE_MS);
  }

  return {
    settings: DEFAULT_SETTINGS,
    loaded: false,
    loadError: null,
    saveError: null,

    load: async () => {
      try {
        await flushPendingSave(); // bekleyen yazım varsa önce diske indir
        const raw = await defaultBackend().load();
        const { settings, issues } = sanitizeSettingsWithReport(raw);
        set({
          settings,
          loaded: true,
          // Alan bazlı kurtarma sessiz kalmasın (V1.2-072): neyin varsayılana çekildiği bildirilir.
          loadError:
            issues.length > 0 ? `Geçersiz ayarlar varsayılana çekildi: ${summarize(issues)}` : null,
          saveError: null,
        });
        errorSource = null;
      } catch (e) {
        set({ loaded: true, loadError: e instanceof Error ? e.message : 'Ayarlar yüklenemedi' });
      }
    },

    update: async (patch) => {
      const current = get().settings;
      const candidate = { ...current, ...patch };
      const checked = validateSettings(candidate);
      if (checked.ok) {
        // İyimser güncelleme: slider sürüklerken UI anında yansır; yazım debounce'lanır.
        errorSource = null;
        set({ settings: checked.value, saveError: null });
        scheduleSave(checked.value);
        return;
      }
      // Alan bazlı kurtarma: geçerli alanlar uygulanır, geçersizler mevcut değerde kalır (V1.2-011).
      const recovered = recoverSettings(candidate, current);
      errorSource = 'validation';
      set({
        settings: recovered.settings,
        saveError:
          recovered.issues.length > 0 ? summarize(recovered.issues) : 'Ayarlar doğrulanamadı',
      });
      scheduleSave(recovered.settings);
    },

    updateProvider: async (patch) => {
      await get().update({ provider: { ...get().settings.provider, ...patch } });
    },

    restoreDefaults: async () => {
      // Bekleyen debounce'lu yazım iptal edilir; son söz varsayılanlardır.
      cancelDebounce();
      pendingSave = DEFAULT_SETTINGS;
      errorSource = null;
      set({ settings: DEFAULT_SETTINGS, saveError: null });
      await flushPendingSave();
    },
  };
});

/** Aktif moda göre model adı (mode pill + agent için). */
export function activeModel(settings: Settings, mode: AssistantMode): string {
  return mode === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
}
