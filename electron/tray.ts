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

export function showMainWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

/**
 * V1.2-032: menü, kurulduğu andaki pencereye bağlı kalmamalı.
 * Saklanan pencere yok edilmişse (pencere yeniden oluşturulduysa) canlı pencereyi çöz.
 */
function liveWindow(fallback: BrowserWindow | null): BrowserWindow | null {
  if (fallback && !fallback.isDestroyed()) return fallback;
  const alive = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  return alive[0] ?? null;
}

/** Komutu güncel pencereye gönder; pencere yoksa sessizce atla (çökme yok). */
function sendCommand(win: BrowserWindow | null, name: string): void {
  const target = liveWindow(win);
  if (!target) return;
  try {
    target.webContents.send('app:command', { name });
  } catch {
    // webContents yok edilmiş olabilir — sessizce atla.
  }
}

export function createTray(win: BrowserWindow, quit: () => void): void {
  if (tray) return;
  // Simge: Windows'ta .ico; macOS menü çubuğunda ŞABLON (template) PNG — yalnızca
  // alfa kanalı biçimi belirler, sistem açık/koyu menü çubuğuna göre kendisi boyar.
  // Şablon yoksa renkli tray.png'ye, o da yoksa icon.ico'ya düşülür.
  // build/**/* paket listesinde → kurulu sürümde de bulunur.
  const iconDir = path.join(__dirname, '..', 'build');
  const isMac = process.platform === 'darwin';

  let image = nativeImage.createFromPath(
    path.join(iconDir, isMac ? 'trayTemplate.png' : 'icon.ico'),
  );
  if (isMac && !image.isEmpty()) {
    const retina = nativeImage.createFromPath(path.join(iconDir, 'trayTemplate@2x.png'));
    if (!retina.isEmpty()) image.addRepresentation({ scaleFactor: 2, buffer: retina.toPNG() });
    image.setTemplateImage(true);
  }
  if (isMac && image.isEmpty()) {
    image = nativeImage.createFromPath(path.join(iconDir, 'tray.png'));
    if (!image.isEmpty()) {
      const retina = nativeImage.createFromPath(path.join(iconDir, 'tray@2x.png'));
      if (!retina.isEmpty()) image.addRepresentation({ scaleFactor: 2, buffer: retina.toPNG() });
    }
  }
  if (image.isEmpty()) {
    image = nativeImage.createFromPath(path.join(iconDir, 'icon.ico'));
  }
  if (image.isEmpty()) log.warn(`tepsi simgesi okunamadı: ${iconDir}`);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Quatra — sesli asistan');
  const menu = Menu.buildFromTemplate([
    { label: "Quatra'yı Göster", click: () => showMainWindow(liveWindow(win)) },
    {
      label: 'Mikrofonu Aç/Kapat',
      click: () => sendCommand(win, 'toggle-mic'),
    },
    {
      label: 'Ayarları Aç',
      click: () => {
        showMainWindow(liveWindow(win));
        sendCommand(win, 'open-settings');
      },
    },
    { type: 'separator' },
    { label: 'Çıkış', click: quit },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow(liveWindow(win)));
  tray.on('double-click', () => showMainWindow(liveWindow(win)));
  log.info('tepsi kuruldu');
}

/** Test izolasyonu için modül düzeyi tepsi durumunu sıfırla (yalnız testlerde). */
export function __resetTrayForTests(): void {
  tray = null;
  hideNotified = false;
}
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
