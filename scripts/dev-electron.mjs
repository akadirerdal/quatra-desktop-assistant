/**
 * dev:electron yardimcisi — esbuild watch + Electron otomatik yeniden baslatma (V1.2-166).
 *
 * electron/ altindaki *.{ts} dosyalari her degistiginde main/preload yeniden derlenir
 * ve Electron otomatik yeniden baslar; elle yeniden baslatma gerekmez.
 *
 * Akis: npm run dev:electron (concurrently) -> "vite" + bu script.
 * Vite dev sunucusunu bu script baslatmaz; VITE_DEV_SERVER_URL ortam degiskeni
 * Electron cocuk surecine aynen aktarilir.
 *
 * Kullanim: npm run dev:electron
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import electronPath from 'electron';
import * as esbuild from 'esbuild';

const root = process.cwd();
const devServerUrl = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173';

let ctx = null;
let electron = null;
let shuttingDown = false;

/** Calisan Electron surecini kapatir (yeniden baslatma ya da cikis icin). */
function killElectron() {
  const child = electron;
  electron = null;
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    // Windows'ta surec agacini kapat (renderer/gpu cocuklari dahil).
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

/** Elektron'u (yeniden) baslatir. */
function startElectron() {
  killElectron();
  const child = spawn(electronPath, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: devServerUrl },
  });
  electron = child;
  child.on('exit', () => {
    if (electron !== child) return; // yeniden baslatma icin kapatildi — yok say
    electron = null;
    void shutdown(0); // pencere/tepsiden gercek cikis -> dev ortamini da kapat
  });
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  killElectron();
  if (ctx) await ctx.dispose().catch(() => {});
  process.exit(code);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => void shutdown(0));
}

ctx = await esbuild.context({
  entryPoints: [
    { in: path.join(root, 'electron', 'main.ts'), out: 'main' },
    { in: path.join(root, 'electron', 'preload.ts'), out: 'preload' },
  ],
  outdir: path.join(root, 'dist-electron'),
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  logLevel: 'warning',
  plugins: [
    {
      name: 'restart-electron',
      setup(build) {
        build.onEnd((result) => {
          if (shuttingDown) return;
          if (result.errors.length > 0) {
            console.error(
              '[dev-electron] derleme hatasi — mevcut Electron surumuyle devam ediliyor',
            );
            return;
          }
          console.log('[dev-electron] derleme tamam — Electron baslatiliyor/yeniden baslatiliyor');
          startElectron();
        });
      },
    },
  ],
});

console.log('[dev-electron] esbuild watch aktif: electron/main.ts + electron/preload.ts');
await ctx.watch();
