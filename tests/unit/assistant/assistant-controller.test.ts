// @vitest-environment jsdom
/**
 * Asistan denetleyicisi — V1.2 Dalga 2 (Ajan B7) davranış testleri.
 * Kapsam: sustur kapısı (V1.2-002), iptal edilen isteğin hatasını yutma (V1.2-013),
 * onay akışının temizlenmesi (V1.2-046), "dur bakalım" yutulmaması (V1.2-057),
 * dispose tamlığı (V1.2-001).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '../../../src/renderer/global';
import { AssistantController } from '../../../src/features/assistant/assistant-controller';
import { useAssistantStore } from '../../../src/state/assistant-store';
import { setSettingsBackend, useSettingsStore } from '../../../src/state/settings-store';
import { DEFAULT_SETTINGS } from '../../../src/state/settings-schema';
import { MemorySettingsBackend } from '../../../src/services/storage/settings-storage';
import { installBridgeMock, removeBridgeMock, type BridgeMock } from '../../helpers/bridge';

let bridge: BridgeMock;
let emitAgent: (event: AgentEvent) => void;
let controllers: AssistantController[] = [];

function makeController(): AssistantController {
  const controller = new AssistantController();
  controllers.push(controller);
  return controller;
}

beforeEach(() => {
  let handler: ((e: AgentEvent) => void) | null = null;
  bridge = installBridgeMock();
  // Ajan olaylarını testten tetikleyebilmek için handler'ı yakala.
  bridge.agent.onEvent = vi.fn((h: (e: AgentEvent) => void) => {
    handler = h;
    return () => undefined;
  }) as unknown as BridgeMock['agent']['onEvent'];
  emitAgent = (event) => handler?.(event);

  setSettingsBackend(new MemorySettingsBackend());
  useSettingsStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      // Testte TTS/uyandırma yan etkisi olmasın: sessiz + sürekli sohbet kapalı.
      voice: { ...DEFAULT_SETTINGS.voice, autoSpeak: false, continuous: false },
      activation: { ...DEFAULT_SETTINGS.activation, mode: 'manual' },
    },
    loaded: true,
    loadError: null,
    saveError: null,
  });
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
  for (const controller of controllers) controller.dispose();
  controllers = [];
  removeBridgeMock();
});

describe('V1.2-013 — iptal/eski isteğin hatası', () => {
  it('category "cancelled" hata sessizce yutulur', () => {
    const controller = makeController();
    emitAgent({ type: 'start', requestId: 'r1' });
    emitAgent({ type: 'error', requestId: 'r1', category: 'cancelled', message: 'iptal edildi' });

    const st = useAssistantStore.getState();
    expect(st.connection).toBe('unknown');
    expect(st.status).toBe('processing');
    expect(st.caption).toBe('');
    expect(controller).toBeTruthy();
  });

  it('eski isteğin hatası yeni isteği bozmaz', () => {
    makeController();
    emitAgent({ type: 'start', requestId: 'r1' });
    emitAgent({ type: 'start', requestId: 'r2' });
    emitAgent({ type: 'error', requestId: 'r1', category: 'provider', message: 'eski hata' });

    const st = useAssistantStore.getState();
    expect(st.connection).toBe('unknown');
    expect(st.status).toBe('processing');
    expect(st.caption).toBe('');
  });

  it('aktif isteğin hatası görünür ve seslendirilir', () => {
    makeController();
    emitAgent({ type: 'start', requestId: 'r3' });
    emitAgent({ type: 'error', requestId: 'r3', category: 'provider', message: 'bağlantı koptu' });

    const st = useAssistantStore.getState();
    expect(st.connection).toBe('failed');
    expect(st.status).toBe('error');
    expect(st.caption).toBe('bağlantı koptu');
  });
});

describe('V1.2-002 — sustur kapısı', () => {
  it('susturulmuşken startCommandCapture mikrofonu AÇMAZ', async () => {
    const controller = makeController();
    controller.setMuted(true);
    const recordSpy = vi.spyOn(controller.audioService, 'recordCommand');

    await controller.startCommandCapture('ptt');

    expect(recordSpy).not.toHaveBeenCalled();
    expect(useAssistantStore.getState().status).toBe('muted');
  });

  it('susturulmuşken interrupt/stopSpeaking "muted" durumunu ezmez', () => {
    const controller = makeController();
    controller.setMuted(true);
    controller.interrupt();
    expect(useAssistantStore.getState().status).toBe('muted');
    controller.stopSpeaking();
    expect(useAssistantStore.getState().status).toBe('muted');
  });
});

describe('V1.2-046 — onay akışı temizliği', () => {
  it('handled:false dönüşünde "processing"te takılı kalmaz', async () => {
    const controller = makeController();
    emitAgent({ type: 'confirm', requestId: 'r9', tool: 'not_al' });
    bridge.agent.confirm = vi.fn(async () => ({ ok: true, handled: false }));

    controller.send('evet');

    await vi.waitFor(() => {
      const st = useAssistantStore.getState();
      expect(st.status).toBe('idle');
      expect(st.caption).toBe('Onay süresi geçmişti; işlem yapılmadı.');
    });
  });

  it('hata sonrası bekleyen onay temizlenir (sonraki komut onay sanılmaz)', () => {
    const controller = makeController();
    emitAgent({ type: 'confirm', requestId: 'r10', tool: 'not_al' });
    emitAgent({ type: 'error', requestId: 'r10', category: 'provider', message: 'hata' });

    controller.send('saat kaç');

    // Onay yanıtı beklenmiyordu: istek doğrudan ajana gitti.
    expect(bridge.agent.confirm).not.toHaveBeenCalled();
    expect(bridge.agent.run).toHaveBeenCalledWith(expect.objectContaining({ text: 'saat kaç' }));
  });
});

describe('V1.2-057 — "dur bakalım" yutulmaz', () => {
  it('konuşmuyorken "dur bakalım" ajana gider', () => {
    const controller = makeController();
    controller.send('dur bakalım');
    expect(bridge.agent.run).toHaveBeenCalledWith(expect.objectContaining({ text: 'dur bakalım' }));
    expect(useAssistantStore.getState().caption).not.toBe('Sustum.');
  });
});

describe('V1.2-001 — dispose', () => {
  it('idempotent ve dispose sonrası yakalama başlamaz', async () => {
    const controller = makeController();
    const recordSpy = vi.spyOn(controller.audioService, 'recordCommand');
    controller.dispose();
    controller.dispose();

    await controller.startCommandCapture('ptt');
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
