import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeSettings,
  sanitizeSettingsWithReport,
  validateSettings,
} from '../../src/state/settings-schema';
import { MemorySettingsBackend } from '../../src/services/storage/settings-storage';
import { setSettingsBackend, useSettingsStore } from '../../src/state/settings-store';

describe('settings schema', () => {
  it('boş girdiye default döner', () => {
    const s = sanitizeSettings(null);
    expect(s.assistantName).toBe('Lidra');
    expect(s.provider.flashModel).toBe('deepseek-chat');
    expect(s.voice.ttsEngine).toBe('edge');
    expect(s.voice.continuous).toBe(true);
  });

  it('geçerli alanları korur', () => {
    const s = sanitizeSettings({ assistantName: 'Asistan' });
    expect(s.assistantName).toBe('Asistan');
    expect(s.provider.flashModel).toBe('deepseek-chat');
  });

  it('tek bozuk alanda yalnız o alan varsayılana çekilir (V1.2-072)', () => {
    const s = sanitizeSettings({ assistantName: 'Asistan', provider: { flashModel: 123 } });
    expect(s.assistantName).toBe('Asistan'); // geçerli alan korunur
    expect(s.provider.flashModel).toBe('deepseek-chat'); // bozuk alan varsayılana düşer
  });

  it('kurtarma raporu bozuk alanı kısa Türkçe bildirir (V1.2-072)', () => {
    const r = sanitizeSettingsWithReport({ provider: { temperature: 5 } });
    expect(r.settings.provider.temperature).toBe(0.7);
    expect(r.issues.join(' ')).toContain('provider.temperature');
  });

  it('geçersiz sıcaklığı reddeder', () => {
    const r = validateSettings({ provider: { temperature: 5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(' ')).toContain('provider.temperature');
  });

  it('geçersiz renk kodunu reddeder', () => {
    const r = validateSettings({ appearance: { accent: 'mor' } });
    expect(r.ok).toBe(false);
  });
});

describe('settings store persistence', () => {
  it('load → update → tekrar load round-trip yapar (atomik backend)', async () => {
    const backend = new MemorySettingsBackend();
    setSettingsBackend(backend);
    const store = useSettingsStore.getState();
    await store.load();
    expect(useSettingsStore.getState().loaded).toBe(true);

    await useSettingsStore.getState().update({ assistantName: 'Aurora' });
    expect(useSettingsStore.getState().settings.assistantName).toBe('Aurora');
    // Yeni bir load, kaydedilen değeri gerçekten geri getirmeli (boş/mock değil).
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings.assistantName).toBe('Aurora');
    expect(useSettingsStore.getState().saveError).toBeNull();
    const raw = await backend.load();
    expect((raw as { assistantName?: string }).assistantName).toBe('Aurora');
  });

  it('bozuk backend verisi defaultlara düşer ve loadError bildirilir (V1.2-072)', async () => {
    setSettingsBackend(new MemorySettingsBackend('çöp'));
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings.assistantName).toBe('Lidra');
    expect(useSettingsStore.getState().loadError).not.toBeNull();
  });

  it('geçerli alanları korur, yalnız bozuk alanı varsayılana çeker (V1.2-072)', async () => {
    setSettingsBackend(
      new MemorySettingsBackend({
        assistantName: 'Asistan',
        appearance: { intensity: 0.2 },
        provider: { temperature: 5 },
      }),
    );
    await useSettingsStore.getState().load();
    const s = useSettingsStore.getState().settings;
    expect(s.assistantName).toBe('Asistan');
    expect(s.appearance.intensity).toBe(0.2);
    expect(s.provider.temperature).toBe(0.7);
    expect(useSettingsStore.getState().loadError).toContain('provider.temperature');
  });

  it('restoreDefaults defaults yazar', async () => {
    const backend = new MemorySettingsBackend();
    setSettingsBackend(backend);
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ assistantName: 'X' });
    await useSettingsStore.getState().restoreDefaults();
    expect(useSettingsStore.getState().settings.assistantName).toBe('Lidra');
  });

  it('hızlı ardışık update debounce ile tek yazıma iner, son durum kazanır (V1.2-010)', async () => {
    const saved: Array<{ assistantName: string }> = [];
    setSettingsBackend({
      load: async () => null,
      save: async (data: unknown) => {
        saved.push(data as { assistantName: string });
      },
    });
    await useSettingsStore.getState().load();

    vi.useFakeTimers();
    try {
      void useSettingsStore.getState().update({ assistantName: 'A' });
      void useSettingsStore.getState().update({ assistantName: 'B' });
      void useSettingsStore.getState().update({ assistantName: 'C' });
      // İyimser set: UI son değeri anında görür; debounce penceresinde henüz yazılmaz.
      expect(useSettingsStore.getState().settings.assistantName).toBe('C');
      expect(saved.length).toBe(0);
      await vi.advanceTimersByTimeAsync(500);
      expect(saved.length).toBe(1); // üç değişiklik tek yazıma indi
      expect(saved[0].assistantName).toBe('C'); // son durum kazandı
    } finally {
      vi.useRealTimers();
    }
  });

  it('geçersiz alan reddedilir, geçerli alan uygulanır ve hata bildirilir (V1.2-011)', async () => {
    const backend = new MemorySettingsBackend();
    setSettingsBackend(backend);
    await useSettingsStore.getState().load();

    vi.useFakeTimers();
    try {
      const current = useSettingsStore.getState().settings;
      await useSettingsStore.getState().update({
        assistantName: 'Yeni',
        provider: { ...current.provider, temperature: 5 },
      });

      const s = useSettingsStore.getState().settings;
      expect(s.assistantName).toBe('Yeni'); // geçerli alan anında uygulanır
      expect(s.provider.temperature).toBe(0.7); // geçersiz alan reddedilir
      expect(useSettingsStore.getState().saveError).toContain('provider.temperature');

      await vi.advanceTimersByTimeAsync(500); // debounce'lu yazım tamamlanır
      const raw = (await backend.load()) as { assistantName: string };
      expect(raw.assistantName).toBe('Yeni'); // geçerli kısım kalıcı oldu
      // Başarılı yazım, doğrulama hatasını silmez — kullanıcı düzeltene kadar görünür kalır.
      expect(useSettingsStore.getState().saveError).toContain('provider.temperature');
    } finally {
      vi.useRealTimers();
    }
  });
});
