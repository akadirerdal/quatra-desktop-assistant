/**
 * Ayarlar dosyası — atomik yazım + yedek + bozuk dosya recovery.
 * Yazımlar serileştirilir ve benzersiz geçici dosya adı kullanılır; böylece
 * eşzamanlı save çağrıları birbirinin .tmp yolunu ezemez (V1.2-010).
 * İçerik secret içermez (API anahtarı credentials vault'tadır).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

/** Yazma kuyruğu: eşzamanlı çağrılar çakışmadan sırayla işlenir. */
let writeChain: Promise<void> = Promise.resolve();

export async function loadSettingsFile(): Promise<unknown> {
  // Devam eden yazım varsa bitmesini bekle; ardından dosya tutarlı okunur.
  await writeChain;
  const file = settingsFile();
  const main = await readJsonSafe(file);
  if (main !== null) return main;
  // Bozuksa son sağlam yedekten dön.
  const backup = await readJsonSafe(`${file}.bak`);
  return backup;
}

export function saveSettingsFile(data: unknown): Promise<void> {
  const run = writeChain.then(() => writeSettingsFile(data));
  // Tek bir hata kuyruğu kilitlemesin; hata çağırana yine iletilir.
  writeChain = run.catch(() => undefined);
  return run;
}

async function writeSettingsFile(data: unknown): Promise<void> {
  const file = settingsFile();
  // Benzersiz tmp adı: aynı anda başka bir yazım varsa dosyaları çakışmaz.
  const tmp = `${file}.${process.pid}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.tmp`;
  try {
    // Önce mevcut sağlam dosyayı yedekle.
    try {
      const current = await readJsonSafe(file);
      if (current !== null) {
        await fs.promises.copyFile(file, `${file}.bak`);
      }
    } catch {
      // yedek alınamazsa devam et — yazım hâlâ atomik
    }
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.promises.rename(tmp, file);
  } catch (e) {
    // Yarım kalan geçici dosyayı ortada bırakma.
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
    throw e;
  }
}

async function readJsonSafe(file: string): Promise<unknown | null> {
  try {
    const raw = await fs.promises.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
