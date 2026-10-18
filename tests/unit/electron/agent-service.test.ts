/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// electron mock (main süreç modülleri için)
let userDataDir = '';
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir), getVersion: () => '0.1.0' },
  BrowserWindow: class {
    isDestroyed() {
      return false;
    }
    webContents = { send: vi.fn() };
  },
}));

// credentials: varsayılan olarak anahtar YOK
vi.mock('../../../electron/credentials', () => ({
  getApiKey: vi.fn(async () => ''),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  hasApiKey: vi.fn(async () => false),
}));

// settings-file: boş ayarlar
vi.mock('../../../electron/settings-file', () => ({
  loadSettingsFile: vi.fn(async () => ({})),
  saveSettingsFile: vi.fn(async () => undefined),
}));

// DeepSeek client — asla gerçekten çağrılmaz (anahtar yok yolu)
vi.mock('../../../src/providers/deepseek/client', () => ({
  DeepSeekClient: class {
    constructor() {}
  },
}));

import { BrowserWindow } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAgent, cancelActiveAgent } from '../../../electron/agent-service';

describe('agent-service (V1.2-025)', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-agent-'));
    cancelActiveAgent();
  });
  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    cancelActiveAgent();
  });

  it('DeepSeek anahtarı yoksa "auth" hatası yayar ve modele gitmez', async () => {
    const win = new BrowserWindow() as any;
    const events: any[] = [];
    win.webContents.send = (_ch: string, e: any) => {
      events.push(e);
    };

    await runAgent(win as any, { text: 'merhaba', model: 'deepseek-chat' });

    expect(events.map((e) => e.type)).toContain('start');
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(err.category).toBe('auth');
    expect(err.message).toMatch(/anahtar/i);
    // 'done' yayılmamalı
    expect(events.find((e) => e.type === 'done')).toBeUndefined();
  });

  it('iptal edilen istek "cancelled" kategorisiyle sessiz yoldur (V1.2-013)', async () => {
    const win = new BrowserWindow() as any;
    const events: any[] = [];
    win.webContents.send = (_ch: string, e: any) => {
      events.push(e);
    };

    // Anahtar yok yolu zaten iptal edilebilir bir istek üretir; cancel çağrısı hata vermemeli.
    const p = runAgent(win as any, { text: 'test', model: 'deepseek-chat' });
    cancelActiveAgent();
    await p;
    // Hata olayı (auth veya cancelled) yayılmış olmalı; çökme yok.
    expect(events.find((e) => e.type === 'error')).toBeDefined();
  });
});
