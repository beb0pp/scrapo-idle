import Phaser from 'phaser';
import { iconUrls } from './sprites';
import { buildRuneArt } from './runeArt';
import { SKILL_NODES, type NodeId, type SpellId } from '../data/ferromancy';

// Original Ferromancia pixel art, painted by code in the game's 16-bit palette (see docs/CREDITOS.md).

type Ctx = CanvasRenderingContext2D;

const K = '#14121e';
const IRON = '#2a2d38';
const STEEL = '#4a5468';
const STEEL_HI = '#7b8aa3';
const COPPER = '#d7833b';
const RUST = '#a8481e';
const CYAN = '#5fd0d8';
const CYAN_HI = '#b8f4f6';
const ETHER = '#b48ae6';
const ETHER_DK = '#6f4fa6';
const ETHER_HI = '#e8d8ff';
const EMBER = '#f08a3a';
const EMBER_HI = '#ffd27a';
const EMBER_DK = '#a8341e';
const WHITE = '#ffffff';
const WOOD = '#8b6340';
const WOOD_HI = '#c08a55';
const WOOD_DK = '#5a3d26';
const COPPER_HI = '#f0a860';
const GLASS = '#3a3f52';

function r(c: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function px(c: Ctx, color: string, pts: [number, number][]): void {
  c.fillStyle = color;
  for (const [x, y] of pts) c.fillRect(x, y, 1, 1);
}

function canvas(w: number, h: number, draw: (c: Ctx) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  draw(c);
  return el;
}

/** A horizontal strip of frames registered as a spritesheet. */
function strip(scene: Phaser.Scene, key: string, w: number, h: number, frames: number, draw: (c: Ctx, f: number, ox: number) => void): void {
  if (scene.textures.exists(key)) return;
  const el = canvas(w * frames, h, (c) => {
    for (let f = 0; f < frames; f++) draw(c, f, f * w);
  });
  scene.textures.addSpriteSheet(key, el as unknown as HTMLImageElement, { frameWidth: w, frameHeight: h });
}

// ---------------- item icons (16×16) ----------------

function etherShard(c: Ctx): void {
  r(c, K, 6, 1, 4, 14); r(c, K, 4, 4, 8, 9); r(c, K, 3, 6, 10, 5);
  r(c, ETHER_DK, 5, 5, 6, 7); r(c, ETHER_DK, 7, 2, 2, 12); r(c, ETHER_DK, 4, 7, 8, 3);
  r(c, ETHER, 7, 3, 2, 9); r(c, ETHER, 5, 6, 3, 4);
  r(c, ETHER_HI, 7, 3, 1, 5); r(c, ETHER_HI, 5, 7, 1, 2);
  px(c, WHITE, [[7, 4], [12, 2], [13, 3], [2, 12]]);
}

function vial(c: Ctx, liquid: string, hi: string, dark: string): void {
  r(c, K, 6, 1, 4, 2); r(c, '#8b6340', 7, 1, 2, 1);
  r(c, K, 5, 3, 6, 2); r(c, '#cfd6e2', 6, 3, 4, 1);
  r(c, K, 3, 5, 10, 10); r(c, K, 4, 15, 8, 1);
  r(c, '#3a3f52', 4, 6, 8, 8);
  r(c, dark, 4, 9, 8, 5); r(c, liquid, 4, 9, 8, 3); r(c, hi, 5, 9, 3, 1);
  r(c, '#cfd6e2', 5, 6, 1, 3);
}

function etherCrystal(c: Ctx): void {
  r(c, K, 5, 0, 6, 16); r(c, K, 3, 3, 10, 11); r(c, K, 2, 6, 12, 5);
  r(c, ETHER_DK, 4, 4, 8, 9); r(c, ETHER_DK, 6, 1, 4, 14);
  r(c, ETHER, 6, 2, 4, 11); r(c, ETHER, 4, 6, 3, 4);
  r(c, CYAN, 9, 4, 2, 7); r(c, CYAN_HI, 9, 5, 1, 3);
  r(c, ETHER_HI, 6, 2, 1, 7); r(c, ETHER_HI, 4, 7, 1, 2);
  px(c, WHITE, [[6, 3], [1, 2], [14, 4], [13, 13], [2, 13]]);
}

const ICONS: Record<'ether_shard' | 'reagent_ember' | 'reagent_ward' | 'reagent_lodestone' | 'ether_crystal' | 'mana_flask', (c: Ctx) => void> = {
  ether_crystal: etherCrystal,
  mana_flask: (c) => { vial(c, '#6fa8ff', CYAN_HI, ETHER_DK); px(c, ETHER_HI, [[6, 12], [9, 11], [8, 13]]); },
  ether_shard: etherShard,
  reagent_ember: (c) => { vial(c, EMBER, EMBER_HI, EMBER_DK); px(c, EMBER_HI, [[9, 12], [7, 13]]); },
  reagent_ward: (c) => {
    vial(c, '#7b8aa3', CYAN_HI, '#4a5468');
    px(c, CYAN, [[6, 11], [9, 10], [10, 12], [7, 13]]);
  },
  reagent_lodestone: (c) => {
    vial(c, ETHER, ETHER_HI, ETHER_DK);
    px(c, '#2a2d38', [[6, 11], [8, 12], [10, 11], [9, 13]]);
  },
};

// ---------------- spell icons (16×16) ----------------
// Luminous style: dark tile, a soft glow pooled behind the art, a bright silhouette in one hue family.

interface IconPal { bg: [string, string, string]; ink: string; mid: string; hi: string; white: string }
/** 0 empty, 2 mid, 3 highlight, 4 white. */
type Shape = (x: number, y: number) => number;

const ICON_PAL: Record<SpellId, IconPal> = {
  spell_ember: { bg: ['#140c12', '#33161a', '#5c2418'], ink: '#a8341e', mid: EMBER, hi: EMBER_HI, white: '#fff6e0' },
  spell_ward: { bg: ['#0a1218', '#123038', '#1c5058'], ink: '#2b7f88', mid: CYAN, hi: CYAN_HI, white: WHITE },
  spell_lodestone: { bg: ['#0f0a1a', '#24163e', '#3a2466'], ink: ETHER_DK, mid: ETHER, hi: ETHER_HI, white: WHITE },
  spell_haste: { bg: ['#141008', '#2e2410', '#4e3c14'], ink: '#a07a1a', mid: '#e0b33a', hi: '#fff2b0', white: WHITE },
  spell_net: { bg: ['#140a18', '#301634', '#4e2252'], ink: '#8a3a90', mid: '#d878e0', hi: '#f8c8f4', white: WHITE },
  spell_harvest: { bg: ['#0a1408', '#183012', '#24501a'], ink: '#4a8a2a', mid: '#9fd86a', hi: '#e8ffc8', white: WHITE },
  spell_arc: { bg: ['#080c18', '#121e3c', '#1c3066'], ink: '#2f4fa8', mid: '#6f9cff', hi: '#cfe0ff', white: WHITE },
  spell_crush: { bg: ['#160810', '#341220', '#5a1a30'], ink: '#9a2038', mid: '#e8506a', hi: '#ffc0cc', white: WHITE },
  spell_acid: { bg: ['#08140f', '#10301f', '#185034'], ink: '#1e7a56', mid: '#3fd49a', hi: '#c4ffe4', white: WHITE },
};

function luminous(c: Ctx, pal: IconPal, glow: [number, number, number], shape: Shape, outline = true, sparks: [number, number, number][] = []): void {
  const [gx, gy, gr] = glow;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / gr;
    let band = d < 0.45 ? 2 : d < 0.85 ? 1 : 0;
    if (band < 2 && d < (band ? 0.53 : 0.93) && (x + y) % 2 === 0) band++;
    r(c, pal.bg[band], x, y, 1, 1);
  }
  const levels = [pal.bg[0], pal.ink, pal.mid, pal.hi, pal.white];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : shape(x, y));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = at(x, y);
    if (k) r(c, levels[k], x, y, 1, 1);
    else if (outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) r(c, pal.ink, x, y, 1, 1);
  }
  for (const [x, y, k] of sparks) r(c, levels[k], x, y, 1, 1);
}

/** Ember lance: a comet streaking up-right, white-hot at the head. */
const emberShape: Shape = (x, y) => {
  const tx = 2.5, ty = 13.5, hx = 11.5, hy = 4.5;
  const vx = hx - tx, vy = hy - ty;
  const t = Math.max(0, Math.min(1, ((x + 0.5 - tx) * vx + (y + 0.5 - ty) * vy) / (vx * vx + vy * vy)));
  const dist = Math.hypot(x + 0.5 - (tx + vx * t), y + 0.5 - (ty + vy * t));
  const rad = 0.55 + t * 2.3;
  if (dist > rad) return 0;
  return dist < rad * 0.45 && t > 0.5 ? 4 : dist < rad * 0.75 && t > 0.25 ? 3 : 2;
};

/** Ward: a shield with a bright rim and a white rune cross. */
const wardShape: Shape = (x, y) => {
  if (y < 2 || y > 14) return 0;
  const dx = Math.abs(x - 7.5);
  const hw = y <= 8 ? 5.5 : 5.5 - (y - 8) * 0.9;
  if (dx > hw) return 0;
  if ((dx < 1 && y >= 4 && y <= 11) || (y === 6 && dx < 3.6)) return 4;
  return dx > hw - 1 || y === 2 ? 3 : 2;
};

/** Lodestone: a horseshoe magnet with white-hot poles. */
const lodeShape: Shape = (x, y) => {
  const dx = Math.abs(x - 7.5);
  const d = Math.hypot(x - 7.5, y - 7);
  const arc = y <= 7 && d >= 2 && d <= 5.2;
  const leg = y > 7 && y <= 13 && dx >= 2 && dx <= 5;
  if (!arc && !leg) return 0;
  if (leg && y >= 12) return 4;
  if (leg && y === 11) return 3;
  return arc && d > 4 && y < 6 ? 3 : 2;
};

const BOLT: [number, number][] = [[9, 0.5], [3.5, 8.5], [7, 8.5], [5, 15.5], [12.5, 6], [8.8, 6], [11.5, 0.5]];

function inPoly(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Haste: a lightning bolt, white at its thick core. */
const hasteShape: Shape = (x, y) => {
  const at = (u: number, v: number) => inPoly(u + 0.5, v + 0.5, BOLT);
  if (!at(x, y)) return 0;
  return at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1) ? 4 : 3;
};

/** Net: a round diagonal mesh with glowing knots. */
const netShape: Shape = (x, y) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 6.9) return 0;
  if (d > 5.9) return 3;
  const a = (x + y) % 4 === 0, b = (x - y + 16) % 4 === 0;
  if (a && b) return d < 3 ? 4 : 3;
  return a || b ? 2 : 0;
};

/** Harvest: a spiky green burst springing from a scrap pile. */
const harvestShape: Shape = (x, y) => {
  const px0 = x + 0.5 - 8, py0 = y + 0.5 - 6.5;
  const d = Math.hypot(px0, py0);
  const a = Math.atan2(py0, px0);
  const k = Math.round(a / (Math.PI / 4));
  const off = Math.abs(a - k * (Math.PI / 4)) * d;
  const len = k % 2 ? 4.6 : 6.2;
  if (d < 2.3) return 4;
  if (d <= len && off < 0.75 && y < 12) return d > len - 1.6 ? 2 : 3;
  const e = ((x + 0.5 - 8) / 6) ** 2 + ((y + 0.5 - 15.5) / 3.2) ** 2;
  if (y >= 12 && e <= 1) return y === 12 ? 3 : 2;
  return 0;
};

function segDist(px0: number, py0: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px0 - ax) * vx + (py0 - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px0 - (ax + vx * t), py0 - (ay + vy * t));
}

const ARC_PATH: [number, number][] = [[2.5, 2.5], [6, 5], [4.5, 7.5], [8.5, 9], [10.5, 6.5], [13.5, 8.5], [11, 11], [13.5, 13.5]];
const ARC_NODES: [number, number][] = [[2.5, 2.5], [8.5, 9], [13.5, 13.5]];

/** Chain arc: a jagged bolt jumping between three white-hot nodes. */
const arcShape: Shape = (x, y) => {
  const cx = x + 0.5, cy = y + 0.5;
  if (ARC_NODES.some(([nx, ny]) => Math.hypot(cx - nx, cy - ny) < 1.3)) return 4;
  if (ARC_NODES.some(([nx, ny]) => Math.hypot(cx - nx, cy - ny) < 2.3)) return 3;
  let d = Infinity;
  for (let i = 1; i < ARC_PATH.length; i++) d = Math.min(d, segDist(cx, cy, ARC_PATH[i - 1], ARC_PATH[i]));
  return d < 0.55 ? 3 : d < 1.05 ? 2 : 0;
};

/** Crush: two magnet jaws squeezing a white-hot block. */
const crushShape: Shape = (x, y) => {
  if (x >= 6 && x <= 9 && y >= 6 && y <= 9) return x >= 7 && x <= 8 && y >= 7 && y <= 8 ? 4 : 3;
  const jaw = (u: number) => {
    if (u <= 1 && y >= 3 && y <= 12) return u === 1 && (y === 3 || y === 12) ? 4 : 2;
    if (u >= 2 && u <= 3 && (y === 3 || y === 12)) return 3;
    if (u === 4 && y >= 6 && y <= 9) return 3;
    return 0;
  };
  return x <= 4 ? jaw(x) : x >= 11 ? jaw(15 - x) : 0;
};

/** Acid: a falling drop over the puddle it leaves. */
const acidShape: Shape = (x, y) => {
  const cx = x + 0.5, cy = y + 0.5;
  const body = Math.hypot(cx - 8, cy - 7.5) <= 3.8;
  const tip = cy >= 1 && cy < 7.5 && Math.abs(cx - 8) <= (cy - 1) * 0.55;
  if (body || tip) {
    if (Math.hypot(cx - 6.6, cy - 6.4) < 1.2) return 4;
    return Math.hypot(cx - 7, cy - 6.5) < 2.6 ? 3 : 2;
  }
  const pool = ((cx - 8) / 6.5) ** 2 + ((cy - 14) / 1.6) ** 2;
  if (pool <= 1) return cy < 13.5 ? 3 : 2;
  return 0;
};

const SPELL_ICONS: Record<SpellId, (c: Ctx) => void> = {
  spell_ember: (c) => luminous(c, ICON_PAL.spell_ember, [10.5, 5.5, 8], emberShape, true, [[14, 1, 3], [13, 8, 2], [8, 2, 2], [1, 15, 2]]),
  spell_ward: (c) => luminous(c, ICON_PAL.spell_ward, [8, 8, 8.5], wardShape, true, [[1, 1, 3], [14, 2, 2], [14, 13, 3]]),
  spell_lodestone: (c) => luminous(c, ICON_PAL.spell_lodestone, [8, 9, 8], lodeShape, true, [[7, 11, 3], [8, 10, 4], [7, 14, 2], [1, 2, 2], [14, 1, 3]]),
  spell_haste: (c) => luminous(c, ICON_PAL.spell_haste, [8, 8, 8], hasteShape, true,
    [[0, 4, 2], [1, 4, 2], [2, 4, 3], [0, 10, 2], [1, 10, 3], [12, 11, 2], [13, 11, 2], [14, 11, 3], [14, 3, 3]]),
  spell_net: (c) => luminous(c, ICON_PAL.spell_net, [8, 8, 8.5], netShape, false, [[0, 1, 3], [15, 14, 3]]),
  spell_harvest: (c) => luminous(c, ICON_PAL.spell_harvest, [8, 7, 8], harvestShape, true, [[1, 2, 3], [14, 3, 2], [2, 10, 2]]),
  spell_arc: (c) => luminous(c, ICON_PAL.spell_arc, [8, 8, 8.5], arcShape, true, [[14, 2, 3], [1, 12, 2], [15, 5, 2]]),
  spell_crush: (c) => luminous(c, ICON_PAL.spell_crush, [8, 8, 8], crushShape, true, [[7, 1, 3], [8, 14, 2], [12, 0, 2]]),
  spell_acid: (c) => luminous(c, ICON_PAL.spell_acid, [8, 9, 8], acidShape, true, [[3, 9, 3], [13, 10, 2], [12, 3, 2]]),
};

export const spellIconUrls: Partial<Record<SpellId, string>> = {};

// ---------------- tree node icons (16×16) ----------------

const NODE_ICONS: Partial<Record<NodeId, (c: Ctx) => void>> = {
  b_workshop: (c) => {
    r(c, K, 1, 4, 13, 5); r(c, K, 0, 5, 2, 2);
    r(c, STEEL, 2, 5, 11, 3); r(c, STEEL_HI, 2, 5, 11, 1);
    r(c, K, 5, 9, 6, 3); r(c, IRON, 6, 9, 4, 2);
    r(c, K, 3, 12, 10, 3); r(c, STEEL, 4, 12, 8, 2); r(c, IRON, 4, 13, 8, 1);
    px(c, EMBER_HI, [[12, 1], [10, 2], [14, 3]]); px(c, EMBER, [[11, 0], [13, 2]]);
  },
  b_bench_tools: (c) => {
    r(c, K, 1, 9, 14, 4); r(c, WOOD_HI, 2, 10, 12, 1); r(c, WOOD, 2, 11, 12, 1);
    r(c, K, 2, 13, 3, 3); r(c, K, 11, 13, 3, 3); r(c, WOOD_DK, 3, 13, 1, 2); r(c, WOOD_DK, 12, 13, 1, 2);
    for (let i = 0; i < 6; i++) r(c, K, 3 + i, 7 - i, 3, 3);
    for (let i = 0; i < 6; i++) r(c, STEEL_HI, 4 + i, 7 - i, 1, 1);
    r(c, K, 9, 0, 6, 5); r(c, STEEL, 10, 1, 4, 3); r(c, STEEL_HI, 10, 1, 4, 1); r(c, K, 12, 0, 1, 2);
  },
  b_bench_modules: (c) => {
    for (const i of [5, 8, 10]) { r(c, COPPER, i, 1, 1, 2); r(c, COPPER, i, 13, 1, 2); r(c, COPPER, 1, i, 2, 1); r(c, COPPER, 13, i, 2, 1); }
    r(c, K, 3, 3, 10, 10); r(c, IRON, 4, 4, 8, 8); r(c, STEEL, 5, 5, 6, 6); r(c, STEEL_HI, 5, 5, 6, 1);
    r(c, K, 6, 6, 4, 4); r(c, CYAN, 7, 7, 2, 2); px(c, CYAN_HI, [[7, 7]]);
  },
  b_drone_servos: (c) => {
    r(c, K, 1, 1, 14, 2); r(c, STEEL_HI, 2, 1, 12, 1); r(c, K, 7, 3, 2, 2);
    r(c, K, 3, 7, 11, 5); r(c, K, 6, 4, 5, 11); r(c, K, 4, 5, 9, 9);
    r(c, STEEL, 5, 6, 7, 7); r(c, STEEL, 4, 8, 9, 3); r(c, STEEL, 7, 5, 3, 9);
    r(c, STEEL_HI, 5, 6, 3, 1); r(c, IRON, 9, 11, 3, 1);
    r(c, K, 7, 8, 3, 3); r(c, COPPER, 8, 9, 1, 1);
  },
  b_drone_bay: (c) => {
    r(c, K, 1, 7, 14, 8); r(c, WOOD, 2, 8, 12, 6); r(c, WOOD_HI, 2, 8, 12, 1);
    r(c, K, 2, 11, 12, 1); r(c, WOOD_DK, 5, 9, 1, 5); r(c, WOOD_DK, 10, 9, 1, 5);
    r(c, K, 2, 0, 4, 2); r(c, K, 10, 0, 4, 2); r(c, STEEL_HI, 3, 0, 2, 1); r(c, STEEL_HI, 11, 0, 2, 1);
    r(c, K, 5, 1, 6, 5); r(c, STEEL, 6, 2, 4, 3); r(c, STEEL_HI, 6, 2, 4, 1); r(c, CYAN, 7, 4, 2, 1);
  },
  b_alchemy: (c) => {
    for (let a = 0; a < 360; a += 10) {
      const t = (a * Math.PI) / 180;
      r(c, a % 90 === 0 ? ETHER : ETHER_DK, Math.round(7.5 + Math.cos(t) * 7), Math.round(7.5 + Math.sin(t) * 7), 1, 1);
    }
    r(c, K, 6, 3, 4, 3); r(c, WOOD, 7, 3, 2, 1);
    r(c, K, 4, 6, 8, 7); r(c, GLASS, 5, 7, 6, 5); r(c, CYAN, 5, 9, 6, 3); r(c, CYAN_HI, 6, 9, 2, 1); r(c, '#cfd6e2', 5, 7, 1, 2);
  },
  b_alembic: (c) => {
    r(c, K, 1, 7, 8, 8); r(c, COPPER, 2, 8, 6, 6); r(c, COPPER_HI, 3, 8, 2, 2); r(c, RUST, 2, 12, 6, 2);
    r(c, K, 3, 3, 4, 5); r(c, COPPER, 4, 4, 2, 3);
    r(c, K, 6, 3, 8, 2); r(c, STEEL_HI, 7, 3, 6, 1);
    r(c, K, 12, 4, 2, 7); r(c, STEEL_HI, 12, 5, 1, 5);
    r(c, K, 10, 10, 6, 6); r(c, GLASS, 11, 11, 4, 4); r(c, ETHER, 11, 12, 4, 3); px(c, ETHER_HI, [[11, 12]]);
  },
  s_cmb_arm: (c) => {
    r(c, K, 3, 3, 10, 9); r(c, COPPER, 4, 4, 8, 7); r(c, COPPER_HI, 4, 4, 8, 1);
    r(c, RUST, 6, 4, 1, 3); r(c, RUST, 8, 4, 1, 3); r(c, RUST, 10, 4, 1, 3); r(c, RUST, 4, 9, 8, 2);
    r(c, K, 1, 7, 4, 4); r(c, COPPER, 2, 8, 2, 2);
    r(c, K, 5, 12, 6, 4); r(c, STEEL, 6, 12, 4, 3); r(c, STEEL_HI, 6, 12, 4, 1);
  },
  s_cmb_dash: (c) => {
    r(c, STEEL_HI, 0, 4, 6, 1); r(c, STEEL, 1, 8, 4, 1); r(c, STEEL_HI, 0, 11, 5, 1);
    r(c, K, 4, 7, 5, 3); r(c, CYAN, 5, 8, 4, 1);
    for (let i = 0; i < 6; i++) r(c, K, 8 + i, 2 + i, 1, 13 - 2 * i);
    for (let i = 0; i < 5; i++) r(c, CYAN, 9 + i, 4 + i, 1, 9 - 2 * i);
    r(c, CYAN_HI, 9, 6, 1, 5); px(c, WHITE, [[14, 8]]);
  },
  s_cmb_fury: (c) => {
    r(c, K, 7, 0, 2, 2); r(c, K, 5, 2, 6, 3); r(c, K, 3, 5, 10, 10); r(c, K, 4, 15, 8, 1);
    r(c, EMBER_DK, 6, 3, 4, 2); r(c, EMBER_DK, 4, 6, 8, 9);
    r(c, EMBER, 5, 6, 6, 7); r(c, EMBER, 7, 1, 1, 4);
    r(c, EMBER_HI, 6, 9, 4, 4); r(c, ETHER_HI, 7, 10, 2, 2); px(c, WHITE, [[7, 10]]);
    px(c, ETHER, [[1, 4], [14, 6], [2, 12], [13, 13]]);
  },
  s_ext_eye: (c) => {
    r(c, K, 1, 6, 14, 5); r(c, K, 3, 4, 10, 2); r(c, K, 3, 11, 10, 2);
    r(c, '#e6e9f0', 2, 7, 12, 3); r(c, '#e6e9f0', 4, 5, 8, 6);
    r(c, K, 5, 5, 6, 6); r(c, CYAN, 6, 5, 4, 6); r(c, '#2b7f88', 6, 9, 4, 2);
    r(c, K, 7, 7, 2, 2); px(c, WHITE, [[6, 6]]);
    px(c, K, [[2, 3], [7, 2], [13, 3]]);
  },
  s_ext_hands: (c) => {
    r(c, K, 3, 1, 3, 6); r(c, K, 6, 0, 3, 7); r(c, K, 9, 1, 3, 6); r(c, K, 12, 5, 3, 5);
    r(c, K, 3, 5, 10, 9);
    r(c, WOOD, 4, 2, 1, 4); r(c, WOOD, 7, 1, 1, 5); r(c, WOOD, 10, 2, 1, 4); r(c, WOOD, 13, 6, 1, 3);
    r(c, WOOD, 4, 6, 8, 7); r(c, WOOD_HI, 4, 6, 8, 1); r(c, WOOD_DK, 4, 11, 8, 2);
    r(c, K, 3, 13, 10, 3); r(c, COPPER, 4, 13, 8, 2);
    px(c, CYAN_HI, [[1, 3], [0, 6], [14, 1]]);
  },
  s_ext_magnet: (c) => {
    r(c, K, 2, 2, 5, 12); r(c, K, 9, 2, 5, 12); r(c, K, 2, 9, 12, 5);
    r(c, STEEL_HI, 3, 3, 3, 3); r(c, STEEL_HI, 10, 3, 3, 3);
    r(c, RUST, 3, 6, 3, 7); r(c, RUST, 10, 6, 3, 7); r(c, RUST, 3, 10, 10, 3);
    r(c, EMBER, 3, 6, 1, 6); r(c, EMBER, 4, 10, 8, 1);
    px(c, CYAN_HI, [[7, 1], [8, 3], [1, 0], [14, 0]]);
  },
  s_mag_channel: (c) => {
    const pts: [number, number][] = [];
    for (let t = 0; t < Math.PI * 5; t += 0.12) pts.push([Math.round(7.5 + Math.cos(t) * t * 0.44), Math.round(7.5 + Math.sin(t) * t * 0.44)]);
    px(c, K, pts.map(([x, y]) => [x + 1, y + 1]));
    px(c, ETHER, pts);
    px(c, ETHER_HI, pts.slice(0, 18));
    px(c, WHITE, [[8, 8]]);
  },
};

export const nodeIconUrls: Partial<Record<NodeId, string>> = {};

// ---------------- world textures ----------------

function etherVein(c: Ctx, f: number, ox: number): void {
  r(c, K, ox + 2, 15, 14, 4); r(c, '#3b3348', ox + 3, 16, 12, 2);
  const crystal = (x: number, h: number, w: number) => {
    r(c, K, ox + x - 1, 17 - h, w + 2, h); r(c, ETHER_DK, ox + x, 18 - h, w, h - 2);
    r(c, ETHER, ox + x, 18 - h, Math.max(1, w - 1), h - 4); r(c, ETHER_HI, ox + x, 18 - h, 1, Math.max(1, h - 6));
  };
  crystal(4, 9, 3); crystal(8, 15, 4); crystal(12, 7, 3);
  if (f === 1) px(c, WHITE, [[ox + 9, 4], [ox + 13, 11], [ox + 5, 9]]);
  else px(c, ETHER_HI, [[ox + 10, 6], [ox + 4, 12]]);
}

/** Cobalto, 20×24, faces right. Frames: idle 0-1, walk 2-3, cast 4, asleep 5. */
function cobalto(c: Ctx, f: number, ox: number): void {
  const asleep = f === 5;
  const bob = f === 1 || f === 3 ? 1 : 0;
  const eye = asleep ? '#3a3f52' : f === 4 ? WHITE : CYAN;
  const y0 = asleep ? 6 : bob;
  // legs
  if (!asleep) {
    const step = f === 2 ? -1 : f === 3 ? 1 : 0;
    r(c, K, ox + 5 + step, 18, 4, 6); r(c, IRON, ox + 6 + step, 18, 2, 4);
    r(c, K, ox + 11 - step, 18, 4, 6); r(c, IRON, ox + 12 - step, 18, 2, 4);
    r(c, K, ox + 4 + step, 22, 6, 2); r(c, K, ox + 10 - step, 22, 6, 2);
  } else {
    r(c, K, ox + 3, 21, 14, 3); r(c, IRON, ox + 4, 22, 12, 1);
  }
  // torso: riveted cobalt plate with an ether rune core
  r(c, K, ox + 3, y0 + 8, 14, 11); r(c, '#2f4f8a', ox + 4, y0 + 9, 12, 9); r(c, '#4a74b8', ox + 4, y0 + 9, 12, 3);
  r(c, K, ox + 8, y0 + 12, 4, 4); r(c, asleep ? ETHER_DK : ETHER, ox + 9, y0 + 13, 2, 2);
  if (!asleep) px(c, ETHER_HI, [[ox + 9, y0 + 13]]);
  px(c, COPPER, [[ox + 5, y0 + 10], [ox + 14, y0 + 10], [ox + 5, y0 + 16], [ox + 14, y0 + 16]]);
  // arms; the cast frame raises the right arm with a rune spark
  r(c, K, ox + 1, y0 + 9, 3, 8); r(c, STEEL, ox + 2, y0 + 10, 1, 6);
  if (f === 4) {
    r(c, K, ox + 16, y0 + 3, 3, 8); r(c, STEEL, ox + 17, y0 + 4, 1, 6);
    px(c, ETHER_HI, [[ox + 17, y0 + 1], [ox + 18, y0 + 2], [ox + 16, y0 + 2]]);
  } else {
    r(c, K, ox + 16, y0 + 9, 3, 8); r(c, STEEL, ox + 17, y0 + 10, 1, 6);
  }
  // head: lantern-like visor
  r(c, K, ox + 5, y0 + 1, 10, 8); r(c, STEEL, ox + 6, y0 + 2, 8, 6); r(c, STEEL_HI, ox + 6, y0 + 2, 8, 2);
  r(c, K, ox + 8, y0 + 4, 6, 3); r(c, eye, ox + 9, y0 + 5, 4, 1);
  r(c, K, ox + 9, y0, 2, 2); r(c, RUST, ox + 9, y0, 1, 1);
  if (asleep) px(c, '#9aa3b8', [[ox + 16, 3], [ox + 17, 1], [ox + 18, 0]]);
}

function emberSpear(c: Ctx, f: number, ox: number): void {
  r(c, EMBER_DK, ox + 0, 3, 6, 2);
  r(c, EMBER, ox + 4, 2, 7, 4);
  r(c, EMBER_HI, ox + 9, 2, 5, 3);
  r(c, WHITE, ox + 13, 3, 3, 1);
  px(c, EMBER_HI, f ? [[ox + 2, 1], [ox + 5, 6]] : [[ox + 1, 6], [ox + 6, 0]]);
}

function runeBolt(c: Ctx, f: number, ox: number): void {
  r(c, ETHER_DK, ox + 1, 2, 6, 4); r(c, ETHER, ox + 2, 1, 4, 6); r(c, ETHER_HI, ox + 3, 2, 2, 4);
  px(c, WHITE, [[ox + (f ? 4 : 3), 3]]);
}

/** Stable per-pixel noise in [0, 1) so painted edges are ragged but identical every build. */
function noise(x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997 / 997;
}

/** Thick ember lance, 24×10, 2 flicker frames. */
function emberLance(c: Ctx, f: number, ox: number): void {
  r(c, EMBER_DK, ox + 0, 4, 8, 2);
  r(c, EMBER_DK, ox + 3, 3, 8, 4);
  r(c, EMBER, ox + 6, 2, 11, 6);
  r(c, EMBER_HI, ox + 11, 3, 9, 4);
  r(c, WHITE, ox + 15, 4, 6, 2);
  r(c, WHITE, ox + 21, 4, 2, 2);
  r(c, EMBER_HI, ox + 20, 3, 1, 4);
  px(c, EMBER_HI, f ? [[ox + 2, 2], [ox + 7, 8], [ox + 12, 1]] : [[ox + 1, 7], [ox + 9, 1], [ox + 13, 8]]);
  px(c, EMBER, f ? [[ox + 0, 6], [ox + 5, 1]] : [[ox + 1, 3], [ox + 4, 8]]);
}

/** Fire burst, 32×32, 5 frames: white core blooms into a ragged fireball, then breaks into embers. */
function fireBurst(c: Ctx, f: number, ox: number): void {
  const outer = [6, 10, 13, 15, 15][f];
  const hollow = [0, 0, 4, 9, 12][f];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, (y - 15.5) * 1.1) + noise(x + f * 7, y) * 3 - 1.5;
      if (d > outer || d < hollow) continue;
      const t = (d - hollow) / Math.max(1, outer - hollow);
      if (f >= 3 && noise(x, y + f * 13) < (f === 3 ? 0.35 : 0.7)) continue;
      const color = f === 4 ? (t > 0.5 ? EMBER_DK : EMBER)
        : t > 0.8 ? EMBER_DK : t > 0.55 ? EMBER : t > 0.25 || f >= 2 ? EMBER_HI : WHITE;
      r(c, color, ox + x, y, 1, 1);
    }
  }
  if (f <= 1) r(c, WHITE, ox + 13, 13, 6, 6);
  if (f >= 2) px(c, EMBER_HI, [[ox + 4, 6], [ox + 27, 9], [ox + 6, 26], [ox + 25, 25], [ox + 15, 2]]);
}

/** Rune shield, 32×32, 6 frames: a segmented hexagon that turns 10° per frame (one 60° symmetry step per loop). */
function wardShield(c: Ctx, f: number, ox: number): void {
  const cx = ox + 16, cy = 16;
  for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) {
    if ((x + y + f) % 4 === 0 && Math.hypot(x - 16, y - 16) < 10) r(c, '#2b7f88', ox + x, y, 1, 1);
  }
  for (let k = 0; k < 6; k++) {
    const a0 = ((k * 60 + f * 10) * Math.PI) / 180, a1 = (((k + 1) * 60 + f * 10) * Math.PI) / 180;
    const lit = k === f % 6 || k === (f + 3) % 6;
    for (const [rad, color] of [[14, lit ? WHITE : CYAN_HI], [13, CYAN], [12, '#2b7f88']] as const) {
      const ax = Math.cos(a0) * rad, ay = Math.sin(a0) * rad, bx = Math.cos(a1) * rad, by = Math.sin(a1) * rad;
      for (let i = 2; i <= 14; i++) r(c, color, Math.round(cx + ax + ((bx - ax) * i) / 16), Math.round(cy + ay + ((by - ay) * i) / 16), 1, 1);
    }
    const am = (a0 + a1) / 2, gx = Math.round(cx + Math.cos(am) * 9), gy = Math.round(cy + Math.sin(am) * 9);
    const glyph = lit ? WHITE : CYAN_HI;
    if (k % 2) { r(c, glyph, gx - 1, gy, 3, 1); r(c, glyph, gx, gy - 1, 1, 3); }
    else { r(c, glyph, gx, gy - 1, 1, 3); px(c, glyph, [[gx - 1, gy - 1], [gx + 1, gy + 1]]); }
  }
}

/** Scorch decal, 24×12: dithered charred oval, drawn with normal blend on the ground. */
function scorch(c: Ctx): void {
  for (let y = 0; y < 12; y++) for (let x = 0; x < 24; x++) {
    const d = Math.hypot((x - 11.5) / 11.5, (y - 5.5) / 5.5) + noise(x, y) * 0.3;
    if (d > 1.05) continue;
    if (d > 0.75 && (x + y) % 2) continue;
    r(c, d < 0.45 ? K : d < 0.8 ? '#2a1e1c' : '#4a2a1e', x, y, 1, 1);
  }
  px(c, EMBER_DK, [[8, 5], [14, 6], [11, 4]]);
}

export function buildFerroArt(scene: Phaser.Scene): void {
  for (const [id, draw] of Object.entries(ICONS)) {
    const el = canvas(16, 16, draw);
    if (!scene.textures.exists(`icon_${id}`)) scene.textures.addCanvas(`icon_${id}`, el);
    iconUrls[id as keyof typeof ICONS] = el.toDataURL();
  }
  for (const [id, draw] of Object.entries(SPELL_ICONS)) spellIconUrls[id as SpellId] = canvas(16, 16, draw).toDataURL();
  for (const [id, draw] of Object.entries(NODE_ICONS)) nodeIconUrls[id as NodeId] = canvas(16, 16, draw).toDataURL();
  for (const node of Object.values(SKILL_NODES)) if (node.unlocksSpell) nodeIconUrls[node.id] = spellIconUrls[node.unlocksSpell];

  buildRuneArt(scene);
  strip(scene, 'ether_vein', 18, 20, 2, etherVein);
  strip(scene, 'cobalto', 20, 24, 6, cobalto);
  strip(scene, 'ember_spear', 16, 8, 2, emberSpear);
  strip(scene, 'rune_bolt', 8, 8, 2, runeBolt);
  strip(scene, 'ember_lance', 24, 10, 2, emberLance);
  strip(scene, 'fire_burst', 32, 32, 5, fireBurst);
  strip(scene, 'ward_shield', 32, 32, 6, wardShield);
  strip(scene, 'scorch', 24, 12, 1, (c) => scorch(c));

  const anim = (key: string, tex: string, frames: number[], rate: number, repeat = -1) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
  };
  anim('ether-shimmer', 'ether_vein', [0, 1], 2);
  anim('cobalto-idle', 'cobalto', [0, 1], 3);
  anim('cobalto-walk', 'cobalto', [2, 3], 7);
  anim('ember-flicker', 'ember_spear', [0, 1], 16);
  anim('bolt-flicker', 'rune_bolt', [0, 1], 14);
  anim('lance-flicker', 'ember_lance', [0, 1], 18);
  anim('fire-burst', 'fire_burst', [0, 1, 2, 3, 4], 16, 0);
  anim('ward-shimmer', 'ward_shield', [0, 1, 2, 3, 4, 5], 5);
}
