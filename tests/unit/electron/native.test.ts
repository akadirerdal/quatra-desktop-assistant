/**
 * electron/native — yol genişletme: `~` ve ortam değişkenleri (V1.2-042).
 * `electron` mock'lanır; dosyalar geçici dizinlerde.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir), getVersion: vi.fn(() => '0.0.0-test') },
  clipboard: { writeText: vi.fn(), readText: vi.fn(() => '') },
  dialog: { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
  shell: { openPath: vi.fn(async () => ''), openExternal: vi.fn(async () => undefined) },
  BrowserWindow: class {},
}));

import { createNativeBridge } from '../../../electron/native';

const tempDirs: string[] = [];

function makeDir(prefix: string, base = os.tmpdir()): string {
  const dir = fs.mkdtempSync(path.join(base, prefix));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  userDataDir = makeDir('quatra-native-data-');
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  delete process.env['QUATRA_TEST_DIR'];
});

describe('native yol genişletme', () => {
  it('folderExists `~` ile başlayan yolu genişletir', async () => {
    const bridge = createNativeBridge(null);
    const dir = makeDir('.quatra-native-test-', os.homedir());
    expect(await bridge.folderExists(path.join('~', path.basename(dir)))).toBe(true);
    expect(await bridge.folderExists('~/.quatra-yok-boyle-bir-dizin')).toBe(false);
  });

  it('folderExists ortam değişkenini ($VAR ve ${VAR}) genişletir', async () => {
    const bridge = createNativeBridge(null);
    const dir = makeDir('quatra-native-env-');
    process.env['QUATRA_TEST_DIR'] = dir;
    expect(await bridge.folderExists('$QUATRA_TEST_DIR')).toBe(true);
    expect(await bridge.folderExists('${QUATRA_TEST_DIR}')).toBe(true);
  });

  it('writeNote `~` ile başlayan hedef klasöre yazar', async () => {
    const bridge = createNativeBridge(null);
    const dir = makeDir('.quatra-native-write-', os.homedir());
    const result = await bridge.writeNote('içerik', 'not.md', `~/${path.basename(dir)}`);
    expect(result.path).toBe(path.join(dir, 'not.md'));
    expect(fs.readFileSync(result.path, 'utf8')).toBe('içerik');
  });

  it('not dizini hatırlanır ve genişletilmiş haliyle okunur', async () => {
    const bridge = createNativeBridge(null);
    const dir = makeDir('quatra-native-notes-');
    await bridge.rememberNotesDirectory(dir);
    expect(await bridge.getNotesDirectory()).toBe(dir);
  });
});
