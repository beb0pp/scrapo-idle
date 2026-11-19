import Phaser from 'phaser';
import { iconUrls } from './sprites';
import type { SpellId } from '../data/ferromancy';

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

const ICONS: Record<'ether_shard' | 'reagent_ember' | 'reagent_ward' | 'reagent_lodestone', (c: Ctx) => void> = {
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

function spellEmber(c: Ctx): void {
  r(c, '#2a1520', 0, 0, 16, 16);
  for (let i = 0; i < 10; i++) r(c, i < 2 ? EMBER_HI : i < 6 ? EMBER : EMBER_DK, 3 + i, 12 - i, 2, 2);
  r(c, K, 12, 1, 3, 3); r(c, EMBER_HI, 12, 2, 2, 1); r(c, WHITE, 13, 1, 1, 1);
  px(c, EMBER_HI, [[2, 8], [5, 14], [9, 13], [1, 11]]);
}

function spellWard(c: Ctx): void {
  r(c, '#14242c', 0, 0, 16, 16);
  r(c, K, 3, 2, 10, 11); r(c, K, 5, 13, 6, 2);
  r(c, STEEL, 4, 3, 8, 9); r(c, STEEL, 6, 12, 4, 2);
  r(c, STEEL_HI, 4, 3, 8, 2);
  r(c, CYAN, 7, 5, 2, 6); r(c, CYAN, 5, 7, 6, 2);
  r(c, CYAN_HI, 7, 7, 2, 2);
  px(c, CYAN, [[1, 1], [14, 1], [1, 14], [14, 14]]);
}

function spellLode(c: Ctx): void {
  r(c, '#1f1530', 0, 0, 16, 16);
  r(c, K, 3, 3, 10, 9); r(c, RUST, 4, 4, 3, 7); r(c, RUST, 9, 4, 3, 7); r(c, RUST, 4, 9, 8, 2);
  r(c, '#3a1f30', 7, 4, 2, 5);
  r(c, STEEL_HI, 4, 4, 3, 2); r(c, STEEL_HI, 9, 4, 3, 2);
  px(c, ETHER, [[2, 1], [5, 1], [10, 1], [13, 1], [1, 13], [14, 13], [7, 14], [8, 13]]);
  px(c, ETHER_HI, [[3, 0], [12, 0], [7, 13]]);
}

export const spellIconUrls: Partial<Record<SpellId, string>> = {};

// ---------------- world textures ----------------

/** Rune circle, 48×48, 4 frames: the glyph ring turns a quarter step per frame. */
function runeCircle(c: Ctx, f: number, ox: number, ink: string, glow: string): void {
  const cx = ox + 24, cy = 24;
  c.save();
  c.beginPath();
  c.rect(ox, 0, 48, 48);
  c.clip();
  const ring = (rad: number, color: string) => {
    for (let a = 0; a < 360; a += 3) {
      const t = (a * Math.PI) / 180;
      r(c, color, Math.round(cx + Math.cos(t) * rad), Math.round(cy + Math.sin(t) * rad * 0.5), 1, 1);
    }
  };
  ring(22, glow);
  ring(21, ink);
  ring(15, ink);
  for (let g = 0; g < 8; g++) {
    const t = ((g * 45 + f * 11) * Math.PI) / 180;
    const gx = Math.round(cx + Math.cos(t) * 18), gy = Math.round(cy + Math.sin(t) * 9);
    const shape = (g + f) % 3;
    if (shape === 0) { r(c, glow, gx - 1, gy - 1, 3, 1); r(c, glow, gx, gy - 1, 1, 3); }
    else if (shape === 1) { r(c, glow, gx - 1, gy, 3, 1); px(c, glow, [[gx - 1, gy - 1], [gx + 1, gy + 1]]); }
    else { r(c, glow, gx, gy - 1, 1, 3); px(c, WHITE, [[gx, gy]]); }
  }
  for (let s = 0; s < 3; s++) {
    const t = ((s * 120 - f * 15) * Math.PI) / 180;
    const ax = cx + Math.cos(t) * 15, ay = cy + Math.sin(t) * 7.5;
    const t2 = (((s + 1) * 120 - f * 15) * Math.PI) / 180;
    const bx = cx + Math.cos(t2) * 15, by = cy + Math.sin(t2) * 7.5;
    for (let i = 0; i <= 12; i++) r(c, ink, Math.round(ax + ((bx - ax) * i) / 12), Math.round(ay + ((by - ay) * i) / 12), 1, 1);
  }
  r(c, WHITE, cx - 1, cy, 2, 1);
  c.restore();
}

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

export function buildFerroArt(scene: Phaser.Scene): void {
  for (const [id, draw] of Object.entries(ICONS)) {
    const el = canvas(16, 16, draw);
    if (!scene.textures.exists(`icon_${id}`)) scene.textures.addCanvas(`icon_${id}`, el);
    iconUrls[id as keyof typeof ICONS] = el.toDataURL();
  }
  spellIconUrls.spell_ember = canvas(16, 16, spellEmber).toDataURL();
  spellIconUrls.spell_ward = canvas(16, 16, spellWard).toDataURL();
  spellIconUrls.spell_lodestone = canvas(16, 16, spellLode).toDataURL();

  strip(scene, 'rune_ember', 48, 48, 4, (c, f, ox) => runeCircle(c, f, ox, EMBER_DK, EMBER_HI));
  strip(scene, 'rune_ward', 48, 48, 4, (c, f, ox) => runeCircle(c, f, ox, '#2b7f88', CYAN_HI));
  strip(scene, 'rune_lode', 48, 48, 4, (c, f, ox) => runeCircle(c, f, ox, ETHER_DK, ETHER_HI));
  strip(scene, 'ether_vein', 18, 20, 2, etherVein);
  strip(scene, 'cobalto', 20, 24, 6, cobalto);
  strip(scene, 'ember_spear', 16, 8, 2, emberSpear);
  strip(scene, 'rune_bolt', 8, 8, 2, runeBolt);

  const anim = (key: string, tex: string, frames: number[], rate: number, repeat = -1) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
  };
  anim('rune-ember-spin', 'rune_ember', [0, 1, 2, 3], 12);
  anim('rune-ward-spin', 'rune_ward', [0, 1, 2, 3], 10);
  anim('rune-lode-spin', 'rune_lode', [0, 1, 2, 3], 10);
  anim('ether-shimmer', 'ether_vein', [0, 1], 2);
  anim('cobalto-idle', 'cobalto', [0, 1], 3);
  anim('cobalto-walk', 'cobalto', [2, 3], 7);
  anim('ember-flicker', 'ember_spear', [0, 1], 16);
  anim('bolt-flicker', 'rune_bolt', [0, 1], 14);
}
