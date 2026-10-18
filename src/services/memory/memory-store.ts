/**
 * Hafıza deposu — saf (Electron'suz), atomik yazımlı, test edilebilir.
 * Kayıtlar YALNIZCA yerel dosyadadır; sadece ilgili bağlam model prompt'una eklenir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isGarbageEntry, isNearDuplicate } from './extraction';

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: string;
  source: 'user' | 'assistant';
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `m-${Date.now()}-${seq}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Aynı dosyaya yazan tüm store örnekleri arasında paylaşılan yazma kuyruğu.
 * Her IPC çağrısı yeni bir MemoryStore açabildiği için kilit modül düzeyindedir (V1.2-012).
 */
const writeQueues = new Map<string, Promise<void>>();

function withFileLock<T>(file: string, task: () => Promise<T>): Promise<T> {
  const key = path.resolve(file);
  const prev = writeQueues.get(key) ?? Promise.resolve();
  // Önceki yazma hata verse de kuyruk devam eder (task, reject durumunda da çalışır).
  const run = prev.then(task, task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  writeQueues.set(key, tail);
  void tail.then(() => {
    if (writeQueues.get(key) === tail) writeQueues.delete(key);
  });
  return run;
}

export class MemoryStore {
  constructor(
    private readonly file: string,
    private readonly maxEntries = 200,
  ) {}

  async load(): Promise<MemoryEntry[]> {
    try {
      const raw = await fs.promises.readFile(this.file, 'utf8');
      const data = JSON.parse(raw) as { entries?: MemoryEntry[] };
      if (!Array.isArray(data.entries)) return [];
      return data.entries.filter((e) => typeof e.text === 'string' && e.text.trim());
    } catch {
      return [];
    }
  }

  async add(text: string, source: MemoryEntry['source']): Promise<MemoryEntry> {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) throw new Error('Boş hafıza kaydı.');
    // load→değiştir→save kilitsiz kalırsa eşzamanlı eklemelerden biri kaybolur (V1.2-012).
    return withFileLock(this.file, async () => {
      const entries = await this.load();
      const existing = entries.find((e) => e.text === trimmed || isNearDuplicate(e.text, trimmed));
      if (existing) {
        // Aynı/çok benzer kayıt zaten var — sessizce geri dön.
        return existing;
      }
      const entry: MemoryEntry = {
        id: newId(),
        text: trimmed,
        createdAt: new Date().toISOString(),
        source,
      };
      entries.push(entry);
      if (entries.length > this.maxEntries) entries.splice(0, entries.length - this.maxEntries);
      await this.save(entries);
      return entry;
    });
  }

  async remove(id: string): Promise<void> {
    await withFileLock(this.file, async () => {
      const entries = await this.load();
      const next = entries.filter((e) => e.id !== id);
      if (next.length === entries.length) return; // kayıt zaten yok — dosyaya dokunma
      await this.backup();
      await this.save(next);
    });
  }

  async clear(): Promise<void> {
    await withFileLock(this.file, async () => {
      const entries = await this.load();
      if (entries.length === 0) return;
      await this.backup();
      await this.save([]);
    });
  }

  /** Sorguyla ilgili kayıtları (basit anahtar kelime skorlaması) döner. */
  async search(query: string, limit = 6): Promise<MemoryEntry[]> {
    const entries = await this.load();
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (tokens.length === 0) return entries.slice(-limit).reverse();
    const scored = entries
      .map((e) => {
        const hay = e.text.toLowerCase();
        const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.e);
  }

  /** Prompt'a eklenecek bağlam bloğu (karakter sınırlı). */
  async contextBlock(query: string, maxChars = 1200): Promise<string> {
    const relevant = await this.search(query, 8);
    if (relevant.length === 0) return '';
    let block = 'Kullanıcı hakkında hatırlananlar:\n';
    for (const e of relevant) {
      const line = `- ${e.text}\n`;
      // Sınır eklemeden ÖNCE kontrol edilir; blok maxChars'ı aşmaz (V1.2-121).
      if (block.length + line.length > maxChars) break;
      block += line;
    }
    return block;
  }

  /** Silme öncesi dosyanın son halini yedekler — yanlışlıkla silinen kayıt geri alınabilsin. */
  private async backup(): Promise<void> {
    try {
      if (fs.existsSync(this.file)) {
        await fs.promises.copyFile(this.file, `${this.file}.bak`);
      }
    } catch {
      // yedek alınamazsa silme yine de sürer
    }
  }

  private async save(entries: MemoryEntry[]): Promise<void> {
    // Benzersiz tmp adı: aynı dosyaya eşzamanlı yazan süreçler birbirini ezmesin (V1.2-012).
    const tmp = `${this.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify({ version: 1, entries }, null, 2), 'utf8');
    await fs.promises.rename(tmp, this.file);
  }

  /** Çöp kayıtları temizler ("Kullanıcının adı: ne" gibi eski bug kalıntıları). */
  async cleanupGarbage(): Promise<number> {
    return withFileLock(this.file, async () => {
      const entries = await this.load();
      const clean = entries.filter((e) => !isGarbageEntry(e.text));
      if (clean.length !== entries.length) {
        await this.backup(); // remove/clear ile aynı yedek politikası (V1.2-122)
        await this.save(clean);
      }
      return entries.length - clean.length;
    });
  }
}
