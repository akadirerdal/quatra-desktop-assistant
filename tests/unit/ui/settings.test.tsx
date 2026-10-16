// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../../../src/features/settings/SettingsPanel';
import { AssistantController } from '../../../src/features/assistant/assistant-controller';

let savedBy: Record<string, string> = {};
let hasState: Record<string, boolean> = {};

function installBridge(): void {
  (window as unknown as { quatra: unknown }).quatra = {
    version: '0.1.0',
    settings: {
      load: async () => null,
      save: async () => ({ ok: true }),
      exportFile: async () => ({ ok: true, canceled: true }),
      importFile: async () => ({ ok: true, canceled: true }),
    },
    credentials: {
      has: async (id: string) => !!hasState[id],
      available: async () => true,
      set: async (id: string, k: string) => {
        savedBy[id] = k;
        hasState[id] = true;
        return { ok: true };
      },
      clear: async (id: string) => {
        hasState[id] = false;
        return { ok: true };
      },
    },
    provider: {
      test: async () => ({ ok: true, latencyMs: 5 }),
      models: async () => ({ ok: true, models: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
    },
    stt: { transcribe: async () => ({ ok: true, text: 'test' }) },
    tts: { voices: async () => ({ ok: false, message: 'test köprüsü' }) },
    shortcut: { register: async () => ({ ok: true }), onTrigger: () => () => undefined },
    agent: {
      run: async () => ({ started: true }),
      cancel: async () => ({ ok: true }),
      clearContext: async () => ({ ok: true }),
      onEvent: () => () => undefined,
    },
    tools: { pickDirectory: async () => null },
    app: {
      version: async () => '0.1.0',
      rendererReady: () => undefined,
      getLaunchAtLogin: async () => ({ ok: true, supported: false, enabled: false }),
      setLaunchAtLogin: async () => ({ ok: false, supported: false }),
      onCommand: () => () => undefined,
    },
    audit: {
      list: async () => ({ ok: true, entries: [] }),
      clear: async () => ({ ok: true }),
    },
    usage: {
      get: async () => ({
        ok: true,
        month: '2026-10',
        monthUsage: { prompt: 0, completion: 0, requests: 0 },
        total: { prompt: 0, completion: 0, requests: 0 },
      }),
    },
    notes: {
      lastBackup: async () => ({ ok: true, record: null }),
      restore: async () => ({ ok: false, message: 'yok' }),
    },
    privacy: { clearTranscripts: async () => ({ ok: true }) },
    log: {
      openLogs: async () => ({ ok: true }),
      path: async () => ({ ok: true }),
      clear: async () => ({ ok: true }),
      rendererError: () => undefined,
      info: () => undefined,
    },
    window: { minimize: () => undefined, toggleMaximize: () => undefined, close: () => undefined },
  };
}

beforeEach(() => {
  savedBy = {};
  hasState = {};
  installBridge();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { quatra?: unknown }).quatra;
});

describe('SettingsPanel — API anahtarı akışı', () => {
  it('kaydedince başarı rozeti gösterir, alanı temizler ve anahtarı köprüye iletir', async () => {
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByText('AI Sağlayıcı'));

    const input = screen.getAllByPlaceholderText('Anahtarı yapıştır')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test-abc-123' } });
    fireEvent.click(screen.getAllByText('Kaydet')[0]);

    expect(await screen.findByText('Anahtar kaydedildi ✓')).toBeTruthy();
    expect(input.value).toBe(''); // güvenlik: alan temizlenir
    expect(savedBy['deepseek']).toBe('test-abc-123');
    // Kayıttan sonra Kaldır butonu görünür.
    expect(screen.getByText('Kaldır')).toBeTruthy();
    controller.dispose();
  });

  it('başarısız kayıtta hata mesajı gösterir', async () => {
    (window as unknown as { quatra: { credentials: { set: unknown } } }).quatra.credentials.set = async () => ({
      ok: false,
      error: 'Sistem kasası yok',
    });
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByText('AI Sağlayıcı'));

    fireEvent.change(screen.getAllByPlaceholderText('Anahtarı yapıştır')[0]!, {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getAllByText('Kaydet')[0]);

    expect(await screen.findByText('Sistem kasası yok')).toBeTruthy();
    controller.dispose();
  });

  it('anahtar varken "Anahtar kayıtlı" rozeti gösterir', async () => {
    hasState = { deepseek: true };
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByText('AI Sağlayıcı'));
    expect(await screen.findByText('Anahtar kayıtlı')).toBeTruthy();
    controller.dispose();
  });
});

describe('SettingsPanel — mikrofon testi ve kademeli ayarlar', () => {
  it('ses bölümünde yeni kontroller görünür', () => {
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByText('Ses ve Giriş'));
    expect(screen.getByText('Mikrofonu test et')).toBeTruthy();
    expect(screen.getByText('Ek kazanç')).toBeTruthy();
    expect(screen.getByText('Gürültü kapısı')).toBeTruthy();
    expect(screen.getByText('Uyku süresi (sessizlik)')).toBeTruthy();
    expect(screen.getByText('Testi başlat')).toBeTruthy();
    expect(screen.getByText('Mikrofon cihazı')).toBeTruthy();
    controller.dispose();
  });
});
