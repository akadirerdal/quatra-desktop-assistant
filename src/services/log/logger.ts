/**
 * Log servisi — bağımlılıksız, rotasyonlu değil ama Diagnostics ring-buffer'lı.
 * Tüm loglar redact sınırından geçer: secret asla tampona yazılmaz.
 * Elektron main tarafı ileride buraya dosya sink'i ekleyebilir (FAZ 7).
 */
import { redactSecrets } from '../../utils/redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LoggerOptions {
  /** Bu seviyenin altındaki kayıtlar ring-buffer'a ve console'a yazılmaz. */
  minLevel?: LogLevel;
  /** Ring-buffer kapasitesi (Diagnostics ekranı bunu okur). */
  ringSize?: number;
}

export class Logger {
  private readonly minLevel: LogLevel;
  private readonly ringSize: number;
  private readonly ring: LogEntry[] = [];
  private sinks: Array<(entry: LogEntry) => void> = [];

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? 'info';
    this.ringSize = options.ringSize ?? 200;
  }

  /** Ek çıkışlar (dosya vb.). Dönen fonksiyon sink'i kaldırır. */
  addSink(fn: (entry: LogEntry) => void): () => void {
    this.sinks.push(fn);
    return () => {
      this.sinks = this.sinks.filter((s) => s !== fn);
    };
  }

  scoped(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope);
  }

  log(scope: string, level: LogLevel, message: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const safe = redactSecrets(message);
    const entry: LogEntry = { ts: new Date().toISOString(), level, scope, message: safe };
    this.ring.push(entry);
    if (this.ring.length > this.ringSize) this.ring.splice(0, this.ring.length - this.ringSize);
    // Sink'ler (dosya vb.) — biri patlarsa diğerleri devam eder.
    for (const sink of this.sinks) {
      try {
        sink(entry);
      } catch {
        // sink hatası loglamayı bozmaz
      }
    }
    // Console çıktısı da redact'lı metni kullanır.
    const line = `[${entry.ts}] [${level.toUpperCase()}] [${scope}] ${safe}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else if (level === 'info') console.info(line);
    else console.debug(line);
  }

  /** Diagnostics ekranı için son kayıtlar (zaten redact'lı). */
  diagnostics(): LogEntry[] {
    return [...this.ring];
  }

  clear(): void {
    this.ring.length = 0;
  }
}

export class ScopedLogger {
  constructor(
    private readonly logger: Logger,
    private readonly scope: string,
  ) {}

  debug(message: string): void {
    this.logger.log(this.scope, 'debug', message);
  }
  info(message: string): void {
    this.logger.log(this.scope, 'info', message);
  }
  warn(message: string): void {
    this.logger.log(this.scope, 'warn', message);
  }
  error(message: string): void {
    this.logger.log(this.scope, 'error', message);
  }
}

/** Uygulama geneli varsayılan logger (ana süreç/DI ile değiştirilebilir). */
export const appLogger = new Logger({ minLevel: 'debug', ringSize: 200 });
