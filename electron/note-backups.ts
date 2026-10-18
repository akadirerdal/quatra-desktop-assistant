/**
 * Not yedekleri (V1-18) — not yazmadan önce mevcut dosyanın kopyası alınır;
 * son yedek tek tıkla geri alınabilir. Kayıt: userData/note-backups.json (son 10).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('note-backup');
const MAX_RECORDS = 10;

export interface NoteBackupRecord {
  target: string;
  backup: string;
  ts: string;
}

function recordsFile(): string {
  return path.join(app.getPath('userData'), 'note-backups.json');
}

function readRecords(): NoteBackupRecord[] {
  try {
    const raw = JSON.parse(fs.readFileSync(recordsFile(), 'utf8')) as NoteBackupRecord[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeRecords(list: NoteBackupRecord[]): void {
  try {
    fs.writeFileSync(recordsFile(), JSON.stringify(list), 'utf8');
  } catch (e) {
    log.warn(`yedek kaydı yazılamadı: ${String(e)}`);
  }
}

/** Hedef dosya varsa `.bak` kopyası alır ve kaydını tutar; yoksa null. */
export function backupBeforeWrite(target: string): NoteBackupRecord | null {
  try {
    if (!fs.existsSync(target)) return null;
    const backup = `${target}.bak`;
    fs.copyFileSync(target, backup);
    const rec: NoteBackupRecord = { target, backup, ts: new Date().toISOString() };
    writeRecords([...readRecords(), rec].slice(-MAX_RECORDS));
    return rec;
  } catch (e) {
    log.warn(`not yedeği alınamadı: ${String(e)}`);
    return null;
  }
}

export function lastNoteBackup(): NoteBackupRecord | null {
  const list = readRecords();
  return list.length ? (list[list.length - 1] as NoteBackupRecord) : null;
}

export function restoreLastNoteBackup(): { ok: boolean; message: string } {
  const list = readRecords();
  const rec = list.length ? (list[list.length - 1] as NoteBackupRecord) : null;
  if (!rec) return { ok: false, message: 'Geri alınacak not yedeği yok.' };
  try {
    if (!fs.existsSync(rec.backup)) return { ok: false, message: 'Yedek dosyası bulunamadı.' };
    // Güvenlik: yedek ile hedef AYNI klasörde olmalı (yol oyunu imkânsız).
    if (path.dirname(path.resolve(rec.backup)) !== path.dirname(path.resolve(rec.target))) {
      return { ok: false, message: 'Yedek konumu doğrulanamadı.' };
    }
    // İçeriği şimdi belleğe al: backupBeforeWrite aynı `.bak` yolunu ezebilir.
    const restored = fs.readFileSync(rec.backup);
    // V1.2-035: üzerine yazmadan ÖNCE mevcut hali yedekle (aradaki düzenlemeler kaybolmasın).
    if (fs.existsSync(rec.target) && !backupBeforeWrite(rec.target)) {
      return { ok: false, message: 'Mevcut not yedeklenemediği için geri alınamadı.' };
    }
    fs.writeFileSync(rec.target, restored);
    consumeRecord(rec);
    log.info(`not geri alındı: ${rec.target}`);
    return { ok: true, message: 'Not geri alındı.' };
  } catch (e) {
    log.warn(`geri alma başarısız: ${String(e)}`);
    return { ok: false, message: 'Geri alma başarısız oldu.' };
  }
}

/** V1.2-035: geri alınan kaydı listeden düş — aynı yedek ikinci kez uygulanmasın. */
function consumeRecord(rec: NoteBackupRecord): void {
  const list = readRecords();
  const idx = list.findIndex(
    (r) => r.ts === rec.ts && r.backup === rec.backup && r.target === rec.target,
  );
  if (idx >= 0) writeRecords([...list.slice(0, idx), ...list.slice(idx + 1)]);
}
