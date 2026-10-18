/**
 * Mikrofon ölçüm analizi — scripts/mic-tanilama.cjs çıktısını değerlendirir.
 *
 * Kullanım:
 *   node scripts/mic-analiz.mjs <olcum.json> [--play=<bas1>:<bit1>,<bas2>:<bit2>]
 *
 * Ölçüm dosyasını üretme (repo kökünden):
 *   Windows: .\node_modules\electron\dist\electron.exe scripts\mic-tanilama.cjs --out=C:\...\olcum.json
 *   macOS  : npx electron scripts/mic-tanilama.cjs --out=/tmp/quatra-olcum.json
 *
 * --play epoch ms cinsindendir (PowerShell: [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();
 * macOS/Node: node -e "console.log(Date.now())").
 * Verilmezse tüm örnekler "base" sayılır. Hoparlörden test cümlesi çalınan pencereler
 * "SPEECH", kalan her yer "BASE" (ortam) olarak raporlanır; ayrıca her hassasiyet
 * kademesi için VAD/minPeak uygunluğu tablo halinde listelenir.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.log('kullanim: node scripts/mic-analiz.mjs <olcum.json> [--play=s1:e1,s2:e2]');
  process.exit(1);
}
const playArg = (args.find((a) => a.startsWith('--play=')) || '').slice(7);

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!data.ok) {
  console.log('OLCUM BASARISIZ: ' + data.error);
  process.exit(1);
}

const windows = playArg
  .split(',')
  .filter(Boolean)
  .map((w) => w.split(':').map(Number))
  .map(([s, e]) => [s - data.t0Epoch, e - data.t0Epoch]);

const PAD = 700;
const base = data.samples
  .filter(([t]) => !windows.some(([s, e]) => t >= s - PAD && t <= e + PAD))
  .map(([, l]) => l);
const speech = data.samples
  .filter(([t]) => windows.some(([s, e]) => t >= s + PAD && t <= e - PAD))
  .map(([, l]) => l);

const sorted = (a) => [...a].sort((x, y) => x - y);
const q = (a, p) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);
const stat = (a) => ({
  n: a.length,
  mean: a.reduce((x, y) => x + y, 0) / (a.length || 1),
  p10: q(a, 0.1),
  p50: q(a, 0.5),
  p90: q(a, 0.9),
  max: a.reduce((x, y) => (y > x ? y : x), 0),
});
const f = (x) => Number(x).toFixed(4);

const B = stat(base);
const S = stat(speech);

console.log(
  `# ${file} (profil=${data.profile}, cihaz="${data.trackLabel}", ornek=${data.sampleCount}, ctx=${data.ctxState})`,
);
console.log(`BASE   n=${B.n}  mean=${f(B.mean)} p50=${f(B.p50)} p90=${f(B.p90)} max=${f(B.max)}`);
console.log(
  `SPEECH n=${S.n}  mean=${f(S.mean)} p10=${f(S.p10)} p50=${f(S.p50)} p90=${f(S.p90)} max=${f(S.max)}`,
);
if (B.p90 > 0 && S.p90 > 0) {
  console.log(
    `SNR(p90)=${(20 * Math.log10(S.p90 / B.p90)).toFixed(1)} dB  SNR(mean)=${(20 * Math.log10(S.mean / B.mean)).toFixed(1)} dB`,
  );
}
console.log('');
console.log('hassasiyet | vad esigi | min tepe | yumusak-ses(p10) | tepe(max)');
for (let s = 1; s <= 10; s++) {
  const vad = 0.03 + (10 - s) * 0.008;
  const mp = 0.1 + (10 - s) * 0.012;
  const soft = S.p10 > vad * 1.15 ? 'OK' : S.p10 > vad ? 'sinir' : 'YETMEZ';
  const peak = S.max > mp * 1.3 ? 'OK' : S.max > mp ? 'sinir' : 'YETMEZ';
  console.log(
    `   ${String(s).padStart(2)}      |  ${f(vad)}  |  ${f(mp)}  |  ${soft.padEnd(6)} | ${peak}`,
  );
}
