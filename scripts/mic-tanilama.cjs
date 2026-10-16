/**
 * Mikrofon tanılama aracı — gerçek Chromium getUserMedia + WebAudio hattıyla
 * seviye ölçer. Metrik uygulamayla birebir aynıdır: rms(byte time domain) * 3.
 *
 * Amaç: gürültü tabanı ve konuşma seviyesini ölçüp VAD hassasiyeti / ek kazanç /
 * gürültü kapısı ayarlarını gerçek veriyle seçmek (bkz. TODO.md kalibrasyon notu).
 *
 * Kullanım (repo kökünden):
 *   .\node_modules\electron\dist\electron.exe scripts\mic-tanilama.cjs `
 *     --seconds=40 --profile=app --out=C:\...\olcum.json
 *
 * Profiller:
 *   app    : uygulama ayarlarının eşi (NS+AEC+AGC açık) — varsayılan
 *   raw    : filtre yok (NS/AEC/AGC kapalı)
 *   nsauto : NS kapalı, AEC+AGC açık
 *   noagc  : AEC+NS açık, AGC kapalı
 *
 * Çıktı JSON: { ok, t0Epoch, trackLabel, samples: [[tMs, level], ...] }
 * Ölçüm sırasında hoparlörden konuşma çalınır; t0Epoch ile zamanlar eşlenir.
 */
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function getArg(name, defValue) {
  const prefix = '--' + name + '=';
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : defValue;
}

const seconds = Math.min(120, Math.max(3, Number(getArg('seconds', '40')) || 40));
const profile = getArg('profile', 'app');
const outFile = getArg('out', path.join(os.tmpdir(), 'quatra-mic-olcum.json'));

const PROFILES = {
  app: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  raw: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  nsauto: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
  noagc: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
};

/** Renderer içinde çalışır: ~60 Hz seviye zaman serisi toplar ve döndürür. */
function rendererMeasure(opts) {
  return (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: opts.constraints });
      const ctx = new AudioContext();
      if (ctx.state !== 'running') await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const track = stream.getAudioTracks()[0];
      const t0Epoch = Date.now();
      const t0 = performance.now();
      const samples = [];
      await new Promise((resolve) => {
        const tick = () => {
          an.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const level = Math.sqrt(sum / data.length) * 3;
          samples.push([Math.round(performance.now() - t0), Math.round(level * 100000) / 100000]);
          if (performance.now() - t0 >= opts.seconds * 1000) {
            resolve(true);
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => {});
      return {
        ok: true,
        t0Epoch,
        trackLabel: track ? track.label : '',
        trackState: track ? track.readyState : '',
        ctxState: ctx.state,
        sampleCount: samples.length,
        samples,
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  })();
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(permission === 'media'),
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { backgroundThrottling: false },
  });
  // file:// güvenli bağlam sayılır; about:blank/data: getUserMedia için güvenilmez.
  const htmlPath = path.join(os.tmpdir(), 'quatra-mic-olcum.html');
  fs.writeFileSync(htmlPath, '<!doctype html><meta charset="utf-8"><title>mic</title>');
  await win.loadFile(htmlPath);

  const constraints = PROFILES[profile] || PROFILES.app;
  const code = `(${rendererMeasure.toString()})(${JSON.stringify({ seconds, constraints })})`;
  let result;
  try {
    result = await win.webContents.executeJavaScript(code, true);
  } catch (e) {
    result = { ok: false, error: String(e) };
  }

  const payload = { profile, seconds, ...result };
  const text = JSON.stringify(payload);
  try {
    fs.writeFileSync(outFile, text, 'utf8');
  } catch (e) {
    console.error('WRITE_FAIL ' + String(e));
  }

  if (result.ok) {
    const levels = result.samples.map((s) => s[1]);
    const mean = levels.reduce((a, b) => a + b, 0) / (levels.length || 1);
    const peak = levels.reduce((a, b) => (b > a ? b : a), 0);
    const label = String(result.trackLabel).replace(/[^\x20-\x7E]/g, '?');
    console.log(
      `PROFILE=${profile} DEVICE="${label}" SAMPLES=${result.sampleCount} MEAN=${mean.toFixed(
        4,
      )} PEAK=${peak.toFixed(4)} CTX=${result.ctxState}`,
    );
  } else {
    console.error('MEASURE_FAIL ' + result.error);
  }
  console.log('RESULT_FILE=' + outFile);
  app.exit(result.ok ? 0 : 1);
});
