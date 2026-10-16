/**
 * Tepsi (System Tray) — V1-13: pencere kapatılınca uygulama ölmez, tepside yaşar.
 * Menü: göster / mikrofon aç-kapat / ayarlar / çıkış. Tek tık: pencereyi öne getirir.
 * Gizlilik: dinleme durumu kullanıcıda kalır; tepsi kendiliğinden mikrofonu AÇMAZ.
 */
import { BrowserWindow, Menu, Notification, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { appLogger } from '../src/services/log/logger';

const log = appLogger.scoped('tray');

let tray: Tray | null = null;
let hideNotified = false;

export function showMainWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

export function createTray(win: BrowserWindow, quit: () => void): void {
  if (tray) return;
  // Simge: Windows'ta .ico; macOS menü çubuğunda .png (retina için @2x temsili).
  // build/**/* paket listesinde → kurulu sürümde de bulunur.
  const iconDir = path.join(__dirname, '..', 'build');
  const preferred = process.platform === 'darwin' ? 'tray.png' : 'icon.ico';
  let image = nativeImage.createFromPath(path.join(iconDir, preferred));
  if (process.platform === 'darwin' && !image.isEmpty()) {
    const retina = nativeImage.createFromPath(path.join(iconDir, 'tray@2x.png'));
    if (!retina.isEmpty()) image.addRepresentation({ scaleFactor: 2, buffer: retina.toPNG() });
  }
  if (image.isEmpty() && preferred !== 'icon.ico') {
    image = nativeImage.createFromPath(path.join(iconDir, 'icon.ico'));
  }
  if (image.isEmpty()) log.warn(`tepsi simgesi okunamadı: ${path.join(iconDir, preferred)}`);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Quatra — sesli asistan');
  const menu = Menu.buildFromTemplate([
    { label: "Quatra'yı Göster", click: () => showMainWindow(win) },
    {
      label: 'Mikrofonu Aç/Kapat',
      click: () => win.webContents.send('app:command', { name: 'toggle-mic' }),
    },
    {
      label: 'Ayarları Aç',
      click: () => {
        showMainWindow(win);
        win.webContents.send('app:command', { name: 'open-settings' });
      },
    },
    { type: 'separator' },
    { label: 'Çıkış', click: quit },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow(win));
  tray.on('double-click', () => showMainWindow(win));
  log.info('tepsi kuruldu');
}

/** Pencere ilk kez tepsiye inince kullanıcıyı BİR KEZ bilgilendir. */
export function notifyFirstHide(): void {
  if (hideNotified) return;
  hideNotified = true;
  try {
    new Notification({
      title: 'Quatra',
      body: 'Arka planda çalışmaya devam ediyorum — buradan ulaşabilirsin.',
    }).show();
  } catch (e) {
    log.warn(`bildirim gösterilemedi: ${String(e)}`);
  }
}
