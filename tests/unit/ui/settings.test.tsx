// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../../../src/features/settings/SettingsPanel';
import { AssistantController } from '../../../src/features/assistant/assistant-controller';
import { installBridgeMock, removeBridgeMock, type BridgeMock } from '../../helpers/bridge';

let savedBy: Record<string, string> = {};
let hasState: Record<string, boolean> = {};
let bridge: BridgeMock;

// Ortak mock: eksik alan derleme hatası verir (V1.2-026). Burada yalnızca
// anahtar akışını kaydeden davranış override edilir.
beforeEach(() => {
  savedBy = {};
  hasState = {};
  bridge = installBridgeMock({
    credentials: {
      has: async (id: string) => !!hasState[id],
      available: async () => true,
      set: async (id: string, key: string) => {
        savedBy[id] = key;
        hasState[id] = true;
        return { ok: true };
      },
      clear: async (id: string) => {
        hasState[id] = false;
        return { ok: true };
      },
    },
  });
});

afterEach(() => {
  cleanup();
  removeBridgeMock();
});

describe('SettingsPanel — API anahtarı akışı', () => {
  it('kaydedince başarı rozeti gösterir, alanı temizler ve anahtarı köprüye iletir', async () => {
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI Sağlayıcı' }));

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
    bridge.credentials.set = async () => ({
      ok: false,
      error: 'Sistem kasası yok',
    });
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI Sağlayıcı' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'AI Sağlayıcı' }));
    expect(await screen.findByText('Anahtar kayıtlı')).toBeTruthy();
    controller.dispose();
  });
});

describe('SettingsPanel — mikrofon testi ve kademeli ayarlar', () => {
  it('ses bölümünde yeni kontroller görünür', () => {
    const controller = new AssistantController();
    render(<SettingsPanel onClose={() => undefined} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ses ve Giriş' }));
    expect(screen.getByText('Mikrofonu test et')).toBeTruthy();
    expect(screen.getByText('Ek kazanç')).toBeTruthy();
    expect(screen.getByText('Gürültü kapısı')).toBeTruthy();
    expect(screen.getByText('Uyku süresi (sessizlik)')).toBeTruthy();
    expect(screen.getByText('Testi başlat')).toBeTruthy();
    expect(screen.getByText('Mikrofon cihazı')).toBeTruthy();
    controller.dispose();
  });
});
