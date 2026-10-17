/**
 * Quatra — Electron main süreç.
 * Güvenlik: contextIsolation açık, nodeIntegration kapalı, CSP header'lı.
 * Çökme koruması: main asla sessizce ölmez; renderer çökerse pencere yenilenir.
 */
import { app, BrowserWindow, session, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { registerIpc } from './ipc';
import { appLogger } from '../src/services/log/logger';
import { appendLogLine, logFilePath } from './log-file';
import { createTray, notifyFirstHide, showMainWindow } from './tray';

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
 * Böylece güncelleme/kurulumda anahtarlar ve ayarlar KORUNUR.
 */
function bootUserDataPath(): void {
  try {
    const appDataDir = app.getPath('appData');
    const stable = path.join(appDataDir, 'Quatra');
    const legacyDirs = ['quatra-desktop-assistant', 'Electron'].map((d) => path.join(appDataDir, d));
    fs.mkdirSync(stable, { recursive: true });
    for (const dir of legacyDirs) {
      for (const file of ['credentials.json', 'settings.json']) {
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
    // İlk açılışta tam ekran (F11 ile çıkılabilir/girilebilir).
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // FAZ 7'de sandbox + CSP sertleştirmesiyle kaldırılacak (TODO 7.2)
      // Tepsiye inince zamanlayıcılar kısılmasın (sesli asistan arka planda çalışır).
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  // Güvenlik ağı: ready-to-show herhangi bir nedenle tetiklenmezse ilk yüklemede yine göster.
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
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
    // E2E doğrulama kancası (yalnız QUATRA_E2E env ile; normal kullanımda çalışmaz).
    if (process.env['QUATRA_E2E'] === 'credentials') {      void mainWindow?.webContents
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

  // Renderer çökerse uygulama yaşar: pencere yeniden yüklenir.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error(`renderer çöktü: ${details.reason}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  const devUrl = process.env['VITE_DEV_SERVER_URL'];
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
    "connect-src 'self' ws://localhost:*",
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

  createWindow();
  if (mainWindow) createTray(mainWindow, quitApp);

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Ana süreç güvenliği: beklenmeyen hatalar loglanır, uygulama kilitli kalmaz.
process.on('uncaughtException', (err) => {
  log.error(`uncaughtException: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${String(reason)}`);
});
