import Phaser from 'phaser';

// Original magic-circle and impact VFX, painted pixel by pixel in code (see docs/CREDITOS.md).

type Ctx = CanvasRenderingContext2D;

export interface RunePalette { ink: string; main: string; hi: string; white: string }
type Geometry = 'star' | 'hexagram' | 'squares';

const W = '#ffffff';
const G1 = '#d0d0d0';
const G2 = '#9a9a9a';
const G3 = '#666666';
/** Grey ramp: tinting multiplies it into one hue, so every tinted variant stays monochrome. */
export const PLAIN: RunePalette = { ink: G3, main: G2, hi: G1, white: W };

const RUNE = 96;
const SLOTS = 32;
const RUNE_FRAMES = 4;

function p(c: Ctx, color: string, x: number, y: number): void {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function line(c: Ctx, color: string, x0: number, y0: number, x1: number, y1: number): void {
  let x = Math.round(x0), y = Math.round(y0);
  const xe = Math.round(x1), ye = Math.round(y1);
  const dx = Math.abs(xe - x), dy = -Math.abs(ye - y), sx = x < xe ? 1 : -1, sy = y < ye ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = color;
  for (;;) {
    c.fillRect(x, y, 1, 1);
    if (x === xe && y === ye) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** 1-px circle; `every` > 1 leaves gaps for a dotted ring, `keep` filters by angle. */
function circle(c: Ctx, color: string, cx: number, cy: number, rad: number, every = 1, keep?: (a: number) => boolean): void {
  const n = Math.max(8, Math.ceil(Math.PI * 2 * rad * 1.6));
  let last = '';
  let k = 0;
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (keep && !keep(a)) continue;
    const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
    const id = `${x},${y}`;
    if (id === last) continue;
    last = id;
    if (k++ % every === 0) c.fillRect(x, y, 1, 1);
  }
}

/** Bitmap stamp: 'w' white, 'h' highlight, 'm' main, 'i' ink, anything else is empty. */
function stamp(c: Ctx, pal: RunePalette, x0: number, y0: number, rows: string[]): void {
  const map: Record<string, string> = { w: pal.white, h: pal.hi, m: pal.main, i: pal.ink };
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (map[ch]) p(c, map[ch], x0 + x, y0 + y); }));
}

const GLYPHS: Record<string, string[]> = {
  a: ['x..', 'xx.', 'x.x', 'xx.', 'x..'],
  b: ['.x.', 'xxx', '.x.', 'x.x', 'x.x'],
  c: ['xxx', 'x.x', '.x.', 'x.x', 'xxx'],
  d: ['x.x', '.x.', 'x.x', '.x.', 'x.x'],
  e: ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'],
  f: ['x..', 'x..', 'xxx', '..x', '..x'],
};
const GLYPH_PAIR: Record<Geometry, [string, string]> = { star: ['a', 'f'], hexagram: ['c', 'b'], squares: ['d', 'e'] };

const SIGIL_FLAME = [
  '....w....', '....w....', '...whw...', '...hwh...', '..hwwwh..', '..hwhwh..',
  '.hwh.hwh.', '.hw...wh.', '.hw...wh.', '..hw.wh..', '...hhh...',
];
const SIGIL_SHIELD = [
  '.hhhhhhhhh.', 'hmmmmwmmmmh', 'hm...w...mh', 'hm...w...mh', 'hmwwwwwwwmh', 'hm...w...mh', 'hm...w...mh',
  '.hm..w..mh.', '.hm..w..mh.', '..hm.w.mh..', '...hmwmh...', '....hwh....', '.....h.....',
];

/** Vertices of a regular polygon of radius `rad`, first vertex at `deg`. */
function poly(cx: number, cy: number, rad: number, n: number, deg: number): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const a = ((deg + (k * 360) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as [number, number];
  });
}

function connect(c: Ctx, color: string, pts: [number, number][], step: number): void {
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[(k + step) % pts.length];
    line(c, color, ax, ay, bx, by);
  }
}

function nodes(c: Ctx, pal: RunePalette, pts: [number, number][]): void {
  for (const [x, y] of pts) {
    circle(c, pal.hi, x, y, 2.6);
    p(c, pal.white, x, y);
  }
}

function arrowsIn(c: Ctx, pal: RunePalette, cx: number, cy: number): void {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const ox = -dy, oy = dx;
    line(c, pal.main, cx + dx * 9, cy + dy * 9, cx + dx * 4, cy + dy * 4);
    p(c, pal.white, cx + dx * 3, cy + dy * 3);
    p(c, pal.hi, cx + dx * 4 + ox, cy + dy * 4 + oy);
    p(c, pal.hi, cx + dx * 4 - ox, cy + dy * 4 - oy);
    p(c, pal.hi, cx + dx * 5 + ox * 2, cy + dy * 5 + oy * 2);
    p(c, pal.hi, cx + dx * 5 - ox * 2, cy + dy * 5 - oy * 2);
  }
  c.fillStyle = pal.white;
  c.fillRect(cx - 1, cy - 1, 2, 2);
}

function innerGeometry(c: Ctx, pal: RunePalette, geom: Geometry, cx: number, cy: number): void {
  if (geom === 'star') {
    const pts = poly(cx, cy, 31, 5, -90);
    connect(c, pal.main, pts, 2);
    circle(c, pal.hi, cx, cy, 12);
    circle(c, pal.ink, cx, cy, 10, 2);
    nodes(c, pal, pts);
    stamp(c, pal, cx - 5, cy - 6, SIGIL_FLAME);
  } else if (geom === 'hexagram') {
    const up = poly(cx, cy, 31, 3, -90), down = poly(cx, cy, 31, 3, 90);
    connect(c, pal.main, up, 1);
    connect(c, pal.main, down, 1);
    circle(c, pal.hi, cx, cy, 17);
    circle(c, pal.ink, cx, cy, 15, 2);
    nodes(c, pal, [...up, ...down]);
    stamp(c, pal, cx - 6, cy - 7, SIGIL_SHIELD);
  } else {
    const a = poly(cx, cy, 31, 4, 45), b = poly(cx, cy, 31, 4, 0);
    connect(c, pal.main, a, 1);
    connect(c, pal.main, b, 1);
    connect(c, pal.ink, poly(cx, cy, 19, 4, 22.5), 1);
    connect(c, pal.ink, poly(cx, cy, 19, 4, 67.5), 1);
    circle(c, pal.hi, cx, cy, 12);
    nodes(c, pal, [...a, ...b]);
    arrowsIn(c, pal, cx, cy);
  }
}

/**
 * Magic circle, 96×96, round (squash it on placement): double outer ring, a band of 32 rune slots,
 * an inner polygram with nodes on its points and a central sigil. Each frame the band moves one slot
 * and the lit quarter steps on, so frame 4 equals frame 0.
 */
function runeCircle(c: Ctx, f: number, ox: number, pal: RunePalette, geom: Geometry): void {
  const cx = ox + RUNE / 2, cy = RUNE / 2;
  circle(c, pal.main, cx, cy, 46);
  circle(c, pal.hi, cx, cy, 45);
  circle(c, pal.main, cx, cy, 43);
  circle(c, pal.main, cx, cy, 35);
  circle(c, pal.ink, cx, cy, 33, 2);
  const [ga, gb] = GLYPH_PAIR[geom];
  for (let s = 0; s < SLOTS; s++) {
    const kind = (((s - f) % 4) + 4) % 4;
    const lit = Math.floor(s / (SLOTS / RUNE_FRAMES)) === f;
    const a = (s / SLOTS) * Math.PI * 2 - Math.PI / 2;
    const gx = cx + Math.cos(a) * 39, gy = cy + Math.sin(a) * 39;
    if (kind === 1) line(c, lit ? pal.hi : pal.main, cx + Math.cos(a) * 37, cy + Math.sin(a) * 37, cx + Math.cos(a) * 41, cy + Math.sin(a) * 41);
    else if (kind === 3) p(c, lit ? pal.white : pal.main, gx, gy);
    else {
      const glyph = GLYPHS[kind === 0 ? ga : gb];
      const color = lit ? pal.white : pal.hi;
      glyph.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') p(c, color, Math.round(gx) - 1 + x, Math.round(gy) - 2 + y); }));
    }
  }
  innerGeometry(c, pal, geom, cx, cy);
}

/** Stable per-pixel noise in [0, 1). */
function noise(x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997 / 997;
}

const SPRAY = 14;

/**
 * Impact burst, 48×48, 6 frames, white so it can be tinted. Points +x (rotate to the hit direction):
 * solid disc → disc breaking into spray → thin crescent with a spray tail → dotted ring fading.
 */
function impactBurst(c: Ctx, f: number, ox: number): void {
  const cx = ox + 24, cy = 24;
  const disc = (rad: number, hole: number) => {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d = Math.hypot(x, y);
      if (d > rad || noise(x + 40, y + f * 9) < hole * (d / rad)) continue;
      p(c, d > rad - 1.5 ? G1 : W, cx + x, cy + y);
    }
  };
  const spray = (r0: number, r1: number, dash: number, color: string) => {
    for (let k = 0; k < SPRAY; k++) {
      const a = (k / SPRAY) * Math.PI * 2 + noise(k, 3) * 0.3;
      const fwd = Math.max(0, Math.cos(a));
      const end = r1 + fwd * 6 - noise(k, 7) * 3;
      for (let rr = r0; rr <= end; rr += 1) {
        if (dash > 1 && Math.floor(rr) % dash === 0) continue;
        p(c, rr > end - 1.5 ? color : W, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    }
  };
  if (f === 0) disc(7, 0);
  else if (f === 1) { disc(10, 0.55); spray(9, 14, 1, G1); }
  else if (f === 2) { disc(4, 0.3); spray(7, 18, 3, G2); }
  else if (f === 3) {
    circle(c, W, cx, cy, 16, 1, (a) => Math.cos(a) > -0.6);
    circle(c, G1, cx, cy, 15, 1, (a) => Math.cos(a) > 0.2);
    spray(18, 21, 2, G2);
  } else if (f === 4) {
    circle(c, G1, cx, cy, 19, 1, (a) => noise(Math.round(a * 20), 5) > 0.3);
    spray(21, 22, 2, G3);
  } else circle(c, G2, cx, cy, 21, 3);
}

/** Converging arrows, 64×64, 4 frames: twelve chevrons pointing inward, stepping closer each frame. */
function pullArrows(c: Ctx, f: number, ox: number): void {
  const cx = ox + 32, cy = 32;
  const ra = 28 - f * 4;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + (k % 2 ? 0.12 : 0);
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const tx = cx + ux * ra, ty = cy + uy * ra;
    line(c, G1, tx, ty, tx + ux * 3 + vx * 2.4, ty + uy * 3 + vy * 2.4);
    line(c, G1, tx, ty, tx + ux * 3 - vx * 2.4, ty + uy * 3 - vy * 2.4);
    p(c, W, tx, ty);
    for (const [d, col] of [[3, W], [5, G1], [7, G2]] as const) if (ra + d < 31) p(c, col, tx + ux * d, ty + uy * d);
  }
}

/** Crescent swirl, 48×48, 4 frames: three tapering arcs spiralling in, 30° per frame (one 120° step per loop). */
function swirl(c: Ctx, f: number, ox: number): void {
  const cx = ox + 24, cy = 24;
  for (let arm = 0; arm < 3; arm++) {
    const a0 = ((arm * 120 + f * 30) * Math.PI) / 180;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = a0 + t * 2.0;
      const rad = 21 - t * 11;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      const color = t < 0.25 ? W : t < 0.6 ? G1 : G2;
      p(c, color, x, y);
      if (t < 0.55) p(c, t < 0.3 ? G1 : G2, cx + Math.cos(a) * (rad - 1), cy + Math.sin(a) * (rad - 1));
    }
  }
}

/** Spiky radial burst, 32×32, 4 frames: spikes shoot out, thin, and leave only their tips. */
function spikeBurst(c: Ctx, f: number, ox: number): void {
  const cx = ox + 16, cy = 16;
  const long = [6, 11, 14, 15][f], short = [3, 6, 9, 10][f];
  const from = [0, 2, 7, 12][f];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const len = k % 2 ? short : long;
    for (let rr = Math.min(from, len - 1); rr <= len; rr++) {
      const t = rr / len;
      p(c, t > 0.8 ? W : f >= 2 ? G2 : G1, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
  }
  if (f < 2) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) <= 2.4 - f) p(c, W, cx + x, cy + y);
}

function strip(scene: Phaser.Scene, key: string, w: number, h: number, frames: number, draw: (c: Ctx, f: number, ox: number) => void, linear = false): void {
  if (scene.textures.exists(key)) return;
  const el = document.createElement('canvas');
  el.width = w * frames;
  el.height = h;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  for (let f = 0; f < frames; f++) draw(c, f, f * w);
  const tex = scene.textures.addSpriteSheet(key, el as unknown as HTMLImageElement, { frameWidth: w, frameHeight: h });
  // Circles are drawn at 96 px and shown smaller: linear sampling keeps their 1-px lines instead of dropping rows.
  if (linear) tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

const RUNES: [string, Geometry, RunePalette][] = [
  ['rune_ember', 'star', { ink: '#a8341e', main: '#f08a3a', hi: '#ffd27a', white: '#fff6e0' }],
  ['rune_ward', 'hexagram', { ink: '#2b7f88', main: '#5fd0d8', hi: '#b8f4f6', white: '#ffffff' }],
  ['rune_lode', 'squares', { ink: '#6f4fa6', main: '#b48ae6', hi: '#e8d8ff', white: '#ffffff' }],
  ['rune_arc', 'star', { ink: '#2f4fa8', main: '#6f9cff', hi: '#cfe0ff', white: '#ffffff' }],
  ['rune_crush', 'star', { ink: '#9a2038', main: '#e8506a', hi: '#ffc0cc', white: '#ffffff' }],
  ['rune_acid', 'star', { ink: '#1e7a56', main: '#3fd49a', hi: '#c4ffe4', white: '#ffffff' }],
  ['rune_ember_w', 'star', PLAIN],
  ['rune_ward_w', 'hexagram', PLAIN],
  ['rune_lode_w', 'squares', PLAIN],
];

export function buildRuneArt(scene: Phaser.Scene): void {
  for (const [key, geom, pal] of RUNES) strip(scene, key, RUNE, RUNE, RUNE_FRAMES, (c, f, ox) => runeCircle(c, f, ox, pal, geom), true);
  strip(scene, 'impact_burst', 48, 48, 6, impactBurst);
  strip(scene, 'pull_arrows', 64, 64, 4, pullArrows);
  strip(scene, 'swirl', 48, 48, 4, swirl);
  strip(scene, 'spike_burst', 32, 32, 4, spikeBurst);

  const anim = (key: string, tex: string, frames: number, rate: number, repeat = -1) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { start: 0, end: frames - 1 }), frameRate: rate, repeat });
  };
  anim('rune-ember-spin', 'rune_ember', 4, 12);
  anim('rune-ward-spin', 'rune_ward', 4, 10);
  anim('rune-lode-spin', 'rune_lode', 4, 10);
  anim('rune-arc-spin', 'rune_arc', 4, 14);
  anim('rune-crush-spin', 'rune_crush', 4, 10);
  anim('rune-acid-spin', 'rune_acid', 4, 12);
  anim('rune-ember-w-spin', 'rune_ember_w', 4, 10);
  anim('rune-ward-w-spin', 'rune_ward_w', 4, 10);
  anim('rune-lode-w-spin', 'rune_lode_w', 4, 10);
  anim('impact-burst', 'impact_burst', 6, 24, 0);
  anim('pull-arrows', 'pull_arrows', 4, 16);
  anim('swirl-spin', 'swirl', 4, 18);
  anim('spike-burst', 'spike_burst', 4, 14, 0);
}
