// Bootstraps the Tiled maps and bakes the tileset PNG.
// Usage: node tools/build-maps.ts            -> tileset PNG + maps that do not exist yet
//        node tools/build-maps.ts --force    -> also overwrites maps (discards Tiled edits)
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCKING, TILE_COUNT, TILE_SIZE, TILES, TILESET_COLUMNS, drawTileset } from '../src/art/tileArt.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');

// ---------- PNG ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- painting ----------
type Grid = string[][];
function grid(w: number, h: number, ch: string): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ch));
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] !== undefined) g[y][x] = ch;
}
function put(g: Grid, x: number, y: number, ch: string): void {
  if (g[y]?.[x] !== undefined) g[y][x] = ch;
}
function border(g: Grid, ch: string): void {
  const h = g.length, w = g[0].length;
  rect(g, 0, 0, w - 1, 0, ch);
  rect(g, 0, h - 1, w - 1, h - 1, ch);
  rect(g, 0, 0, 0, h - 1, ch);
  rect(g, w - 1, 0, w - 1, h - 1, ch);
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

// char -> [terrain gid | null (= base), object gid]
const LEGEND: Record<string, [number | null, number]> = {
  '.': [TILES.dirt, 0], 'o': [TILES.dirtDark, 0], ',': [TILES.grass, 0], ';': [TILES.tallGrass, 0],
  ':': [TILES.gravel, 0], '_': [TILES.concrete, 0], '=': [TILES.railH, 0], '|': [TILES.railV, 0],
  '+': [TILES.railX, 0], 'd': [TILES.floor, 0], '-': [TILES.path, 0], '~': [TILES.conveyor, 0],
  '#': [null, TILES.mound], 'm': [null, TILES.moundSmall], 'F': [null, TILES.fence], 'W': [TILES.wall, 0],
  'c': [null, TILES.crate], 'b': [null, TILES.barrel], 'V': [TILES.railH, TILES.wagonL], 'v': [TILES.railH, TILES.wagonR],
  'A': [TILES.railV, TILES.wagonT], 'a': [TILES.railV, TILES.wagonB], 'K': [null, TILES.forklift],
  '"': [null, TILES.weeds], '%': [null, TILES.cables], 's': [null, TILES.sign], '*': [null, TILES.bush],
  'C': [null, TILES.container], 'B': [TILES.concrete, TILES.bwall], 'R': [TILES.concrete, TILES.roof],
  'L': [null, TILES.lamp], 'h': [null, TILES.hatch], 'D': [null, TILES.debris], 'p': [null, TILES.pipe],
  '>': [null, TILES.exitArrow],
  't': [null, TILES.tires], 'e': [null, TILES.engine], 'q': [null, TILES.carTL], 'w': [null, TILES.carTR],
  'z': [null, TILES.carBL], 'x': [null, TILES.carBR], 'I': [null, TILES.girders], 'r': [null, TILES.fridge],
  'Z': [null, TILES.robotHusk], 'l': [null, TILES.pallet], 'u': [null, TILES.oilStain], 'y': [null, TILES.puddle],
  'Y': [TILES.railH, TILES.locoL], 'J': [TILES.railH, TILES.locoR], 'n': [null, TILES.moundRust],
  'g': [null, TILES.drums], 'k': [null, TILES.plates], 'M': [null, TILES.craneArm], '^': [null, TILES.tree],
};
const INTERACT_CHARS = '@PGEHQNUXO$TN';
const WALL_TERRAIN = new Set<number>([TILES.wall]);

interface Obj {
  type: string;
  name?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props?: Record<string, string | number | boolean>;
}
interface MapSpec {
  id: string;
  displayName: string;
  base: string;
  grid: Grid;
  objects: Obj[];
  piles: { loot: string };
}

function blocked(g: Grid, x: number, y: number): boolean {
  const ch = g[y]?.[x];
  if (ch === undefined) return true;
  const def = LEGEND[ch];
  if (!def) return false;
  return BLOCKING.includes(def[1]) || (def[0] !== null && WALL_TERRAIN.has(def[0]));
}

function reachable(g: Grid, sx: number, sy: number): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && !blocked(g, nx, ny)) seen.add(k), q.push([nx, ny]);
    }
  }
  return seen;
}

// ---------- Pátio Zero ----------
function patio(): MapSpec {
  const W = 36, H = 24, g = grid(W, H, ',');
  border(g, 'F');
  rect(g, 2, 2, 11, 3, 'R'); rect(g, 2, 4, 11, 4, 'B'); rect(g, 6, 4, 7, 4, '_'); rect(g, 3, 5, 11, 7, '_');
  rect(g, 21, 2, 27, 3, 'R'); rect(g, 21, 4, 27, 4, 'B'); put(g, 24, 4, '_'); rect(g, 22, 5, 26, 6, '_');
  rect(g, 14, 8, 20, 10, '_');
  rect(g, 7, 8, 7, 12, '-'); rect(g, 7, 12, 34, 12, '-'); rect(g, 24, 7, 24, 11, '-'); rect(g, 17, 11, 17, 11, '-');
  rect(g, 33, 11, 35, 13, '-'); rect(g, 35, 11, 35, 13, '>');
  rect(g, 1, 18, 22, 18, '='); rect(g, 1, 17, 22, 17, ':'); rect(g, 1, 19, 22, 19, ':');
  put(g, 2, 18, 'Y'); put(g, 3, 18, 'J'); put(g, 4, 18, 'J');
  for (const x of [5, 12]) put(g, x, 18, 'V'), put(g, x + 1, 18, 'v'), put(g, x + 2, 18, 'v');
  for (const [x, y] of [[13, 7], [21, 13], [30, 8], [4, 13]]) put(g, x, y, 'L');
  for (const [x, y] of [[29, 5], [30, 5], [12, 6], [20, 5], [27, 7]]) put(g, x, y, 'c');
  for (const [x, y] of [[19, 6], [28, 9], [2, 9]]) put(g, x, y, 'b');
  rect(g, 30, 16, 31, 17, 'C');
  rect(g, 26, 19, 29, 21, '#'); put(g, 25, 20, 'm'); put(g, 30, 20, 'm');
  for (const [x, y] of [[31, 3], [32, 3], [32, 4], [2, 21], [3, 21], [3, 20], [11, 15], [12, 15], [33, 20], [20, 21]]) put(g, x, y, '"');
  for (const [x, y] of [[16, 2], [33, 7], [9, 15], [24, 15], [14, 21], [5, 15], [19, 15], [28, 3], [22, 20]]) put(g, x, y, '*');
  for (const [x, y] of [[2, 16], [6, 21], [13, 2], [33, 18], [18, 21], [27, 16], [3, 11]]) put(g, x, y, '^');
  for (const [x, y] of [[4, 16], [10, 21], [17, 16], [26, 15], [31, 21], [12, 10], [21, 9], [29, 12], [8, 14]]) put(g, x, y, '"');
  for (const [x, y, ch] of [[2, 8, 't'], [12, 7, 'l'], [13, 5, 'g'], [33, 15, 'e'], [32, 16, 'I'], [20, 20, 'Z'], [26, 7, 'l'], [3, 14, 'r']] as [number, number, string][]) put(g, x, y, ch);
  for (const [x, y] of [[8, 10], [18, 13], [27, 13], [5, 7], [23, 9], [29, 18]]) put(g, x, y, 'u');
  for (const [x, y] of [[12, 16], [16, 20], [28, 14], [6, 16]]) put(g, x, y, 'k');
  put(g, 8, 6, 'O');
  put(g, 24, 5, '$');
  put(g, 17, 9, 'T');
  put(g, 9, 9, '@');
  put(g, 31, 11, 's');
  put(g, 6, 11, 'N');
  return {
    id: 'patio', displayName: 'Pátio Zero', base: ',', grid: g, piles: { loot: 'yard_pile' },
    objects: [
      { type: 'exit', x: 35, y: 11, w: 1, h: 3, props: { target: 'yard', entry: 'from_patio', label: 'Pátio Ferroviário' } },
      { type: 'spawn', name: 'from_yard', x: 32, y: 12 },
      { type: 'spawn', name: 'from_terminal', x: 17, y: 12 },
      { type: 'note', x: 6, y: 11, props: { text: 'Oficina ao norte. Comerciante a nordeste. Terminal de extração ao centro. Ferro-velho a leste →' } },
    ],
  };
}

// ---------- Pátio Ferroviário (ferro-velho) ----------
function yard(): MapSpec {
  const W = 72, H = 48, r = rng(20261118), g = grid(W, H, '.');
  for (let i = 0; i < 26; i++) {
    const cx = Math.floor(r() * W), cy = Math.floor(r() * H), rad = 2 + Math.floor(r() * 4);
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad) put(g, cx + x, cy + y, r() < 0.15 ? ';' : ',');
  }
  for (let i = 0; i < 40; i++) put(g, Math.floor(r() * W), Math.floor(r() * H), 'o');
  border(g, 'F');
  const railsY = [9, 20, 35], railX = 46;
  for (const y of railsY) rect(g, 1, y - 1, W - 2, y - 1, ':'), rect(g, 1, y + 1, W - 2, y + 1, ':');
  rect(g, railX - 1, 1, railX - 1, H - 2, ':'); rect(g, railX + 1, 1, railX + 1, H - 2, ':');
  for (const y of railsY) rect(g, 1, y, W - 2, y, '=');
  rect(g, railX, 1, railX, H - 2, '|');
  for (const y of railsY) put(g, railX, y, '+');

  // Wagon trains form walls with gaps: the gaps are the alternative routes.
  for (const y of railsY) {
    let x = 3;
    while (x < W - 4) {
      const run = 2 + Math.floor(r() * 4);
      const start = x;
      // Cars are 3 tiles long (V v v); a car never sits on the crossing.
      for (let k = 0; k < run && x + 2 < W - 2; k++, x += 3) {
        if (x <= railX && railX <= x + 2) continue;
        put(g, x, y, 'V'), put(g, x + 1, y, 'v'), put(g, x + 2, y, 'v');
      }
      // Most trains get a dead locomotive at their head.
      if (r() < 0.6 && g[y][start] === 'V') put(g, start, y, 'Y'), put(g, start + 1, y, 'J'), put(g, start + 2, y, 'J');
      x += 3 + Math.floor(r() * 4);
    }
  }
  for (const y of [3, 13, 27, 39]) put(g, railX, y, 'A'), put(g, railX, y + 1, 'a'), put(g, railX, y + 2, 'a');
  rect(g, 3, 20, 11, 20, '=');
  put(g, 4, 20, 'V'); put(g, 5, 20, 'v'); put(g, 6, 20, 'v'); put(g, 8, 20, 'V'); put(g, 9, 20, 'v'); put(g, 10, 20, 'v');

  // Main route and an alternative southern loop.
  const path: [number, number, number, number][] = [
    [1, 23, 30, 23], [30, 13, 30, 23], [30, 13, 58, 13], [58, 5, 58, 13], [58, 5, 66, 5],
    [30, 23, 30, 41], [30, 41, 62, 41], [62, 27, 62, 41], [50, 27, 62, 27], [50, 13, 50, 27],
    [12, 23, 12, 30], [12, 30, 22, 30],
  ];
  const isPath = grid(W, H, '0');
  for (const [x0, y0, x1, y1] of path) {
    rect(isPath, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), '1');
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isPath[y][x] !== '1') continue;
      const ch = g[y][x];
      if ('VvYJ'.includes(ch)) g[y][x] = '=';
      else if (ch === 'A' || ch === 'a') g[y][x] = '|';
      else if (ch !== '=' && ch !== '|' && ch !== '+' && ch !== 'F') g[y][x] = '-';
    }
  // A path can cut a car: keep only complete 3-tile cars, the rest goes back to bare rail.
  const keep = new Set<string>();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [head, body] = g[y][x] === 'V' ? ['V', 'v'] : g[y][x] === 'Y' ? ['Y', 'J'] : ['', ''];
      if (head && g[y][x + 1] === body && g[y][x + 2] === body) for (let k = 0; k < 3; k++) keep.add(`${x + k},${y}`);
      if (g[y][x] === 'A' && g[y + 1]?.[x] === 'a' && g[y + 2]?.[x] === 'a') for (let k = 0; k < 3; k++) keep.add(`${x},${y + k}`);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if ('VvYJ'.includes(g[y][x]) && !keep.has(`${x},${y}`)) g[y][x] = '=';
      if ('Aa'.includes(g[y][x]) && !keep.has(`${x},${y}`)) g[y][x] = '|';
    }
  rect(g, 0, 22, 0, 25, '>');
  rect(g, 1, 22, 2, 25, '-');

  const nearPath = (x: number, y: number, d: number) => {
    for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (isPath[y + j]?.[x + i] === '1') return true;
    return false;
  };
  const free = (x: number, y: number) => '.,;o'.includes(g[y]?.[x] ?? 'X');

  // Scrap mountains, kept one tile off the paths so routes stay readable.
  const moundCenters: [number, number][] = [];
  for (let i = 0; i < 70; i++) {
    const cx = 3 + Math.floor(r() * (W - 6)), cy = 3 + Math.floor(r() * (H - 6)), rad = 1 + Math.floor(r() * 3);
    if (nearPath(cx, cy, rad + 1) || railsY.some((y) => Math.abs(y - cy) <= rad + 1)) continue;
    moundCenters.push([cx, cy]);
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++) {
        const d = x * x + y * y;
        if (d <= rad * rad && free(cx + x, cy + y)) put(g, cx + x, cy + y, d >= (rad - 1) * (rad - 1) && rad > 1 ? 'm' : r() < 0.35 ? 'n' : '#');
      }
  }

  const scatter = (ch: string, n: number, blocking: boolean, minX = 2) => {
    for (let placed = 0, tries = 0; placed < n && tries < n * 40; tries++) {
      const x = minX + Math.floor(r() * (W - minX - 2)), y = 2 + Math.floor(r() * (H - 4));
      if (!free(x, y) || nearPath(x, y, blocking ? 1 : 0)) continue;
      put(g, x, y, ch);
      placed++;
    }
  };
  // Car wrecks are 2×2 and need a clear footprint.
  for (let placed = 0, tries = 0; placed < 14 && tries < 1200; tries++) {
    const x = 4 + Math.floor(r() * (W - 8)), y = 3 + Math.floor(r() * (H - 6));
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
    if (!cells.every(([dx, dy]) => free(x + dx, y + dy) && !nearPath(x + dx, y + dy, 1))) continue;
    put(g, x, y, 'q'); put(g, x + 1, y, 'w'); put(g, x, y + 1, 'z'); put(g, x + 1, y + 1, 'x');
    placed++;
  }
  // Junk neighbourhoods: every scrap mountain gathers loose junk around it, like a real yard.
  const junkKinds = 'tttbbgecZrIp';
  for (const [cx, cy] of moundCenters) {
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 3;
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (!free(x, y) || nearPath(x, y, 1) || railsY.some((ry) => Math.abs(ry - y) <= 1)) continue;
      put(g, x, y, junkKinds[Math.floor(r() * junkKinds.length)]);
      k++;
    }
  }
  scatter('K', 10, true, 8); scatter('c', 30, true); scatter('b', 24, true); scatter('C', 12, true, 10);
  scatter('p', 10, true, 10); scatter('t', 28, true); scatter('e', 18, true); scatter('I', 14, true);
  scatter('r', 14, true); scatter('Z', 16, true); scatter('g', 16, true); scatter('M', 6, true, 10);
  scatter('l', 18, false); scatter('u', 50, false); scatter('y', 14, false); scatter('k', 80, false);
  scatter('"', 140, false); scatter('%', 30, false); scatter('*', 40, false); scatter('D', 60, false); scatter('L', 7, true);
  // Trees grow where the yard turned to grass, never next to a path.
  for (let placed = 0, tries = 0; placed < 26 && tries < 4000; tries++) {
    const x = 2 + Math.floor(r() * (W - 4)), y = 3 + Math.floor(r() * (H - 5));
    if (!',;'.includes(g[y][x]) || nearPath(x, y, 2) || g[y - 1]?.[x] === 'F') continue;
    put(g, x, y, '^');
    placed++;
  }
  for (const [x, y] of [[4, 21], [29, 12], [57, 6], [31, 40]]) put(g, x, y, 's');

  put(g, 66, 4, 'h');
  rect(g, 65, 5, 67, 5, '-');
  put(g, 8, 21, 'G');

  // Piles hug the mountains; enemies patrol the middle and east.
  const reach = reachable(g, 2, 23);
  const ok = (x: number, y: number) => reach.has(`${x},${y}`) && free(x, y) && !nearPath(x, y, 0);
  // Up to two piles per scrap mountain, plus a few in the open so every stretch has something to dig.
  let piles = 0;
  for (const [cx, cy] of moundCenters) {
    let here = 0;
    for (const [dx, dy] of [[0, 3], [3, 0], [-3, 0], [0, -3], [0, 2], [2, 0], [-2, 0], [0, -2]]) {
      if (piles >= 28 || here >= 2) break;
      if (ok(cx + dx, cy + dy)) {
        put(g, cx + dx, cy + dy, 'P');
        piles++;
        here++;
      }
    }
  }
  for (let tries = 0; piles < 34 && tries < 3000; tries++) {
    const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 6));
    if (ok(x, y) && !nearPath(x, y, 1)) put(g, x, y, 'P'), piles++;
  }
  const enemies: [string, number][] = [['E', 7], ['Q', 4], ['N', 2]];
  for (const [ch, n] of enemies)
    for (let placed = 0, tries = 0; placed < n && tries < 2000; tries++) {
      const x = 18 + Math.floor(r() * (W - 20)), y = 2 + Math.floor(r() * (H - 4));
      if (ok(x, y) || (reach.has(`${x},${y}`) && g[y][x] === '-' && r() < 0.2)) put(g, x, y, ch), placed++;
    }

  return {
    id: 'yard', displayName: 'Pátio Ferroviário', base: '.', grid: g, piles: { loot: 'yard_pile' },
    objects: [
      { type: 'exit', x: 0, y: 22, w: 1, h: 4, props: { target: 'patio', entry: 'from_yard', label: 'Pátio Zero' } },
      { type: 'exit', x: 66, y: 4, w: 1, h: 1, props: { target: 'dungeon', entry: 'from_yard', label: 'Estação de Triagem Soterrada' } },
      { type: 'spawn', name: 'from_patio', x: 3, y: 23 },
      { type: 'spawn', name: 'from_dungeon', x: 66, y: 6 },
      { type: 'note', x: 4, y: 21, props: { text: 'Sob o primeiro vagão, algo pulsa. Vasculhe as pilhas que brilham (E).' } },
      { type: 'note', x: 57, y: 6, props: { text: 'Estação de Triagem Soterrada. O guindaste ainda trabalha lá embaixo.' } },
    ],
  };
}

// ---------- Estação de Triagem Soterrada ----------
function dungeon(): MapSpec {
  const W = 32, H = 28, g = grid(W, H, 'W');
  rect(g, 14, 21, 17, 26, 'd');
  rect(g, 3, 14, 28, 20, 'd');
  rect(g, 14, 11, 17, 13, 'd');
  rect(g, 4, 2, 27, 10, 'd');
  rect(g, 6, 17, 12, 17, '~'); rect(g, 19, 17, 25, 17, '~');
  for (const [x, y] of [[8, 4], [23, 4], [8, 8], [23, 8]]) put(g, x, y, 'p');
  for (const [x, y] of [[4, 14], [27, 14], [13, 20], [18, 20]]) put(g, x, y, 'c');
  for (const [x, y] of [[5, 3], [26, 9], [11, 6], [20, 3], [9, 19], [24, 15]]) put(g, x, y, 'D');
  put(g, 3, 20, 'b'); put(g, 28, 20, 'b');
  for (const [x, y, ch] of [[5, 9, 'Z'], [26, 3, 'Z'], [12, 2, 'I'], [19, 9, 'I'], [6, 20, 'g'], [26, 20, 'e'], [4, 18, 't']] as [number, number, string][]) put(g, x, y, ch);
  for (const [x, y] of [[10, 5], [21, 7], [14, 9], [9, 16], [23, 19], [16, 23], [15, 18]]) put(g, x, y, 'k');
  for (const [x, y] of [[13, 6], [18, 3], [11, 18], [20, 15]]) put(g, x, y, 'u');
  rect(g, 15, 26, 16, 26, '>');
  for (const [x, y] of [[5, 15], [26, 16], [8, 20], [21, 20], [16, 15], [11, 19], [24, 18], [6, 9], [25, 6], [15, 22]]) put(g, x, y, 'P');
  put(g, 10, 15, 'H'); put(g, 22, 18, 'U'); put(g, 19, 15, 'N'); put(g, 8, 16, 'Q'); put(g, 24, 15, 'Q');
  put(g, 15, 4, 'X');
  return {
    id: 'dungeon', displayName: 'Estação de Triagem Soterrada', base: 'd', grid: g, piles: { loot: 'dungeon_pile' },
    objects: [
      { type: 'exit', x: 15, y: 26, w: 2, h: 1, props: { target: 'yard', entry: 'from_dungeon', label: 'Pátio Ferroviário' } },
      { type: 'spawn', name: 'from_yard', x: 15, y: 24 },
      { type: 'note', x: 15, y: 12, props: { text: 'Quando a linha amarela piscar, o ímã vai puxar. Use a Investida (3) para escapar.' } },
    ],
  };
}

// ---------- Tiled export ----------
/** Interactive markers sit on whatever floor surrounds them (concrete pad, path, gravel). */
function neighborTerrain(g: Grid, x: number, y: number): number | null {
  const votes = new Map<number, number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = LEGEND[g[y + dy]?.[x + dx] ?? '']?.[0];
    if (t && t !== TILES.wall) votes.set(t, (votes.get(t) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [t, n] of votes) if (best === null || n > votes.get(best)!) best = t;
  return best;
}

function toTiled(spec: MapSpec) {
  const g = spec.grid, H = g.length, W = g[0].length;
  const baseTerrain = LEGEND[spec.base][0]!;
  const terrain: number[] = [], objects: number[] = [], collision: number[] = [];
  const objs: Obj[] = [...spec.objects];
  let pileN = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      const def = LEGEND[ch] ?? [neighborTerrain(g, x, y) ?? baseTerrain, 0];
      terrain.push(def[0] ?? baseTerrain);
      objects.push(def[1]);
      collision.push(blocked(g, x, y) ? TILES.solid : 0);
      if (!INTERACT_CHARS.includes(ch)) continue;
      if (ch === '@') objs.push({ type: 'spawn', name: 'default', x, y });
      if (ch === 'P') objs.push({ type: 'pile', name: `${spec.id}_pile_${++pileN}`, x, y, props: { loot: spec.piles.loot } });
      if (ch === 'G') objs.push({ type: 'pile', name: 'first_wagon', x, y, props: { loot: spec.piles.loot, special: 'first_wagon' } });
      if (ch === 'E') objs.push({ type: 'enemy', x, y, props: { kind: 'sorter' } });
      if (ch === 'H') objs.push({ type: 'enemy', x, y, props: { kind: 'press' } });
      if (ch === 'Q') objs.push({ type: 'enemy', x, y, props: { kind: 'sparkbot' } });
      if (ch === 'N') objs.push({ type: 'enemy', x, y, props: { kind: 'magnetron' } });
      if (ch === 'U') objs.push({ type: 'enemy', x, y, props: { kind: 'scrapgolem' } });
      if (ch === 'X') objs.push({ type: 'boss', name: 'crane', x, y, props: { kind: 'crane' } });
      if (ch === 'O') objs.push({ type: 'workbench', x, y });
      if (ch === '$') objs.push({ type: 'vendor', x, y });
      if (ch === 'T') objs.push({ type: 'terminal', x, y });
    }
  const spawn = objs.find((o) => o.type === 'spawn')!;
  const reach = reachable(g, spawn.x, spawn.y);
  for (const o of objs) {
    if (['pile', 'enemy', 'boss', 'workbench', 'vendor', 'terminal', 'spawn'].includes(o.type) && !reach.has(`${o.x},${o.y}`)) {
      const near = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => reach.has(`${o.x + dx},${o.y + dy}`));
      if (!near) throw new Error(`${spec.id}: ${o.type} ${o.name ?? ''} at ${o.x},${o.y} is unreachable`);
    }
  }
  const layer = (id: number, name: string, data: number[], visible = true) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible, data });
  return {
    type: 'map', version: '1.10', tiledversion: '1.11.0', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: W, height: H, tilewidth: TILE_SIZE, tileheight: TILE_SIZE, compressionlevel: -1, nextlayerid: 5, nextobjectid: objs.length + 1,
    properties: [{ name: 'displayName', type: 'string', value: spec.displayName }],
    layers: [
      layer(1, 'terrain', terrain),
      layer(2, 'objects', objects),
      layer(3, 'collision', collision, false),
      {
        id: 4, name: 'interact', type: 'objectgroup', draworder: 'topdown', opacity: 1, visible: true, x: 0, y: 0,
        objects: objs.map((o, i) => ({
          id: i + 1, name: o.name ?? '', type: o.type, x: o.x * TILE_SIZE, y: o.y * TILE_SIZE,
          width: (o.w ?? 1) * TILE_SIZE, height: (o.h ?? 1) * TILE_SIZE, rotation: 0, visible: true,
          properties: Object.entries(o.props ?? {}).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string', value })),
        })),
      },
    ],
    tilesets: [{
      firstgid: 1, name: 'scrapo', tilewidth: TILE_SIZE, tileheight: TILE_SIZE, tilecount: TILE_COUNT, columns: TILESET_COLUMNS,
      image: '../tiles/scrapo-tiles.png', imagewidth: TILESET_COLUMNS * TILE_SIZE, imageheight: Math.ceil(TILE_COUNT / TILESET_COLUMNS) * TILE_SIZE, margin: 0, spacing: 0,
    }],
  };
}

const tiles = drawTileset();
mkdirSync(join(ROOT, 'public/tiles'), { recursive: true });
mkdirSync(join(ROOT, 'public/maps'), { recursive: true });
writeFileSync(join(ROOT, 'public/tiles/scrapo-tiles.png'), encodePng(tiles.width, tiles.height, tiles.data));
console.log('tileset  public/tiles/scrapo-tiles.png');
for (const spec of [patio(), yard(), dungeon()]) {
  const file = join(ROOT, `public/maps/${spec.id}.json`);
  const json = toTiled(spec);
  if (existsSync(file) && !FORCE) {
    console.log(`skip     public/maps/${spec.id}.json (exists; --force overwrites Tiled edits)`);
    continue;
  }
  writeFileSync(file, JSON.stringify(json));
  console.log(`map      public/maps/${spec.id}.json ${spec.grid[0].length}x${spec.grid.length}`);
  if (process.argv.includes('--ascii')) console.log(spec.grid.map((row) => row.join('')).join('\n'));
}
