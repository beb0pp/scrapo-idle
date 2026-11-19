import type Phaser from 'phaser';

// Junk drawn in 3/4 view (top + front face) so it has height next to the 24×32 hero.
// Each prop stands on its footprint: origin is bottom-centre, depth sorts by that bottom edge.

type Ctx = CanvasRenderingContext2D;

const INK = '#1b1a24';

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

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JUNK = [
  ['#9b5a32', '#6f3c22', '#c27a48'],
  ['#8d949c', '#5d636b', '#c4c9cf'],
  ['#6a4a30', '#4c3422', '#8b6340'],
  ['#3d6a8a', '#2c4f69', '#5f8fb0'],
  ['#b0962f', '#7d6a1f', '#d8bc4a'],
];

/** A dome of tangled scrap: base silhouette, then lit lumps, then a few sticking-out pieces. */
function heap(c: Ctx, w: number, h: number, seed: number, rusty: boolean): void {
  const r = rng(seed);
  const cx = Math.floor(w / 2), base = h - 2, rx = Math.floor(w / 2) - 1, ry = h - 4;
  for (let y = 0; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - Math.pow(y / ry, 1.6)));
    rect(c, INK, cx - half - 1, base - y, half * 2 + 3, 1);
  }
  for (let y = 0; y < ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - Math.pow(y / ry, 1.6))) - 1;
    rect(c, rusty ? '#5a2f1c' : '#3e3a3c', cx - half, base - y, half * 2 + 1, 1);
  }
  for (let i = 0; i < Math.floor(w * h / 14); i++) {
    const y = Math.floor(r() * (ry - 2)) + 1;
    const half = Math.round(rx * Math.sqrt(1 - Math.pow(y / ry, 1.6))) - 3;
    if (half < 1) continue;
    const x = cx + Math.floor((r() * 2 - 1) * half);
    const [mid, dark, light] = JUNK[rusty ? (r() < 0.7 ? 0 : 2) : Math.floor(r() * JUNK.length)];
    const s = 1 + Math.floor(r() * 2);
    disc(c, dark, x + 1, base - y + 1, s);
    disc(c, mid, x, base - y, s);
    rect(c, light, x - s + 1, base - y - s + 1, 1, 1);
  }
  // sticking-out bits: a tyre, a rod, a plank
  disc(c, INK, cx - Math.floor(rx / 2), base - Math.floor(ry / 3), 3);
  disc(c, '#2b2a30', cx - Math.floor(rx / 2), base - Math.floor(ry / 3), 2);
  rect(c, '#1b1a24', cx - Math.floor(rx / 2), base - Math.floor(ry / 3), 1, 1);
  for (let i = 0; i < 6; i++) rect(c, '#c4c9cf', cx + 2 + i, base - ry + 2 - Math.floor(i / 2), 1, 1);
  rect(c, '#8b6340', cx + Math.floor(rx / 3), base - Math.floor(ry / 2), 5, 2);
  rect(c, '#4c3422', cx + Math.floor(rx / 3), base - Math.floor(ry / 2) + 2, 5, 1);
}

function crate(c: Ctx): void {
  rect(c, INK, 0, 3, 16, 15);
  rect(c, '#b07a44', 1, 4, 14, 5);
  rect(c, '#c98e52', 1, 4, 14, 1);
  rect(c, '#9c6b3a', 1, 9, 14, 8);
  for (const y of [11, 14]) rect(c, '#74502b', 1, y, 14, 1);
  rect(c, '#74502b', 1, 9, 1, 8);
  rect(c, '#74502b', 14, 9, 1, 8);
  for (let i = 0; i < 6; i++) rect(c, '#74502b', 3 + i * 2, 15 - i, 1, 1);
}

function barrel(c: Ctx, body: string, light: string, dark: string, x = 0): void {
  rect(c, INK, x + 1, 3, 12, 15);
  rect(c, body, x + 2, 5, 10, 12);
  rect(c, light, x + 3, 5, 2, 12);
  rect(c, dark, x + 10, 5, 2, 12);
  for (const y of [8, 13]) rect(c, dark, x + 2, y, 10, 1);
  ellipse(c, INK, x + 7, 4, 6, 2);
  ellipse(c, dark, x + 7, 4, 5, 1);
  rect(c, light, x + 5, 3, 2, 1);
}

function drums(c: Ctx): void {
  barrel(c, '#3d6a8a', '#5f8fb0', '#2c4f69', 9);
  barrel(c, '#8c3b2e', '#b5523f', '#5e261d', 0);
  c.save();
  c.translate(5, 4);
  barrel(c, '#b0962f', '#d8bc4a', '#7d6a1f', 0);
  c.restore();
}

function tires(c: Ctx): void {
  for (let i = 0; i < 3; i++) {
    const y = 15 - i * 4;
    ellipse(c, INK, 9, y, 8, 3);
    ellipse(c, '#2b2a30', 9, y - 1, 7, 2);
    for (let x = 3; x < 16; x += 3) rect(c, '#45434c', x, y + 1, 1, 1);
  }
  ellipse(c, '#14131a', 9, 6, 3, 1);
  rect(c, '#6a6872', 4, 5, 2, 1);
}

function fridge(c: Ctx): void {
  rect(c, INK, 0, 0, 14, 26);
  rect(c, '#f2efe6', 1, 1, 12, 3);
  rect(c, '#d8d4c8', 1, 4, 12, 21);
  rect(c, '#b4b0a4', 11, 4, 2, 21);
  rect(c, '#9e9a90', 1, 11, 12, 1);
  rect(c, '#5d636b', 9, 6, 1, 3);
  rect(c, '#5d636b', 9, 13, 1, 5);
  rect(c, '#b8733f', 2, 19, 4, 3);
  rect(c, '#9b5a32', 3, 21, 2, 2);
  rect(c, '#c27a48', 8, 2, 3, 1);
}

function engine(c: Ctx): void {
  rect(c, INK, 0, 4, 20, 13);
  rect(c, '#8d949c', 1, 5, 18, 3);
  rect(c, '#5d636b', 1, 8, 18, 8);
  for (let x = 2; x < 18; x += 4) {
    rect(c, INK, x, 1, 3, 5);
    rect(c, '#c4c9cf', x + 1, 1, 1, 4);
  }
  disc(c, INK, 4, 12, 3);
  disc(c, '#3e3a3c', 4, 12, 2);
  rect(c, '#e0b33a', 4, 12, 1, 1);
  rect(c, '#9b5a32', 9, 11, 9, 3);
  rect(c, '#6f3c22', 9, 14, 9, 1);
}

function robotHusk(c: Ctx): void {
  rect(c, INK, 2, 6, 16, 12);
  rect(c, '#7d8792', 3, 7, 14, 4);
  rect(c, '#4a515c', 3, 11, 14, 6);
  rect(c, '#4a1c18', 6, 9, 3, 2);
  rect(c, '#c27a48', 13, 13, 2, 2);
  disc(c, INK, 15, 4, 3);
  disc(c, '#7d8792', 15, 4, 2);
  rect(c, '#4a1c18', 15, 4, 1, 1);
  rect(c, INK, 0, 12, 3, 5);
  rect(c, '#5d636b', 0, 13, 2, 3);
  rect(c, '#8d949c', 4, 7, 6, 1);
}

function forklift(c: Ctx): void {
  rect(c, INK, 2, 8, 16, 12);
  rect(c, '#d9a62b', 3, 9, 14, 6);
  rect(c, '#a57a1c', 3, 15, 14, 4);
  rect(c, INK, 5, 0, 1, 9);
  rect(c, INK, 13, 0, 1, 9);
  rect(c, INK, 5, 0, 9, 1);
  rect(c, '#3b4b6b', 6, 9, 6, 4);
  rect(c, INK, 18, 2, 2, 17);
  rect(c, '#8d949c', 19, 2, 1, 17);
  rect(c, '#c4c9cf', 20, 17, 4, 1);
  rect(c, '#c4c9cf', 20, 12, 4, 1);
  disc(c, INK, 6, 20, 3);
  disc(c, INK, 15, 20, 3);
  disc(c, '#45434c', 6, 20, 1);
  disc(c, '#45434c', 15, 20, 1);
}

function cargoBox(c: Ctx): void {
  rect(c, INK, 0, 0, 18, 22);
  rect(c, '#5f8fb0', 1, 1, 16, 5);
  rect(c, '#3d6a8a', 1, 6, 16, 15);
  for (let x = 2; x < 17; x += 3) rect(c, '#2c4f69', x, 6, 1, 15);
  rect(c, '#9b5a32', 2, 16, 5, 3);
  rect(c, '#e0b33a', 12, 9, 3, 2);
}

function lamp(c: Ctx): void {
  rect(c, INK, 3, 4, 3, 36);
  rect(c, '#5d636b', 4, 5, 1, 34);
  rect(c, INK, 0, 0, 9, 5);
  rect(c, '#f6e7a1', 1, 3, 7, 2);
  rect(c, INK, 1, 38, 7, 2);
}

function pipe(c: Ctx): void {
  rect(c, INK, 0, 3, 28, 11);
  rect(c, '#5d636b', 0, 4, 28, 9);
  rect(c, '#8d949c', 0, 5, 28, 3);
  rect(c, '#c4c9cf', 0, 5, 28, 1);
  ellipse(c, INK, 27, 8, 2, 5);
  ellipse(c, '#14131a', 27, 8, 1, 3);
  rect(c, '#6f3c22', 10, 3, 3, 11);
}

function girders(c: Ctx): void {
  for (let i = 0; i < 3; i++) {
    const y = 10 - i * 4;
    rect(c, INK, i, y, 26, 5);
    rect(c, '#9b5a32', i + 1, y + 1, 24, 2);
    rect(c, '#c27a48', i + 1, y + 1, 24, 1);
    rect(c, '#6f3c22', i + 1, y + 3, 24, 1);
  }
}

function craneArm(c: Ctx): void {
  rect(c, INK, 0, 5, 32, 10);
  rect(c, '#d9a62b', 1, 6, 30, 3);
  rect(c, '#a57a1c', 1, 9, 30, 5);
  for (let x = 2; x < 30; x += 4) {
    rect(c, INK, x, 9, 1, 5);
    rect(c, INK, x + 2, 9, 1, 5);
  }
  disc(c, INK, 28, 6, 4);
  disc(c, '#5d636b', 28, 6, 2);
}

function car(c: Ctx): void {
  rect(c, INK, 1, 6, 30, 16);
  rect(c, '#5b7f8c', 2, 7, 28, 6);
  rect(c, '#7fa3ae', 2, 7, 28, 1);
  rect(c, '#4a6a76', 2, 13, 28, 8);
  rect(c, INK, 8, 1, 15, 7);
  rect(c, '#4a6a76', 9, 2, 13, 3);
  rect(c, '#1f2a30', 9, 5, 13, 3);
  rect(c, '#5fd0d8', 10, 5, 3, 1);
  rect(c, '#1f2a30', 3, 14, 5, 3);
  rect(c, '#f6e7a1', 28, 14, 2, 2);
  rect(c, '#9b5a32', 14, 15, 7, 4);
  rect(c, '#c27a48', 15, 15, 3, 1);
  disc(c, INK, 7, 22, 3);
  disc(c, '#45434c', 7, 22, 1);
  rect(c, INK, 22, 21, 6, 2);
}

/** Open freight car, 3 tiles long: cargo heap over the rim, ribbed side wall, two bogies. */
function bigWagon(c: Ctx, seed: number): void {
  const r = rng(seed), W = 48;
  rect(c, INK, 1, 9, W - 2, 27);
  for (let i = 0; i < 70; i++) {
    const [mid, dark, light] = JUNK[Math.floor(r() * 3)];
    const x = 4 + Math.floor(r() * (W - 8)), y = 4 + Math.floor(r() * 8) + Math.abs(x - W / 2) / 6;
    disc(c, INK, x, y + 1, 2);
    disc(c, dark, x, y + 1, 1);
    disc(c, mid, x, y, 1);
    rect(c, light, x - 1, y - 1, 1, 1);
  }
  rect(c, '#561f17', 2, 10, W - 4, 3);
  rect(c, '#c27a48', 2, 10, W - 4, 1);
  rect(c, '#9c4a35', 2, 13, W - 4, 19);
  rect(c, '#b8603f', 2, 13, W - 4, 1);
  for (let x = 5; x < W - 3; x += 6) {
    rect(c, '#7a3326', x, 14, 2, 18);
    rect(c, '#c27a48', x, 14, 1, 18);
    rect(c, '#e0b08a', x + 1, 16, 1, 1);
    rect(c, '#e0b08a', x + 1, 29, 1, 1);
  }
  rect(c, '#6f3c22', 14 + Math.floor(r() * 10), 22, 7, 5);
  rect(c, '#c27a48', 30, 18, 4, 2);
  rect(c, '#561f17', 2, 31, W - 4, 2);
  rect(c, INK, 0, 33, W, 2);
  for (const bx of [7, W - 15]) {
    rect(c, INK, bx - 2, 34, 12, 4);
    rect(c, '#3e3a3c', bx - 1, 34, 10, 3);
    for (const wx of [bx, bx + 7]) {
      disc(c, INK, wx, 37, 3);
      disc(c, '#5d636b', wx, 37, 2);
      rect(c, '#c4c9cf', wx - 1, 36, 1, 1);
    }
  }
  rect(c, '#8d949c', 0, 28, 2, 3);
  rect(c, '#8d949c', W - 2, 28, 2, 3);
}

/** Dead diesel locomotive, 3 tiles long: low hood with grille, tall cab with windows at the back. */
function bigLoco(c: Ctx): void {
  const W = 48;
  rect(c, INK, 0, 14, 32, 22);
  rect(c, '#2f4a3a', 1, 15, 30, 19);
  rect(c, '#4c7058', 1, 15, 30, 3);
  rect(c, '#5f8a6c', 1, 15, 30, 1);
  for (let x = 6; x < 24; x += 3) rect(c, '#1b2a22', x, 20, 2, 9);
  for (let x = 6; x < 24; x += 3) rect(c, '#4c7058', x, 20, 1, 1);
  rect(c, INK, 24, 9, 5, 7);
  rect(c, '#3e3a3c', 25, 10, 3, 5);
  rect(c, '#1b1a24', 25, 9, 3, 1);
  for (let i = 0; i < 4; i++) rect(c, i % 2 ? INK : '#e0b33a', 1, 21 + i * 3, 4, 3);
  rect(c, INK, 0, 17, 4, 4);
  rect(c, '#f6e7a1', 1, 18, 2, 2);
  rect(c, INK, 30, 0, W - 30, 36);
  rect(c, '#5f8a6c', 31, 1, W - 32, 4);
  rect(c, '#2f4a3a', 31, 5, W - 32, 29);
  rect(c, '#253b2e', W - 4, 5, 3, 29);
  rect(c, INK, 33, 8, 5, 7);
  rect(c, INK, 40, 8, 5, 7);
  rect(c, '#9fe8ee', 34, 9, 3, 5);
  rect(c, '#9fe8ee', 41, 9, 3, 5);
  rect(c, '#ffffff', 34, 9, 1, 1);
  rect(c, '#ffffff', 41, 9, 1, 1);
  rect(c, '#1b2a22', 32, 18, 12, 1);
  rect(c, '#9b5a32', 8, 30, 8, 3);
  rect(c, '#9b5a32', 36, 26, 5, 4);
  rect(c, INK, 0, 34, W, 2);
  for (const bx of [6, W - 16]) {
    rect(c, INK, bx - 2, 35, 14, 4);
    rect(c, '#3e3a3c', bx - 1, 35, 12, 3);
    for (const wx of [bx, bx + 5, bx + 10]) {
      disc(c, INK, wx, 38, 3);
      disc(c, '#5d636b', wx, 38, 2);
      rect(c, '#c4c9cf', wx - 1, 37, 1, 1);
    }
  }
}

/** Freight car on a north-south track: seen end-on, long cargo top receding up, end wall at the bottom. */
function bigWagonEnd(c: Ctx, seed: number): void {
  const r = rng(seed);
  rect(c, INK, 0, 0, 20, 58);
  rect(c, '#561f17', 1, 1, 18, 40);
  for (let i = 0; i < 40; i++) {
    const [mid, , light] = JUNK[Math.floor(r() * 3)];
    const x = 3 + Math.floor(r() * 14), y = 3 + Math.floor(r() * 36);
    disc(c, mid, x, y, 1);
    rect(c, light, x - 1, y - 1, 1, 1);
  }
  rect(c, '#c27a48', 1, 1, 1, 40);
  rect(c, '#9c4a35', 1, 41, 18, 13);
  rect(c, '#b8603f', 1, 41, 18, 1);
  for (let x = 3; x < 19; x += 5) rect(c, '#7a3326', x, 42, 2, 12);
  rect(c, '#8d949c', 8, 54, 4, 3);
  disc(c, INK, 4, 55, 2);
  disc(c, INK, 16, 55, 2);
}

const LEAF = ['#244a31', '#347044', '#5d9b4d', '#9bcf65'];
const MOSS = ['#285d3b', '#3f8248', '#68aa50', '#9dcc63'];

function shadow(c: Ctx, cx: number, cy: number, rx: number): void {
  ellipse(c, '#315b4c', cx, cy, rx, 2);
}

function canopy(c: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, palette = LEAF): void {
  const r = rng(seed);
  ellipse(c, INK, cx, cy, rx + 1, ry + 1);
  ellipse(c, palette[0], cx, cy, rx, ry);
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.75;
    const x = Math.round(cx + Math.cos(a) * rx * d), y = Math.round(cy + Math.sin(a) * ry * d - 1);
    disc(c, palette[1], x, y, 2 + Math.floor(r() * 2));
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.round(cx - rx * 0.6 + r() * rx), y = Math.round(cy - ry * 0.7 + r() * ry * 0.8);
    disc(c, palette[2], x, y, 1 + Math.floor(r() * 2));
    rect(c, palette[3], x - 1, y - 1, 1, 1);
  }
}

function trunk(c: Ctx, cx: number, top: number, bottom: number, w: number): void {
  rect(c, INK, cx - Math.floor(w / 2) - 1, top, w + 2, bottom - top);
  rect(c, '#6a4a30', cx - Math.floor(w / 2), top, w, bottom - top - 1);
  rect(c, '#4c3422', cx + Math.floor(w / 2) - 1, top, 1, bottom - top - 1);
  rect(c, '#8b6340', cx - Math.floor(w / 2), top, 1, bottom - top - 1);
  rect(c, '#4c3422', cx - Math.floor(w / 2) - 2, bottom - 2, w + 4, 1);
}

function treeLeafy(c: Ctx): void {
  shadow(c, 16, 42, 14);
  trunk(c, 16, 25, 44, 6);
  canopy(c, 11, 17, 10, 11, 7);
  canopy(c, 21, 16, 10, 12, 17);
  canopy(c, 16, 10, 9, 9, 27);
}

function treePine(c: Ctx): void {
  shadow(c, 11, 41, 10);
  trunk(c, 11, 32, 42, 4);
  for (let i = 0; i < 4; i++) {
    const y = 6 + i * 8, half = 4 + i * 3;
    for (let k = 0; k < 9; k++) {
      const w = Math.round((half * (k + 1)) / 9);
      rect(c, INK, 11 - w - 1, y + k - 3, w * 2 + 3, 1);
    }
    for (let k = 0; k < 8; k++) {
      const w = Math.round((half * (k + 1)) / 9);
      rect(c, k < 3 ? '#3f7a34' : '#2d5a26', 11 - w, y + k - 2, w * 2 + 1, 1);
    }
    rect(c, '#62a14b', 11 - Math.floor(half / 2), y + 2, 2, 1);
  }
}

function treeDead(c: Ctx): void {
  shadow(c, 13, 39, 11);
  trunk(c, 13, 14, 40, 5);
  const branch = (x0: number, y0: number, dx: number, dy: number, n: number) => {
    for (let i = 0; i < n; i++) {
      rect(c, INK, x0 + dx * i - 1, y0 + dy * i - 1, 3, 3);
    }
    for (let i = 0; i < n; i++) rect(c, '#6a4a30', x0 + dx * i, y0 + dy * i, 1, 1);
  };
  branch(13, 16, -1, -1, 9);
  branch(14, 20, 1, -1, 10);
  branch(12, 10, 0, -1, 9);
  branch(6, 9, -1, 0, 4);
  branch(20, 12, 1, -1, 4);
}

function bush(c: Ctx): void {
  shadow(c, 10, 14, 9);
  canopy(c, 5, 9, 5, 5, 19, LEAF);
  canopy(c, 14, 8, 6, 6, 31, LEAF);
  rect(c, '#244a31', 3, 12, 14, 2);
  rect(c, '#5d9b4d', 5, 5, 2, 1);
  rect(c, '#9bcf65', 13, 4, 1, 1);
}

function tuft(c: Ctx, seed: number): void {
  const r = rng(seed);
  shadow(c, 7, 11, 6);
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(r() * 11), h = 3 + Math.floor(r() * 6), lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < h; k++) rect(c, k === h - 1 ? '#9bcf65' : k > h / 2 ? '#5d9b4d' : '#347044', x + (k > h - 3 ? lean : 0), 11 - k, 1, 1);
  }
  if (r() < 0.5) {
    const x = 4 + Math.floor(r() * 5), y = 4 + Math.floor(r() * 3);
    rect(c, '#f6e7a1', x, y, 1, 1); rect(c, '#f6e7a1', x + 1, y, 1, 1); rect(c, '#f6e7a1', x, y + 1, 1, 1); rect(c, '#e0b33a', x + 1, y + 1, 1, 1);
  }
}

function rock(c: Ctx, cx: number, cy: number, rx: number, ry: number, moss: boolean): void {
  ellipse(c, INK, cx, cy, rx, ry);
  ellipse(c, '#485569', cx, cy, rx - 1, ry - 1);
  ellipse(c, '#69788c', cx - 1, cy - 2, Math.max(1, rx - 3), Math.max(1, ry - 3));
  rect(c, '#9ba8b8', cx - Math.floor(rx / 2), cy - ry + 2, Math.max(2, rx - 2), 1);
  rect(c, '#334154', cx + rx - 2, cy, 2, 2);
  if (moss) {
    rect(c, MOSS[0], cx - rx + 2, cy - 1, 4, 2);
    rect(c, MOSS[1], cx - rx + 3, cy - 2, 3, 2);
    rect(c, MOSS[2], cx - rx + 4, cy - 3, 1, 1);
  }
}

function boulder(c: Ctx): void {
  shadow(c, 16, 26, 15);
  rock(c, 16, 17, 14, 10, true);
  rock(c, 8, 23, 6, 4, true);
  rect(c, '#9dcc63', 8, 22, 2, 1);
}

function rockPile(c: Ctx): void {
  shadow(c, 13, 20, 12);
  rock(c, 9, 15, 8, 6, true);
  rock(c, 17, 17, 7, 5, false);
  rock(c, 4, 19, 4, 3, false);
}

function stones(c: Ctx): void {
  shadow(c, 12, 13, 11);
  rock(c, 6, 10, 4, 3, true);
  rock(c, 15, 11, 5, 3, false);
  rect(c, '#f6e7a1', 10, 8, 2, 1); rect(c, '#f6e7a1', 10, 9, 1, 1); rect(c, '#e0b33a', 11, 9, 1, 1);
}

function mushrooms(c: Ctx): void {
  shadow(c, 10, 13, 8);
  for (const [x, y, cap] of [[4, 10, 3], [10, 8, 4], [15, 11, 3]] as [number, number, number][]) {
    rect(c, INK, x, y, 2, 4); rect(c, '#eadfc4', x + 1, y + 1, 1, 3);
    disc(c, INK, x + 1, y, cap); disc(c, '#b83b38', x + 1, y - 1, cap - 1); rect(c, '#f6e7a1', x, y - 2, 1, 1);
  }
}

function fallenLog(c: Ctx, mossy: boolean): void {
  shadow(c, 15, 13, 14);
  rect(c, INK, 1, 6, 28, 7); rect(c, '#563827', 2, 7, 26, 5); rect(c, '#8b5a36', 4, 7, 20, 2); rect(c, '#b57a4a', 5, 7, 10, 1);
  ellipse(c, INK, 27, 9, 3, 4); ellipse(c, '#a66b3e', 27, 9, 2, 3); ellipse(c, '#6c4028', 27, 9, 1, 2);
  rect(c, '#3b261f', 8, 10, 8, 1); rect(c, '#3b261f', 18, 8, 5, 1);
  if (mossy) { rect(c, MOSS[0], 6, 6, 13, 2); rect(c, MOSS[1], 8, 5, 9, 2); rect(c, MOSS[2], 10, 5, 3, 1); }
}

function hedge(c: Ctx): void {
  shadow(c, 15, 15, 14);
  rect(c, INK, 0, 5, 30, 10); rect(c, '#244a31', 1, 6, 28, 8);
  for (let x = 2; x < 28; x += 4) { rect(c, '#347044', x, 6 + (x % 3), 3, 5); rect(c, '#5d9b4d', x, 6, 2, 2); rect(c, '#9bcf65', x, 6, 1, 1); }
  rect(c, '#285d3b', 2, 13, 26, 1);
}

function stoneWall(c: Ctx): void {
  shadow(c, 15, 14, 14);
  rect(c, INK, 0, 4, 30, 10); rect(c, '#455267', 1, 5, 28, 8);
  for (let y = 5; y < 13; y += 3) { rect(c, '#76869a', 2, y, 8, 2); rect(c, '#66758a', 11, y, 7, 2); rect(c, '#94a0b0', 3, y, 3, 1); }
  rect(c, MOSS[0], 20, 11, 5, 2); rect(c, MOSS[1], 21, 10, 3, 2);
}

function flowers(c: Ctx): void {
  shadow(c, 10, 13, 9);
  for (const [x, y] of [[4, 10], [10, 7], [16, 11]] as [number, number][]) {
    rect(c, '#347044', x, y, 1, 3); rect(c, '#f6e7a1', x - 1, y - 1, 3, 2); rect(c, '#e0b33a', x, y, 1, 1);
  }
}

export interface PropDef {
  w: number;
  h: number;
  draw: (c: Ctx) => void;
}

export const PROPS: Record<string, PropDef> = {
  heap0: { w: 34, h: 28, draw: (c) => heap(c, 34, 28, 11, false) },
  heap1: { w: 32, h: 30, draw: (c) => heap(c, 32, 30, 23, false) },
  heap2: { w: 30, h: 26, draw: (c) => heap(c, 30, 26, 37, false) },
  heapSmall: { w: 24, h: 20, draw: (c) => heap(c, 24, 20, 41, false) },
  heapRust0: { w: 34, h: 28, draw: (c) => heap(c, 34, 28, 53, true) },
  heapRust1: { w: 30, h: 26, draw: (c) => heap(c, 30, 26, 67, true) },
  crate: { w: 16, h: 18, draw: crate },
  barrel: { w: 14, h: 18, draw: (c) => barrel(c, '#8c3b2e', '#b5523f', '#5e261d') },
  drums: { w: 23, h: 22, draw: drums },
  tires: { w: 18, h: 19, draw: tires },
  fridge: { w: 14, h: 26, draw: fridge },
  engine: { w: 20, h: 17, draw: engine },
  robotHusk: { w: 18, h: 18, draw: robotHusk },
  forklift: { w: 24, h: 24, draw: forklift },
  cargoBox: { w: 18, h: 22, draw: cargoBox },
  lamp: { w: 9, h: 40, draw: lamp },
  pipe: { w: 30, h: 14, draw: pipe },
  girders: { w: 28, h: 15, draw: girders },
  craneArm: { w: 32, h: 16, draw: craneArm },
  car: { w: 32, h: 26, draw: car },
  wagon0: { w: 48, h: 40, draw: (c) => bigWagon(c, 3) },
  wagon1: { w: 48, h: 40, draw: (c) => bigWagon(c, 9) },
  loco: { w: 48, h: 41, draw: bigLoco },
  wagonEnd: { w: 20, h: 58, draw: (c) => bigWagonEnd(c, 5) },
  treeLeafy: { w: 32, h: 44, draw: treeLeafy },
  treePine: { w: 22, h: 42, draw: treePine },
  treeDead: { w: 26, h: 40, draw: treeDead },
  bush: { w: 20, h: 16, draw: bush },
  tuft0: { w: 13, h: 12, draw: (c) => tuft(c, 3) },
  tuft1: { w: 13, h: 12, draw: (c) => tuft(c, 8) },
  tuft2: { w: 13, h: 12, draw: (c) => tuft(c, 15) },
  boulderMoss: { w: 32, h: 28, draw: boulder },
  rockPile: { w: 26, h: 22, draw: rockPile },
  stonesDaisy: { w: 22, h: 15, draw: stones },
  mushroomCluster: { w: 20, h: 15, draw: mushrooms },
  logPlain: { w: 30, h: 15, draw: (c) => fallenLog(c, false) },
  logMoss: { w: 30, h: 15, draw: (c) => fallenLog(c, true) },
  hedgeShort: { w: 30, h: 16, draw: hedge },
  stoneWallShort: { w: 30, h: 15, draw: stoneWall },
  flowerPatch: { w: 21, h: 15, draw: flowers },
};

export function buildProps(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(PROPS)) {
    const tex = scene.textures.createCanvas(`prop_${key}`, def.w, def.h)!;
    def.draw(tex.getContext());
    tex.refresh();
  }
}
