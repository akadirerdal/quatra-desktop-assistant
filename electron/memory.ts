/**
 * Hafıza — IPC tarafı. Kayıtlar YALNIZCA yerel dosyada (%APPDATA%\Quatra\memory.json).
 * Silinmedikçe kalıcıdır; hiçbir servise gönderilmez (yalnızca prompt bağlamına eklenir).
 */
import { app, ipcMain } from 'electron';
import path from 'node:path';
import { MemoryStore } from '../src/services/memory/memory-store';
import { appLogger } from '../src/services/log/logger';

function store(): MemoryStore {
  return new MemoryStore(path.join(app.getPath('userData'), 'memory.json'));
}

/** Açılışta eski bug kalıntılarını (ör. "adı: ne") temizler. */
async function cleanupOnBoot(): Promise<void> {
  try {
    const removed = await store().cleanupGarbage();
    if (removed > 0) appLogger.scoped('memory').info(`${removed} çöp kayıt temizlendi`);
  } catch {
    // temizlik hatası önemli değil
  }
}

export function registerMemoryIpc(): void {
  void cleanupOnBoot();
  ipcMain.handle('memory:list', async () => store().load());
  ipcMain.handle('memory:add', async (_e, text: string, source: 'user' | 'assistant') => {
    const entry = await store().add(String(text), source === 'assistant' ? 'assistant' : 'user');
    return { ok: true, entry };
  });
  ipcMain.handle('memory:remove', async (_e, id: string) => {
    await store().remove(String(id));
    appLogger.scoped('memory').info('kayıt silindi (yedek: memory.json.bak)');
    return { ok: true };
  });
  ipcMain.handle('memory:clear', async () => {
    const count = (await store().load()).length;
    await store().clear();
    appLogger.scoped('memory').info(`hafıza temizlendi (${count} kayıt) — yedek: memory.json.bak`);
    return { ok: true };
  });
}
