import { describe, expect, it } from 'vitest';
import { containsSecrets, redactSecrets } from '../../src/utils/redact';

describe('redactSecrets', () => {
  it('maskeler sk- anahtarını', () => {
    const out = redactSecrets('key=sk-abcdef1234567890abcdef');
    expect(out).toBe('key=sk-[REDACTED]');
  });

  it('maskeler gsk_ anahtarını', () => {
    const out = redactSecrets('gsk_1234567890abcdef');
    expect(out).toBe('gsk_[REDACTED]');
  });

  it('maskeler Bearer tokenını', () => {
    const out = redactSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc');
    expect(out).toBe('Authorization: Bearer [REDACTED]');
  });

  it('maskeler api_key= ve x-api-key formlarını', () => {
    expect(redactSecrets('api_key=abcdefgh12345678')).toBe('api-key=[REDACTED]');
    expect(redactSecrets('X-API-Key: abcdefgh12345678')).toContain('[REDACTED]');
  });

  it('dokunmaz normal metne', () => {
    const text = 'Bugün hava güzel, alarm 06:00 için kuruldu.';
    expect(redactSecrets(text)).toBe(text);
  });

  it('kısa kelimeleri yanlışlıkla maskelemez', () => {
    const text = 'key sk-kısa olsun ama 8+ karakter yok';
    expect(redactSecrets(text)).toBe(text);
  });

  it('JSON benzeri log satırında da maskeler', () => {
    const out = redactSecrets('{"provider":"deepseek","apiKey":"sk-abcdef1234567890abcdef"}');
    expect(out).not.toContain('sk-abcdef1234567890abcdef');
    expect(out).toContain('[REDACTED]');
  });
});

describe('containsSecrets', () => {
  it('secret varsa true döner', () => {
    expect(containsSecrets('sk-abcdef1234567890abcdef')).toBe(true);
  });

  it('temiz metinde false döner', () => {
    expect(containsSecrets('merhaba dünya')).toBe(false);
  });
});
