/**
 * Hata taksonomisi — UI'da kısa ve dürüst, Diagnostics'te detaylı gösterim için.
 * Mesajlar kullanıcıya gösterilebilir ve asla secret içermez.
 */

export type QuatraErrorCategory =
  | 'auth' // API anahtarı/izin hatası
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'cancelled' // kullanıcı iptali
  | 'tool' // görev (tool) yürütme hatası
  | 'permission' // izin reddi
  | 'mic' // mikrofon erişimi/donanım
  | 'stt' // konuşma tanıma
  | 'tts' // konuşma sentezi
  | 'storage' // ayar/hafıza saklama
  | 'native' // OS katmanı (IPC vb.)
  | 'unsupported' // desteklenmeyen yetenek (dürüst "çalışmıyor")
  | 'unknown';

export class QuatraError extends Error {
  constructor(
    readonly category: QuatraErrorCategory,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = 'QuatraError';
  }
}

export function quatraError(
  category: QuatraErrorCategory,
  message: string,
  details?: string,
): QuatraError {
  return new QuatraError(category, message, details);
}
