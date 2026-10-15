/**
 * Tool registry — tip güvenli görev kaydı.
 * Her tool: kararlı ad, açıklama, zod şeması, izin seviyesi, handler.
 * Bir tool patlarsa loop ölmez; hata structured ToolResult olarak modele döner.
 */
import type { ToolContext, ToolDef, ToolResult } from './types';
import { errorResult, okResult } from './types';
import { redactSecrets } from '../../utils/redact';

export interface ToolTimeoutOptions {
  /** Tool başına azami süre (ms). Aşan tool hata döner, loop devam eder. */
  timeoutMs?: number;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();
  private readonly timeoutMs: number;

  constructor(options: ToolTimeoutOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  register(tool: ToolDef): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool zaten kayıtlı: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Array<Pick<ToolDef, 'name' | 'description' | 'permission' | 'requiresConfirmation'>> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      permission: t.permission,
      requiresConfirmation: t.requiresConfirmation,
    }));
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  /** OpenAI uyumlu tool tanımları (modele gönderilen). */
  toProviderDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return [...this.tools.values()].map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * Tool'u doğrular ve yürütür. Asla throw etmez; her durumda ToolResult döner.
   * - Bilinmeyen tool → hata sonucu
   * - Bozuk argüman → hata sonucu (model düzeltebilir)
   * - Handler hatası/zaman aşımı → hata sonucu (loop ölmez)
   */
  async execute(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return errorResult(name, 'Bilinmeyen görev adı.');

    let args: unknown;
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return errorResult(name, 'Argümanlar geçersiz JSON değil.');
    }

    const parsed = tool.schema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return errorResult(name, `Argüman doğrulaması başarısız: ${issues}`);
    }

    try {
      const result = await this.withTimeout(() => tool.run(parsed.data as never, ctx), ctx.signal);
      return okResult(name, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Görev başarısız oldu.';
      return errorResult(name, redactSecrets(msg));
    }
  }

  private async withTimeout<T>(fn: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Görev zaman aşımına uğradı (${this.timeoutMs}ms).`)), this.timeoutMs);
    });
    const onAbort = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('Görev iptal edildi.')), { once: true });
    });
    try {
      return await Promise.race([Promise.resolve().then(fn), timeout, onAbort]);
    } finally {
      clearTimeout(timer);
    }
  }
}
