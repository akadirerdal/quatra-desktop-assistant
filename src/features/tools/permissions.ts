/**
 * İzin yöneticisi — uygulama katmanında (native) zorunlu tutulur.
 * Model kendi iznini genişletemez. Uygulama allowlist'i TEK kaynaktır: app-names.ts
 * (V1.2-068: buradaki ayrı/ölü DEFAULT_ALLOWED_APPS listesi kaldırıldı).
 */
import type { PermissionLevel } from './types';
import { redactSecrets } from '../../utils/redact';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface PermissionManagerOptions {
  /** sensitive işlemler için onay fonksiyonu (UI'ya bağlanır); args = tool'un ham argümanı. */
  confirm?: (toolName: string, args: unknown) => Promise<boolean>;
  /** Okuma-yazma yapılamayan kilitli mod (ör. güvenli gözlem modu). */
  readOnly?: boolean;
}

/**
 * Onay sorusu için güvenli argüman özeti (V1.2-009): secret maskele + tek satıra indir + kırp.
 * Ham argüman (JSON string ya da nesne) kullanıcıya gösterilebilir kısa metne çevrilir.
 */
export function summarizeArgs(args: unknown, maxLength = 200): string {
  let text = '';
  if (typeof args === 'string') {
    try {
      text = JSON.stringify(JSON.parse(args)) ?? '';
    } catch {
      text = args; // JSON değilse ham metin (yine maskelenir)
    }
  } else if (args !== undefined && args !== null) {
    try {
      text = JSON.stringify(args) ?? '';
    } catch {
      text = '';
    }
  }
  const safe = redactSecrets(text).replace(/\s+/g, ' ').trim();
  return safe.length > maxLength ? `${safe.slice(0, Math.max(0, maxLength - 1))}…` : safe;
}

export class PermissionManager {
  private readonly confirmFn: PermissionManagerOptions['confirm'];
  private readonly readOnly: boolean;

  constructor(options: PermissionManagerOptions = {}) {
    this.confirmFn = options.confirm;
    this.readOnly = options.readOnly ?? false;
  }

  async check(
    toolName: string,
    level: PermissionLevel,
    requiresConfirmation: boolean | undefined,
    args: unknown,
  ): Promise<PermissionCheck> {
    if (this.readOnly && level !== 'safe') {
      return { allowed: false, reason: 'Salt okunur mod etkin — bu işlem engellendi.' };
    }
    if (level === 'safe') return { allowed: true };
    if (requiresConfirmation || level === 'sensitive') {
      if (!this.confirmFn) {
        return { allowed: false, reason: 'Bu işlem için kullanıcı onayı gerekli.' };
      }
      const ok = await this.confirmFn(toolName, args);
      return ok ? { allowed: true } : { allowed: false, reason: 'Kullanıcı izin vermedi.' };
    }
    // low-risk: varsayılan izinli (allowlist uygulayan tool kendi içinde denetler).
    return { allowed: true };
  }
}
