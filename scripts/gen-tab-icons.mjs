import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images', 'tabIcons');

const SIZES = [
  { name: (n) => `${n}.png`, size: 24 },
  { name: (n) => `${n}@2x.png`, size: 48 },
  { name: (n) => `${n}@3x.png`, size: 72 },
];

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function distPointSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * abx);
  const dy = py - (ay + t * aby);
  return Math.hypot(dx, dy);
}

const stroke = 0.085;
const half = stroke / 2;

const discOutline = (cu, cv, r) => (u, v) => {
  const d = Math.abs(Math.hypot(u - cu, v - cv) - r);
  return d <= half ? 1 : 0;
};

const discFilled = (cu, cv, r) => (u, v) => {
  return Math.hypot(u - cu, v - cv) <= r ? 1 : 0;
};

const seg = (ax, ay, bx, by) => (u, v) => {
  return distPointSeg(u, v, ax, ay, bx, by) <= half ? 1 : 0;
};

const box = (mx, my, hw, hv) => (u, v) => {
  const d = Math.max(Math.abs(u - mx) - hw, Math.abs(v - my) - hv);
  const inner = Math.max(Math.abs(u - mx) - (hw - stroke), Math.abs(v - my) - (hv - stroke));
  return d <= 0 && inner >= 0 ? 1 : 0;
};

const nakedBox = (mx, my, hw, hv) => (u, v) => {
  const d = Math.max(Math.abs(u - mx) - hw, Math.abs(v - my) - hv);
  return d <= 0 ? 1 : 0;
};

const dome = (cu, cv, rx, ry) => (u, v) => {
  const ex = (u - cu) / rx;
  const ey = (v - cv) / ry;
  return ex * ex + ey * ey <= 1 && v <= cv ? 1 : 0;
};

const enclosed = (sx, sy, r) => (u, v) => Math.hypot(u - sx, sy - v) <= r;

const combine = (...shapes) => (u, v) => (shapes.some((s) => s(u, v) > 0) ? 1 : 0);
const subtract = (shape, ...cuts) => (u, v) => (shape(u, v) > 0 && cuts.every((c) => !c(u, v)) ? 1 : 0);

const ticketsGlyph = subtract(
  combine(box(0.5, 0.5, 0.42, 0.18), seg(0.62, 0.36, 0.62, 0.44), seg(0.62, 0.56, 0.62, 0.64)),
  enclosed(0.08, 0.5, 0.055),
  enclosed(0.92, 0.5, 0.055),
);

const hostGlyph = (u, v) =>
  Math.max(
    box(0.5, 0.55, 0.38, 0.32)(u, v),
    nakedBox(0.5, 0.30, 0.335, 0.055)(u, v),
    seg(0.28, 0.12, 0.28, 0.3)(u, v),
    seg(0.72, 0.12, 0.72, 0.3)(u, v),
  );

const glyphs = {
  discover: (u, v) => (discOutline(0.4, 0.4, 0.3)(u, v) || seg(0.62, 0.62, 0.86, 0.86)(u, v)),
  tickets: ticketsGlyph,
  host: hostGlyph,
  profile: (u, v) => (discFilled(0.5, 0.32, 0.17)(u, v) || dome(0.5, 0.84, 0.34, 0.34)(u, v)),
};

function render(shapes, size) {
  const data = new Uint8Array(size * size * 4);
  const sampleAt = (sx, sy) => shapes(sx / size, sy / size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0;
      for (const [dx, dy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        acc += sampleAt(x + dx, y + dy);
      }
      const alpha = Math.round(clamp01((acc / 4) * 1.4) * 255);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = alpha;
    }
  }
  return data;
}

export { glyphs, render };

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, shapes] of Object.entries(glyphs)) {
  for (const { name: fileName, size } of SIZES) {
    const file = path.join(OUT_DIR, fileName(name));
    writeFileSync(file, encodePng(size, render(shapes, size)));
    console.log('wrote', file, `${size}x${size}`);
  }
}
