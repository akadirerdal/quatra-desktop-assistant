/**
 * electron/memory — IPC kabuğu: list/add/remove/clear + açılış temizliği (V1.2-082).
 * `ipcMain.handle` yakalanır; gerçek IPC yok. Kayıtlar geçici userData'ya yazılır.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';
const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

import { registerMemoryIpc } from '../../../electron/memory';

function memoryPath(): string {
  return path.join(userDataDir, 'memory.json');
}

function readEntries(): Array<{ id: string; text: string; source: string }> {
  const raw = JSON.parse(fs.readFileSync(memoryPath(), 'utf8')) as {
    entries: Array<{ id: string; text: string; source: string }>;
  };
  return raw.entries;
}

function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`handler yok: ${channel}`);
  return Promise.resolve(handler(null, ...args) as T);
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-memory-ipc-'));
  handlers.clear();
  registerMemoryIpc();
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('memory IPC', () => {
  it('dört kanalı kaydeder', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'memory:add',
      'memory:clear',
      'memory:list',
      'memory:remove',
    ]);
  });

  it('memory:list boş depoda [] döner', async () => {
    expect(await call('memory:list')).toEqual([]);
  });

  it('memory:add kaydı diske yazar ve entry döner', async () => {
    const res = await call<{ ok: boolean; entry: { id: string; text: string; source: string } }>(
      'memory:add',
      'Kullanıcının kedisi var',
      'user',
    );
    expect(res.ok).toBe(true);
    expect(res.entry.text).toBe('Kullanıcının kedisi var');
    expect(res.entry.source).toBe('user');
    expect(readEntries()).toHaveLength(1);
  });

  it('memory:add bilinmeyen source değerini user olarak normalize eder', async () => {
    const res = await call<{ entry: { source: string } }>('memory:add', 'not', 'hacker');
    expect(res.entry.source).toBe('user');
  });

  it('memory:add her zaman string metin bekler (sayı stringe çevrilir)', async () => {
    const res = await call<{ entry: { text: string } }>('memory:add', 42, 'user');
    expect(res.entry.text).toBe('42');
  });

  it('memory:remove kaydı siler ve silme öncesi yedek bırakır', async () => {
    const added = await call<{ entry: { id: string } }>('memory:add', 'silinecek kayıt', 'user');
    const res = await call<{ ok: boolean }>('memory:remove', added.entry.id);
    expect(res.ok).toBe(true);
    expect(await call('memory:list')).toEqual([]);
    expect(fs.existsSync(`${memoryPath()}.bak`)).toBe(true);
  });

  it('memory:clear tüm kayıtları temizler', async () => {
    await call('memory:add', 'birinci kayıt', 'user');
    await call('memory:add', 'ikinci kayıt', 'user');
    const res = await call<{ ok: boolean }>('memory:clear');
    expect(res.ok).toBe(true);
    expect(await call('memory:list')).toEqual([]);
  });

  it('açılışta eski bug kalıntısı (çöp) kayıtları temizler', async () => {
    fs.writeFileSync(
      memoryPath(),
      JSON.stringify({
        version: 1,
        entries: [
          { id: 'x1', text: 'asistan burada', createdAt: new Date().toISOString(), source: 'user' },
          {
            id: 'x2',
            text: 'Kullanıcı kahveyi sever',
            createdAt: new Date().toISOString(),
            source: 'user',
          },
        ],
      }),
      'utf8',
    );
    registerMemoryIpc(); // cleanupOnBoot'u yeniden tetikle
    await vi.waitFor(() => {
      const entries = readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('Kullanıcı kahveyi sever');
    });
  });
});
