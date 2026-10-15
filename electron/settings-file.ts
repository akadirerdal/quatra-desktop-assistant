/**
 * Ayarlar dosyası — atomik yazım + yedek + bozuk dosya recovery.
 * İçerik secret içermez (API anahtarı credentials vault'tadır).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export async function loadSettingsFile(): Promise<unknown> {
  const file = settingsFile();
  const main = await readJsonSafe(file);
  if (main !== null) return main;
  // Bozuksa son sağlam yedekten dön.
  const backup = await readJsonSafe(`${file}.bak`);
  return backup;
}

export async function saveSettingsFile(data: unknown): Promise<void> {
  const file = settingsFile();
  const tmp = `${file}.tmp`;
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
}

async function readJsonSafe(file: string): Promise<unknown | null> {
  try {
    const raw = await fs.promises.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
