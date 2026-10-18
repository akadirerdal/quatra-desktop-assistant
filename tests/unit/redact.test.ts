import { describe, expect, it } from 'vitest';
import { containsSecrets, redactSecrets } from '../../src/utils/redact';

// Sahte anahtarlar parçalı yazılır ki repo secret taraması (scripts/check-secrets.mjs)
// test fixture'larını yanlış alarm olarak yakalamasın. Değerler uydurmadır, gerçek key değildir.
const FAKE = {
  sk: 'sk-' + 'abcdef1234567890abcdef',
  gsk: 'gsk_' + '1234567890abcdef',
  bearer: 'Bearer ' + 'eyJhbGciOiJIUzI1NiJ9.abc',
  apiKey: 'api_key=' + 'abcdefgh12345678',
  xApiKey: 'X-API-Key: ' + 'abcdefgh12345678',
};

describe('redactSecrets', () => {
  it('maskeler sk- anahtarını', () => {
    expect(redactSecrets('key=' + FAKE.sk)).toBe('key=sk-[REDACTED]');
  });

  it('maskeler gsk_ anahtarını', () => {
    expect(redactSecrets(FAKE.gsk)).toBe('gsk_[REDACTED]');
  });

  it('maskeler Bearer tokenını', () => {
    expect(redactSecrets('Authorization: ' + FAKE.bearer)).toBe('Authorization: Bearer [REDACTED]');
  });

  it('maskeler api_key= ve x-api-key formlarını', () => {
    expect(redactSecrets(FAKE.apiKey)).toBe('api_key=[REDACTED]');
    expect(redactSecrets(FAKE.xApiKey)).toBe('X-API-Key: [REDACTED]');
  });

  it('api_key değerindeki base64 karakterlerini (+ / =) de maskeler (V1.2-123)', () => {
    expect(redactSecrets('api_key: ' + 'ab+CDefghi/jkl12==')).toBe('api_key: [REDACTED]');
    expect(redactSecrets('api_key=ab+CDefghi/jkl12==')).toBe('api_key=[REDACTED]');
  });

  it('kelime ortasındaki "sk-" dizisini maskelemez (V1.2-124)', () => {
    for (const text of ['risk-balanced', 'disk-alanı temiz', 'kiosk-mode açık']) {
      expect(redactSecrets(text)).toBe(text);
    }
    expect(redactSecrets(' anahtar ' + FAKE.sk)).toBe(' anahtar sk-[REDACTED]');
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
    const out = redactSecrets('{"provider":"deepseek","apiKey":"' + FAKE.sk + '"}');
    expect(out).not.toContain(FAKE.sk);
    expect(out).toContain('[REDACTED]');
  });
});

describe('containsSecrets', () => {
  it('secret varsa true döner', () => {
    expect(containsSecrets(FAKE.sk)).toBe(true);
  });

  it('temiz metinde false döner', () => {
    expect(containsSecrets('merhaba dünya')).toBe(false);
  });
});
