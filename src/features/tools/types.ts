/**
 * Tool (görev) sistemi tipleri — agent'ın yürütebileceği gerçek işler.
 * Model yalnızca isim + argüman önerebilir; uygulama çalıştırıp çalıştırmayacağına karar verir.
 */
import type { z } from 'zod';

export type PermissionLevel = 'safe' | 'low-risk' | 'sensitive';

/** Native katman köprüsü — Electron main'de gerçeklenir; testlerde mock'lanır. */
export interface NativeBridge {
  sysinfo(): Promise<Record<string, unknown>>;
  openApp(name: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  writeNote(text: string, filename: string, directory: string): Promise<{ path: string }>;
  clipboardWrite(text: string): Promise<void>;
  clipboardRead(): Promise<string>;
  pickDirectory(): Promise<string | null>;
  getAppVersion(): string;
}

export interface ToolContext {
  native: NativeBridge;
  signal?: AbortSignal;
}

export interface ToolDef<TArgs = Record<string, unknown>> {
  /** Kararlı, makine-okunur ad. Model bunu kullanır. */
  name: string;
  description: string;
  /** Argüman şeması — model çıktısı buradan doğrulanır (injection koruması). */
  schema: z.ZodType<TArgs>;
  /** Provider'a gönderilen JSON Schema (modelin argüman üretmesi için). */
  parameters: Record<string, unknown>;
  permission: PermissionLevel;
  /** sensitive işlemler için ek onay gerektirir. */
  requiresConfirmation?: boolean;
  run(args: TArgs, ctx: ToolContext): Promise<unknown> | unknown;
}

export interface ToolResult {
  tool: string;
  ok: boolean;
  /** Yapılandırılmış, serileştirilebilir sonuç. */
  result?: unknown;
  /** Kullanıcıya ve modele güvenle gösterilebilir hata mesajı. */
  error?: string;
}

export function okResult(tool: string, result?: unknown): ToolResult {
  return { tool, ok: true, result };
}

export function errorResult(tool: string, error: string): ToolResult {
  return { tool, ok: false, error };
}
