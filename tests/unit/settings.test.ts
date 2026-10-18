import { describe, expect, it } from 'vitest';
import { sanitizeSettings, validateSettings } from '../../src/state/settings-schema';
import { MemorySettingsBackend } from '../../src/services/storage/settings-storage';
import { setSettingsBackend, useSettingsStore } from '../../src/state/settings-store';

describe('settings schema', () => {
  it('boş girdiye default döner', () => {
    const s = sanitizeSettings(null);
    expect(s.assistantName).toBe('Quatra');
    expect(s.provider.flashModel).toBe('deepseek-chat');
    expect(s.voice.ttsEngine).toBe('edge');
    expect(s.voice.continuous).toBe(true);
  });

  it('geçerli alanları korur', () => {
    const s = sanitizeSettings({ assistantName: 'Asistan' });
    expect(s.assistantName).toBe('Asistan');
    expect(s.provider.flashModel).toBe('deepseek-chat');
  });

  it('yapısal olarak bozuk girdide defaultlara düşer (recovery)', () => {
    const s = sanitizeSettings({ assistantName: 'Asistan', provider: { flashModel: 123 } });
    expect(s.assistantName).toBe('Quatra');
  });

  it('geçersiz sıcaklığı reddeder', () => {
    const r = validateSettings({ provider: { temperature: 5 } });
    expect(r.ok).toBe(false);
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

  it('bozuk backend verisi defaultlara düşer', async () => {
    setSettingsBackend(new MemorySettingsBackend('çöp'));
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings.assistantName).toBe('Quatra');
    expect(useSettingsStore.getState().loadError).toBeNull();
  });

  it('restoreDefaults defaults yazar', async () => {
    const backend = new MemorySettingsBackend();
    setSettingsBackend(backend);
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ assistantName: 'X' });
    await useSettingsStore.getState().restoreDefaults();
    expect(useSettingsStore.getState().settings.assistantName).toBe('Quatra');
  });
});
