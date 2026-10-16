import { describe, expect, it } from 'vitest';
import { THEMES, accentFamily, buildThemeVars, getTheme, mixHex } from '../../src/renderer/themes';

describe('tema sistemi', () => {
  it('tüm temalar benzersiz id ve geçerli renk değerlerine sahip', () => {
    const ids = new Set(THEMES.map((t) => t.id));
    expect(ids.size).toBe(THEMES.length);
    for (const t of THEMES) {
      expect(/^#[0-9a-f]{6}$/i.test(t.accent)).toBe(true);
      expect(/^#[0-9a-f]{6}$/i.test(t.vars.bg)).toBe(true);
      expect(t.vars.glass.length).toBeGreaterThan(5);
      expect(t.vars.overlay.length).toBeGreaterThan(5);
    }
  });

  it('bilinmeyen tema id varsayılan (gece) temasına düşer', () => {
    expect(getTheme('yok-boyle-tema').id).toBe('gece');
  });

  it('buildThemeVars tema değerlerini ve vurgu ailesini üretir', () => {
    const vars = buildThemeVars('okyanus');
    const okyanus = getTheme('okyanus');
    expect(vars['--bg']).toBe(okyanus.vars.bg);
    expect(vars['--accent']).toBe(okyanus.accent);
    expect(vars['--accent-bright']).not.toBe(vars['--accent']);
    expect(vars['--accent-dim']).not.toBe(vars['--accent']);
  });

  it('vurgu rengi verilince tema zeminini değiştirmez, yalnız vurguyu değiştirir', () => {
    const custom = buildThemeVars('okyanus', '#ff0000');
    expect(custom['--accent']).toBe('#ff0000');
    expect(custom['--bg']).toBe(getTheme('okyanus').vars.bg);
    // Geçersiz vurgu → tema vurgusuna düşer.
    const invalid = buildThemeVars('okyanus', 'kirmizi');
    expect(invalid['--accent']).toBe(getTheme('okyanus').accent);
  });

  it('accentFamily farklı açık/koyu tonlar üretir; mixHex uçlarda doğrudur', () => {
    const fam = accentFamily('#808080');
    expect(fam.bright).not.toBe('#808080');
    expect(fam.dim).not.toBe('#808080');
    expect(fam.bright).not.toBe(fam.dim);
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
