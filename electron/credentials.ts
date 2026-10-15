/**
 * Credentials vault — API anahtarı yalnızca burada yaşar.
 * OS şifre kasası (Electron safeStorage: Windows DPAPI / macOS Keychain) ile şifrelenir.
 * Renderer'a asla açık metin gitmez; yalnızca "var/yok" bilgisi taşınır.
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function credentialsFile(): string {
  return path.join(app.getPath('userData'), 'credentials.json');
}

export function credentialsAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export async function hasApiKey(): Promise<boolean> {
  return (await readStoredKey()) !== '';
}

export interface SetKeyResult {
  ok: boolean;
  error?: string;
}

export async function setApiKey(key: string): Promise<SetKeyResult> {
  if (!credentialsAvailable()) {
    return {
      ok: false,
      error: 'Bu sistemde güvenli anahtar kasası yok. Anahtar kaydedilmedi; oturum için elle girebilirsin.',
    };
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, error: 'Anahtar boş olamaz.' };
  }
  try {
    const enc = safeStorage.encryptString(trimmed).toString('base64');
    await atomicWriteJson(credentialsFile(), { version: 1, keyEnc: enc });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Anahtar kaydedilemedi.' };
  }
}

/** Anahtarın okunması yalnızca main süreçte yapılır; asla loglanmaz. */
export async function getApiKey(): Promise<string> {
  const stored = await readStoredKey();
  if (!stored) return '';
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return '';
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    fs.rmSync(credentialsFile(), { force: true });
  } catch {
    // yok say — temizlik amaçlı
  }
}

async function readStoredKey(): Promise<string> {
  try {
    const raw = await fs.promises.readFile(credentialsFile(), 'utf8');
    const data = JSON.parse(raw) as { keyEnc?: string };
    return typeof data.keyEnc === 'string' ? data.keyEnc : '';
  } catch {
    return '';
  }
}

/** Atomik yazım: geçici dosyaya yaz + rename (yarım dosya riski yok). */
async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, file);
}
