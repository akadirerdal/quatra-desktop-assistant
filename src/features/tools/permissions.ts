/**
 * İzin yöneticisi — uygulama katmanında (native) zorunlu tutulur.
 * Model kendi iznini genişletemez; allowlist dışı işlem reddedilir.
 */
import type { PermissionLevel } from './types';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface PermissionManagerOptions {
  /** open-app için izinli uygulama adları (küçük harf, eşleşme gevşek). */
  allowedApps?: string[];
  /** sensitive işlemler için onay fonksiyonu (UI'ya bağlanır). */
  confirm?: (toolName: string, args: unknown) => Promise<boolean>;
  /** Okuma-yazma yapılamayan kilitli mod (ör. güvenli gözlem modu). */
  readOnly?: boolean;
}

const DEFAULT_ALLOWED_APPS = [
  'notepad',
  'calculator',
  'explorer',
  'cmd',
  'powershell',
  'terminal',
  'finder',
  'textedit',
  'calculator.app',
];

export class PermissionManager {
  private readonly allowedApps: Set<string>;
  private readonly confirmFn: PermissionManagerOptions['confirm'];
  private readonly readOnly: boolean;

  constructor(options: PermissionManagerOptions = {}) {
    this.allowedApps = new Set(
      (options.allowedApps ?? DEFAULT_ALLOWED_APPS).map((a) => a.toLowerCase()),
    );
    this.confirmFn = options.confirm;
    this.readOnly = options.readOnly ?? false;
  }

  isAppAllowed(name: string): boolean {
    const n = name.toLowerCase();
    return [...this.allowedApps].some((a) => n === a || n.includes(a) || a.includes(n));
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
