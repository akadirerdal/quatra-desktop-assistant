/**
 * Uygulama adı eşleştirme — Türkçe kullanıcı komutlarını gerçek uygulamalara çevirir.
 * Model çıktısı "not defterini aç" dese bile güvenli eşleşme çalışır.
 * Kabuk komutu yok: yalnızca sabit haritadaki uygulamalar açılabilir.
 */

export interface AppEntry {
  /** İzinli uygulamanın kanonik anahtarı. */
  key: string;
  /** Çalıştırılacak hedef (Windows). */
  exec: string;
  /** Eşleşen takma adlar (küçük harf). */
  aliases: string[];
}

export const KNOWN_APPS: AppEntry[] = [
  { key: 'notepad', exec: 'notepad.exe', aliases: ['not defteri', 'notepad', 'not defterini'] },
  { key: 'calculator', exec: 'calc.exe', aliases: ['hesap makinesi', 'calculator', 'calc'] },
  { key: 'explorer', exec: 'explorer.exe', aliases: ['dosya gezgini', 'gezgin', 'explorer'] },
  { key: 'cmd', exec: 'cmd.exe', aliases: ['komut istemi', 'cmd', 'command prompt'] },
  { key: 'powershell', exec: 'powershell.exe', aliases: ['powershell', 'power shell'] },
  { key: 'mspaint', exec: 'mspaint.exe', aliases: ['paint', 'boya'] },
  { key: 'taskmgr', exec: 'taskmgr.exe', aliases: ['görev yöneticisi', 'task manager', 'taskmgr'] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ');
}

/** Kullanıcı/model girdisini kanonik uygulama anahtarına normalize eder; eşleşmezse null. */
export function normalizeAppName(input: string): string | null {
  const hay = normalize(input);
  if (!hay) return null;
  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      const a = normalize(alias);
      if (hay === a || hay.includes(a) || a.includes(hay)) return app.key;
    }
  }
  return null;
}

/** Kanonik anahtarın çalıştırılabilir hedefi. */
export function appExec(key: string): string | null {
  return KNOWN_APPS.find((a) => a.key === key)?.exec ?? null;
}

/** İzin denetimi için izinli ad listesi (allowlist). */
export function allowedAppNames(): string[] {
  return KNOWN_APPS.flatMap((a) => [a.key, ...a.aliases]);
}
