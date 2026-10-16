import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../../../src/services/memory/memory-store';

const tempDirs: string[] = [];

function store(): MemoryStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-mem-'));
  tempDirs.push(dir);
  return new MemoryStore(path.join(dir, 'memory.json'));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('MemoryStore', () => {
  it('ekler ve listeler (kalıcı dosyada)', async () => {
    const s = store();
    await s.add('Kullanıcının kedisi var', 'user');
    const entries = await s.load();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe('Kullanıcının kedisi var');
  });

  it('aynı kaydı tekrarlamaz (dedupe)', async () => {
    const s = store();
    await s.add('Kullanıcı Fenerbahçeli', 'user');
    await s.add('Kullanıcı Fenerbahçeli', 'user');
    expect(await s.load()).toHaveLength(1);
  });

  it('siler ve temizler', async () => {
    const s = store();
    const a = await s.add('bir', 'user');
    await s.add('iki', 'user');
    await s.remove(a.id);
    expect(await s.load()).toHaveLength(1);
    await s.clear();
    expect(await s.load()).toHaveLength(0);
  });

  it('boş kayıt eklemeyi reddeder', async () => {
    const s = store();
    await expect(s.add('   ', 'user')).rejects.toThrow();
  });

  it('arama: sorguyla ilgili kayıtları öne alır', async () => {
    const s = store();
    await s.add('Kullanıcının adı Ali', 'user');
    await s.add('Kullanıcı Python seviyor', 'user');
    await s.add('Kahve tercihi: sade', 'user');
    const found = await s.search('python');
    expect(found[0]?.text).toContain('Python');
  });

  it('contextBlock ilgili kayıtları döner', async () => {
    const s = store();
    await s.add('Kullanıcının adı Ali', 'user');
    await s.add('Proje adı Quatra', 'user');
    const block = await s.contextBlock('proje neydi');
    expect(block).toContain('Quatra');
  });

  it('maxEntries sınırını korur (en eskiler düşer)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-mem-'));
    tempDirs.push(dir);
    const s = new MemoryStore(path.join(dir, 'm.json'), 3);
    for (let i = 0; i < 5; i++) await s.add(`kayıt ${i}`, 'user');
    const entries = await s.load();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.text).toBe('kayıt 2');
  });
});
