/**
 * Saf (Electron'suz) dosya ekleme + basit rotasyon yardımcısı — test edilebilir.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Dosyaya satır ekler; boyut sınırı aşılırsa .1 yedeğine döndürür. */
export function appendWithRotation(file: string, line: string, maxBytes = 1_000_000): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      const st = fs.statSync(file);
      if (st.size > maxBytes) {
        fs.renameSync(file, `${file}.1`);
      }
    } catch {
      // dosya yok — sorun değil
    }
    fs.appendFileSync(file, `${line}\n`, 'utf8');
  } catch {
    // yazamıyorsak sessiz kal — loglamanın kendisi uygulamayı bozmamalı
  }
}
