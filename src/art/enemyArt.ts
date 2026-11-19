import Phaser from 'phaser';

type Painter = (ctx: CanvasRenderingContext2D, frame: number, ox: number) => void;

const INK = '#14121e';
const SLATE = '#4a5468';
const STEEL = '#7b8aa3';
const COPPER = '#d7833b';
const RUST = '#a8481e';
const RED = '#e8433a';
const AMBER = '#f6c84a';
const TEAL = '#5fd0d8';

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function box(ctx: CanvasRenderingContext2D, ox: number, x: number, y: number, w: number, h: number, fill: string, hi = STEEL): void {
  px(ctx, INK, ox + x - 1, y - 1, w + 2, h + 2);
  px(ctx, fill, ox + x, y, w, h);
  px(ctx, hi, ox + x, y, Math.max(1, w - 1), 1);
}

function wheel(ctx: CanvasRenderingContext2D, ox: number, x: number, y: number, color = SLATE): void {
  px(ctx, INK, ox + x - 1, y - 1, 5, 5);
  px(ctx, color, ox + x, y, 3, 3);
  px(ctx, STEEL, ox + x, y, 1, 1);
}

function canvasSheet(scene: Phaser.Scene, key: string, size: number, paint: Painter): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, size * 9, size)!;
  const ctx = texture.getContext();
  for (let frame = 0; frame < 9; frame++) {
    ctx.clearRect(frame * size, 0, size, size);
    paint(ctx, frame, frame * size);
    texture.add(frame, 0, frame * size, 0, size, size);
  }
  texture.refresh();
}

function sorter(ctx: CanvasRenderingContext2D, frame: number, ox: number): void {
  const step = frame < 4 ? [0, 1, 0, -1][frame] : 0;
  const claw = frame === 4 ? 1 : frame === 5 ? 3 : frame === 6 ? 5 : 3;
  box(ctx, ox, 5, 5, 8, 7, RUST, COPPER);
  px(ctx, INK, ox + 7, 7, 4, 3); px(ctx, AMBER, ox + 8, 8, 2, 1);
  wheel(ctx, ox, 5, 12 + step); wheel(ctx, ox, 10, 12 - step);
  px(ctx, INK, ox + 2, 7, 4, 2); px(ctx, COPPER, ox + 3, 7, 2, 1);
  px(ctx, INK, ox + 1, 8, 2, claw); px(ctx, STEEL, ox + 1, 8, 1, claw);
  px(ctx, INK, ox + 0, 8 + claw, 2, 1); px(ctx, INK, ox + 0, 8 - claw, 2, 1);
  if (frame === 6 || frame === 7) px(ctx, RED, ox + 1, 7, 2, 1);
  if (frame === 8) { px(ctx, INK, ox + 3, 13, 4, 1); px(ctx, COPPER, ox + 2, 14, 3, 1); }
}

function press(ctx: CanvasRenderingContext2D, frame: number, ox: number): void {
  const stomp = frame === 6 ? 3 : frame === 7 ? 1 : 0;
  box(ctx, ox, 3, 3 + stomp, 18, 8, SLATE, STEEL);
  px(ctx, INK, ox + 1, 12 + stomp, 22, 5); px(ctx, RUST, ox + 2, 13 + stomp, 20, 3);
  px(ctx, COPPER, ox + 5, 5 + stomp, 14, 2); px(ctx, INK, ox + 10, 7 + stomp, 4, 3); px(ctx, RED, ox + 11, 8 + stomp, 2, 1);
  px(ctx, INK, ox + 5, 17, 4, 5); px(ctx, SLATE, ox + 6, 17, 2, 4);
  px(ctx, INK, ox + 16, 17, 4, 5); px(ctx, SLATE, ox + 17, 17, 2, 4);
  if (frame === 4 || frame === 5) px(ctx, AMBER, ox + 11, 1, 2, 2);
  if (frame === 8) { px(ctx, STEEL, ox + 3, 19, 7, 2); px(ctx, RUST, ox + 14, 20, 6, 2); }
}

function sparkbot(ctx: CanvasRenderingContext2D, frame: number, ox: number): void {
  const dash = frame === 6 || frame === 7 ? 3 : 0;
  px(ctx, INK, ox + 3 + dash, 7, 13, 6); px(ctx, SLATE, ox + 4 + dash, 8, 11, 4); px(ctx, STEEL, ox + 5 + dash, 8, 5, 1);
  px(ctx, INK, ox + 7 + dash, 6, 4, 3); px(ctx, TEAL, ox + 8 + dash, 7, 2, 1);
  for (const leg of [4, 8, 12]) { px(ctx, INK, ox + leg + dash, 13, 2, 3); px(ctx, COPPER, ox + leg + dash, 13, 1, 2); }
  if (frame < 4) px(ctx, AMBER, ox + 1, 10 + (frame % 2), 2, 1);
  if (frame === 4 || frame === 5) px(ctx, RED, ox + 1, 10, 3, 1);
  if (frame === 8) { px(ctx, STEEL, ox + 4, 14, 4, 1); px(ctx, COPPER, ox + 12, 14, 3, 1); }
}

function magnetron(ctx: CanvasRenderingContext2D, frame: number, ox: number): void {
  const bob = frame < 4 ? frame % 2 : 0;
  box(ctx, ox, 3, 5 + bob, 18, 12, SLATE, STEEL);
  px(ctx, INK, ox + 6, 7 + bob, 12, 6); px(ctx, RUST, ox + 7, 8 + bob, 10, 4); px(ctx, TEAL, ox + 10, 9 + bob, 4, 2);
  px(ctx, INK, ox + 1, 8 + bob, 4, 8); px(ctx, RED, ox + 2, 9 + bob, 2, 6);
  px(ctx, INK, ox + 19, 8 + bob, 4, 8); px(ctx, COPPER, ox + 20, 9 + bob, 2, 6);
  wheel(ctx, ox, 5, 17); wheel(ctx, ox, 16, 17);
  if (frame === 4 || frame === 5) px(ctx, AMBER, ox + 11, 2, 2, 3);
  if (frame === 6 || frame === 7) { px(ctx, TEAL, ox + 21, 10, 3, 3); px(ctx, '#ffffff', ox + 22, 10, 1, 1); }
  if (frame === 8) { px(ctx, SLATE, ox + 2, 19, 7, 2); px(ctx, RUST, ox + 15, 20, 5, 1); }
}

function scrapgolem(ctx: CanvasRenderingContext2D, frame: number, ox: number): void {
  const crouch = frame === 4 || frame === 5 ? 2 : 0;
  px(ctx, INK, ox + 5, 3 + crouch, 22, 21); px(ctx, RUST, ox + 6, 4 + crouch, 20, 19); px(ctx, COPPER, ox + 7, 5 + crouch, 10, 5);
  px(ctx, INK, ox + 11, 9 + crouch, 10, 6); px(ctx, SLATE, ox + 12, 10 + crouch, 8, 4); px(ctx, AMBER, ox + 14, 11 + crouch, 2, 1);
  px(ctx, INK, ox + 1, 12 + crouch, 6, 10); px(ctx, STEEL, ox + 2, 13 + crouch, 4, 7);
  px(ctx, INK, ox + 25, 12 + crouch, 6, 10); px(ctx, STEEL, ox + 26, 13 + crouch, 4, 7);
  px(ctx, INK, ox + 7, 24, 7, 6); px(ctx, SLATE, ox + 8, 24, 5, 5); px(ctx, INK, ox + 19, 24, 7, 6); px(ctx, SLATE, ox + 20, 24, 5, 5);
  if (frame === 6 || frame === 7) { px(ctx, AMBER, ox + 11, 26, 10, 2); px(ctx, RED, ox + 15, 28, 2, 2); }
  if (frame === 8) { px(ctx, COPPER, ox + 4, 29, 8, 2); px(ctx, STEEL, ox + 20, 29, 8, 2); }
}

function animations(scene: Phaser.Scene, kind: string): void {
  for (const suffix of ['walk', 'windup', 'attack', 'hurt']) scene.anims.remove(`${kind}-${suffix}`);
  const make = (suffix: string, frames: number[], rate: number, repeat: number) => scene.anims.create({ key: `${kind}-${suffix}`, frames: frames.map((frame) => ({ key: kind, frame })), frameRate: rate, repeat });
  make('walk', [0, 1, 2, 3], 8, -1);
  make('windup', [4, 5], 5, -1);
  make('attack', [6, 7], 12, 0);
  make('hurt', [8], 8, 0);
}

/** Builds the enemy sheets separately from general props so combat silhouettes can evolve together. */
export function buildEnemyArt(scene: Phaser.Scene): void {
  canvasSheet(scene, 'sorter', 16, sorter);
  canvasSheet(scene, 'press', 24, press);
  canvasSheet(scene, 'sparkbot', 16, sparkbot);
  canvasSheet(scene, 'magnetron', 24, magnetron);
  canvasSheet(scene, 'scrapgolem', 32, scrapgolem);
  for (const kind of ['sorter', 'press', 'sparkbot', 'magnetron', 'scrapgolem']) animations(scene, kind);
}
