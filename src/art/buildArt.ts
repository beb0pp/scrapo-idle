import type Phaser from 'phaser';
import type { DecorId } from '../core/decor';

// Workshop-plot props for the Pátio: one per Ferromancy build plus progress decor, 3/4 view like props.ts.
// Origin is bottom-centre; each strip holds its animation frames side by side.

type Ctx = CanvasRenderingContext2D;

const INK = '#1b1a24';
const WOOD = '#8b6340';
const WOOD_HI = '#c08a55';
const WOOD_DK = '#5a3d26';
const BOARD = '#a8834f';
const STEEL = '#4a5468';
const STEEL_HI = '#7b8aa3';
const STEEL_LT = '#c4c9cf';
const IRON = '#2a2d38';
const GLASS = '#3a3f52';
const GLASS_HI = '#8a93ad';
const COPPER = '#d7833b';
const COPPER_HI = '#f0a860';
const COPPER_DK = '#9b5a32';
const BRICK = '#8c3b2e';
const BRICK_HI = '#b5523f';
const CYAN = '#5fd0d8';
const CYAN_HI = '#b8f4f6';
const CYAN_DK = '#2b7f88';
const ETHER = '#b48ae6';
const ETHER_DK = '#6f4fa6';
const ETHER_HI = '#e8d8ff';
const EMBER = '#f08a3a';
const EMBER_HI = '#ffd27a';
const GOLD = '#e0b33a';
const GOLD_HI = '#fff2b0';
const RED = '#e8433a';
const PCB = '#2f7a4a';
const PCB_HI = '#58b06a';
const SCREEN = '#0e1a1c';

function rect(c: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function disc(c: Ctx, color: string, cx: number, cy: number, r: number): void {
  c.fillStyle = color;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) c.fillRect(cx + x, cy + y, 1, 1);
}

function ellipse(c: Ctx, color: string, cx: number, cy: number, rx: number, ry: number): void {
  c.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function ring(c: Ctx, color: string, cx: number, cy: number, rx: number, ry: number, step: number): void {
  c.fillStyle = color;
  for (let a = 0; a < Math.PI * 2; a += step) c.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
}

function crate(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, INK, x, y, w, h);
  rect(c, WOOD_HI, x + 1, y + 1, w - 2, 3);
  rect(c, WOOD, x + 1, y + 4, w - 2, h - 5);
  rect(c, WOOD_DK, x + 1, y + 4, w - 2, 1);
  for (let i = x + 2; i < x + w - 2; i += 2) rect(c, WOOD_DK, i, y + 6 + ((i - x) % 4 ? 0 : 1), 1, h - 8);
  rect(c, WOOD_DK, x + 1, y + h - 2, w - 2, 1);
}

function jar(c: Ctx, x: number, y: number, liquid: string, hi: string): void {
  rect(c, INK, x, y, 5, 7);
  rect(c, WOOD_DK, x + 1, y, 3, 1);
  rect(c, GLASS, x + 1, y + 1, 3, 5);
  rect(c, liquid, x + 1, y + 3, 3, 3);
  rect(c, hi, x + 1, y + 3, 1, 1);
  rect(c, GLASS_HI, x + 3, y + 1, 1, 1);
}

/** Pegboard with hung tools, a gear sign and a lit clamp lamp: the restored workshop behind the bench. */
function workshop(c: Ctx): void {
  rect(c, INK, 2, 8, 3, 22); rect(c, INK, 17, 8, 3, 22);
  rect(c, WOOD, 3, 9, 1, 20); rect(c, WOOD, 18, 9, 1, 20);
  rect(c, INK, 0, 6, 22, 17);
  rect(c, BOARD, 1, 7, 20, 15);
  rect(c, WOOD_DK, 1, 21, 20, 1);
  for (let y = 9; y < 21; y += 3) for (let x = 3; x < 20; x += 3) rect(c, WOOD_DK, x, y, 1, 1);
  // wrench
  rect(c, STEEL_HI, 4, 10, 1, 9); rect(c, STEEL_LT, 3, 9, 3, 2); rect(c, BOARD, 4, 9, 1, 1);
  // hammer
  rect(c, WOOD_DK, 8, 11, 1, 8); rect(c, IRON, 6, 9, 5, 3); rect(c, STEEL_HI, 6, 9, 5, 1);
  // saw
  rect(c, STEEL_LT, 12, 10, 4, 6); rect(c, STEEL_HI, 12, 15, 4, 1); rect(c, RED, 12, 16, 2, 3);
  // screwdrivers
  rect(c, RED, 17, 10, 2, 3); rect(c, STEEL_LT, 17, 13, 1, 5);
  rect(c, PCB_HI, 19, 12, 1, 2); rect(c, STEEL_LT, 19, 14, 1, 4);
  // gear sign
  rect(c, INK, 5, 1, 10, 6); rect(c, WOOD_HI, 6, 2, 8, 4);
  disc(c, COPPER_DK, 10, 4, 2); disc(c, GOLD, 10, 4, 1); rect(c, WOOD_DK, 10, 4, 1, 1);
  // clamp lamp
  rect(c, STEEL, 19, 3, 1, 4); rect(c, STEEL, 17, 2, 3, 1);
  rect(c, INK, 14, 1, 5, 4); rect(c, '#3d6a8a', 15, 1, 3, 2);
  rect(c, GOLD_HI, 15, 3, 3, 1); rect(c, EMBER_HI, 15, 4, 3, 1);
}

/** Anvil on a stump in front of a rack of hanging wrenches. */
function toolRack(c: Ctx): void {
  rect(c, INK, 0, 1, 3, 17); rect(c, INK, 19, 1, 3, 17);
  rect(c, WOOD, 1, 2, 1, 15); rect(c, WOOD, 20, 2, 1, 15);
  rect(c, INK, 0, 2, 22, 3); rect(c, WOOD_HI, 1, 3, 20, 1);
  for (const [x, len] of [[4, 6], [7, 8], [10, 5], [14, 7], [17, 6]] as [number, number][]) {
    rect(c, INK, x - 1, 4, 3, len + 2);
    rect(c, STEEL_HI, x, 5, 1, len);
    rect(c, STEEL_LT, x - 1, 4 + len, 3, 2);
    rect(c, INK, x, 5 + len, 1, 1);
  }
  ellipse(c, INK, 11, 17, 6, 4);
  rect(c, INK, 5, 16, 13, 6);
  rect(c, WOOD, 6, 17, 11, 4);
  ellipse(c, WOOD_HI, 11, 16, 5, 2);
  ellipse(c, WOOD, 11, 16, 2, 1);
  rect(c, WOOD_DK, 8, 18, 1, 3); rect(c, WOOD_DK, 13, 18, 1, 3);
  rect(c, INK, 3, 9, 15, 5); rect(c, INK, 7, 13, 7, 3);
  rect(c, STEEL, 4, 10, 13, 3); rect(c, STEEL_HI, 4, 10, 13, 1);
  rect(c, STEEL, 2, 10, 2, 1); rect(c, IRON, 8, 13, 5, 2);
  rect(c, STEEL_LT, 6, 10, 3, 1);
}

/** Steel bench with circuit boards and a glowing cyan monitor. */
function moduleBench(c: Ctx): void {
  rect(c, INK, 13, 0, 11, 10);
  rect(c, GLASS, 14, 1, 9, 8);
  rect(c, SCREEN, 15, 2, 7, 5);
  rect(c, CYAN, 16, 3, 5, 1); rect(c, CYAN_HI, 16, 5, 3, 1); rect(c, CYAN_DK, 19, 5, 2, 1);
  rect(c, PCB_HI, 21, 7, 1, 1);
  rect(c, INK, 0, 9, 24, 8);
  rect(c, STEEL_HI, 1, 10, 22, 2);
  rect(c, STEEL, 1, 12, 22, 1);
  rect(c, IRON, 1, 13, 22, 3);
  rect(c, INK, 1, 16, 3, 4); rect(c, INK, 20, 16, 3, 4);
  rect(c, IRON, 2, 16, 1, 3); rect(c, IRON, 21, 16, 1, 3);
  rect(c, INK, 1, 6, 10, 5); rect(c, PCB, 2, 7, 8, 3);
  rect(c, INK, 3, 8, 2, 1); rect(c, INK, 7, 7, 2, 2); rect(c, GOLD, 5, 7, 1, 1); rect(c, GOLD, 6, 9, 3, 1); rect(c, PCB_HI, 2, 7, 1, 1);
  rect(c, INK, 4, 4, 6, 3); rect(c, PCB_HI, 5, 5, 4, 1);
  rect(c, CYAN, 12, 13, 1, 5); rect(c, RED, 15, 13, 1, 4); rect(c, CYAN_HI, 12, 13, 1, 1);
  rect(c, EMBER_HI, 10, 11, 1, 1);
}

/** Calibration stand: copper gear on a post, servo arm and a status light. */
function servoStand(c: Ctx): void {
  ellipse(c, INK, 8, 19, 7, 3); ellipse(c, STEEL, 8, 18, 6, 2); ellipse(c, STEEL_HI, 8, 17, 4, 1);
  rect(c, INK, 6, 6, 4, 13); rect(c, STEEL_HI, 7, 7, 1, 11); rect(c, STEEL, 8, 7, 1, 11);
  disc(c, INK, 8, 9, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rect(c, INK, Math.round(8 + Math.cos(a) * 6) - 1, Math.round(9 + Math.sin(a) * 6) - 1, 3, 3);
    rect(c, COPPER_DK, Math.round(8 + Math.cos(a) * 6), Math.round(9 + Math.sin(a) * 6), 1, 1);
  }
  disc(c, COPPER, 8, 9, 5); disc(c, COPPER_HI, 7, 8, 2); disc(c, COPPER_DK, 8, 9, 1); rect(c, INK, 8, 9, 1, 1);
  disc(c, INK, 13, 15, 3); disc(c, STEEL_HI, 13, 15, 2); rect(c, INK, 13, 15, 1, 1);
  rect(c, INK, 9, 1, 7, 3); rect(c, STEEL_LT, 10, 2, 5, 1); rect(c, RED, 14, 1, 2, 1);
  rect(c, INK, 1, 13, 4, 4); rect(c, SCREEN, 2, 14, 2, 2); rect(c, CYAN, 2, 14, 1, 1);
}

/** Landing pad with an H mark and running lights that alternate between frames. */
function dronePad(c: Ctx, f: number, ox: number): void {
  ellipse(c, INK, ox + 13, 8, 12, 5);
  rect(c, INK, ox + 1, 8, 25, 4);
  ellipse(c, IRON, ox + 13, 10, 11, 3);
  ellipse(c, GLASS, ox + 13, 7, 11, 4);
  ellipse(c, STEEL, ox + 13, 7, 8, 3);
  ring(c, GOLD, ox + 13, 7, 9, 3.5, 0.35);
  rect(c, GOLD, ox + 10, 5, 1, 5); rect(c, GOLD, ox + 16, 5, 1, 5); rect(c, GOLD, ox + 10, 7, 7, 1);
  const lit = (on: boolean) => (on ? CYAN_HI : CYAN_DK);
  rect(c, lit(f === 0), ox + 2, 7, 2, 2); rect(c, lit(f === 0), ox + 23, 7, 2, 2);
  rect(c, lit(f === 1), ox + 12, 2, 2, 1); rect(c, lit(f === 1), ox + 12, 11, 2, 1);
}

/** Alchemy table with a bubbling ether flask over a chalk transmutation circle. */
function alchemy(c: Ctx, f: number, ox: number): void {
  ring(c, ETHER_DK, ox + 12, 23, 11, 3, 0.18);
  ring(c, ETHER, ox + 12, 23, 8, 2, 0.4);
  rect(c, INK, ox + 2, 13, 20, 8);
  rect(c, WOOD_HI, ox + 3, 14, 18, 2);
  rect(c, WOOD, ox + 3, 16, 18, 3);
  rect(c, WOOD_DK, ox + 3, 19, 2, 4); rect(c, WOOD_DK, ox + 19, 19, 2, 4);
  // big flask
  rect(c, INK, ox + 7, 1, 5, 6); rect(c, GLASS, ox + 8, 2, 3, 5);
  disc(c, INK, ox + 9, 10, 5); disc(c, GLASS, ox + 9, 10, 4);
  const wob = f === 1 ? 1 : 0;
  rect(c, ETHER_DK, ox + 5, 11, 9, 3); rect(c, ETHER, ox + 6, 10 + wob, 7, 3 - wob); disc(c, ETHER, ox + 9, 12, 3);
  rect(c, ETHER_HI, ox + 6 + f * 2, 10, 2, 1);
  rect(c, GLASS_HI, ox + 6, 8, 1, 2);
  const bubbles: [number, number][][] = [[[8, 5], [10, 2]], [[9, 4], [8, 0]], [[10, 6], [9, 1]]];
  for (const [bx, by] of bubbles[f]) rect(c, ETHER_HI, ox + bx, by, 1, 1);
  rect(c, ETHER, ox + 9, 7 - f, 1, 1);
  // test tube rack
  rect(c, INK, ox + 15, 4, 3, 10); rect(c, GLASS, ox + 16, 5, 1, 8); rect(c, CYAN, ox + 16, 9, 1, 4);
  rect(c, INK, ox + 18, 7, 3, 7); rect(c, GLASS, ox + 19, 8, 1, 5); rect(c, EMBER, ox + 19, 10, 1, 3);
  rect(c, INK, ox + 14, 12, 8, 2); rect(c, WOOD_DK, ox + 15, 12, 6, 1);
  jar(c, ox + 1, 8, PCB_HI, '#d8ffb0');
}

/** Copper alembic on a brick burner: swan neck, cooling coil and a drip into the jar. */
function alembic(c: Ctx, f: number, ox: number): void {
  rect(c, INK, ox + 1, 20, 13, 8);
  rect(c, BRICK, ox + 2, 21, 11, 6);
  rect(c, BRICK_HI, ox + 2, 21, 5, 1); rect(c, BRICK_HI, ox + 8, 24, 5, 1); rect(c, INK, ox + 7, 21, 1, 3); rect(c, INK, ox + 4, 24, 1, 3);
  rect(c, INK, ox + 5, 23, 5, 4);
  rect(c, f === 1 ? EMBER_HI : EMBER, ox + 6, 24, 3, 3); rect(c, f === 2 ? EMBER_HI : GOLD_HI, ox + 7, 25 - (f % 2), 1, 1);
  disc(c, INK, ox + 7, 15, 6); disc(c, COPPER, ox + 7, 15, 5);
  disc(c, COPPER_DK, ox + 8, 17, 3); disc(c, COPPER, ox + 7, 15, 3); disc(c, COPPER_HI, ox + 5, 13, 2); rect(c, GOLD_HI, ox + 4, 12, 1, 1);
  rect(c, INK, ox + 5, 6, 5, 4); rect(c, COPPER, ox + 6, 7, 3, 3); rect(c, COPPER_HI, ox + 6, 7, 1, 2);
  // swan neck down to the coil
  rect(c, INK, ox + 7, 4, 10, 3); rect(c, COPPER, ox + 8, 5, 8, 1);
  for (let i = 0; i < 6; i++) { rect(c, INK, ox + 15 + Math.floor(i / 3), 5 + i, 3, 2); rect(c, COPPER, ox + 16 + Math.floor(i / 3), 6 + i, 1, 1); }
  // coil
  for (let y = 11; y <= 18; y += 2) { rect(c, INK, ox + 14, y, 7, 2); rect(c, y % 4 === 3 ? COPPER_HI : COPPER, ox + 15, y, 5, 1); }
  rect(c, INK, ox + 17, 19, 2, 3); rect(c, COPPER_DK, ox + 17, 19, 1, 2);
  // jar and drip
  rect(c, INK, ox + 14, 23, 7, 5); rect(c, GLASS, ox + 15, 24, 5, 3); rect(c, ETHER, ox + 15, 25 + (f === 2 ? 0 : 1), 5, 2 - (f === 2 ? 0 : 1)); rect(c, ETHER_HI, ox + 15, 25, 1, 1);
  if (f === 0) rect(c, ETHER_HI, ox + 17, 21, 1, 1);
  if (f === 1) rect(c, ETHER, ox + 17, 22, 1, 2);
  if (f === 2) { rect(c, ETHER_HI, ox + 16, 24, 1, 1); rect(c, ETHER_HI, ox + 18, 24, 1, 1); }
}

/** Wooden post with a lantern and a sagging string of warm bulbs. */
function lamps(c: Ctx): void {
  rect(c, INK, 2, 4, 4, 32); rect(c, WOOD, 3, 5, 2, 30); rect(c, WOOD_HI, 3, 5, 1, 30);
  rect(c, INK, 0, 34, 8, 2); rect(c, WOOD_DK, 1, 34, 6, 1);
  rect(c, INK, 1, 3, 6, 2); rect(c, WOOD_DK, 2, 3, 4, 1);
  rect(c, INK, 1, 0, 6, 4); rect(c, GOLD_HI, 2, 1, 4, 2); rect(c, IRON, 2, 0, 4, 1);
  let prev = 6;
  for (let x = 6; x < 22; x++) {
    const t = (x - 6) / 15;
    const y = Math.round(6 + t * 4 + Math.sin(t * Math.PI) * 4);
    rect(c, INK, x, Math.min(prev, y), 1, Math.abs(prev - y) + 1);
    prev = y;
    if ((x - 6) % 4 === 2) { rect(c, INK, x - 1, y + 1, 3, 3); rect(c, EMBER_HI, x, y + 1, 1, 2); rect(c, GOLD_HI, x, y + 1, 1, 1); }
  }
}

/** Ether-violet banner with a crystal rune, flapping between two frames. */
function banner(c: Ctx, f: number, ox: number): void {
  rect(c, INK, ox + 1, 2, 3, 30); rect(c, STEEL_HI, ox + 2, 3, 1, 28);
  disc(c, INK, ox + 2, 2, 2); rect(c, GOLD, ox + 2, 1, 1, 2);
  ellipse(c, INK, ox + 3, 30, 3, 2); ellipse(c, STEEL, ox + 3, 30, 2, 1);
  const wave = (x: number) => (f === 0 ? (x % 4 < 2 ? 0 : 1) : (x % 4 < 2 ? 1 : 0));
  for (let x = 4; x < 15; x++) {
    const top = 3 + wave(x), bottom = 16 + wave(x) + (x > 11 ? (x - 11) : 0) * (x % 2);
    rect(c, INK, ox + x, top, 1, bottom - top + 1);
    rect(c, x === 4 || x === 14 ? ETHER : ETHER_DK, ox + x, top + 1, 1, bottom - top - 1);
    rect(c, ETHER, ox + x, top + 1, 1, 1);
  }
  const cy = 9 + (f === 0 ? 0 : 1);
  rect(c, ETHER_HI, ox + 9, cy - 3, 1, 7); rect(c, ETHER_HI, ox + 7, cy - 1, 5, 3); rect(c, ETHER, ox + 8, cy, 3, 1); rect(c, '#ffffff', ox + 9, cy - 2, 1, 1);
}

/** Two stacked crates topped with reagent jars: ember, iron salt and lodestone filings. */
function reagentCrates(c: Ctx): void {
  crate(c, 0, 8, 14, 12);
  crate(c, 10, 11, 12, 9);
  rect(c, INK, 10, 11, 1, 9);
  jar(c, 1, 2, EMBER, EMBER_HI);
  jar(c, 6, 2, STEEL_HI, STEEL_LT);
  jar(c, 14, 5, ETHER, ETHER_HI);
  rect(c, EMBER, 4, 13, 2, 2); rect(c, ETHER_DK, 15, 15, 2, 2);
}

/** Swept, packed earth patch with broom strokes and a neat stone border. */
function sweptGround(c: Ctx): void {
  c.globalAlpha = 0.45;
  ellipse(c, '#d9c49a', 24, 11, 22, 9);
  c.globalAlpha = 0.35;
  ellipse(c, '#efe0b8', 24, 10, 16, 6);
  c.globalAlpha = 0.5;
  for (const [x, y, w] of [[10, 6, 9], [20, 8, 12], [12, 13, 10], [27, 14, 9], [32, 5, 7]] as [number, number, number][]) rect(c, '#b49a6a', x, y, w, 1);
  c.globalAlpha = 1;
  for (let a = 0; a < Math.PI * 2; a += 0.42) {
    const x = Math.round(24 + Math.cos(a) * 22), y = Math.round(11 + Math.sin(a) * 9);
    rect(c, '#76869a', x - 1, y, 3, 2); rect(c, '#c4c9cf', x - 1, y, 2, 1);
  }
}

export interface DecorArt {
  key: string;
  w: number;
  h: number;
  frames: number;
  draw: (c: Ctx, frame: number, ox: number) => void;
  anim?: { key: string; rate: number };
  /** Lies on the ground: sorted under walkers instead of by its bottom edge. */
  flat?: boolean;
  /** Additive light at an offset from the prop's bottom-centre. */
  glow?: { dx: number; dy: number; color: number; scale: number; alpha: number };
  shadowW?: number;
  flip?: boolean;
}

const still = (fn: (c: Ctx) => void) => (c: Ctx, _f: number, ox: number) => { c.save(); c.translate(ox, 0); fn(c); c.restore(); };

export const DECOR_ART: Record<DecorId, DecorArt> = {
  b_workshop: { key: 'decor_workshop', w: 22, h: 30, frames: 1, draw: still(workshop), glow: { dx: 5, dy: -26, color: 0xf6c870, scale: 0.9, alpha: 0.6 }, shadowW: 22 },
  b_bench_tools: { key: 'decor_tool_rack', w: 22, h: 22, frames: 1, draw: still(toolRack), shadowW: 20 },
  b_bench_modules: { key: 'decor_module_bench', w: 24, h: 20, frames: 1, draw: still(moduleBench), glow: { dx: 6, dy: -16, color: 0x5fd0d8, scale: 0.8, alpha: 0.55 }, shadowW: 24 },
  b_drone_servos: { key: 'decor_servo_stand', w: 16, h: 22, frames: 1, draw: still(servoStand), shadowW: 14 },
  b_drone_bay: { key: 'decor_drone_pad', w: 27, h: 13, frames: 2, draw: dronePad, anim: { key: 'decor-pad-blink', rate: 2 }, flat: true, glow: { dx: 0, dy: -6, color: 0x5fd0d8, scale: 0.7, alpha: 0.3 } },
  b_alchemy: { key: 'decor_alchemy', w: 24, h: 26, frames: 3, draw: alchemy, anim: { key: 'decor-alchemy-bubble', rate: 5 }, glow: { dx: -3, dy: -16, color: 0xb48ae6, scale: 1.1, alpha: 0.6 }, shadowW: 22 },
  b_alembic: { key: 'decor_alembic', w: 22, h: 28, frames: 3, draw: alembic, anim: { key: 'decor-alembic-drip', rate: 4 }, glow: { dx: -4, dy: -4, color: 0xf08a3a, scale: 0.7, alpha: 0.55 }, shadowW: 20 },
  swept_ground: { key: 'decor_swept', w: 48, h: 22, frames: 1, draw: still(sweptGround), flat: true },
  lamps_low: { key: 'decor_lamps', w: 22, h: 36, frames: 1, draw: still(lamps), glow: { dx: -7, dy: -34, color: 0xf6c870, scale: 1.3, alpha: 0.55 }, shadowW: 10 },
  lamps_high: { key: 'decor_lamps', w: 22, h: 36, frames: 1, draw: still(lamps), flip: true, glow: { dx: -7, dy: -34, color: 0xf6c870, scale: 1.3, alpha: 0.55 }, shadowW: 10 },
  banner: { key: 'decor_banner', w: 16, h: 32, frames: 2, draw: banner, anim: { key: 'decor-banner-wave', rate: 3 }, glow: { dx: 1, dy: -22, color: 0xb48ae6, scale: 0.6, alpha: 0.35 }, shadowW: 8 },
  reagent_crates: { key: 'decor_reagents', w: 22, h: 20, frames: 1, draw: still(reagentCrates), shadowW: 22 },
};

export function buildBuildArt(scene: Phaser.Scene): void {
  for (const art of Object.values(DECOR_ART)) {
    if (scene.textures.exists(art.key)) continue;
    const tex = scene.textures.createCanvas(art.key, art.w * art.frames, art.h)!;
    const ctx = tex.getContext();
    for (let f = 0; f < art.frames; f++) {
      art.draw(ctx, f, f * art.w);
      tex.add(f, 0, f * art.w, 0, art.w, art.h);
    }
    tex.refresh();
    if (art.anim && !scene.anims.exists(art.anim.key)) {
      scene.anims.create({ key: art.anim.key, frames: Array.from({ length: art.frames }, (_, frame) => ({ key: art.key, frame })), frameRate: art.anim.rate, repeat: -1 });
    }
  }
}
