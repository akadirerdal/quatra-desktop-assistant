/**
 * electron/log-file — kalıcı günlük dosyası: yazma, rotasyon, temizleme, klasör açma (V1.2-082).
 * `electron` mock'lanır; shell.openPath testte çağrı yapmaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shell } from 'electron';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
  shell: { openPath: vi.fn(async () => '') },
}));

import {
  appendLogLine,
  clearLogFile,
  logDir,
  logFilePath,
  openLogsFolder,
} from '../../../electron/log-file';

function seedFile(content: string): void {
  fs.mkdirSync(logDir(), { recursive: true });
  fs.writeFileSync(logFilePath(), content, 'utf8');
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-log-file-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('log-file', () => {
  it('log yolu userData/logs/quatra.log olarak hesaplanır', () => {
    expect(logDir()).toBe(path.join(userDataDir, 'logs'));
    expect(logFilePath()).toBe(path.join(userDataDir, 'logs', 'quatra.log'));
  });

  it('appendLogLine satırı dosyaya ekler (klasörü kendisi açar)', () => {
    appendLogLine('birinci');
    appendLogLine('ikinci');
    expect(fs.readFileSync(logFilePath(), 'utf8')).toBe('birinci\nikinci\n');
  });

  it('1MB sınırı aşılınca .1 yedeğine döndürür', () => {
    seedFile('a'.repeat(1_000_001));
    appendLogLine('yeni');
    expect(fs.readFileSync(logFilePath(), 'utf8')).toBe('yeni\n');
    expect(fs.readFileSync(`${logFilePath()}.1`, 'utf8')).toHaveLength(1_000_001);
  });

  it('clearLogFile dosyayı boşaltır, .1 yedeğine dokunmaz', () => {
    seedFile('eski içerik');
    fs.writeFileSync(`${logFilePath()}.1`, 'yedek', 'utf8');
    clearLogFile();
    expect(fs.readFileSync(logFilePath(), 'utf8')).toBe('');
    expect(fs.readFileSync(`${logFilePath()}.1`, 'utf8')).toBe('yedek');
  });

  it('clearLogFile dosya yokken sessiz kalır', () => {
    expect(() => clearLogFile()).not.toThrow();
  });

  it('openLogsFolder klasörü oluşturur ve yolu döner', async () => {
    const r = await openLogsFolder();
    expect(r).toEqual({ ok: true, path: logDir() });
    expect(fs.existsSync(logDir())).toBe(true);
    expect(vi.mocked(shell.openPath)).toHaveBeenCalledWith(logDir());
  });

  it('openLogsFolder shell hatasını mesaja çevirir', async () => {
    vi.mocked(shell.openPath).mockResolvedValueOnce('klasör açılamadı');
    expect(await openLogsFolder()).toEqual({ ok: false, message: 'klasör açılamadı' });
  });

  it('openLogsFolder beklenmedik hatada temiz mesaj verir', async () => {
    vi.mocked(shell.openPath).mockRejectedValueOnce(new Error('boom'));
    expect(await openLogsFolder()).toEqual({ ok: false, message: 'Günlük klasörü açılamadı.' });
  });
});
