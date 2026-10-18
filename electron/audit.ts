/**
 * İşlem günlüğü (audit) — V1-17: Quatra'nın yaptığı işlerin kalıcı, görüntülenebilir kaydı.
 * Yalnız yerel: userData/audit.jsonl. Secret'lar redact edilir; en fazla 800 kayıt tutulur
 * (V1.2-039: kırpma toplu yapılır — dosya kısa süre ~900 satıra taşabilir).
 * Yazım hataları asistan akışını ASLA etkilemez (yutulur, log'lanır).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets } from '../src/utils/redact';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('audit');
const MAX_ENTRIES = 800;
// V1.2-039: kırpma toplu yapılır — her ekte dosya baştan okunmaz.
const TRIM_SLACK = 100;

export interface AuditEntry {
  ts: string;
  tool: string;
  ok: boolean;
  detail: string;
  ms: number;
}

function auditFile(): string {
  return path.join(app.getPath('userData'), 'audit.jsonl');
}

// V1.2-039: yaklaşık satır sayacı (tam okuma yerine). -1 = bilinmiyor.
let approxLines = -1;
// Dışarıdan (başka süreç/elle) dosya değişirse stat boyutu eşleşmez → sayaç yeniden sayılır.
let lastBytes = -1;
let lastPath = '';

function syncCounter(): void {
  const file = auditFile();
  if (file !== lastPath) {
    lastPath = file;
    approxLines = -1;
    lastBytes = -1;
  }
  try {
    const size = fs.statSync(file).size;
    if (size !== lastBytes) {
      approxLines = -1;
      lastBytes = size;
    }
  } catch {
    approxLines = 0; // dosya henüz yok
    lastBytes = 0;
  }
}

function countLines(): number {
  try {
    return fs
      .readFileSync(auditFile(), 'utf8')
      .split('\n')
      .filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

export function appendAudit(entry: AuditEntry): void {
  try {
    const safe: AuditEntry = {
      ...entry,
      detail: redactSecrets(entry.detail).slice(0, 300),
    };
    const line = JSON.stringify(safe) + '\n';
    syncCounter();
    fs.appendFileSync(auditFile(), line, 'utf8');
    approxLines = approxLines < 0 ? countLines() : approxLines + 1;
    lastBytes += Buffer.byteLength(line, 'utf8');
    // Yalnız pay kadar taşınca tek seferde 800'e indir (her kayıtta tam okuma yok).
    if (approxLines > MAX_ENTRIES + TRIM_SLACK) trimIfNeeded();
  } catch (e) {
    log.warn(`audit yazılamadı: ${String(e)}`);
  }
}

function trimIfNeeded(): void {
  try {
    const lines = fs
      .readFileSync(auditFile(), 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    if (lines.length <= MAX_ENTRIES) {
      approxLines = lines.length;
      lastBytes = fs.statSync(auditFile()).size;
      return;
    }
    const kept = lines.slice(-MAX_ENTRIES);
    const out = kept.join('\n') + '\n';
    fs.writeFileSync(auditFile(), out, 'utf8');
    approxLines = kept.length;
    lastBytes = Buffer.byteLength(out, 'utf8');
  } catch {
    // kırpma kritik değil
  }
}

/** En yeni kayıt önce olacak şekilde son `limit` girişi döner. */
export function listAudit(limit = 50): AuditEntry[] {
  try {
    const lines = fs
      .readFileSync(auditFile(), 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .slice(-limit);
    const out: AuditEntry[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as AuditEntry);
      } catch {
        // bozuk satırı atla
      }
    }
    return out.reverse();
  } catch {
    return [];
  }
}

export function clearAudit(): void {
  try {
    fs.writeFileSync(auditFile(), '', 'utf8');
    approxLines = 0;
    lastBytes = 0;
  } catch (e) {
    log.warn(`audit temizlenemedi: ${String(e)}`);
  }
}
