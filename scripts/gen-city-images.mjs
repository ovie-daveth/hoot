import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePng, hex, mix, clamp01, paintScene, applyGrain, applyVignette, hashSequence } from './lib-raster.mjs';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images', 'cities');
const WIDTH = 720;
const HEIGHT = 900;

const px = 2 / WIDTH;

function smoothstep(edge0, edge1, v) {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function litWindows(u, v, col, windowColor, horizon, dusk = 1, duskTint = [255, 244, 214]) {
  const relX = (u - col.mx) / col.hw; // -1..1 across facade
  if (Math.abs(relX) > 0.8) return null;
  const relV = (v - col.top) / (horizon - col.top);
  if (relV < 0.1 || relV > 0.92) return null;
  const cols = 7;
  const rows = 13;
  const fx = Math.abs(relX) * cols;
  const cx = Math.floor(fx);
  const fy = relV * rows;
  const cy = Math.floor(fy);
  const frx = fx - cx;
  const fry = fy - cy;
  if (frx < 0.28 || frx > 0.72 || fry < 0.3 || fry > 0.78) return null;
  const rand = hashCell(cx, cy, col.seed ?? 0);
  if (rand < 0.6) return null;
  return mix(windowColor, duskTint, ((rand - 0.6) / 0.4) * 0.25 * dusk);
}

function hashCell(a, b, seed) {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

// Lagos — blue hour over the lagoon
function lagos(u, v) {
  const horizon = 0.62;
  const stops = [
    [0, hex('#1E355F')],
    [0.3, hex('#6E3D63')],
    [0.52, hex('#D96A44')],
    [horizon, hex('#F4A24B')],
  ];
  let rgb;
  if (v < horizon) {
    rgb = stops[stops.length - 1][1];
    for (let i = stops.length - 1; i > 0; i--) {
      if (v < stops[i][0]) {
        const [t, c] = stops[i];
        rgb = mix(stops[i - 1][1], c, (v - stops[i - 1][0]) / (t - stops[i - 1][0]));
      }
    }
    // sun glow behind far layer
    const d = Math.hypot(u - 0.68, v - 0.5);
    rgb = mix(rgb, hex('#FFC873'), Math.max(0, 1 - d * 1.7) * 0.55);
  } else {
    const depth = (v - horizon) / (1 - horizon);
    rgb = mix(hex('#1A2C4E'), hex('#0B1526'), depth);
    // shimmering glint column under the sun
    const glint = Math.exp(-Math.pow((u - 0.68) * 9, 2)) * (1 - depth) * 0.7;
    const ripple = 0.5 + 0.5 * Math.sin(u * 150 + depth * 44);
    rgb = mix(rgb, hex('#FFA75C'), glint * ripple * 0.8);
  }

  const far = [
    { mx: 0.08, hw: 0.075, top: 0.5 },
    { mx: 0.24, hw: 0.06, top: 0.53 },
    { mx: 0.4, hw: 0.085, top: 0.52 },
    { mx: 0.58, hw: 0.07, top: 0.545 },
    { mx: 0.76, hw: 0.08, top: 0.51 },
    { mx: 0.94, hw: 0.07, top: 0.53 },
  ];
  const near = [
    { mx: 0.14, hw: 0.06, top: 0.42, seed: 3 },
    { mx: 0.3, hw: 0.08, top: 0.36, seed: 7 },
    { mx: 0.47, hw: 0.055, top: 0.45, seed: 11 },
    { mx: 0.62, hw: 0.075, top: 0.4, antenna: true, seed: 13 },
    { mx: 0.78, hw: 0.09, top: 0.44, seed: 17 },
    { mx: 0.93, hw: 0.05, top: 0.47, antenna: true, seed: 19 },
  ];

  if (v < horizon) {
    const haze = mix(hex('#F4A24B'), hex('#24123C'), 0.62);
    for (const col of far) {
      if (Math.abs(u - col.mx) <= col.hw && v >= col.top) rgb = mix(rgb, haze, 1);
    }
    for (const col of near) {
      if (Math.abs(u - col.mx) <= col.hw && v >= col.top) {
        rgb = mix(rgb, hex('#14092E'), 1);
        const lit = litWindows(u, v, col, hex('#FFD98A'), horizon, 1.1);
        if (lit) rgb = lit;
        if (col.antenna && Math.abs(u - (col.mx + col.hw * 0.3)) <= 0.0025 && v >= col.top - 0.06) {
          rgb = hex('#14092E');
        }
      }
    }
  } else {
    const depth = (v - horizon) / (1 - horizon);
    const shimmer = 0.68 + 0.32 * Math.sin(u * 95) * Math.sin(depth * 38 + u * 7);
    for (const col of near) {
      if (Math.abs(u - col.mx) <= col.hw * 0.92) {
        const alpha = clamp01(1 - depth * 2.1) * 0.75 * shimmer;
        rgb = mix(rgb, hex('#14092E'), alpha);
      }
    }
  }
  return rgb;
}

// Abuja — harmattan gold over Zuma rock
function abuja(u, v) {
  const horizon = 0.72;
  const stops = [
    [0, hex('#FBEDCD')],
    [0.4, hex('#F2C77E')],
    [0.62, hex('#E09552')],
    [horizon, hex('#C86F3A')],
  ];
  let rgb;
  if (v < horizon) {
    for (let i = stops.length - 1; i >= 0; i--) {
      if (v >= stops[i][0]) {
        const next = stops[i + 1] ?? [horizon, hex('#C86F3A')];
        rgb = mix(stops[i][1], next[1], (v - stops[i][0]) / (next[0] - stops[i][0]));
        break;
      }
    }
    const d = Math.hypot(u - 0.24, v - 0.26);
    rgb = mix(rgb, hex('#FFE9AC'), Math.max(0, 1 - d * 1.5) * 0.7);
    const radius = 0.042;
    const disc = clamp01((radius - d) / px);
    rgb = mix(rgb, hex('#FFF6DA'), disc);
  } else {
    const depth = (v - horizon) / (1 - horizon);
    rgb = mix(hex('#8A5A36'), hex('#432B19'), depth);
    const track = Math.exp(-Math.pow((u - 0.5 + 0.12 * Math.sin(v * 9)) * 7, 2));
    rgb = mix(rgb, hex('#C9975F'), track * 0.28 * (1 - depth * 0.4));
  }

  if (v < horizon) {
    // haze hills
    for (const hill of [
      { mx: 0.06, hw: 0.12, top: 0.56 },
      { mx: 0.9, hw: 0.14, top: 0.58 },
      { mx: 0.74, hw: 0.08, top: 0.6 },
    ]) {
      if (Math.abs(u - hill.mx) <= hill.hw && v >= hill.top) {
        rgb = mix(rgb, hex('#8C5B46'), 1);
      }
    }
    // Zuma rock with arched profile
    const mx = 0.5;
    const hw = 0.15;
    if (Math.abs(u - mx) <= hw) {
      const t = (u - mx) / hw;
      const top = 0.74 - 0.34 * (1 - t * t) * (1 - t * t);
      if (v >= top) rgb = mix(rgb, hex('#3E2517'), 1);
      if (v >= top && v < top + 0.012) rgb = mix(rgb, hex('#5C3B26'), 0.7);
    }
  }
  return rgb;
}

// Nairobi — cloud morning over the city + escarpment
function nairobi(u, v) {
  const horizon = 0.56;
  const stops = [
    [0, hex('#5FA8CE')],
    [0.26, hex('#9CCBDF')],
    [horizon, hex('#E6F1F4')],
  ];
  let rgb = stops[stops.length - 1][1];
  if (v < horizon) {
    for (let i = stops.length - 1; i > 0; i--) {
      if (v < stops[i][0]) {
        rgb = mix(stops[i - 1][1], stops[i][1], v / stops[i][0]);
      }
    }
    const d = Math.hypot(u - 0.22, v - 0.2);
    rgb = mix(rgb, hex('#FFF6DC'), Math.max(0, 1 - d * 2.2) * 0.5);
    // soft clouds
    const cloud = Math.exp(-Math.pow((u - 0.65 + 0.08 * Math.sin(v * 7)) * 3.4, 2)) * Math.exp(-Math.pow((v - 0.12) * 9, 2));
    rgb = mix(rgb, [255, 255, 255], cloud * 0.75);
  } else {
    const depth = (v - horizon) / (1 - horizon);
    rgb = mix(hex('#41744F'), hex('#24402F'), depth);
    const path = Math.exp(-Math.pow((u - 0.32 - 0.1 * Math.sin(v * 6)) * 6, 2));
    rgb = mix(rgb, hex('#D8E4C2'), path * 0.3 * (1 - depth * 0.3));
  }

  if (v < horizon) {
    // escarpment ridge
    const ridge =
      0.53 - 0.065 * Math.sin(u * 6.7 + 1.2) - 0.025 * Math.sin(u * 17 + 3) - 0.01 * Math.sin(u * 31);
    if (v >= ridge) rgb = mix(rgb, hex('#73977F'), 1);
    const far = [
      { mx: 0.05, hw: 0.07, top: 0.5 },
      { mx: 0.2, hw: 0.055, top: 0.47 },
      { mx: 0.62, hw: 0.06, top: 0.49 },
      { mx: 0.94, hw: 0.08, top: 0.48 },
    ];
    const near = [
      { mx: 0.12, hw: 0.075, top: 0.36, seed: 5 },
      { mx: 0.28, hw: 0.06, top: 0.44, seed: 9 },
      { mx: 0.42, hw: 0.09, top: 0.33, antenna: true, seed: 15 },
      { mx: 0.58, hw: 0.05, top: 0.46, seed: 21 },
      { mx: 0.72, hw: 0.08, top: 0.38, seed: 27 },
      { mx: 0.88, hw: 0.055, top: 0.45, antenna: true, seed: 31 },
    ];
    for (const col of far) {
      if (Math.abs(u - col.mx) <= col.hw && v >= col.top) rgb = mix(rgb, hex('#9FBCC4'), 1);
    }
    for (const col of near) {
      if (Math.abs(u - col.mx) <= col.hw && v >= col.top) {
        rgb = mix(rgb, hex('#2F4A66'), 1);
        const lit = litWindows(u, v, col, hex('#FFF3C4'), horizon, 0.9, [252, 247, 230]);
        if (lit) rgb = lit;
        if (col.antenna && Math.abs(u - (col.mx - col.hw * 0.2)) <= 0.0025 && v >= col.top - 0.07) {
          rgb = hex('#2F4A66');
        }
      }
    }
  }
  return rgb;
}

const scenes = { 'lagos.png': lagos, 'abuja.png': abuja, 'nairobi.png': nairobi };

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, paint] of Object.entries(scenes)) {
  const data = paintScene(WIDTH, HEIGHT, paint);
  applyVignette(data, WIDTH, HEIGHT, 0.32);
  applyGrain(data, WIDTH, HEIGHT, 7, 42);
  const out = path.join(OUT_DIR, file);
  writeFileSync(out, encodePng(WIDTH, HEIGHT, data));
  console.log('wrote', out, `${WIDTH}x${HEIGHT}`);
}
