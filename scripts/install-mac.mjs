/**
 * macOS kurulum yardımcısı (V1.2-165) — mimariden bağımsız.
 *
 * release/ altındaki mac* dizinini otomatik bulur (mac-arm64 / mac-x64 / mac /
 * mac-universal); önce çalışan Quatra'yı kapatır, /Applications/Quatra.app'i
 * tazeler, spctl (Gatekeeper) değerlendirme sonucunu yazdırır ve uygulamayı açar.
 *
 * Kullanım: npm run install:mac   (önce npm run package:mac paketlemeyi koşar)
 * Tek başına: node scripts/install-mac.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const target = '/Applications/Quatra.app';

function run(cmd, args, { allowFail = false } = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (!allowFail && res.status !== 0) {
    console.error(`[install:mac] komut basarisiz (exit=${res.status}): ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
  return res;
}

/** release icindeki mac* klasorlerinden arch'a en uygun Quatra.app'i secer (arch bagimsiz). */
export function findApp() {
  if (!fs.existsSync(releaseDir)) return null;
  const dirs = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('mac'))
    .map((e) => e.name);
  // Tercih sırası: birebir arch adı -> evrensel -> arch'sız "mac" -> kalan.
  const prefer =
    process.arch === 'arm64'
      ? ['mac-arm64', 'mac-universal', 'mac']
      : ['mac-x64', 'mac', 'mac-universal'];
  const ordered = [...prefer.filter((n) => dirs.includes(n)), ...dirs];
  for (const name of ordered) {
    const app = path.join(releaseDir, name, 'Quatra.app');
    if (fs.existsSync(app)) return app;
  }
  return null;
}

function main() {
  if (process.platform !== 'darwin') {
    console.error('[install:mac] Bu script yalnızca macOS icin calisir.');
    process.exit(1);
  }

  const appPath = findApp();
  if (!appPath) {
    console.error(
      '[install:mac] release/ altinda Quatra.app bulunamadi. Once: npm run package:mac',
    );
    process.exit(1);
  }
  console.log(`[install:mac] kaynak: ${path.relative(root, appPath)} (arch: ${process.arch})`);

  // Calisan uygulamayi kapat (acik degilse pkill 1 doner — sorun degil).
  run('pkill', ['-x', 'Quatra'], { allowFail: true });

  // Kurulumu tazele: eski .app'i sil, ditto ile kopyala (izin/meta korunur).
  fs.rmSync(target, { recursive: true, force: true });
  run('ditto', [appPath, target]);
  console.log(`[install:mac] kuruldu: ${target}`);

  // Gatekeeper degerlendirmesi: imzasiz build'de "rejected" beklenir (identity: null).
  const assess = spawnSync('spctl', ['--assess', '--type', 'execute', '--verbose=2', target], {
    encoding: 'utf8',
  });
  console.log(
    `[install:mac] spctl --assess: ${assess.status === 0 ? 'ACCEPTED' : 'REJECTED'} (exit=${assess.status})`,
  );
  for (const line of [assess.stdout, assess.stderr]) {
    if (line && line.trim()) console.log(line.trim());
  }

  run('open', [target]);
  console.log('[install:mac] Quatra acildi.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
