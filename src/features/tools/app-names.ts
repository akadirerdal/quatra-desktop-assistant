/**
 * Uygulama adı eşleştirme — Türkçe kullanıcı komutlarını gerçek uygulamalara çevirir.
 * Model çıktısı "not defterini aç" dese bile güvenli eşleşme çalışır.
 * Kabuk komutu yok: yalnızca sabit haritadaki uygulamalar açılabilir.
 * Her girdi iki platformu birden tanımlar: Windows hedefi (.exe) + macOS uygulama adı.
 */

export interface AppEntry {
  /** İzinli uygulamanın kanonik anahtarı. */
  key: string;
  /** Windows çalıştırılabilir hedefi (.exe). */
  win: string;
  /** macOS uygulama adı (`open -a` ile açılır); '' = macOS'ta karşılığı yok. */
  mac: string;
  /** Eşleşen takma adlar (küçük harf). Diğer platformun adları da dahil: textedit, finder… */
  aliases: string[];
}

export const KNOWN_APPS: AppEntry[] = [
  {
    key: 'notepad',
    win: 'notepad.exe',
    mac: 'TextEdit',
    aliases: ['not defteri', 'not defterini', 'notepad', 'textedit'],
  },
  {
    key: 'calculator',
    win: 'calc.exe',
    mac: 'Calculator',
    aliases: ['hesap makinesi', 'calculator', 'calc'],
  },
  {
    key: 'explorer',
    win: 'explorer.exe',
    mac: 'Finder',
    aliases: ['dosya gezgini', 'gezgin', 'explorer', 'finder'],
  },
  {
    key: 'cmd',
    win: 'cmd.exe',
    mac: 'Terminal',
    aliases: ['komut istemi', 'cmd', 'command prompt', 'terminal'],
  },
  {
    key: 'powershell',
    win: 'powershell.exe',
    mac: 'Terminal',
    aliases: ['powershell', 'power shell'],
  },
  {
    key: 'mspaint',
    win: 'mspaint.exe',
    mac: '', // macOS'ta Paint'in karşılığı yok — dürüst hata döner, uydurma açma yok.
    aliases: ['paint', 'boya'],
  },
  {
    key: 'taskmgr',
    win: 'taskmgr.exe',
    mac: 'Activity Monitor',
    aliases: ['görev yöneticisi', 'task manager', 'taskmgr', 'etkinlik izleyicisi', 'activity monitor'],
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    // Unicode ayrıştırma + birleşen işaret temizliği: ç→c, ğ→g, ö→o, ü→u, İ→i
    // (İ küçültünce "i + birleşen nokta" olur; temizlenmezse eşleşme kırılırdı.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Noktasız ı ayrışmaz — ayrıca eşlenir.
    .replace(/ı/g, 'i')
    .trim()
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

/** Platforma göre çalıştırma hedefi. */
export interface AppTarget {
  /** exe: Windows çalıştırılabilir yolu · macApp: `open -a` uygulama adı. */
  type: 'exe' | 'macApp';
  value: string;
}

/** Kanonik anahtarın platform hedefi; anahtar yoksa ya da o platformda karşılığı yoksa null. */
export function appTarget(key: string, platform: string): AppTarget | null {
  const app = KNOWN_APPS.find((a) => a.key === key);
  if (!app) return null;
  if (platform === 'darwin') {
    return app.mac ? { type: 'macApp', value: app.mac } : null;
  }
  return app.win ? { type: 'exe', value: app.win } : null;
}

/** İzin denetimi için izinli ad listesi (allowlist). */
export function allowedAppNames(): string[] {
  return KNOWN_APPS.flatMap((a) => [a.key, ...a.aliases]);
}
