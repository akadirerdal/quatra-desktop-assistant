export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug: (message, meta) => console.debug(prefix, message, meta ?? ''),
    info: (message, meta) => console.info(prefix, message, meta ?? ''),
    warn: (message, meta) => console.warn(prefix, message, meta ?? ''),
    error: (message, meta) => console.error(prefix, message, meta ?? ''),
  };
}
