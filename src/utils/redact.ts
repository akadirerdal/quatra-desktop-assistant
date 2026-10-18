/**
 * Secret redaction — log/diagnostics sınırında API anahtarı sızıntısını önler.
 * Model, web ve dosya içeriği untrusted'dır; loglanmadan önce buradan geçer.
 */

interface SecretPattern {
  /** Eşleşen desen; `$1` ile korunacak ön-ek yakalanabilir. */
  re: RegExp;
  /** Değiştirme şablonu (maskeli). */
  replacement: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // OpenAI/DeepSeek tarzı anahtarlar: sk-... (kelime başı koruması: "risk-balanced" bozulmasın) (V1.2-124)
  { re: /(^|[^\w-])sk-[A-Za-z0-9_-]{8,}/g, replacement: '$1sk-[REDACTED]' },
  // Groq anahtarları: gsk_...
  { re: /gsk_[A-Za-z0-9_-]{8,}/g, replacement: 'gsk_[REDACTED]' },
  // Authorization: Bearer <token>
  { re: /(bearer\s+)[A-Za-z0-9._-]{10,}/gi, replacement: '$1[REDACTED]' },
  // api_key=... / api-key: "..." / x-api-key — base64 değerleri için + / = de kapsanır (V1.2-123)
  {
    re: /(x?api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._+/=-]{8,}/gi,
    replacement: '$1[REDACTED]',
  },
];

/**
 * Metindeki bilinen secret desenlerini maskeler.
 * Bilinmeyen desenler için %100 garanti değildir; birincil savunma secret'ların
 * hiç loglanmamasıdır (bkz. services/credentials).
 */
export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, replacement } of SECRET_PATTERNS) {
    out = out.replace(re, replacement);
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
