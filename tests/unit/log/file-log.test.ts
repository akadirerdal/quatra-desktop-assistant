import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendWithRotation } from '../../../src/services/log/file-append';
import { Logger } from '../../../src/services/log/logger';

const tempDirs: string[] = [];

function tempFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-log-'));
  tempDirs.push(dir);
  return path.join(dir, 'quatra.log');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('appendWithRotation', () => {
  it('satırları ekler', () => {
    const file = tempFile();
    appendWithRotation(file, 'birinci');
    appendWithRotation(file, 'ikinci');
    expect(fs.readFileSync(file, 'utf8')).toBe('birinci\nikinci\n');
  });

  it('boyut sınırında .1 yedeğine döndürür', () => {
    const file = tempFile();
    appendWithRotation(file, 'a'.repeat(50), 40); // 51 byte > 40
    appendWithRotation(file, 'yeni', 40);
    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('yeni\n');
    expect(fs.readFileSync(`${file}.1`, 'utf8')).toContain('aaaa');
  });

  it('yazılamayan yolda sessiz kalır (throw etmez)', () => {
    expect(() => appendWithRotation('Z:\\olmayan-yol\\x.log', 'x')).not.toThrow();
  });
});

describe('Logger sink', () => {
  it('sink redact edilmiş kaydı alır', () => {
    const logger = new Logger();
    const received: string[] = [];
    logger.addSink((e) => received.push(e.message));
    const fake = 'sk-' + 'abcdef1234567890abcdef';
    logger.log('test', 'info', `anahtar: ${fake}`);
    expect(received).toHaveLength(1);
    expect(received[0]).not.toContain('abcdef1234567890abcdef');
    expect(received[0]).toContain('[REDACTED]');
  });

  it('sink kaldırılabilir', () => {
    const logger = new Logger();
    let count = 0;
    const off = logger.addSink(() => count++);
    logger.log('t', 'info', 'bir');
    off();
    logger.log('t', 'info', 'iki');
    expect(count).toBe(1);
  });

  it('patlayan sink diğerlerini ve loglamayı etkilemez', () => {
    const logger = new Logger();
    let ok = 0;
    logger.addSink(() => {
      throw new Error('sink patladı');
    });
    logger.addSink(() => ok++);
    expect(() => logger.log('t', 'info', 'x')).not.toThrow();
    expect(ok).toBe(1);
    expect(logger.diagnostics()).toHaveLength(1);
  });
});
