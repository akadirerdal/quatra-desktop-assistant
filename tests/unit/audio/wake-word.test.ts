import { describe, expect, it, vi } from 'vitest';
import {
  extractCommandAfterWake,
  matchesWakeWord,
  similarity,
  WakeWordService,
} from '../../../src/features/audio/wake-word';
import type { AudioService } from '../../../src/features/audio/audio-service';

describe('matchesWakeWord', () => {
  it('tam kelimeyi yakalar', () => {
    expect(matchesWakeWord('quatra', 'quatra')).toBe(true);
    expect(matchesWakeWord('Quatra, saat kaç?', 'quatra')).toBe(true);
  });

  it('yaygın telaffuz varyantlarını yakalar', () => {
    expect(matchesWakeWord('kuatra', 'quatra')).toBe(true);
    expect(matchesWakeWord('quatro', 'quatra')).toBe(true);
    expect(matchesWakeWord('kotra', 'quatra')).toBe(true);
  });

  it('alakasız cümleyi yakalamaz', () => {
    expect(matchesWakeWord('bugün hava çok güzel', 'quatra')).toBe(false);
    expect(matchesWakeWord('takvim aç', 'quatra')).toBe(false);
  });

  it('noktalama ve büyük harf sorun değil', () => {
    expect(matchesWakeWord('  QUATRA!  ', 'quatra')).toBe(true);
  });

  it('özel uyandırma kelimesinde varsayılan alias’lar uygulanmaz (V1.2-058)', () => {
    expect(matchesWakeWord('kuatra', 'bilge')).toBe(false);
    expect(matchesWakeWord('kotra', 'bilge')).toBe(false);
    expect(matchesWakeWord('quatro', 'bilge')).toBe(false);
    expect(matchesWakeWord('bilge', 'bilge')).toBe(true);
  });
});

describe('similarity', () => {
  it('aynı kelimede 1, tamamen farklıda düşük döner', () => {
    expect(similarity('quatra', 'quatra')).toBe(1);
    expect(similarity('quatra', 'xyzabc')).toBeLessThan(0.3);
  });
});

describe('extractCommandAfterWake', () => {
  it('uyandırma kelimesinden sonrasını komut olarak döner', () => {
    expect(extractCommandAfterWake('quatra saat kaç', 'quatra')).toBe('saat kaç');
    expect(extractCommandAfterWake('Quatra benim adım Ali', 'quatra')).toBe('benim adım Ali');
  });

  it('komut yoksa boş döner', () => {
    expect(extractCommandAfterWake('quatra', 'quatra')).toBe('');
    expect(extractCommandAfterWake('bugün hava güzel', 'quatra')).toBe('');
  });

  it('varyant telaffuzları da tanır', () => {
    expect(extractCommandAfterWake('kuatra not defterini aç', 'quatra')).toBe('not defterini aç');
  });

  it('noktalama/tire kalıntısı komuta sızmaz (V1.2-059)', () => {
    expect(extractCommandAfterWake('Quatra, saat kaç?', 'quatra')).toBe('saat kaç');
    expect(extractCommandAfterWake('- quatra, not defterini aç!', 'quatra')).toBe(
      'not defterini aç',
    );
    expect(extractCommandAfterWake('quatra - müziği aç', 'quatra')).toBe('müziği aç');
    expect(extractCommandAfterWake('quatra-saat kaç', 'quatra')).toBe('saat kaç');
    // Kelime içi kesme işareti KORUNUR (yalnız baş/son noktalama temizlenir).
    expect(extractCommandAfterWake("quatra Ayşe'yi ara", 'quatra')).toBe("Ayşe'yi ara");
  });

  it('özel uyandırma kelimesinde eski alias’lar tetiklemez (V1.2-058)', () => {
    expect(extractCommandAfterWake('kuatra not defterini aç', 'bilge')).toBe('');
    expect(extractCommandAfterWake('bilge not defterini aç', 'bilge')).toBe('not defterini aç');
  });
});

describe('WakeWordService.start (single-flight)', () => {
  it('hızlı ardışık start çağrıları tek mikrofon açılışı ve tek dinleme döngüsü kurar', async () => {
    const never = new Promise<never>(() => undefined);
    const audio = {
      ensureMic: vi.fn(async () => true),
      recordCommand: vi.fn(() => never),
    } as unknown as AudioService;
    const wake = new WakeWordService(
      audio,
      { wakeWord: 'quatra' },
      { onWake: vi.fn(), onError: vi.fn() },
    );

    const [a, b] = await Promise.all([wake.start(), wake.start()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(wake.isRunning()).toBe(true);
    expect(audio.ensureMic).toHaveBeenCalledTimes(1);
    expect(audio.recordCommand).toHaveBeenCalledTimes(1); // ikinci döngü açılmadı
    wake.stop();
  });

  it('start beklerken stop çağrılırsa dinleme başlamaz', async () => {
    let release!: (v: boolean) => void;
    const gate = new Promise<boolean>((r) => {
      release = r;
    });
    const audio = {
      ensureMic: vi.fn(() => gate),
      recordCommand: vi.fn(() => new Promise<never>(() => undefined)),
    } as unknown as AudioService;
    const wake = new WakeWordService(
      audio,
      { wakeWord: 'quatra' },
      { onWake: vi.fn(), onError: vi.fn() },
    );

    const p = wake.start();
    wake.stop(); // bekleyen başlatma iptal
    release(true);
    await expect(p).resolves.toBe(false);
    expect(wake.isRunning()).toBe(false);
    expect(audio.recordCommand).not.toHaveBeenCalled();
  });
});
