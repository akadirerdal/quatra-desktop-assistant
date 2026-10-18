/**
 * Quatra ikonu üreticisi — bağımlılıksız, saf Node.
 * Çıktı: build/icon.ico (16–256 px, 32-bit BGRA + AND mask)
 *        build/icon.png (1024 px, RGBA — macOS paketleme icin, V1.2-165)
 * Tema: koyu zemin + menekşe halka (uygulama accent rengi #9b87f5).
 * Kullanım: node scripts/make-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** RGBA piksel tamponu (üstten alta) — PNG için doğrudan, BMP için dönüştürülür. */
function renderRgba(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const corner = size * 0.22; // yuvarlatılmış köşe yarıçapı
  const ringR = size * 0.3;
  const ringW = size * 0.085;
  const dotR = size * 0.065;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Yuvarlatılmış kare kapsama alanı
      const dx = Math.max(Math.abs(x - c) - (size / 2 - corner), 0);
      const dy = Math.max(Math.abs(y - c) - (size / 2 - corner), 0);
      const dRect = Math.sqrt(dx * dx + dy * dy) - corner;
      const bg = 1 - smoothstep(-0.75, 0.75, dRect);

      // Zemin #101120
      let r = 16;
      let g = 17;
      let b = 32;

      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);

      // Menekşe halka (üstten alta #b9acf5 → #6e5fc4 geçişli)
      const ring = 1 - smoothstep(ringW / 2 - 0.75, ringW / 2 + 0.75, Math.abs(d - ringR));
      const t = y / Math.max(1, size - 1);
      r = lerp(r, lerp(0xb9, 0x6e, t), ring);
      g = lerp(g, lerp(0xac, 0x5f, t), ring);
      b = lerp(b, lerp(0xf5, 0xc4, t), ring);

      // Merkez nokta #b9acf5
      const dot = 1 - smoothstep(dotR - 0.75, dotR + 0.75, d);
      r = lerp(r, 0xb9, dot);
      g = lerp(g, 0xac, dot);
      b = lerp(b, 0xf5, dot);

      const o = (y * size + x) * 4;
      px[o] = Math.round(r);
      px[o + 1] = Math.round(g);
      px[o + 2] = Math.round(b);
      px[o + 3] = Math.round(255 * bg);
    }
  }
  return px;
}

/** BMP verisi: satırlar alttan üste + BGRA düzeni. */
function renderBmpData(size) {
  const rgba = renderRgba(size);
  const flipped = Buffer.alloc(rgba.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = ((size - 1 - y) * size + x) * 4;
      flipped[d] = rgba[s + 2]; // B
      flipped[d + 1] = rgba[s + 1]; // G
      flipped[d + 2] = rgba[s]; // R
      flipped[d + 3] = rgba[s + 3]; // A
    }
  }
  return flipped;
}

function bmpEntry(size) {
  const data = renderBmpData(size);
  const andRow = (Math.ceil(size / 8) + 3) & ~3; // 4 bayt hizalı 1bpp maske
  const andMask = Buffer.alloc(andRow * size); // 32-bit alpha kullanıldığı için boş maske

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight (XOR + AND)
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(data.length + andMask.length, 20); // biSizeImage

  return { size, buf: Buffer.concat([header, data, andMask]) };
}

// ---------------------------------------------------------------- PNG yazıcı (bağımlılıksız, make-tray.mjs ile aynı)
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

const sizes = [16, 32, 48, 64, 128, 256];
const entries = sizes.map(bmpEntry);

const dir = Buffer.alloc(6 + 16 * entries.length);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(entries.length, 4);

let offset = dir.length;
entries.forEach((e, i) => {
  const o = 6 + i * 16;
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, o); // 256 → 0 kuralı
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
  dir.writeUInt8(0, o + 2); // palette
  dir.writeUInt8(0, o + 3); // reserved
  dir.writeUInt16LE(1, o + 4); // planes
  dir.writeUInt16LE(32, o + 6); // bit count
  dir.writeUInt32LE(e.buf.length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += e.buf.length;
});

const outDir = path.join(process.cwd(), 'build');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'icon.ico');
fs.writeFileSync(outFile, Buffer.concat([dir, ...entries.map((e) => e.buf)]));
console.log(`build/icon.ico yazıldı (${sizes.join(', ')} px, ${fs.statSync(outFile).size} bayt)`);

// V1.2-165: macOS paketlemesi (package.json build.mac.icon) 1024 px PNG ister.
const pngSize = 1024;
const pngFile = path.join(outDir, 'icon.png');
fs.writeFileSync(pngFile, encodePng(renderRgba(pngSize), pngSize));
console.log(`build/icon.png yazıldı (${pngSize} px, ${fs.statSync(pngFile).size} bayt)`);
