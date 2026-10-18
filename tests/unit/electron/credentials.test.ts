/**
 * electron/credentials — yazma kuyruğu, benzersiz tmp, deşifre hatası ayrımı (V1.2-029/036/102).
 * `electron` mock'lanır; safeStorage şifrelemesi test amaçlı taklit edilir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';

let userDataDir = '';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataDir) },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`, 'utf8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf8').replace(/^enc:/, '')),
  },
}));

import { clearApiKey, getApiKey, hasApiKey, setApiKey } from '../../../electron/credentials';

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-credentials-'));
  vi.clearAllMocks();
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('credentials', () => {
  it('anahtar yokken boş döner, hasApiKey false olur', async () => {
    expect(await getApiKey('deepseek')).toBe('');
    expect(await hasApiKey('deepseek')).toBe(false);
  });

  it('eşzamanlı setApiKey çağrıları anahtar kaybettirmez (yazma kuyruğu)', async () => {
    await Promise.all([
      setApiKey('deepseek', 'anahtar-A'),
      setApiKey('groq', 'anahtar-B'),
      setApiKey('mem0', 'anahtar-C'),
    ]);
    expect(await getApiKey('deepseek')).toBe('anahtar-A');
    expect(await getApiKey('groq')).toBe('anahtar-B');
    expect(await getApiKey('mem0')).toBe('anahtar-C');
    expect(await hasApiKey('mem0')).toBe(true);
  });

  it('yazma sonrası geçici dosya kalmaz (benzersiz tmp)', async () => {
    await setApiKey('deepseek', 'A');
    expect(fs.readdirSync(userDataDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('clearApiKey anahtarı siler (kuyruk üzerinden)', async () => {
    await setApiKey('deepseek', 'A');
    await clearApiKey('deepseek');
    expect(await hasApiKey('deepseek')).toBe(false);
    expect(await getApiKey('deepseek')).toBe('');
  });

  it('anahtar kayıtlı ama çözülemezse hata ayırt edilir (V1.2-036)', async () => {
    await setApiKey('deepseek', 'gizli-anahtar');
    vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
      throw new Error('keychain bozuk');
    });
    expect(await hasApiKey('deepseek')).toBe(true); // kayıt var
    await expect(getApiKey('deepseek')).rejects.toMatchObject({
      code: 'auth',
      message:
        'Kayıtlı API anahtarı çözülemedi; Ayarlar → AI Sağlayıcı bölümünden anahtarı yeniden kaydet.',
    });
    // Sonraki okuma normal çalışır (kalıcı bozulma taklidi değil).
    expect(await getApiKey('deepseek')).toBe('gizli-anahtar');
  });

  it('kasa yoksa mesaj oturumluk elle giriş vaat etmez (V1.2-102)', async () => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    const r = await setApiKey('deepseek', 'A');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/kaydedilemedi/);
    expect(r.error).not.toMatch(/oturum/i);
  });

  it('boş anahtar reddedilir', async () => {
    expect(await setApiKey('deepseek', '   ')).toEqual({ ok: false, error: 'Anahtar boş olamaz.' });
  });
});
