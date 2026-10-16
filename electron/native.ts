/**
 * Native köprü — Electron main süreç gerçeklemesi (NativeBridge interface).
 * Model çıktısı BURAYA komut olarak gelemez: her fonksiyon kendi güvenlik denetimini yapar.
 */
import { app, clipboard, dialog, shell, BrowserWindow } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { NativeBridge } from '../src/features/tools/types';
import { appExec } from '../src/features/tools/app-names';

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
      const exe = appExec(name);
      if (!exe) {
        throw new Error(`"${name}" için güvenli çalıştırma yolu tanımlı değil.`);
      }
      const err = await shell.openPath(exe);
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

    getAppVersion() {
      return app.getVersion();
    },
  };
}
