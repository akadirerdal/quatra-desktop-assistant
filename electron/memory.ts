/**
 * Hafıza — IPC tarafı. Kayıtlar YALNIZCA yerel dosyada (%APPDATA%\Quatra\memory.json).
 * Silinmedikçe kalıcıdır; hiçbir servise gönderilmez (yalnızca prompt bağlamına eklenir).
 */
import { app, ipcMain } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { MemoryStore } from '../src/services/memory/memory-store';
import { appLogger } from '../src/services/log/logger';

/**
 * V1.2-012 (main tarafı): TEK store örneği — her IPC çağrısında yeni MemoryStore kurulmaz.
 * Yol değişirse (testler ayrı userData kullanır) örnek yenilenir.
 */
let storePath = '';
let storeInstance: MemoryStore | null = null;

function store(): MemoryStore {
  const file = path.join(app.getPath('userData'), 'memory.json');
  if (!storeInstance || storePath !== file) {
    storeInstance = new MemoryStore(file);
    storePath = file;
  }
  return storeInstance;
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

/** V1.2-096: IPC yalnızca ana çerçeveden kabul edilir (iframe/yabancı webContents reddedilir). */
function isTrustedSender(event: unknown): boolean {
  const frame = (event as { senderFrame?: { parent?: unknown } | null } | null)?.senderFrame;
  if (!frame) return true; // çerçeve bilgisi yok — test/özel çağrı ortamı
  return frame.parent == null; // yalnız ana çerçeve (alt çerçevede parent doludur)
}

type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function handle(channel: string, fn: IpcHandler): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      appLogger.scoped('memory').warn(`yetkisiz IPC çağrısı reddedildi: ${channel}`);
      return { ok: false };
    }
    return fn(event, ...args);
  });
}

/**
 * V1.2-044: kayıt metni main tarafında doğrulanır. Sayı stringe çevrilir (mevcut davranış),
 * ancak `undefined`/`null` "undefined" gibi çöp bir kayda DÖNÜŞMEZ.
 */
const addTextSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().slice(0, 500));

export function registerMemoryIpc(): void {
  void cleanupOnBoot();
  handle('memory:list', async () => store().load());
  handle('memory:add', async (_e, text: unknown, source: unknown) => {
    const parsed = addTextSchema.safeParse(text);
    if (!parsed.success || !parsed.data) return { ok: false, message: 'Hafıza kaydı boş olamaz.' };
    const entry = await store().add(parsed.data, source === 'assistant' ? 'assistant' : 'user');
    return { ok: true, entry };
  });
  handle('memory:remove', async (_e, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) return { ok: false };
    await store().remove(id.trim());
    appLogger.scoped('memory').info('kayıt silindi (yedek: memory.json.bak)');
    return { ok: true };
  });
  handle('memory:clear', async () => {
    const count = (await store().load()).length;
    await store().clear();
    appLogger.scoped('memory').info(`hafıza temizlendi (${count} kayıt) — yedek: memory.json.bak`);
    return { ok: true };
  });
}
