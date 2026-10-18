// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LocalStorageSettingsBackend,
  MemorySettingsBackend,
  type SettingsBackend,
} from '../../../../src/services/storage/settings-storage';

describe('MemorySettingsBackend', () => {
  it('başlangıç değeri null → load null döner', async () => {
    const b = new MemorySettingsBackend();
    expect(await b.load()).toBeNull();
  });

  it('başlangıç değeri verilirse load onu döner', async () => {
    const b = new MemorySettingsBackend({ a: 1 });
    expect(await b.load()).toEqual({ a: 1 });
  });

  it('save → load round-trip', async () => {
    const b = new MemorySettingsBackend();
    await b.save({ x: 'y', n: 42 });
    expect(await b.load()).toEqual({ x: 'y', n: 42 });
  });

  it("ardışık save'ler son değeri korur (kayıp güncelleme yok)", async () => {
    const b = new MemorySettingsBackend();
    await b.save({ v: 1 });
    await b.save({ v: 2 });
    await b.save({ v: 3 });
    expect(await b.load()).toEqual({ v: 3 });
  });

  it('farklı backend örnekleri birbirini etkilemez', async () => {
    const a = new MemorySettingsBackend();
    const c = new MemorySettingsBackend();
    await a.save({ owner: 'a' });
    expect(await c.load()).toBeNull();
  });
});

describe('LocalStorageSettingsBackend', () => {
  const KEY = 'quatra.test.settings';

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('boş storage → load null', async () => {
    const b = new LocalStorageSettingsBackend(KEY);
    expect(await b.load()).toBeNull();
  });

  it('save → load round-trip (JSON)', async () => {
    const b = new LocalStorageSettingsBackend(KEY);
    await b.save({ theme: 'gece', n: 7 });
    expect(await b.load()).toEqual({ theme: 'gece', n: 7 });
  });

  it('bozuk JSON → load null (varsayılanlara düşer, throw etmez)', async () => {
    window.localStorage.setItem(KEY, '{bozuk json');
    const b = new LocalStorageSettingsBackend(KEY);
    expect(await b.load()).toBeNull();
  });

  it('farklı storageKey izole çalışır', async () => {
    const a = new LocalStorageSettingsBackend('quatra.a');
    const c = new LocalStorageSettingsBackend('quatra.c');
    await a.save({ v: 1 });
    expect(await c.load()).toBeNull();
    expect(window.localStorage.getItem('quatra.c')).toBeNull();
  });

  it('save üstüne yazar (append değil)', async () => {
    const b = new LocalStorageSettingsBackend(KEY);
    await b.save({ v: 1 });
    await b.save({ v: 2 });
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ v: 2 });
  });
});

describe('SettingsBackend sözleşmesi', () => {
  it("Memory ve LocalStorage aynı interface'i implement eder", () => {
    const backends: SettingsBackend[] = [
      new MemorySettingsBackend(),
      new LocalStorageSettingsBackend('k'),
    ];
    expect(backends).toHaveLength(2);
  });
});
