import { deflateSync } from 'node:zlib';

export function crc32(buffer) {
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

export function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const hex = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v & 0xff00) >> 8, v & 255];
};

export const mix = (a, b, t) => {
  const k = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
};

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function hashSequence(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function stringSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function hashCell(a, b, seed) {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

export function paintScene(width, height, paint) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      const subs = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ];
      for (const [dx, dy] of subs) {
        const rgb = paint((x + dx) / width, (y + dy) / height);
        r += clamp01(rgb[0] / 255) * 255;
        g += clamp01(rgb[1] / 255) * 255;
        b += clamp01(rgb[2] / 255) * 255;
      }
      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(r / subs.length);
      data[i + 1] = Math.round(g / subs.length);
      data[i + 2] = Math.round(b / subs.length);
      data[i + 3] = 255;
    }
  }
  return data;
}

export function applyGrain(data, width, height, amount, seed = 7) {
  const rand = hashSequence(seed);
  for (let i = 0; i < width * height; i++) {
    const n = (rand() - 0.5) * 2 * amount;
    data[i * 4 + 0] = Math.max(0, Math.min(255, data[i * 4 + 0] + n));
    data[i * 4 + 1] = Math.max(0, Math.min(255, data[i * 4 + 1] + n));
    data[i * 4 + 2] = Math.max(0, Math.min(255, data[i * 4 + 2] + n));
  }
  return data;
}

export function applyVignette(data, width, height, strength = 0.35) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / width - 0.5) * 2;
      const ny = (y / height - 0.5) * 2;
      const d = Math.min(1, Math.hypot(nx, ny) * 0.72);
      const factor = 1 - strength * d * d;
      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(data[i + 0] * factor);
      data[i + 1] = Math.round(data[i + 1] * factor);
      data[i + 2] = Math.round(data[i + 2] * factor);
    }
  }
  return data;
}
