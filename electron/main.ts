/**
 * Quatra — Electron main süreç.
 * Güvenlik: contextIsolation açık, nodeIntegration kapalı, CSP header'lı.
 * Çökme koruması: main asla sessizce ölmez; renderer çökerse pencere yenilenir.
 */
import { app, BrowserWindow, session, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc';
import { appLogger } from '../src/services/log/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = appLogger.scoped('main');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Varsayılan menü (File/Edit/View…) kaldırılır — üst panel özel çubuktur.
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#08090D',
    show: false,
    // Özel başlık çubuğu: çerçevesiz pencere; kontroller renderer'daki TitleBar'da.
    frame: false,
    // İlk açılışta tam ekran (F11 ile çıkılabilir/girilebilir).
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // FAZ 7'de sandbox + CSP sertleştirmesiyle kaldırılacak (TODO 7.2)
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerIpc(mainWindow);
}

// CSP: yalnızca kendi kaynaklarımız; harici ağ yok (renderer'da).
void app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*; media-src 'self' blob:; font-src 'self' data:",
        ],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
