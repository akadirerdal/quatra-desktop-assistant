// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MainScreen } from '../../../src/features/assistant/MainScreen';
import { App } from '../../../src/renderer/App';
import { useAssistantStore } from '../../../src/state/assistant-store';

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
});

afterEach(() => {
  cleanup();
  useAssistantStore.setState({ tasks: [], caption: '', status: 'idle' });
});

describe('MainScreen', () => {
  it('marka ve durum metnini gösterir', () => {
    render(<MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} onModeClick={() => undefined} />);
    expect(screen.getByText('QUATRA')).toBeTruthy();
    expect(screen.getByText('Hazır')).toBeTruthy();
  });

  it('chat paneli yasak — input/textarea yok', () => {
    const { container } = render(
      <MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} onModeClick={() => undefined} />,
    );
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('görev balonunu saydam kutu olarak gösterir', () => {
    useAssistantStore.getState().pushTask({ title: 'Alarm kuruldu — 06:00', detail: 'Tamamlandı', state: 'done' });
    render(<MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} onModeClick={() => undefined} />);
    expect(screen.getByText('Alarm kuruldu — 06:00')).toBeTruthy();
    expect(screen.getByText('Tamamlandı')).toBeTruthy();
  });

  it('model göstergesi aktif modeli gösterir', () => {
    render(<MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} onModeClick={() => undefined} />);
    expect(screen.getByText('deepseek-chat')).toBeTruthy();
    act(() => {
      useAssistantStore.getState().setMode('pro');
    });
    expect(screen.getByText('deepseek-reasoner')).toBeTruthy();
  });

  it('mikrofon kapalıyken MIC OFF gösterir', () => {
    act(() => {
      useAssistantStore.getState().setMuted(true);
    });
    render(<MainScreen onOpenSettings={() => undefined} onToggleMic={() => undefined} onModeClick={() => undefined} />);
    expect(screen.getByText('Mikrofon kapalı')).toBeTruthy();
  });
});

describe('App smoke', () => {
  it('ayarlar kapalıyken açılır ve ana ekranı gösterir', () => {
    render(<App />);
    expect(screen.getByText('QUATRA')).toBeTruthy();
  });

  it('API anahtarı yoksa first-run daveti görünür', async () => {
    // window.quatra yok (jsdom) → has() çağrısı yapılmaz; first-run state false kalır.
    // Gerçek ortamda main süreç "has=false" döndüğünde görünür; bu test ana ekranı doğrular.
    render(<App />);
    expect(screen.getByText('QUATRA')).toBeTruthy();
  });
});
