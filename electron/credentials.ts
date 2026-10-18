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
import { ProviderError } from '../src/providers/types';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('credentials');

export type CredentialId = 'deepseek' | 'groq' | 'mem0';

interface CredentialsFile {
  version: 2;
  keys: Partial<Record<CredentialId, string>>; // base64(encrypted)
}

function credentialsFile(): string {
  return path.join(app.getPath('userData'), 'credentials.json');
}

// V1.2-029: oku-değiştir-yaz işlemleri tek kuyrukta seri çalışır; eşzamanlı
// set/clear çağrıları birbirinin değişikliğini ezemez (anahtar kaybı yok).
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
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
      // V1.2-102: geçici (oturumluk) anahtar yolu YOK — vaat etmeyen net mesaj.
      error: 'Bu sistemde güvenli anahtar kasası yok; anahtar kaydedilemedi.',
    };
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, error: 'Anahtar boş olamaz.' };
  }
  try {
    const encrypted = safeStorage.encryptString(trimmed).toString('base64');
    await enqueueWrite(async () => {
      const keys = await readKeys();
      keys[id] = encrypted;
      await atomicWriteJson(credentialsFile(), { version: 2, keys } satisfies CredentialsFile);
    });
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
  } catch (e) {
    // V1.2-036: anahtar kayıtlı ama çözülemedi — "anahtar ayarlanmamış" ile karışmasın.
    log.error(`'${id}' anahtarı çözülemedi (güvenli kasa erişimi bozulmuş olabilir): ${String(e)}`);
    throw new ProviderError(
      'auth',
      'Kayıtlı API anahtarı çözülemedi; Ayarlar → AI Sağlayıcı bölümünden anahtarı yeniden kaydet.',
    );
  }
}

export async function clearApiKey(id: CredentialId): Promise<void> {
  try {
    await enqueueWrite(async () => {
      const keys = await readKeys();
      delete keys[id];
      if (Object.keys(keys).length === 0) {
        fs.rmSync(credentialsFile(), { force: true });
      } else {
        await atomicWriteJson(credentialsFile(), { version: 2, keys } satisfies CredentialsFile);
      }
    });
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

/** Atomik yazım: benzersiz geçici dosyaya yaz + rename (yarım dosya riski yok). */
let tmpSeq = 0;

async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  // V1.2-029: sabit `.tmp` yerine benzersiz ad — eşzamanlı yazımlar çakışamaz.
  const tmp = `${file}.${process.pid}-${++tmpSeq}.tmp`;
  try {
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.promises.rename(tmp, file);
  } catch (e) {
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
    throw e;
  }
}
