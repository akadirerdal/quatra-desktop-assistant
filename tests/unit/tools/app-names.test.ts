import { describe, expect, it } from 'vitest';
import { normalizeAppName, appTarget, allowedAppNames } from '../../../src/features/tools/app-names';

describe('normalizeAppName', () => {
  it('Türkçe komutları kanonik uygulamaya çevirir', () => {
    expect(normalizeAppName('not defterini aç')).toBe('notepad');
    expect(normalizeAppName('hesap makinesi')).toBe('calculator');
    expect(normalizeAppName('dosya gezgini')).toBe('explorer');
    expect(normalizeAppName('komut istemi')).toBe('cmd');
    expect(normalizeAppName('görev yöneticisi')).toBe('taskmgr');
  });

  it('İngilizce adları kabul eder', () => {
    expect(normalizeAppName('notepad')).toBe('notepad');
    expect(normalizeAppName('Calc')).toBe('calculator');
  });

  it('macOS uygulama adlarını da tanır', () => {
    expect(normalizeAppName('Terminal')).toBe('cmd');
    expect(normalizeAppName('finder')).toBe('explorer');
    expect(normalizeAppName('textedit')).toBe('notepad');
    expect(normalizeAppName('Etkinlik İzleyicisi')).toBe('taskmgr');
    expect(normalizeAppName('Activity Monitor')).toBe('taskmgr');
  });

  it('bilinmeyen adları reddeder', () => {
    expect(normalizeAppName('kötücül.exe')).toBeNull();
    expect(normalizeAppName('rm -rf /')).toBeNull();
    expect(normalizeAppName('')).toBeNull();
  });

  it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
    expect(normalizeAppName('  NOT  DEFTERİ  ')).toBe('notepad');
  });
});

describe('appTarget / allowedAppNames', () => {
  it('Windows hedefini döner', () => {
    expect(appTarget('notepad', 'win32')).toEqual({ type: 'exe', value: 'notepad.exe' });
    expect(appTarget('cmd', 'win32')).toEqual({ type: 'exe', value: 'cmd.exe' });
  });

  it('macOS hedefini döner', () => {
    expect(appTarget('notepad', 'darwin')).toEqual({ type: 'macApp', value: 'TextEdit' });
    expect(appTarget('explorer', 'darwin')).toEqual({ type: 'macApp', value: 'Finder' });
    expect(appTarget('taskmgr', 'darwin')).toEqual({ type: 'macApp', value: 'Activity Monitor' });
  });

  it('macOS karşılığı olmayanı ya da bilinmeyeni reddeder', () => {
    expect(appTarget('mspaint', 'darwin')).toBeNull();
    expect(appTarget('bilinmeyen', 'win32')).toBeNull();
    expect(appTarget('bilinmeyen', 'darwin')).toBeNull();
  });

  it('allowlist dolu ve sadece bilinenleri içeriyor', () => {
    const list = allowedAppNames();
    expect(list.length).toBeGreaterThan(10);
    expect(list).toContain('notepad');
    expect(list).toContain('hesap makinesi');
    expect(list).toContain('terminal');
  });
});
