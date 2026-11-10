import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePng, hex, mix, clamp01, paintScene, applyGrain, applyVignette, hashSequence, hashCell } from './lib-raster.mjs';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images', 'eventCovers');
const WIDTH = 960;
const HEIGHT = 540;

const TAU = Math.PI * 2;

// aurora — indigo sky with three drifting light bands
const aurora = (u, v) => {
  let rgb = mix(hex('#191834'), hex('#241B3F'), v);
  const bands = [
    { color: hex('#4E3ED6'), amp: 0.1, freq: 2.2, phase: 0.4, center: 0.3, width: 0.16 },
    { color: hex('#22B8CF'), amp: 0.08, freq: 1.4, phase: 1.9, center: 0.5, width: 0.14 },
    { color: hex('#D45A92') , amp: 0.07, freq: 2.8, phase: 3.6, center: 0.68, width: 0.12 },
  ];
  for (const band of bands) {
    const cy = band.center + band.amp * Math.sin(u * TAU * band.freq + band.phase);
    const d = Math.abs(v - cy);
    const a = Math.exp(-Math.pow(d / band.width, 1.6));
    rgb = mix(rgb, band.color, a * 0.55);
  }
  const starCol = Math.floor(u * 96);
  const starRow = Math.floor(v * 54);
  if (v < 0.45 && hashCell(starCol, starRow, 99) > 0.994) {
    const sx = (starCol + 0.5) / 96;
    const sy = (starRow + 0.5) / 54;
    const d = Math.hypot(u - sx, v - sy);
    rgb = mix(rgb, [255, 255, 255], clamp01((0.004 - d) / (2 / WIDTH)));
  }
  return rgb;
};

// confetti — dark slate with sparse neon dots
const confetti = (u, v) => {
  let rgb = mix(hex('#151721'), hex('#1D2130'), v);
  const palette = [hex('#F97066'), hex('#FBBF24'), hex('#34D399'), hex('#60A5FA'), hex('#C084FC')];
  const cell = 0.07;
  const cx = Math.floor(u / cell);
  const cy = Math.floor(v / cell);
  const pickRand = hashCell(cx, cy, 11);
  const dotRand = hashCell(cx, cy, 23);
  const jxRand = hashCell(cx, cy, 37);
  const jyRand = hashCell(cx, cy, 53);
  if (pickRand > 0.82) {
    const pick = palette[Math.floor(dotRand * palette.length) % palette.length];
    const px0 = (cx + 0.2 + jxRand * 0.6) * cell;
    const py0 = (cy + 0.2 + jyRand * 0.6) * cell;
    const radius = 0.006 + dotRand * 0.008;
    const d = Math.hypot(u - px0, v - py0);
    const glow = clamp01((radius * 2.6 - d) / (radius * 1.6));
    const core = clamp01((radius - d) / (2 / WIDTH));
    rgb = mix(rgb, pick, glow * 0.35);
    rgb = mix(rgb, mix(pick, [255, 255, 255], 0.35), core);
  }
  return rgb;
};

// waves — layered dusk dune curves
const waves = (u, v) => {
  let rgb;
  const layers = [
    { color: hex('#F2A65A'), base: 0.28, amp: 0.07, freq: 1.6, phase: 0 },
    { color: hex('#E2707E'), base: 0.42, amp: 0.09, freq: 1.1, phase: 1.4 },
    { color: hex('#7C4A8E'), base: 0.58, amp: 0.1, freq: 0.9, phase: 2.6 },
    { color: hex('#2D2340'), base: 0.8, amp: 0.06, freq: 1.3, phase: 4.4 },
  ];
  rgb = mix(hex('#FBD1A2'), hex('#F07C54'), v * 0.5);
  for (const layer of layers) {
    const cy = layer.base + layer.amp * Math.sin(u * TAU * layer.freq + layer.phase);
    if (v >= cy) rgb = mix(rgb, layer.color, 1);
    if (v >= cy - 0.006 && v < cy) rgb = mix(rgb, layer.color, 0.5); // soft crest
  }
  return rgb;
};

// orbs — deep navy with soft round glows
const orbs = (u, v) => {
  let rgb = hex('#101522');
  const orbs = [
    { color: hex('#FF8A5B'), x: 0.26, y: 0.3, r: 0.38 },
    { color: hex('#64D2FF'), x: 0.74, y: 0.26, r: 0.42 },
    { color: hex('#B48CFF'), x: 0.6, y: 0.72, r: 0.5 },
    { color: hex('#59C585'), x: 0.2, y: 0.78, r: 0.34 },
  ];
  for (const orb of orbs) {
    const d = Math.hypot(u - orb.x, (v - orb.y) * 1.05);
    const a = Math.exp(-Math.pow(clamp01(d / orb.r), 2.4) * 3.4);
    rgb = mix(rgb, orb.color, a * 0.8);
  }
  return rgb;
};

// rings — moss field with pulse rings
const rings = (u, v) => {
  let rgb = mix(hex('#0C2521'), hex('#123333'), v);
  const cx = 0.62;
  const cy = 0.42;
  const r = Math.hypot(u - cx, (v - cy) * 1.4);
  for (let k = 0; k < 5; k++) {
    const band = Math.abs(r - (0.12 + k * 0.14));
    const a = clamp01(0.16 - band) * clamp01(1 - k * 0.16) + max(0, 0.05 - band * 6);
    rgb = mix(rgb, hex('#64D9A0'), clamp01(a));
  }
  const d = Math.hypot(u - cx, (v - cy) * 1.4);
  rgb = mix(rgb, hex('#EAFBF0'), clamp01((0.06 - d) / 0.002));
  return rgb;
};

function max(a, b) {
  return a > b ? a : b;
}

// dune — amber sunrise haze
const dune = (u, v) => {
  let rgb = mix(hex('#FFE3B8'), hex('#FB7A4E'), v);
  const ray = Math.exp(-Math.pow((u * 0.8 + v - 0.9) * 2.6, 2));
  rgb = mix(rgb, [255, 244, 214], ray * 0.5);
  const sunX = 0.3;
  const sunY = 0.42;
  const d = Math.hypot(u - sunX, v - sunY);
  rgb = mix(rgb, hex('#FF9E45'), Math.max(0, 1 - d * 2.4) * 0.6);
  rgb = mix(rgb, hex('#FFEFC9'), clamp01((0.055 - d) / (2 / WIDTH)));
  if (v > 0.55) {
    const cutoff =
      0.6 + 0.07 * Math.sin(u * 2.4 + 0.6) + 0.05 * Math.sin(u * 5.3 + 2.2) + 0.02 * Math.sin(u * 11 + 5);
    if (v >= cutoff) rgb = mix(rgb, hex('#5A2B22'), 1);
    if (v >= cutoff - 0.008 && v < cutoff) rgb = mix(rgb, hex('#C4592F'), 0.5);
  }
  return rgb;
};

const scenes = {
  'cover-aurora.png': aurora,
  'cover-confetti.png': confetti,
  'cover-waves.png': waves,
  'cover-orbs.png': orbs,
  'cover-rings.png': rings,
  'cover-dune.png': dune,
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, paint] of Object.entries(scenes)) {
  const data = paintScene(WIDTH, HEIGHT, paint);
  applyVignette(data, WIDTH, HEIGHT, 0.3);
  applyGrain(data, WIDTH, HEIGHT, 6, 99);
  const out = path.join(OUT_DIR, file);
  writeFileSync(out, encodePng(WIDTH, HEIGHT, data));
  console.log('wrote', out, `${WIDTH}x${HEIGHT}`);
}
