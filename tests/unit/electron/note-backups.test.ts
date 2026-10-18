/**
 * electron/note-backups — not yedek kayıtları, yol doğrulama ve geri yükleme (V1.2-082).
 * `electron` mock'lanır; tüm dosyalar geçici dizinde.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let userDataDir = '';
let workDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
}));

import {
  backupBeforeWrite,
  lastNoteBackup,
  restoreLastNoteBackup,
} from '../../../electron/note-backups';

function recordsPath(): string {
  return path.join(userDataDir, 'note-backups.json');
}

function writeRecords(records: Array<{ target: string; backup: string; ts: string }>): void {
  fs.writeFileSync(recordsPath(), JSON.stringify(records), 'utf8');
}

function note(name: string, content: string): string {
  const file = path.join(workDir, name);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-note-backups-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-notes-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('note-backups', () => {
  it('hedef dosya yoksa yedek almaz, kayıt tutmaz', () => {
    expect(backupBeforeWrite(path.join(workDir, 'yok.md'))).toBeNull();
    expect(lastNoteBackup()).toBeNull();
  });

  it('mevcut notun .bak kopyasını alır ve kaydı tutar', () => {
    const target = note('not.md', 'ilk sürüm');
    const rec = backupBeforeWrite(target);
    expect(rec).not.toBeNull();
    expect(rec!.target).toBe(target);
    expect(rec!.backup).toBe(`${target}.bak`);
    expect(fs.readFileSync(rec!.backup, 'utf8')).toBe('ilk sürüm');
    expect(lastNoteBackup()).toEqual(rec);
  });

  it('geri yükleme hedefi yedekteki içeriğe döndürür', () => {
    const target = note('not.md', 'ilk sürüm');
    backupBeforeWrite(target);
    fs.writeFileSync(target, 'bozulmuş sürüm', 'utf8');
    expect(restoreLastNoteBackup()).toEqual({ ok: true, message: 'Not geri alındı.' });
    expect(fs.readFileSync(target, 'utf8')).toBe('ilk sürüm');
  });

  it('geri alma önce mevcut hali yedekler ve kaydı tüketir (aynı yedek ikinci kez uygulanmaz)', () => {
    const target = note('not.md', 'ilk sürüm');
    backupBeforeWrite(target);
    fs.writeFileSync(target, 'aradaki düzenleme', 'utf8');
    expect(restoreLastNoteBackup()).toEqual({ ok: true, message: 'Not geri alındı.' });
    expect(fs.readFileSync(target, 'utf8')).toBe('ilk sürüm');
    // V1.2-035: eski(ilk) kayıt tüketildi; sıradaki kayıt geri alma öncesi hali taşır.
    const records = JSON.parse(fs.readFileSync(recordsPath(), 'utf8')) as Array<{
      backup: string;
      ts: string;
    }>;
    expect(records).toHaveLength(1);
    expect(fs.readFileSync(records[0]!.backup, 'utf8')).toBe('aradaki düzenleme');
    // İkinci geri alma stale yedeği değil, bir önceki hali döndürür.
    expect(restoreLastNoteBackup()).toEqual({ ok: true, message: 'Not geri alındı.' });
    expect(fs.readFileSync(target, 'utf8')).toBe('aradaki düzenleme');
  });

  it('yedek kaydı yokken anlamlı hata döner', () => {
    expect(restoreLastNoteBackup()).toEqual({
      ok: false,
      message: 'Geri alınacak not yedeği yok.',
    });
  });

  it('yedek dosyası silinmişse geri yükleme reddedilir', () => {
    const target = note('not.md', 'içerik');
    const rec = backupBeforeWrite(target)!;
    fs.rmSync(rec.backup);
    expect(restoreLastNoteBackup()).toEqual({ ok: false, message: 'Yedek dosyası bulunamadı.' });
  });

  it('yol doğrulaması: yedek ile hedef farklı klasördeyse reddedilir', () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-other-'));
    try {
      const target = note('not.md', 'hedef');
      const foreignBackup = path.join(otherDir, 'not.md.bak');
      fs.writeFileSync(foreignBackup, 'şüpheli yedek', 'utf8');
      writeRecords([{ target, backup: foreignBackup, ts: new Date().toISOString() }]);
      expect(restoreLastNoteBackup()).toEqual({
        ok: false,
        message: 'Yedek konumu doğrulanamadı.',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('hedef'); // hedefe dokunulmadı
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });

  it('en fazla 10 kayıt tutar; son kayıt en yenidir (eskiler düşer)', () => {
    const target = note('not.md', 'v0');
    let last: ReturnType<typeof backupBeforeWrite> = null;
    for (let i = 1; i <= 12; i++) {
      fs.writeFileSync(target, `v${i}`, 'utf8');
      last = backupBeforeWrite(target);
    }
    const records = JSON.parse(fs.readFileSync(recordsPath(), 'utf8')) as Array<{ ts: string }>;
    expect(records).toHaveLength(10);
    expect(lastNoteBackup()).toEqual(last);
  });
});
