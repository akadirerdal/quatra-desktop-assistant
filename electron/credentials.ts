/**
 * Credentials vault — API anahtarları yalnızca burada yaşar.
 * OS şifre kasası (Electron safeStorage: Windows DPAPI / macOS Keychain) ile şifrelenir.
 * Renderer'a asla açık metin gitmez; yalnızca "var/yok" bilgisi taşınır.
 *
 * Slotlar:
 *  - deepseek : sohbet modeli anahtarı
 *  - groq     : ses tanıma (Whisper) anahtarı
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type CredentialId = 'deepseek' | 'groq';

interface CredentialsFile {
  version: 2;
  keys: Partial<Record<CredentialId, string>>; // base64(encrypted)
}

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

export async function hasApiKey(id: CredentialId): Promise<boolean> {
  const keys = await readKeys();
  return typeof keys[id] === 'string' && keys[id]!.length > 0;
}

export interface SetKeyResult {
  ok: boolean;
  error?: string;
}

export async function setApiKey(id: CredentialId, key: string): Promise<SetKeyResult> {
  if (!credentialsAvailable()) {
    return {
      ok: false,
      error:
        'Bu sistemde güvenli anahtar kasası yok. Anahtar kaydedilmedi; oturum için elle girebilirsin.',
    };
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, error: 'Anahtar boş olamaz.' };
  }
  try {
    const keys = await readKeys();
    keys[id] = safeStorage.encryptString(trimmed).toString('base64');
    await atomicWriteJson(credentialsFile(), { version: 2, keys } satisfies CredentialsFile);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Anahtar kaydedilemedi.' };
  }
}

/** Anahtarın okunması yalnızca main süreçte yapılır; asla loglanmaz. */
export async function getApiKey(id: CredentialId): Promise<string> {
  const keys = await readKeys();
  const stored = keys[id];
  if (!stored) return '';
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return '';
  }
}

export async function clearApiKey(id: CredentialId): Promise<void> {
  try {
    const keys = await readKeys();
    delete keys[id];
    if (Object.keys(keys).length === 0) {
      fs.rmSync(credentialsFile(), { force: true });
    } else {
      await atomicWriteJson(credentialsFile(), { version: 2, keys } satisfies CredentialsFile);
    }
  } catch {
    // yok say — temizlik amaçlı
  }
}

/**
 * Eski tek-anahtar formatını (v1: { keyEnc }) yeni formata taşır.
 * Geriye dönük uyumluluk: kullanıcıların önceki DeepSeek anahtarı korunur.
 */
async function readKeys(): Promise<Partial<Record<CredentialId, string>>> {
  try {
    const raw = await fs.promises.readFile(credentialsFile(), 'utf8');
    const data = JSON.parse(raw) as Partial<CredentialsFile> & { keyEnc?: string };
    if (typeof data.keyEnc === 'string') {
      return { deepseek: data.keyEnc };
    }
    return data.keys ?? {};
  } catch {
    return {};
  }
}

/** Atomik yazım: geçici dosyaya yaz + rename (yarım dosya riski yok). */
async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, file);
}
