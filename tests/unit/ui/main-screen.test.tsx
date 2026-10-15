// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MainScreen } from '../../../src/features/assistant/MainScreen';
import { App } from '../../../src/renderer/App';
import { useAssistantStore } from '../../../src/state/assistant-store';
import { setSettingsBackend, useSettingsStore } from '../../../src/state/settings-store';
import { DEFAULT_SETTINGS } from '../../../src/state/settings-schema';
import { MemorySettingsBackend } from '../../../src/services/storage/settings-storage';

function renderMain(): void {
  render(<MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} />);
}

beforeEach(() => {
  useAssistantStore.setState({
    status: 'idle',
    caption: '',
    tasks: [],
    micLevel: 0,
    speakLevel: 0,
    mutedByUser: false,
    mode: 'flash',
    connection: 'unknown',
    connectionError: null,
  });
  setSettingsBackend(new MemorySettingsBackend());
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: true, loadError: null, saveError: null });
});

afterEach(() => {
  cleanup();
  useAssistantStore.setState({ tasks: [], caption: '', status: 'idle' });
});

describe('MainScreen', () => {
  it('marka ve durum metnini gösterir', () => {
    renderMain();
    expect(screen.getByText('QUATRA')).toBeTruthy();
    expect(screen.getByText('Hazır')).toBeTruthy();
  });

  it('chat paneli yasak — input/textarea yok', () => {
    const { container } = render(
      <MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} />,
    );
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('görev balonunu saydam kutu olarak gösterir', () => {
    useAssistantStore.getState().pushTask({ title: 'Alarm kuruldu — 06:00', detail: 'Tamamlandı', state: 'done' });
    renderMain();
    expect(screen.getByText('Alarm kuruldu — 06:00')).toBeTruthy();
    expect(screen.getByText('Tamamlandı')).toBeTruthy();
  });

  it('model pill varsayılan seviye adını, pro modda model adını gösterir', () => {
    renderMain();
    expect(screen.getByText('Varsayılan')).toBeTruthy();
    act(() => {
      useAssistantStore.getState().setMode('pro');
    });
    expect(screen.getByText('deepseek-reasoner')).toBeTruthy();
  });

  it('model menüsünde seviyeler listelenir; Max seçilince ayarlar gerçekten güncellenir', async () => {
    renderMain();
    fireEvent.click(screen.getByTitle('Model seç'));
    expect(await screen.findByText('Ultra Max')).toBeTruthy();
    expect(screen.getByText('Düşük')).toBeTruthy();
    expect(screen.getByText('Yüksek')).toBeTruthy();

    fireEvent.click(screen.getByText('Max'));
    await waitFor(() => {
      const p = useSettingsStore.getState().settings.provider;
      expect(p.flashModel).toBe('deepseek-reasoner');
      expect(p.maxTokens).toBe(8192);
      expect(p.temperature).toBe(1);
    });
  });

  it('mod pill Hızlı gösterir; menüden Düşünceli seçilince mod değişir', () => {
    renderMain();
    const modePill = screen.getByTitle('Çalışma modu');
    expect(modePill.textContent).toContain('Hızlı');

    fireEvent.click(modePill);
    const proOption = screen.getByText('Düşünceli');
    fireEvent.click(proOption);

    expect(useAssistantStore.getState().mode).toBe('pro');
    expect(screen.getByText('deepseek-reasoner')).toBeTruthy();
  });
  it('model pill tıklanınca model menüsü açılır', () => {
    renderMain();
    fireEvent.click(screen.getByTitle('Model seç'));
    expect(screen.getByText('DeepSeek · Model seç')).toBeTruthy();
  });

  it('mikrofon kapalıyken MIC OFF gösterir', () => {
    act(() => {
      useAssistantStore.getState().setMuted(true);
    });
    renderMain();
    expect(screen.getByText('Mikrofon kapalı')).toBeTruthy();
  });
});

describe('App smoke', () => {
  it('özel başlık çubuğu ve pencere kontrolleri render edilir', () => {
    render(<App />);
    expect(screen.getByText('QUATRA')).toBeTruthy();
    expect(screen.getByLabelText('Küçült')).toBeTruthy();
    expect(screen.getByLabelText('Büyüt veya geri al')).toBeTruthy();
    expect(screen.getByLabelText('Kapat')).toBeTruthy();
  });

  it('File/Edit tarzı menü öğesi içermez', () => {
    render(<App />);
    expect(screen.queryByText('File')).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
  });
});
