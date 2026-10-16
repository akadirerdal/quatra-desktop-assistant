/**
 * Quatra ikonu üreticisi — bağımlılıksız, saf Node.
 * Çıktı: build/icon.ico (16–256 px, 32-bit BGRA + AND mask).
 * Tema: koyu zemin + menekşe halka (uygulama accent rengi #9b87f5).
 * Kullanım: node scripts/make-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 32-bit BGRA piksel tamponu üretir (BMP alt-üst sırasına çevrilmiş). */
function render(size) {
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
      px[o] = Math.round(b);
      px[o + 1] = Math.round(g);
      px[o + 2] = Math.round(r);
      px[o + 3] = Math.round(255 * bg);
    }
  }

  // BMP satırları alttan üste
  const flipped = Buffer.alloc(px.length);
  for (let y = 0; y < size; y++) {
    px.copy(flipped, y * size * 4, (size - 1 - y) * size * 4, (size - y) * size * 4);
  }
  return flipped;
}

function bmpEntry(size) {
  const data = render(size);
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
