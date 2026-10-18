/**
 * electron/tts-service — istek başına istemci, eşzamanlı sentez yarışı, zaman aşımı (V1.2-031).
 * `msedge-tts` mock'lanır; ağa çıkılmaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeStream {
  on(event: string, cb: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

const mockState = vi.hoisted(() => ({
  instances: [] as Array<{ closed: boolean }>,
  streams: [] as FakeStream[],
  metadataCalls: 0,
  autoFinish: true,
}));

vi.mock('msedge-tts', () => {
  class FakeStreamImpl {
    private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    on(event: string, cb: (...args: unknown[]) => void): void {
      const list = this.listeners.get(event) ?? [];
      list.push(cb);
      this.listeners.set(event, list);
    }
    emit(event: string, ...args: unknown[]): void {
      for (const cb of this.listeners.get(event) ?? []) cb(...args);
    }
  }
  class MsEdgeTTS {
    constructor() {
      mockState.instances.push(this);
    }
    closed = false;
    setMetadata(): Promise<void> {
      mockState.metadataCalls += 1;
      return Promise.resolve();
    }
    toStream(text: string): { audioStream: FakeStreamImpl; metadataStream: null } {
      const stream = new FakeStreamImpl();
      mockState.streams.push(stream);
      if (mockState.autoFinish) {
        queueMicrotask(() => {
          stream.emit('data', Buffer.from(`ses:${text}`));
          stream.emit('end');
        });
      }
      return { audioStream: stream, metadataStream: null };
    }
    close(): void {
      this.closed = true;
    }
  }
  class ProsodyOptions {
    rate = '';
    pitch = '';
  }
  return {
    MsEdgeTTS,
    ProsodyOptions,
    OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz' },
  };
});

import { disposeTts, synthesizeEdge } from '../../../electron/tts-service';

beforeEach(() => {
  mockState.instances.length = 0;
  mockState.streams.length = 0;
  mockState.metadataCalls = 0;
  mockState.autoFinish = true;
});

afterEach(() => {
  disposeTts();
  vi.useRealTimers();
});

describe('tts-service', () => {
  it('tek istekte sentez üretir ve istemciyi kapatır', async () => {
    const res = await synthesizeEdge('merhaba', 'tr-TR-EmelNeural', 1, 1);
    expect(res.mime).toBe('audio/mpeg');
    expect(res.audio.toString()).toBe('ses:merhaba');
    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0]!.closed).toBe(true);
  });

  it('eşzamanlı sentezler birbirinin istemcisini kapatmaz (istek başına istemci)', async () => {
    mockState.autoFinish = false;
    const p1 = synthesizeEdge('bir', 'tr-TR-EmelNeural', 1, 1);
    const p2 = synthesizeEdge('iki', 'tr-TR-AhmetNeural', 1, 1); // ses değişimi eşzamanlı
    await vi.waitFor(() => expect(mockState.streams).toHaveLength(2));
    expect(mockState.instances).toHaveLength(2);

    mockState.streams[0]!.emit('data', Buffer.from('bir!'));
    mockState.streams[0]!.emit('end');
    const r1 = await p1;
    expect(r1.audio.toString()).toBe('bir!');
    expect(mockState.instances[0]!.closed).toBe(true);
    expect(mockState.instances[1]!.closed).toBe(false); // süren istek ölmedi

    mockState.streams[1]!.emit('data', Buffer.from('iki!'));
    mockState.streams[1]!.emit('end');
    const r2 = await p2;
    expect(r2.audio.toString()).toBe('iki!');
  });

  it('akış asılı kalırsa zaman aşımına düşer ve istemci kapanır', async () => {
    vi.useFakeTimers();
    mockState.autoFinish = false;
    const p = synthesizeEdge('uzun', 'tr-TR-EmelNeural', 1, 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockState.streams).toHaveLength(1); // metadata tamam, akış kuruldu
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
    expect(mockState.instances[0]!.closed).toBe(true);
  });

  it('disposeTts süren istemcileri kapatır', async () => {
    mockState.autoFinish = false;
    const p = synthesizeEdge('asılı', 'tr-TR-EmelNeural', 1, 1);
    await vi.waitFor(() => expect(mockState.streams).toHaveLength(1));
    disposeTts();
    expect(mockState.instances[0]!.closed).toBe(true);
    mockState.streams[0]!.emit('error', new Error('kapandı'));
    await expect(p).rejects.toMatchObject({ code: 'network' });
  });
});
