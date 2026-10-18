/**
 * electron/audit — işlem günlüğü: ekleme, redact, kırpma, listeleme, temizleme (V1.2-082).
 * `electron` mock'lanır; veri geçici userData/audit.jsonl dosyasına gider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
}));

import { appendAudit, clearAudit, listAudit, type AuditEntry } from '../../../electron/audit';

function auditPath(): string {
  return path.join(userDataDir, 'audit.jsonl');
}

function entry(tool: string, detail = '-', overrides: Partial<AuditEntry> = {}): AuditEntry {
  return { ts: new Date().toISOString(), tool, ok: true, detail, ms: 1, ...overrides };
}

function fileLines(): string[] {
  return fs
    .readFileSync(auditPath(), 'utf8')
    .split('\n')
    .filter((l) => l.trim());
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-audit-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('audit', () => {
  it('appendAudit yazar; listAudit en yeni kaydı önce döner', () => {
    appendAudit(entry('birinci'));
    appendAudit(entry('ikinci'));
    expect(listAudit().map((e) => e.tool)).toEqual(['ikinci', 'birinci']);
  });

  it('secret içeren detay maskelenir', () => {
    const fake = 'sk-' + 'abcdef1234567890abcdef';
    appendAudit(entry('p', `anahtar: ${fake}`));
    const [first] = listAudit();
    expect(first!.detail).not.toContain('abcdef1234567890abcdef');
    expect(first!.detail).toContain('[REDACTED]');
  });

  it('detay 300 karaktere kırpılır', () => {
    appendAudit(entry('uzun', 'a'.repeat(400)));
    expect(listAudit()[0]!.detail).toHaveLength(300);
  });

  it('listAudit(limit) son N kaydı yeni önce verir', () => {
    appendAudit(entry('k1'));
    appendAudit(entry('k2'));
    appendAudit(entry('k3'));
    expect(listAudit(2).map((e) => e.tool)).toEqual(['k3', 'k2']);
  });

  it('bozuk satırlar atlanır, sağlamlar okunur', () => {
    fs.writeFileSync(
      auditPath(),
      `${JSON.stringify(entry('ok1'))}\nbu satır json değil\n${JSON.stringify(entry('ok2'))}\n`,
      'utf8',
    );
    expect(listAudit().map((e) => e.tool)).toEqual(['ok2', 'ok1']);
  });

  it('800 kayıt sınırını aşınca en yeniler kalır, dosya kırpılır', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 810; i++) lines.push(JSON.stringify(entry(`t${i}`)));
    fs.writeFileSync(auditPath(), lines.join('\n') + '\n', 'utf8');
    appendAudit(entry('son'));
    const kept = fileLines();
    expect(kept).toHaveLength(800);
    expect((JSON.parse(kept[kept.length - 1]!) as AuditEntry).tool).toBe('son');
    expect(listAudit(800)[0]!.tool).toBe('son');
  });

  it('clearAudit dosyayı boşaltır', () => {
    appendAudit(entry('x'));
    clearAudit();
    expect(fs.readFileSync(auditPath(), 'utf8')).toBe('');
    expect(listAudit()).toEqual([]);
  });

  it('dosya erişilemezse append sessiz kalır, list boş döner', () => {
    // userData bir dosya: audit.jsonl yolu altına yazılamaz.
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.writeFileSync(userDataDir, 'blok', 'utf8');
    expect(() => appendAudit(entry('x'))).not.toThrow();
    expect(listAudit()).toEqual([]);
    expect(() => clearAudit()).not.toThrow();
  });
});
