/**
 * İşlem günlüğü (audit) — V1-17: Quatra'nın yaptığı işlerin kalıcı, görüntülenebilir kaydı.
 * Yalnız yerel: userData/audit.jsonl. Secret'lar redact edilir; en fazla 800 kayıt tutulur.
 * Yazım hataları asistan akışını ASLA etkilemez (yutulur, log'lanır).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets } from '../src/utils/redact';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('audit');
const MAX_ENTRIES = 800;

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

export function appendAudit(entry: AuditEntry): void {
  try {
    const safe: AuditEntry = {
      ...entry,
      detail: redactSecrets(entry.detail).slice(0, 300),
    };
    fs.appendFileSync(auditFile(), JSON.stringify(safe) + '\n', 'utf8');
    trimIfNeeded();
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
    if (lines.length <= MAX_ENTRIES) return;
    fs.writeFileSync(auditFile(), lines.slice(-MAX_ENTRIES).join('\n') + '\n', 'utf8');
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
  } catch (e) {
    log.warn(`audit temizlenemedi: ${String(e)}`);
  }
}
