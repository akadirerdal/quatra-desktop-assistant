/**
 * AudioService yaşam döngüsü regresyonları:
 * V1.2-014 (single-flight mikrofon + tüm RAF temizliği), V1.2-049 (kayıt kilidi await öncesi),
 * V1.2-052 (decode hatasında ctx kapanır), V1.2-053 (eski utterance bayrağı ezmez),
 * V1.2-054 (stopAll kaydı iptal eder), V1.2-106/107/108 (dürüst hata geri bildirimi).
 * Gerçek mikrofon/WebAudio GEREKMEZ — tüm ortam sahtedir.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../../src/features/audio/audio-service';

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAnalyser extends FakeNode {
  fftSize = 0;
  frequencyBinCount = 64;
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
  static state = 'running';

  state = FakeAudioContext.state;
  currentTime = 0;
  destination = {};
  createMediaStreamSource = vi.fn(() => new FakeNode());
  createAnalyser = vi.fn(() => new FakeAnalyser());
  createGain = vi.fn(() => new FakeGain());
  createMediaStreamDestination = vi.fn(() => new FakeDestination());
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  decodeAudioData = vi.fn(async () => ({}));

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);

  state = 'inactive';
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = 'recording';
  });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });

  constructor() {
    FakeRecorder.instances.push(this);
  }
}

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {
    FakeUtterance.instances.push(this);
  }
}

function makeTrack() {
  return { readyState: 'live', stop: vi.fn(), label: 'test-mic' };
}

function makeStream(track: ReturnType<typeof makeTrack>) {
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}

/** Ortak sahte ortam: RAF kuyruğu + sahte AudioContext/MediaRecorder + boş window. */
function stubEnvironment() {
  const rafs: FrameRequestCallback[] = [];
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      rafs.push(cb);
      return rafs.length;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('window', {});
  return { rafs };
}

function stubMic(track = makeTrack()) {
  const getUserMedia = vi.fn(async () => makeStream(track));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  return { getUserMedia, track };
}

function makeService() {
  const onError = vi.fn();
  const onLog = vi.fn();
  const service = new AudioService(onError, vi.fn(), onLog);
  return { service, onError, onLog };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
  FakeAudioContext.state = 'running';
  FakeRecorder.instances = [];
  FakeUtterance.instances = [];
});

describe('AudioService.ensureMic — single-flight (V1.2-014)', () => {
  it('eşzamanlı çağrılar tek getUserMedia + tek AudioContext + tek RAF açar', async () => {
    const { rafs } = stubEnvironment();
    let release!: (s: MediaStream) => void;
    const track = makeTrack();
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((r) => {
          release = r;
        }),
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const { service } = makeService();

    const p1 = service.ensureMic();
    const p2 = service.ensureMic();
    const p3 = service.ensureMic();
    expect(getUserMedia).toHaveBeenCalledTimes(1); // ikinci/üçüncü çağrı yeni açılış başlatmadı

    release(makeStream(track));
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([true, true, true]);
    expect(FakeAudioContext.instances.length).toBe(1);
    expect(rafs.length).toBe(1); // tek seviye döngüsü
  });

  it('ürün: releaseMic sonrası eski RAF kare çalışsa bile yeniden planlamaz', async () => {
    const { rafs } = stubEnvironment();
    stubMic();
    const { service } = makeService();
    expect(await service.ensureMic()).toBe(true);
    expect(rafs.length).toBe(1);

    rafs.shift()!(0); // bir kare çalıştır → döngü yeni kare planlar
    expect(rafs.length).toBe(1);

    service.stopAll(); // nesil artar; cancelAnimationFrame tek başına yetmez (stub no-op)
    rafs.shift()!(0);
    expect(rafs.length).toBe(0); // eski kare kendini kapattı
  });

  it('başarısız açılıştan sonra yeni deneme mümkündür (söz temizlenir)', async () => {
    stubEnvironment();
    const track = makeTrack();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('yok', 'NotFoundError'))
      .mockResolvedValueOnce(makeStream(track));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const { service } = makeService();

    await expect(Promise.all([service.ensureMic(), service.ensureMic()])).resolves.toEqual([
      false,
      false,
    ]);
    expect(await service.ensureMic()).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe('AudioService.recordCommand — meşguliyet kilidi ve iptal (V1.2-049/054)', () => {
  it('eşzamanlı iki çağrı: ikincisi busy, tek MediaRecorder açılır', async () => {
    stubEnvironment();
    stubMic();
    const { service } = makeService();

    const p1 = service.recordCommand({ maxMs: 5000, waitStartMs: 4000 });
    const p2 = service.recordCommand({ maxMs: 5000, waitStartMs: 4000 });
    await expect(p2).resolves.toEqual({ kind: 'busy' });
    await flush();

    expect(FakeRecorder.instances.length).toBe(1);
    service.cancelRecording();
    await expect(p1).resolves.toEqual({ kind: 'silence' });
  });

  it('stopAll aktif kaydı iptal eder: recorder durur, mikrofon serbest kalır', async () => {
    stubEnvironment();
    const { track } = stubMic();
    const { service } = makeService();

    const p = service.recordCommand({ maxMs: 5000, waitStartMs: 4000 });
    await flush();
    const rec = FakeRecorder.instances[0]!;
    expect(rec.state).toBe('recording');

    service.stopAll();
    expect(rec.stop).toHaveBeenCalled();
    await expect(p).resolves.toEqual({ kind: 'silence' });
    expect(track.stop).toHaveBeenCalled();
    expect(service.isRecording()).toBe(false);
  });
});

describe('AudioService TTS — bayrak kilitleri (V1.2-052/053/106)', () => {
  it('speechSynthesis yokken pendingPlay temizlenir — TTS kilitlenmez', () => {
    vi.stubGlobal('window', {}); // speechSynthesis yok
    const onError = vi.fn();
    const service = new AudioService(onError, vi.fn(), vi.fn());

    service.speak('bir', 1, 1, '');
    expect(onError).toHaveBeenCalledTimes(1);
    // Bayrak temizlenmeseydi bu çağrı kuyruğa girer ve hata bir daha bildirilmezdi.
    service.speak('iki', 1, 1, '');
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('eski utterance onend/onerror yeni turun bayrağını ezmez', () => {
    const synth = { speaking: false, cancel: vi.fn(), getVoices: vi.fn(() => []), speak: vi.fn() };
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const service = new AudioService(vi.fn(), vi.fn(), vi.fn());

    service.speak('bir', 1, 1, '');
    expect(FakeUtterance.instances.length).toBe(1);

    service.stopSpeaking(); // eski utterance iptal edilir (seq artar)
    service.speak('iki', 1, 1, '');
    expect(FakeUtterance.instances.length).toBe(2);

    // Geç gelen eski onend, yeni turun pendingPlay'ini false yapmamalı.
    FakeUtterance.instances[0]!.onend?.();
    service.speak('üç', 1, 1, '');
    expect(FakeUtterance.instances.length).toBe(2); // 'üç' kuyruğa girdi — kilit bozulmadı
  });

  it('decodeAudioData hatasında AudioContext kapatılır, sistem sesine düşülür', async () => {
    class DecodeFailContext extends FakeAudioContext {
      decodeAudioData = vi.fn(async () => {
        throw new Error('decode');
      });
    }
    const synth = { speaking: false, cancel: vi.fn(), getVoices: vi.fn(() => []), speak: vi.fn() };
    const synthesize = vi.fn(async () => ({ ok: true, audio: new ArrayBuffer(8) }));
    vi.stubGlobal('window', { speechSynthesis: synth, quatra: { tts: { synthesize } } });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('AudioContext', DecodeFailContext);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 0),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { service } = makeService();

    service.speak('bir', 1, 1, '');
    await flush();

    expect(DecodeFailContext.instances.length).toBe(1);
    expect(DecodeFailContext.instances[0]!.close).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalled(); // akış ölmedi — sistem sesine düştü
  });
});

describe('AudioService mikrofon hataları (V1.2-107/108)', () => {
  it('WebAudio zinciri kurulamazsa loglanır ve dürüst bildirim verilir', async () => {
    class BrokenAudioContext {
      constructor() {
        throw new Error('AudioContext yok');
      }
    }
    vi.stubGlobal('AudioContext', BrokenAudioContext);
    vi.stubGlobal('window', {});
    stubMic();
    const { service, onError, onLog } = makeService();

    expect(await service.ensureMic()).toBe(true); // mikrofon yine de açıldı
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLog.mock.calls.flat().join(' ')).toContain('WebAudio');
  });

  it('NotReadableError → "başka uygulama" mesajı (bulunamadı değil)', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('busy', 'NotReadableError');
        }),
      },
    });
    const { service, onError } = makeService();

    expect(await service.ensureMic()).toBe(false);
    expect(String(onError.mock.calls[0]![0])).toContain('başka bir uygulama');
  });
});
