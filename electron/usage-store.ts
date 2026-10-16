/**
 * Token kullanım sayaçları (V1-19) — aylık + toplam; yalnız yerel (userData/token-usage.json).
 * Sağlayıcı usage bildirmediyse hiçbir şey kaydedilmez (uydurma sayı yok).
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('usage');

export interface UsageBucket {
  prompt: number;
  completion: number;
  requests: number;
}

export interface UsageSummary {
  month: string;
  monthUsage: UsageBucket;
  total: UsageBucket;
}

interface UsageFile {
  total: UsageBucket;
  months: Record<string, UsageBucket>;
}

const empty = (): UsageBucket => ({ prompt: 0, completion: 0, requests: 0 });

function usageFile(): string {
  return path.join(app.getPath('userData'), 'token-usage.json');
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function read(): UsageFile {
  try {
    const raw = JSON.parse(fs.readFileSync(usageFile(), 'utf8')) as UsageFile;
    if (raw && raw.total && raw.months) return raw;
  } catch {
    // dosya yok/bozuk → sıfırdan başla
  }
  return { total: empty(), months: {} };
}

export function recordUsage(promptTokens: number, completionTokens: number): void {
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return;
  try {
    const data = read();
    const m = monthKey();
    const mb = data.months[m] ?? empty();
    mb.prompt += promptTokens;
    mb.completion += completionTokens;
    mb.requests += 1;
    data.months[m] = mb;
    data.total.prompt += promptTokens;
    data.total.completion += completionTokens;
    data.total.requests += 1;
    fs.writeFileSync(usageFile(), JSON.stringify(data), 'utf8');
  } catch (e) {
    log.warn(`kullanım kaydedilemedi: ${String(e)}`);
  }
}

export function getUsage(): UsageSummary {
  const data = read();
  const m = monthKey();
  return { month: m, monthUsage: data.months[m] ?? empty(), total: data.total };
}
