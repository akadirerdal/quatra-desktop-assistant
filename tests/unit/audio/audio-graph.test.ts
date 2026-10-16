/**
 * Mikrofon zinciri regresyonu — "mikrofon ölü" hatası (16.10 düzeltmesi):
 * Analyser HAM kaynağa bağlı olmalı (kazançtan ÖNCE). Kazançtan sonra bağlanırsa
 * gürültü kapısı kapandığı anda seviye ~0 okunur ve kapı bir daha açılamaz;
 * tüm kayıtlar sonsuza dek "sessizlik" olur (log: art arda "kayıt sonu: sessizlik").
 *
 * Gerçek mikrofon GEREKMEZ — WebAudio düğümleri sahtedir; yalnızca bağlantı sırası doğrulanır.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../../src/features/audio/audio-service';

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAnalyser extends FakeNode {
  fftSize = 0;
  frequencyBinCount = 256;
  getByteTimeDomainData = vi.fn((arr: Uint8Array) => arr.fill(128));
}

class FakeGain extends FakeNode {
  gain = { setTargetAtTime: vi.fn() };
}

class FakeDestination extends FakeNode {
  stream = { getTracks: () => [], getAudioTracks: () => [] };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static nextState = 'running';

  state = FakeAudioContext.nextState;
  currentTime = 0;
  createMediaStreamSource = vi.fn(() => new FakeNode());
  createAnalyser = vi.fn(() => new FakeAnalyser());
  createGain = vi.fn(() => new FakeGain());
  createMediaStreamDestination = vi.fn(() => new FakeDestination());
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

function makeTrack() {
  return { readyState: 'live', stop: vi.fn(), label: 'test-mic' };
}

function makeStream(track: ReturnType<typeof makeTrack>) {
  return { getTracks: () => [track], getAudioTracks: () => [track] };
}

async function setupMic(state = 'running') {
  FakeAudioContext.nextState = state;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const track = makeTrack();
  const getUserMedia = vi.fn(async () => makeStream(track));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const service = new AudioService(vi.fn(), vi.fn(), vi.fn());
  const ok = await service.ensureMic();
  return { ok, getUserMedia, service, track };
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
  FakeAudioContext.nextState = 'running';
});

describe('AudioService — mikrofon zinciri (regresyon)', () => {
  it('analyser HAM kaynağa bağlanır; kazanç çıkışı analyser’a bağlanmaz', async () => {
    const { ok } = await setupMic();
    expect(ok).toBe(true);

    const ctx = FakeAudioContext.instances[0]!;
    const source = ctx.createMediaStreamSource.mock.results[0]!.value as FakeNode;
    const analyser = ctx.createAnalyser.mock.results[0]!.value as FakeAnalyser;
    const gain = ctx.createGain.mock.results[0]!.value as FakeGain;
    const dest = ctx.createMediaStreamDestination.mock.results[0]!.value as FakeDestination;

    // Ham tap: kaynak → analyser (kapı kararı ham seviyeden — kilitlenemez).
    expect(source.connect).toHaveBeenCalledWith(analyser);
    // Kayıt yolu: kaynak → kazanç → kayıt hedefi.
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(dest);
    // KRİTİK regresyon: kazanç çıkışı analyser'a bağlanmamalı (eski kilit hatası).
    expect(gain.connect).not.toHaveBeenCalledWith(analyser);
  });

  it('askıya düşmüş AudioContext açılışta resume edilir', async () => {
    const { ok } = await setupMic('suspended');
    expect(ok).toBe(true);
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('kopan cihaz akışı (readyState=ended) atılır ve yeniden açılır', async () => {
    const { service, track, getUserMedia } = await setupMic();
    track.readyState = 'ended';
    const again = await service.ensureMic();
    expect(again).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(2); // eski akış bırakıldı, yeni açıldı
    expect(track.stop).toHaveBeenCalled();
  });
});
