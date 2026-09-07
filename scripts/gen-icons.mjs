// Generate the PWA icons referenced by packages/app/vite.config.ts.
// Pure Node — no image libraries. Run: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../packages/app/public/icons/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex("#0f172a");
const ACCENT = hex("#38bdf8");
const LIGHT = hex("#f8fafc");

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
};

function png(size, { padding }) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * (0.5 - padding);
  const barW = size * (0.62 - padding);
  const barH = size * 0.09;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let px = BG;
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const inTopBar = Math.abs(x - cx) < barW / 2 && Math.abs(y - (cy - r * 0.62)) < barH / 2;
      const inBotBar = Math.abs(x - cx) < barW / 2 && Math.abs(y - (cy + r * 0.62)) < barH / 2;
      if (padding < 0.2 && (inTopBar || inBotBar)) px = LIGHT;
      else if (inCircle) px = ACCENT;
      const o = row + 1 + x * 4;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const files = [
  ["pwa-192.png", 192, { padding: 0.14 }],
  ["pwa-512.png", 512, { padding: 0.14 }],
  ["pwa-512-maskable.png", 512, { padding: 0.26 }],
];
for (const [name, size, opts] of files) {
  writeFileSync(new URL(name, `file://${OUT}`), png(size, opts));
  console.log("wrote", name);
}
