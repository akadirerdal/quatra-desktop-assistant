/**
 * Secret redaction — log/diagnostics sınırında API anahtarı sızıntısını önler.
 * Model, web ve dosya içeriği untrusted'dır; loglanmadan önce buradan geçer.
 */

interface SecretPattern {
  /** Eşleşen desen (yakalama grubu gizli değildir). */
  re: RegExp;
  /** Yerine yazılacak etiket. */
  label: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // OpenAI/DeepSeek tarzı anahtarlar: sk-...
  { re: /sk-[A-Za-z0-9_-]{8,}/g, label: 'sk-[REDACTED]' },
  // Groq anahtarları: gsk_...
  { re: /gsk_[A-Za-z0-9_-]{8,}/g, label: 'gsk_[REDACTED]' },
  // Authorization: Bearer <token>
  { re: /(bearer\s+)[A-Za-z0-9._-]{10,}/gi, label: 'Bearer [REDACTED]' },
  // api_key=... / api-key: "..." / x-api-key
  { re: /(x?api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]{8,}/gi, label: 'api-key=[REDACTED]' },
];

/**
 * Metindeki bilinen secret desenlerini maskeler.
 * Bilinmeyen desenler için %100 garanti değildir; birincil savunma secret'ların
 * hiç loglanmamasıdır (bkz. services/credentials).
 */
export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, label } of SECRET_PATTERNS) {
    out = out.replace(re, (_match, prefix?: string) => (prefix ?? '') + label);
  }
  return out;
}

/** Bir metnin içinde potansiyel secret olup olmadığını döner (test/ön kontrol için). */
export function containsSecrets(input: string): boolean {
  return SECRET_PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(input);
  });
}
