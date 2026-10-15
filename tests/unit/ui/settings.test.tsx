// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../../../src/features/settings/SettingsPanel';
import { AssistantController } from '../../../src/features/assistant/assistant-controller';

let savedKey = '';
let hasKeyState = false;

function installBridge(): void {
  (window as unknown as { quatra: unknown }).quatra = {
    version: '0.1.0',
    settings: { load: async () => null, save: async () => ({ ok: true }) },
    credentials: {
      has: async () => hasKeyState,
      available: async () => true,
      set: async (k: string) => {
        savedKey = k;
        hasKeyState = true;
        return { ok: true };
      },
      clear: async () => {
        hasKeyState = false;
        return { ok: true };
      },
    },
    provider: {
      test: async () => ({ ok: true, latencyMs: 5 }),
      models: async () => ({ ok: true, models: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
    },
    agent: {
      run: async () => ({ started: true }),
      cancel: async () => ({ ok: true }),
      onEvent: () => () => undefined,
    },
    tools: { pickDirectory: async () => null },
    app: { version: async () => '0.1.0', rendererReady: () => undefined },
    window: { minimize: () => undefined, toggleMaximize: () => undefined, close: () => undefined },
  };
}

beforeEach(() => {
  savedKey = '';
  hasKeyState = false;
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

    const input = screen.getByPlaceholderText('Anahtarı yapıştır') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test-abc-123' } });
    fireEvent.click(screen.getByText('Kaydet'));

    expect(await screen.findByText('Anahtar kaydedildi ✓')).toBeTruthy();
    expect(input.value).toBe(''); // güvenlik: alan temizlenir
    expect(savedKey).toBe('test-abc-123');
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

    fireEvent.change(screen.getByPlaceholderText('Anahtarı yapıştır'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByText('Kaydet'));

    expect(await screen.findByText('Sistem kasası yok')).toBeTruthy();
    controller.dispose();
  });

  it('anahtar varken "Anahtar kayıtlı" rozeti gösterir', async () => {
    hasKeyState = true;
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByText('AI Sağlayıcı'));
    expect(await screen.findByText('Anahtar kayıtlı')).toBeTruthy();
    controller.dispose();
  });
});
