import { describe, expect, it } from 'vitest';
import {
  detectModeCommand,
  isDetailRequest,
  isNameQuestion,
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
