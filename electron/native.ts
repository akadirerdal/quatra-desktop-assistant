/**
 * Native köprü — Electron main süreç gerçeklemesi (NativeBridge interface).
 * Model çıktısı BURAYA komut olarak gelemez: her fonksiyon kendi güvenlik denetimini yapar.
 */
import { app, clipboard, dialog, shell, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { NativeBridge } from '../src/features/tools/types';
import { appTarget } from '../src/features/tools/app-names';
import { backupBeforeWrite } from './note-backups';

/**
 * macOS: uygulamayı `open -a <ad>` ile açar. Ad yalnızca sabit allowlist'ten gelir
 * (kullanıcı/model çıktısı buraya ham aksetmez); kabuk yok, argüman dizisi güvenli.
 * Başarıda '' döner; hatada hata mesajı.
 */
function openMacApp(appName: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('open', ['-a', appName], (error) => resolve(error ? error.message : ''));
  });
}

export function createNativeBridge(win: BrowserWindow | null): NativeBridge {
  return {
    async sysinfo() {
      return {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        cpuCount: os.cpus().length,
        totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMemMb: Math.round(os.freemem() / 1024 / 1024),
        uptimeSec: Math.round(os.uptime()),
        electron: process.versions.electron,
      };
    },

    async openApp(name: string) {
      const target = appTarget(name, process.platform);
      if (!target) {
        throw new Error(
          process.platform === 'darwin'
            ? `"${name}" macOS'ta açılamıyor — karşılığı tanımlı değil.`
            : `"${name}" için güvenli çalıştırma yolu tanımlı değil.`,
        );
      }
      if (target.type === 'macApp') {
        const err = await openMacApp(target.value);
        if (err) throw new Error(`Uygulama açılamadı: ${err}`);
        return;
      }
      const err = await shell.openPath(target.value);
      if (err) throw new Error(`Uygulama açılamadı: ${err}`);
    },

    async openUrl(url: string) {
      if (!/^https?:\/\//i.test(url)) {
        throw new Error('Yalnızca http/https adresleri açılabilir.');
      }
      await shell.openExternal(url);
    },

    async writeNote(text: string, filename: string, directory: string) {
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ._-]+/g, '_');
      const dir = path.resolve(directory);
      if (!fs.existsSync(dir)) {
        throw new Error('Hedef klasör mevcut değil.');
      }
      const target = path.join(dir, safeName);
      backupBeforeWrite(target); // V1-18: üzerine yazmadan önce mevcut sürümün kopyası alınır
      await fs.promises.writeFile(target, text, 'utf8');
      return { path: target };
    },

    async clipboardWrite(text: string) {
      clipboard.writeText(text);
    },

    async clipboardRead() {
      return clipboard.readText();
    },

    async pickDirectory() {
      const parent = win && !win.isDestroyed() ? win : undefined;
      const result = parent
        ? await dialog.showOpenDialog(parent, { properties: ['openDirectory'] })
        : await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths[0]) return null;
      return result.filePaths[0];
    },

    async folderExists(dir: string) {
      try {
        return fs.statSync(path.resolve(dir)).isDirectory();
      } catch {
        return false;
      }
    },

    async getNotesDirectory() {
      try {
        const file = path.join(app.getPath('userData'), 'notes-dir.txt');
        const dir = (await fs.promises.readFile(file, 'utf8')).trim();
        return dir && fs.existsSync(dir) ? dir : '';
      } catch {
        return '';
      }
    },

    async rememberNotesDirectory(dir: string) {
      try {
        const file = path.join(app.getPath('userData'), 'notes-dir.txt');
        await fs.promises.writeFile(file, path.resolve(dir), 'utf8');
      } catch {
        // hatırlama kritik değil — not yine de yazıldı
      }
    },

    getAppVersion() {
      return app.getVersion();
    },
  };
}
