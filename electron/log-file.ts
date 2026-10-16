/**
 * Kalıcı günlük dosyası — %APPDATA%\Quatra\logs\quatra.log (+ 1MB'da quatra.log.1).
 * Tüm satırlar redact sınırından geçtikten sonra yazılır (secret asla dosyaya gitmez).
 */
import { app, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { appendWithRotation } from '../src/services/log/file-append';

export function logDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function logFilePath(): string {
  return path.join(logDir(), 'quatra.log');
}

export function appendLogLine(line: string): void {
  appendWithRotation(logFilePath(), line);
}

/** Kullanıcı için günlük klasörünü aç. */
export async function openLogsFolder(): Promise<{ ok: boolean; path?: string; message?: string }> {
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    const err = await shell.openPath(logDir());
    if (err) return { ok: false, message: err };
    return { ok: true, path: logDir() };
  } catch {
    return { ok: false, message: 'Günlük klasörü açılamadı.' };
  }
}
