/**
 * electron/usage-store — token kullanım sayaçları ve bozuk alan normalizasyonu (V1.2-082).
 * `electron` mock'lanır; veri geçici userData/token-usage.json dosyasına gider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
}));

import { getUsage, recordUsage } from '../../../electron/usage-store';

function usagePath(): string {
  return path.join(userDataDir, 'token-usage.json');
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-usage-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('usage-store', () => {
  it('kayıt yokken sıfır özet döner', () => {
    const u = getUsage();
    expect(u.month).toBe(currentMonth());
    expect(u.monthUsage).toEqual({ prompt: 0, completion: 0, requests: 0 });
    expect(u.total).toEqual({ prompt: 0, completion: 0, requests: 0 });
  });

  it('recordUsage aylık ve toplam sayaçları artırır', () => {
    recordUsage(10, 2);
    recordUsage(5, 1);
    const u = getUsage();
    expect(u.monthUsage).toEqual({ prompt: 15, completion: 3, requests: 2 });
    expect(u.total).toEqual({ prompt: 15, completion: 3, requests: 2 });
  });

  it('kayıt diske JSON olarak yazılır (ay anahtarıyla)', () => {
    recordUsage(7, 3);
    const raw = JSON.parse(fs.readFileSync(usagePath(), 'utf8')) as {
      total: { prompt: number };
      months: Record<string, { prompt: number; requests: number }>;
    };
    expect(raw.total.prompt).toBe(7);
    expect(raw.months[currentMonth()]).toEqual({ prompt: 7, completion: 3, requests: 1 });
  });

  it('sonlu olmayan token değerleri hiç kaydedilmez (uydurma sayı yok)', () => {
    recordUsage(Number.NaN, 1);
    recordUsage(1, Number.POSITIVE_INFINITY);
    expect(fs.existsSync(usagePath())).toBe(false);
    expect(getUsage().total).toEqual({ prompt: 0, completion: 0, requests: 0 });
  });

  it('bozuk JSON dosyası sıfırdan başlar ve üzerine sağlam yazar', () => {
    fs.writeFileSync(usagePath(), '{bozuk', 'utf8');
    expect(getUsage().total).toEqual({ prompt: 0, completion: 0, requests: 0 });
    recordUsage(4, 1);
    expect(getUsage().monthUsage).toEqual({ prompt: 4, completion: 1, requests: 1 });
    expect(() => JSON.parse(fs.readFileSync(usagePath(), 'utf8'))).not.toThrow();
  });

  it('şekli bozuk dosya (total/months eksik) yok sayılır', () => {
    fs.writeFileSync(
      usagePath(),
      JSON.stringify({ total: { prompt: 99, completion: 99, requests: 99 } }),
      'utf8',
    );
    expect(getUsage().total).toEqual({ prompt: 0, completion: 0, requests: 0 });
    recordUsage(2, 2);
    expect(getUsage().total).toEqual({ prompt: 2, completion: 2, requests: 1 });
  });

  it('bozuk alanlar (string/null/negatif) alan bazında sıfıra normalize edilir', () => {
    fs.writeFileSync(
      usagePath(),
      JSON.stringify({
        total: { prompt: '99', completion: null, requests: 3.9 },
        months: { [currentMonth()]: { prompt: 2, completion: -5, requests: 'x' } },
      }),
      'utf8',
    );
    const u = getUsage();
    expect(u.total).toEqual({ prompt: 0, completion: 0, requests: 3 });
    expect(u.monthUsage).toEqual({ prompt: 2, completion: 0, requests: 0 });
    // Üzerine yazım da sağlam sayılarla: JSON'da null/NaN oluşmaz.
    recordUsage(1, 1);
    const raw = JSON.parse(fs.readFileSync(usagePath(), 'utf8')) as {
      total: { prompt: number; completion: number; requests: number };
    };
    expect(raw.total).toEqual({ prompt: 1, completion: 1, requests: 4 });
    expect(JSON.stringify(raw)).not.toContain('null');
  });

  it('yazılamayan yolda sessiz kalır (throw etmez)', () => {
    // userData bir dizin değil DOSYA: yazma başarısız olmalı ama çökmemeli.
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.writeFileSync(userDataDir, 'blok', 'utf8');
    expect(() => recordUsage(1, 1)).not.toThrow();
    expect(getUsage().total).toEqual({ prompt: 0, completion: 0, requests: 0 });
  });
});
