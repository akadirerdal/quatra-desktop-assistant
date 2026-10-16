/**
 * Hafıza — IPC tarafı. Kayıtlar YALNIZCA yerel dosyada (%APPDATA%\Quatra\memory.json).
 * Silinmedikçe kalıcıdır; hiçbir servise gönderilmez (yalnızca prompt bağlamına eklenir).
 */
import { app, ipcMain } from 'electron';
import path from 'node:path';
import { MemoryStore } from '../src/services/memory/memory-store';
import { isGarbageNameEntry } from '../src/services/memory/extraction';

function store(): MemoryStore {
  return new MemoryStore(path.join(app.getPath('userData'), 'memory.json'));
}

/** Açılışta eski bug kalıntılarını (ör. "adı: ne") temizler. */
async function cleanupOnBoot(): Promise<void> {
  try {
    const s = store();
    const entries = await s.load();
    for (const e of entries) {
      if (isGarbageNameEntry(e.text)) await s.remove(e.id);
    }
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
    return { ok: true };
  });
  ipcMain.handle('memory:clear', async () => {
    await store().clear();
    return { ok: true };
  });
}
