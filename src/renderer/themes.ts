/**
 * Tema sistemi — hazır paletler ve CSS değişkenlerinin uygulanması.
 * Tema arka plan/yüzey/metin renklerini belirler; vurgu rengi ayrıca ince ayarlanabilir.
 * SPRINT: saf fonksiyonlar test edilir; DOM'a yazma tek noktada (applyAppearance).
 */

export type ThemeId = 'gece' | 'okyanus' | 'zumrut' | 'gunbatimi' | 'gul' | 'grafit' | 'safak';

export interface ThemeVars {
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  /** Yarı saydam yüzey (görev balonları). */
  glass: string;
  /** Modal arka plan örtüsü. */
  overlay: string;
  /** Vurgu rengi üzerindeki metin. */
  onAccent: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  desc: string;
  vars: ThemeVars;
  /** Tema seçildiğinde vurgu rengi de buna döner (sonra elle inceltilebilir). */
  accent: string;
}

export const THEMES: Theme[] = [
  {
    id: 'gece',
    label: 'Gece Moru',
    desc: 'Mevcut görünüm — koyu zemin, mor vurgu',
    accent: '#9b87f5',
    vars: {
      bg: '#08090d',
      panel: '#0f1017',
      panel2: '#13141c',
      border: '#23242e',
      text: '#e9e9f0',
      muted: '#76798a',
      glass: 'rgba(15, 16, 23, 0.72)',
      overlay: 'rgba(4, 5, 8, 0.65)',
      onAccent: '#0b0c10',
    },
  },
  {
    id: 'okyanus',
    label: 'Okyanus',
    desc: 'Lacivert derinlik, açık mavi vurgu',
    accent: '#5da8ff',
    vars: {
      bg: '#060b14',
      panel: '#0c1420',
      panel2: '#101a2a',
      border: '#1e2c42',
      text: '#e8eef8',
      muted: '#7388a3',
      glass: 'rgba(12, 20, 32, 0.72)',
      overlay: 'rgba(3, 7, 14, 0.65)',
      onAccent: '#06101c',
    },
  },
  {
    id: 'zumrut',
    label: 'Zümrüt',
    desc: 'Koyu yeşil zemin, zümrüt vurgu',
    accent: '#46d08b',
    vars: {
      bg: '#050c08',
      panel: '#0b1510',
      panel2: '#0f1d15',
      border: '#1e3126',
      text: '#e6f2ea',
      muted: '#729181',
      glass: 'rgba(11, 21, 16, 0.72)',
      overlay: 'rgba(3, 9, 6, 0.65)',
      onAccent: '#06110b',
    },
  },
  {
    id: 'gunbatimi',
    label: 'Gün Batımı',
    desc: 'Sıcak kahve tonları, amber vurgu',
    accent: '#f0a35f',
    vars: {
      bg: '#0e0906',
      panel: '#171009',
      panel2: '#1e160d',
      border: '#33261a',
      text: '#f3ece4',
      muted: '#94806d',
      glass: 'rgba(23, 16, 9, 0.72)',
      overlay: 'rgba(12, 6, 3, 0.65)',
      onAccent: '#180d04',
    },
  },
  {
    id: 'gul',
    label: 'Gül',
    desc: 'Mürdüm zemin, pembe vurgu',
    accent: '#f07fae',
    vars: {
      bg: '#0d060a',
      panel: '#160b12',
      panel2: '#1d0f18',
      border: '#34202d',
      text: '#f2e7ee',
      muted: '#92788b',
      glass: 'rgba(22, 11, 18, 0.72)',
      overlay: 'rgba(13, 6, 10, 0.65)',
      onAccent: '#1d0a12',
    },
  },
  {
    id: 'grafit',
    label: 'Grafit',
    desc: 'Neredeyse tek renk — sakin, nötr',
    accent: '#c9cad6',
    vars: {
      bg: '#0a0a0c',
      panel: '#121214',
      panel2: '#17171a',
      border: '#2b2b31',
      text: '#ececef',
      muted: '#7f7f86',
      glass: 'rgba(18, 18, 20, 0.72)',
      overlay: 'rgba(8, 8, 10, 0.65)',
      onAccent: '#101012',
    },
  },
  {
    id: 'safak',
    label: 'Şafak',
    desc: 'Aydınlık tema — gündüz kullanımı',
    accent: '#6e5fc4',
    vars: {
      bg: '#f3f4f8',
      panel: '#ffffff',
      panel2: '#f6f7fb',
      border: '#dcdfe9',
      text: '#23242e',
      muted: '#6b6e7e',
      glass: 'rgba(255, 255, 255, 0.8)',
      overlay: 'rgba(226, 229, 238, 0.72)',
      onAccent: '#ffffff',
    },
  },
];

/** Id ile tema bulur; bilinmeyen id varsayılan (gece) temasına düşer. */
export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** İki hex rengi karıştırır (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const pa = parseHex(a);
  const pb = parseHex(b);
  const m = (x: number, y: number): number => Math.round(x + (y - x) * k);
  return toHex(m(pa.r, pb.r), m(pa.g, pb.g), m(pa.b, pb.b));
}

/** Vurgu renginden açık/koyu tonlar üretir (--accent-bright / --accent-dim). */
export function accentFamily(accent: string): { bright: string; dim: string } {
  return {
    bright: mixHex(accent, '#ffffff', 0.28),
    dim: mixHex(accent, '#000000', 0.32),
  };
}

function normaliseHex(hex: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
}

/** Appearance ayarından tam CSS değişken tablosu üretir (saf; test dostu). */
export function buildThemeVars(themeId: string, accentOverride?: string): Record<string, string> {
  const theme = getTheme(themeId);
  const accent = normaliseHex(accentOverride ?? '') ?? theme.accent;
  const fam = accentFamily(accent);
  return {
    '--bg': theme.vars.bg,
    '--panel': theme.vars.panel,
    '--panel-2': theme.vars.panel2,
    '--border': theme.vars.border,
    '--text': theme.vars.text,
    '--muted': theme.vars.muted,
    '--glass': theme.vars.glass,
    '--overlay': theme.vars.overlay,
    '--on-accent': theme.vars.onAccent,
    '--accent': accent,
    '--accent-bright': fam.bright,
    '--accent-dim': fam.dim,
  };
}

/**
 * Görünüm ayarlarını DOM'a uygular:
 * tema + vurgu → CSS değişkenleri; arayüz ölçeği → zoom; hareket azaltma → sınıf.
 */
export function applyAppearance(app: {
  theme: string;
  accent: string;
  uiScale: number;
  reducedMotion: boolean;
}): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(buildThemeVars(app.theme, app.accent))) {
    root.style.setProperty(key, value);
  }
  document.body.style.setProperty('zoom', String(app.uiScale));
  document.body.classList.toggle('reduced-motion', app.reducedMotion);
}
