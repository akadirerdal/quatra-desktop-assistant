import { describe, expect, it } from 'vitest';
import { normalizeAppName, appExec, allowedAppNames } from '../../../src/features/tools/app-names';

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

  it('bilinmeyen adları reddeder', () => {
    expect(normalizeAppName('kötücül.exe')).toBeNull();
    expect(normalizeAppName('rm -rf /')).toBeNull();
    expect(normalizeAppName('')).toBeNull();
  });

  it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
    expect(normalizeAppName('  NOT  DEFTERİ  ')).toBe('notepad');
  });
});

describe('appExec / allowedAppNames', () => {
  it('kanonik anahtarın hedefini döner', () => {
    expect(appExec('notepad')).toBe('notepad.exe');
    expect(appExec('bilinmeyen')).toBeNull();
  });

  it('allowlist dolu ve sadece bilinenleri içeriyor', () => {
    const list = allowedAppNames();
    expect(list.length).toBeGreaterThan(10);
    expect(list).toContain('notepad');
    expect(list).toContain('hesap makinesi');
  });
});
