/**
 * Quatra — Electron main süreç.
 * Güvenlik: contextIsolation açık, nodeIntegration kapalı, CSP header'lı.
 * Çökme koruması: main asla sessizce ölmez; renderer çökerse pencere yenilenir.
 */
import { app, BrowserWindow, dialog, session, Menu, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { disposeGlobals, registerIpc } from './ipc';
import { appLogger } from '../src/services/log/logger';
import { appendLogLine, logFilePath } from './log-file';
import { createTray, notifyFirstHide, showMainWindow } from './tray';
import { disposeTts } from './tts-service';

// Chromium mikrofon yakalarken sistem mikrofon sesini otomatik ayarlamasın.
// (wake-word dinlemesi açıkken seviyenin kendi kendine 45 → 80+ çıkmasının nedeni buydu)
app.commandLine.appendSwitch('disable-features', 'WebRtcAllowInputVolumeAdjustment');

// esbuild main'i CJS olarak üretir; __dirname doğrudan kullanılabilir.
const log = appLogger.scoped('main');

// Kalıcı günlük dosyası: tüm loglar redact'lı olarak dosyaya da yazılır.
appLogger.addSink((entry) => {
  appendLogLine(`[${entry.ts}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`);
});

/**
 * Kalıcı veri yolu — sürümden/güncellemeden bağımsız SABİT konum (%APPDATA%\Quatra).
 * Eski konumlardan (quatra-desktop-assistant / Electron) bir kez göç ettirir.
 * Böylece güncelleme/kurulumda anahtarlar, ayarlar ve hafıza KORUNUR.
 */
// V1.2-037: göç yalnız anahtarlarla sınırlı değil — tüm kullanıcı verisi taşınır.
const DATA_FILES = [
  'credentials.json',
  'settings.json',
  'memory.json',
  'token-usage.json',
  'audit.jsonl',
  'transcripts.jsonl',
  'note-backups.json',
  'notes-dir.txt',
];

function bootUserDataPath(): void {
  try {
    const appDataDir = app.getPath('appData');
    // V1.2-083: E2E kancaları gerçek profili ASLA kirletmesin — ayrı test profili kullanılır
    // (kancalar anahtar yazar/siler; bu yüzden göç de yapılmaz, gerçek veriye dokunulmaz).
    if (String(process.env['QUATRA_E2E'] ?? '').trim()) {
      const testDir = path.join(appDataDir, 'Quatra-e2e');
      fs.mkdirSync(testDir, { recursive: true });
      app.setPath('userData', testDir);
      log.info(`QUATRA_E2E aktif — ayrı test profili: ${testDir}`);
      return;
    }
    const stable = path.join(appDataDir, 'Quatra');
    const legacyDirs = ['quatra-desktop-assistant', 'Electron'].map((d) =>
      path.join(appDataDir, d),
    );
    fs.mkdirSync(stable, { recursive: true });
    for (const dir of legacyDirs) {
      for (const file of DATA_FILES) {
        try {
          const src = path.join(dir, file);
          const dst = path.join(stable, file);
          if (fs.existsSync(src) && !fs.existsSync(dst)) {
            fs.copyFileSync(src, dst);
            log.info(`veri göçü: ${file} → ${stable}`);
          }
        } catch {
          // dosya bazlı yok say
        }
      }
    }
    app.setPath('userData', stable);
  } catch {
    // yok say — varsayılan yol kullanılır
  }
}
bootUserDataPath();

let mainWindow: BrowserWindow | null = null;
// V1-13: X ile kapanma tepsiye iner; gerçek çıkış tepsi menüsünden veya uygulama kapanışından.
let isQuitting = false;
/** V1.2-043: art arda bu kadar çökmeden sonra otomatik yeniden yükleme durur. */
const MAX_RENDERER_RELOADS = 3;

function quitApp(): void {
  isQuitting = true;
  app.quit();
}

/**
 * Uygulama menüsü — platforma göre.
 * Windows/Linux: varsayılan menü kaldırılır (üst panel özel çubuktur).
 * macOS: sistem menü çubuğu ŞARTTIR — kopyala/yapıştır (⌘C/⌘V), ⌘Q ve tam ekran (⌃⌘F)
 * yalnız rol tabanlı menüyle çalışır; menüsüz uygulamada bu kısayollar ölür.
 */
function setupApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
}

function createWindow(): void {
  setupApplicationMenu();

  const devUrl = process.env['VITE_DEV_SERVER_URL'];
  // İzinli tek adres: dev sunucusu ya da paketlenmiş index.html — navigasyon kilidi buna bakar.
  const appUrlPrefix = devUrl
    ? `${devUrl.replace(/\/+$/, '')}/`
    : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
  // V1.2-043: art arda çöken renderer sonsuz yeniden yükleme döngüsüne girmesin.
  let rendererReloads = 0;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#08090D',
    show: false,
    // Pencere çerçevesi: Windows/Linux'ta tamamen çerçevesiz (kontroller TitleBar'da);
    // macOS'ta yerel trafik ışıkları korunur (hiddenInset) — Mac kullanıcısı kırmızı/sarı/
    // yeşil düğmeleri bekler; onları taklit etmek yanıltıcı olurdu.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 11 } }
      : { frame: false }),
    // V1.2-105: tam ekran YALNIZ Windows'ta; macOS'ta menü çubuğu/Dock gizlenmesin (⌃⌘F ile açılabilir).
    fullscreen: process.platform === 'win32',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // V1.2-104: sandbox açık — preload yalnızca `electron` (contextBridge/ipcRenderer) ve
      // `process.platform` kullanır; ikisi de sandbox'lı preload'da desteklenir. Denenmemiş
      // bir kombinasyon değil: `npm run dev:electron` ile doğrulandı (bkz. V1.2 raporu).
      sandbox: true,
      // Tepsiye inince zamanlayıcılar kısılmasın (sesli asistan arka planda çalışır).
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  // Güvenlik ağı: ready-to-show herhangi bir nedenle tetiklenmezse ilk yüklemede yine göster.
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  });

  // V1.2-008: pencere YALNIZ kendi sayfasında kalır. Sürüklenen bağlantı/dosya ya da bir
  // window.open ile harici sayfa yüklenirse preload o sayfaya da enjekte olur ve
  // window.quatra (agent/memory/settings/credentials) açığa çıkardı.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    log.warn(`yeni pencere engellendi: ${url}`);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    // Dev'de Vite tam yeniden yüklemesi (HMR) aynı adrese gider — izinli.
    if (url === appUrlPrefix || url.startsWith(appUrlPrefix)) return;
    e.preventDefault();
    log.warn(`navigasyon engellendi: ${url}`);
    // Dış bağlantı isteği kullanıcıyı kaybetmesin: sistem tarayıcısında aç.
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });

  // F11: tam ekran aç/kapat.
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Renderer hatalarını ve yüklenme durumunu logla (boş ekran teşhisi).
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error(`sayfa yüklenemedi: ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) log.warn(`renderer: ${message}`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    log.info('renderer yüklendi');
    rendererReloads = 0; // V1.2-043: çökme sayacı başarılı yüklemede sıfırlanır
    // E2E doğrulama kancası (yalnız QUATRA_E2E env ile; normal kullanımda çalışmaz ve
    // V1.2-083 gereği ayrı test profilinde koşar — gerçek anahtarlar ezilmez/silinmez).
    if (process.env['QUATRA_E2E'] === 'credentials') {
      void mainWindow?.webContents
        .executeJavaScript(
          `(async () => {
            const setRes = await window.quatra.credentials.set('deepseek', 'e2e-test-key-123');
            const hasAfterSet = await window.quatra.credentials.has('deepseek');
            const groqRes = await window.quatra.credentials.set('groq', 'e2e-groq-456');
            const groqHas = await window.quatra.credentials.has('groq');
            const avail = await window.quatra.credentials.available();
            await window.quatra.credentials.clear('deepseek');
            await window.quatra.credentials.clear('groq');
            const hasAfterClear = await window.quatra.credentials.has('deepseek');
            return JSON.stringify({ setRes, hasAfterSet, groqRes, groqHas, avail, hasAfterClear });
          })()`,
        )
        .then((result) => {
          log.info(`E2E credentials → ${String(result)}`);
          setTimeout(() => app.quit(), 300);
        })
        .catch((e) => {
          log.error(`E2E credentials HATA: ${String(e)}`);
          setTimeout(() => app.quit(), 300);
        });
    }
    if (process.env['QUATRA_E2E'] === 'tts') {
      void mainWindow?.webContents
        .executeJavaScript(
          `(async () => {
            const res = await window.quatra.tts.synthesize('Merhaba, ben Quatra. Test.', '', 1.0, 1.0);
            return JSON.stringify({ ok: res.ok, bytes: res.audio ? res.audio.byteLength : 0, message: res.message ?? null });
          })()`,
        )
        .then((result) => {
          log.info(`E2E tts → ${String(result)}`);
          setTimeout(() => app.quit(), 300);
        })
        .catch((e) => {
          log.error(`E2E tts HATA: ${String(e)}`);
          setTimeout(() => app.quit(), 300);
        });
    }
  });

  // Renderer çökerse uygulama yaşar: pencere ART ARDA çökmedikçe yeniden yüklenir (V1.2-043).
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error(`renderer çöktü: ${details.reason}`);
    if (isQuitting || details.reason === 'clean-exit') return;
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    rendererReloads += 1;
    if (rendererReloads > MAX_RENDERER_RELOADS) {
      log.error(
        `${MAX_RENDERER_RELOADS} ardışık çökme — otomatik yeniden yükleme durduruldu (sonsuz döngü koruması)`,
      );
      return;
    }
    const delayMs = 500 * 2 ** (rendererReloads - 1); // 500 ms → 1 s → 2 s
    log.warn(
      `yeniden yükleme planlandı: ${delayMs} ms (deneme ${rendererReloads}/${MAX_RENDERER_RELOADS})`,
    );
    setTimeout(() => {
      if (!win.isDestroyed()) win.reload();
    }, delayMs);
  });

  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // V1-13: X = tepsiye in; uygulama yaşar, gerçek çıkış tepsi menüsünden.
  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow?.hide();
    notifyFirstHide();
    log.info('pencere tepsiye indi — uygulama yaşamaya devam ediyor');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerIpc(mainWindow);
}

// CSP: yalnızca kendi kaynaklarımız; harici ağ yok (renderer'da).
// Dev modda Vite'ın inline preamble/HMR script'leri için 'unsafe-inline' şart; üretimde katı kalır.
void app.whenReady().then(() => {
  log.info(`Quatra başladı — v${app.getVersion()} · ${process.platform} · log: ${logFilePath()}`);
  const isDev = Boolean(process.env['VITE_DEV_SERVER_URL']);
  const csp = [
    "default-src 'self'",
    isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self' ws://localhost:* https://www.google.com https://*.google.com",
    "media-src 'self' blob:",
    "font-src 'self' data:",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // V1.2: Web Speech API (uyandırma) + mikrofon izni.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const ok = [
      'media',
      'audioCapture',
      'microphone',
      'speechRecognition',
      'notifications',
    ].includes(permission);
    callback(ok);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'audioCapture', 'microphone', 'speechRecognition', 'notifications'].includes(
      permission,
    );
  });

  createWindow();
  if (mainWindow) createTray(mainWindow, quitApp);

  // V1.2-004: otomatik güncelleme (yalnız paketlenmiş sürümde; dev'de kapalı).
  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => log.info(`güncelleme mevcut: ${info.version}`));
    autoUpdater.on('update-downloaded', async (info) => {
      log.info(`güncelleme indirildi: ${info.version}`);
      try {
        const opts = {
          type: 'info' as const,
          title: 'Güncelleme hazır',
          message: `Quatra ${info.version} indirildi.`,
          detail: 'Yeniden başlatınca kurulacak. Şimdi yeniden başlatılsın mı?',
          buttons: ['Şimdi yeniden başlat', 'Sonra'],
          defaultId: 0,
        };
        const res = mainWindow
          ? await dialog.showMessageBox(mainWindow, opts)
          : await dialog.showMessageBox(opts);
        if (res.response === 0) autoUpdater.quitAndInstall();
      } catch (e) {
        log.warn(`güncelleme diyaloğu gösterilemedi: ${String(e)}`);
      }
    });
    autoUpdater.on('error', (e) => log.warn(`güncelleme hatası: ${String(e)}`));
    void autoUpdater
      .checkForUpdatesAndNotify()
      .catch((e) => log.warn(`güncelleme kontrolü başarısız: ${String(e)}`));
  }

  app.on('activate', () => {
    // macOS: Dock simgesine tıklanınca pencere yoksa kur, gizliyse öne getir.
    // (Tepsiye inen pencere show() olmadan Dock tıklamasıyla açılmıyordu.)
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) showMainWindow(mainWindow);
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

// V1.2-098: kapanışta global kısayollar ve TTS istemcisi bırakılır (dispose'lar artık gerçekten çağrılıyor).
app.on('will-quit', () => {
  disposeGlobals();
  disposeTts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Ana süreç güvenliği: beklenmeyen hatalar loglanır, uygulama kilitli kalmaz.
// V1.2-103: yalnız mesaj değil, yığın izi (stack) da günlüğe girer.
process.on('uncaughtException', (err) => {
  log.error(`uncaughtException: ${err.stack ?? err.message}`);
});
process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  log.error(`unhandledRejection: ${detail}`);
});
