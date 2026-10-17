/**
 * Quatra macOS menü çubuğu (tepsi) ŞABLON simgesi üreticisi — bağımlılıksız, saf Node.
 * Çıktı: build/trayTemplate.png (22px) + build/trayTemplate@2x.png (44px)
 *
 * Şablon (template) görüntüde macOS yalnızca ALFA kanalını kullanır ve simgeyi
 * açık/koyu menü çubuğuna göre kendisi boyar — bu yüzden siyah + alfa yeterli.
 * Geometri uygulama simgesiyle aynı kimlik: menekşe halka + merkez nokta.
 *
 * Kullanım: node scripts/make-tray.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Siyah + alfa RGBA tamponu — halka + merkez nokta (menü çubuğu için hafif kalın). */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const ringR = size * 0.31;
  const ringW = size * 0.1;
  const dotR = size * 0.075;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
      const ring = 1 - smoothstep(ringW / 2 - 0.75, ringW / 2 + 0.75, Math.abs(d - ringR));
      const dot = 1 - smoothstep(dotR - 0.9, dotR + 0.9, d);
      const a = Math.max(ring, dot);
      const o = (y * size + x) * 4;
      px[o] = 0;
      px[o + 1] = 0;
      px[o + 2] = 0;
      px[o + 3] = Math.round(255 * Math.min(1, Math.max(0, a)));
    }
  }
  return px;
}

// ---------------------------------------------------------------- PNG yazıcı (bağımlılıksız)
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtre: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // renk türü: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(process.cwd(), 'build');
fs.mkdirSync(outDir, { recursive: true });
for (const [file, size] of [
  ['trayTemplate.png', 22],
  ['trayTemplate@2x.png', 44],
]) {
  fs.writeFileSync(path.join(outDir, file), encodePng(render(size), size));
  console.log(`yazıldı: build/${file} (${size}px)`);
}
