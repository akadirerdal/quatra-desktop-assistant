import { describe, expect, it } from 'vitest';
import { parseMemoryIntent, detectModeCommand } from '../../../src/features/assistant/commands';

describe('parseMemoryIntent', () => {
  it('isim kalıbını yakalar', () => {
    expect(parseMemoryIntent('benim adım Ali')).toEqual({ kind: 'name', name: 'Ali' });
    expect(parseMemoryIntent('adım Mehmet')).toEqual({ kind: 'name', name: 'Mehmet' });
    expect(parseMemoryIntent('ismim Ayşe!')).toEqual({ kind: 'name', name: 'Ayşe' });
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
  });

  it('alakasız metinde null döner', () => {
    expect(parseMemoryIntent('saat kaç')).toBeNull();
    expect(parseMemoryIntent('hava nasıl')).toBeNull();
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
