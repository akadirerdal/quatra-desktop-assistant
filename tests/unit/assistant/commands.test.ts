import { describe, expect, it } from 'vitest';
import {
  detectModeCommand,
  detectSleepCommand,
  detectStopSpeakingCommand,
  isDetailRequest,
  isNameQuestion,
  parseConfirmAnswer,
  parseMemoryIntent,
} from '../../../src/features/assistant/commands';

describe('parseMemoryIntent', () => {
  it('isim kalıbını yakalar', () => {
    expect(parseMemoryIntent('benim adım Ali')).toEqual({ kind: 'name', name: 'Ali' });
    expect(parseMemoryIntent('adım Mehmet')).toEqual({ kind: 'name', name: 'Mehmet' });
    expect(parseMemoryIntent('ismim Ayşe!')).toEqual({ kind: 'name', name: 'Ayşe' });
  });

  it('soyad kalıbını yakalar', () => {
    expect(parseMemoryIntent('soyadım Demir')).toEqual({ kind: 'surname', surname: 'Demir' });
    expect(parseMemoryIntent('benim soyadım Yılmaz.')).toEqual({
      kind: 'surname',
      surname: 'Yılmaz',
    });
  });

  it('"adım ne" sorusunu KAYIT sanmaz', () => {
    expect(parseMemoryIntent('adım ne')).toBeNull();
    expect(parseMemoryIntent('benim adım ne?')).toBeNull();
  });

  it('hatırla kalıbını yakalar', () => {
    expect(parseMemoryIntent('hatırla: yarın toplantım var')).toEqual({
      kind: 'remember',
      text: 'yarın toplantım var',
    });
    expect(parseMemoryIntent('şunu hatırla köpeğimin adı Karabaş')).toEqual({
      kind: 'remember',
      text: 'köpeğimin adı Karabaş',
    });
    expect(parseMemoryIntent('not et, süt al')).toEqual({ kind: 'remember', text: 'süt al' });
    expect(parseMemoryIntent('unutma: annemin doğum günü 5 Mayıs')).toEqual({
      kind: 'remember',
      text: 'annemin doğum günü 5 Mayıs',
    });
  });

  it('hatırla SORUSUNU kayıt sanmaz', () => {
    expect(parseMemoryIntent('hatırladın mı?')).toBeNull();
    expect(parseMemoryIntent('bunu hatırlıyor musun')).toBeNull();
  });

  it('alakasız metinde null döner', () => {
    expect(parseMemoryIntent('saat kaç')).toBeNull();
    expect(parseMemoryIntent('hava nasıl')).toBeNull();
  });
});

describe('isNameQuestion / isDetailRequest', () => {
  it('isim sorusunu tanır', () => {
    expect(isNameQuestion('adım ne')).toBe(true);
    expect(isNameQuestion('benim ismim ne?')).toBe(true);
    expect(isNameQuestion('benim adım Ali')).toBe(false);
  });

  it('detay isteğini tanır', () => {
    expect(isDetailRequest('bunu detaylı anlat')).toBe(true);
    expect(isDetailRequest('uzun uzun açıkla')).toBe(true);
    expect(isDetailRequest('saat kaç')).toBe(false);
  });
});

describe('detectModeCommand', () => {
  it('mod komutlarını tanır', () => {
    expect(detectModeCommand('yazılım moduna geç')).toBe('pro');
    expect(detectModeCommand('normal moda geç')).toBe('flash');
    expect(detectModeCommand('mod değiştir')).toBe('toggle');
    expect(detectModeCommand('saat kaç')).toBeNull();
  });
});

describe('detectSleepCommand', () => {
  it('uyku komutlarını tanır', () => {
    expect(detectSleepCommand('uyu')).toBe(true);
    expect(detectSleepCommand('Uykuya dön lütfen')).toBe(true);
    expect(detectSleepCommand('dinlemeyi bırak')).toBe(true);
    expect(detectSleepCommand('bekleme moduna geç')).toBe(true);
  });

  it('normal cümleyi uyku sanmaz', () => {
    expect(detectSleepCommand('saat kaç')).toBe(false);
    expect(detectSleepCommand('bugün hava nasıl')).toBe(false);
  });
});

describe('detectStopSpeakingCommand', () => {
  it('durdurma komutlarını tanır', () => {
    expect(detectStopSpeakingCommand('sus')).toBe(true);
    expect(detectStopSpeakingCommand('Kes sesini!')).toBe(true);
    expect(detectStopSpeakingCommand('sessiz ol')).toBe(true);
    expect(detectStopSpeakingCommand('dur')).toBe(true);
    expect(detectStopSpeakingCommand('yeter artık')).toBe(true);
  });

  it('normal cümleyi durdurma sanmaz', () => {
    expect(detectStopSpeakingCommand('durum nedir')).toBe(false);
    expect(detectStopSpeakingCommand('susuz kaldım')).toBe(false);
    expect(detectStopSpeakingCommand('saat kaç')).toBe(false);
  });
});

describe('parseConfirmAnswer', () => {
  it('evet ailesini tanır', () => {
    expect(parseConfirmAnswer('evet')).toBe('yes');
    expect(parseConfirmAnswer('Evet, not al')).toBe('yes');
    expect(parseConfirmAnswer('tamam')).toBe('yes');
    expect(parseConfirmAnswer('onaylıyorum')).toBe('yes');
  });

  it('hayır ailesini tanır', () => {
    expect(parseConfirmAnswer('hayır')).toBe('no');
    expect(parseConfirmAnswer('Hayır!')).toBe('no');
    expect(parseConfirmAnswer('vazgeç')).toBe('no');
    expect(parseConfirmAnswer('istemiyorum')).toBe('no');
  });

  it('anlaşılmayan yanıtta null döner', () => {
    expect(parseConfirmAnswer('bugün hava nasıl')).toBeNull();
    expect(parseConfirmAnswer('not al')).toBeNull();
  });
});
