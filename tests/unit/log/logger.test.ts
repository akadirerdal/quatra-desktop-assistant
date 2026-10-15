import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../src/services/log/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Logger', () => {
  it('minLevel altındaki kayıtları atmaz', () => {
    const logger = new Logger({ minLevel: 'warn' });
    logger.log('test', 'info', 'görünmez');
    expect(logger.diagnostics()).toHaveLength(0);
    logger.log('test', 'warn', 'görünür');
    expect(logger.diagnostics()).toHaveLength(1);
  });

  it("scoped logger scope'u taşır", () => {
    const logger = new Logger();
    logger.scoped('providers').info('deneme');
    const [entry] = logger.diagnostics();
    expect(entry?.scope).toBe('providers');
    expect(entry?.level).toBe('info');
  });

  it('ring kapasitesini aşan eski kayıtları düşürür', () => {
    const logger = new Logger({ ringSize: 3 });
    for (let i = 0; i < 5; i++) logger.log('t', 'info', `kayit-${i}`);
    const diag = logger.diagnostics();
    expect(diag).toHaveLength(3);
    expect(diag[0]?.message).toBe('kayit-2');
  });

  it('secret desenlerini tampona yazmadan maskeler', () => {
    const logger = new Logger();
    const fake = 'sk-' + 'abcdef1234567890abcdef';
    logger.log('t', 'error', `hata oldu: ${fake}`);
    const [entry] = logger.diagnostics();
    expect(entry?.message).not.toContain('abcdef1234567890abcdef');
    expect(entry?.message).toContain('[REDACTED]');
  });

  it('clear() tamponu boşaltır', () => {
    const logger = new Logger();
    logger.log('t', 'info', 'x');
    logger.clear();
    expect(logger.diagnostics()).toHaveLength(0);
  });

  it('error seviyesini console.error ile yazar', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new Logger().log('t', 'error', 'büyük hata');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('büyük hata');
  });
});
