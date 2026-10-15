/**
 * check:secrets — repo'da (commit'lenmiş dosyalarda) bilinen API anahtarı
 * desenlerini tarar. CI'da her push'ta koşar. Gitleaks alternatifi olarak.
 */
import { execSync } from 'node:child_process';

const PATTERNS = [
  'sk-[A-Za-z0-9_-]{16,}',
  'gsk_[A-Za-z0-9_-]{16,}',
  'Bearer [A-Za-z0-9._-]{16,}',
  '(api[_-]?key|x-api-key)["\'\\s]*[:=]["\'\\s]*[A-Za-z0-9._-]{16,}',
];

let failed = false;
for (const pattern of PATTERNS) {
  try {
    const out = execSync(
      `git grep -n -I -E "${pattern}" -- . ":(exclude)package-lock.json"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (out.trim()) {
      console.error(`[check:secrets] ŞÜPHELİ SECRET BULUNDU (${pattern}):\n${out}`);
      failed = true;
    }
  } catch {
    // git grep eşleşme yoksa 1 ile çıkar — bu iyidir.
  }
}

if (failed) {
  console.error('[check:secrets] BAŞARISIZ — yukarıdaki satırları temizle veya rotate et.');
  process.exit(1);
}
console.log('[check:secrets] TEMİZ — bilinen anahtar deseni yok.');
