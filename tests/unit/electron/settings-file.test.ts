/**
 * electron/settings-file — atomik yazım + yedek + bozuk dosya recovery (V1.2-082).
 * `electron` modülü mock'lanır; app.getPath('userData') geçici dizine yönlendirilir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
}));

import { loadSettingsFile, saveSettingsFile } from '../../../electron/settings-file';

function settingsPath(): string {
  return path.join(userDataDir, 'settings.json');
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-settings-file-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('settings-file', () => {
  it('dosya yokken null döner', async () => {
    expect(await loadSettingsFile()).toBeNull();
  });

  it('kaydeder ve geri okur', async () => {
    await saveSettingsFile({ assistantName: 'Quatra', provider: { temperature: 0.7 } });
    expect(await loadSettingsFile()).toEqual({
      assistantName: 'Quatra',
      provider: { temperature: 0.7 },
    });
  });

  it('atomik yazar: .tmp dosyası ortada bırakılmaz', async () => {
    await saveSettingsFile({ a: 1 });
    expect(fs.existsSync(settingsPath())).toBe(true);
    expect(fs.existsSync(`${settingsPath()}.tmp`)).toBe(false);
  });

  it('ikinci kayıt önceki sürümü .bak olarak saklar', async () => {
    await saveSettingsFile({ v: 1 });
    await saveSettingsFile({ v: 2 });
    expect(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))).toEqual({ v: 2 });
    expect(JSON.parse(fs.readFileSync(`${settingsPath()}.bak`, 'utf8'))).toEqual({ v: 1 });
  });

  it('bozuk ana dosyada son sağlam yedekten döner', async () => {
    await saveSettingsFile({ v: 1 });
    await saveSettingsFile({ v: 2 }); // .bak = {v:1}
    fs.writeFileSync(settingsPath(), '{bozuk json', 'utf8');
    expect(await loadSettingsFile()).toEqual({ v: 1 });
  });

  it('ana ve yedek de bozuksa null döner', async () => {
    fs.writeFileSync(settingsPath(), 'çöp', 'utf8');
    fs.writeFileSync(`${settingsPath()}.bak`, 'çöp', 'utf8');
    expect(await loadSettingsFile()).toBeNull();
  });

  it('bozuk ana dosya ve yedek yoksa null döner (recovery sessiz)', async () => {
    fs.writeFileSync(settingsPath(), 'not json', 'utf8');
    expect(await loadSettingsFile()).toBeNull();
  });
});
