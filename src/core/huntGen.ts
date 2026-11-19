import type { EnemyKind } from '../data/enemies';
import { BIOMES, regionOf, type AreaSize, type Biome, type HuntArea } from '../data/hunt';
import { TILES } from '../art/tileArt';
import { mixSeed, mulberry32, type Rng } from './rng';

export interface Cell { x: number; y: number }

/** A generated hunt area in tile coordinates. Layers are row-major, 0 = no object. */
export interface HuntGrid {
  width: number;
  height: number;
  /** 1 = wall (blocked), 0 = floor. */
  walls: Uint8Array;
  terrain: number[];
  objects: number[];
  playerSpawn: Cell;
  exit: Cell;
  enemies: (Cell & { kind: EnemyKind })[];
  piles: (Cell & { table: string })[];
}

export const SIZES: Record<AreaSize, { w: number; h: number; enemies: number; piles: number }> = {
  small: { w: 36, h: 26, enemies: 5, piles: 3 },
  medium: { w: 48, h: 34, enemies: 8, piles: 5 },
  large: { w: 60, h: 42, enemies: 12, piles: 7 },
};

const WALL_CHANCE = 0.45;
const SMOOTH_STEPS = 4;
const MIN_OPEN_SHARE = 0.4;
const CAVE_ATTEMPTS = 12;
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

const isWall = (walls: Uint8Array, w: number, h: number, x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || walls[y * w + x] === 1;
const openAround = (walls: Uint8Array, w: number, h: number, c: Cell, n: readonly (readonly [number, number])[]) => n.every(([dx, dy]) => !isWall(walls, w, h, c.x + dx, c.y + dy));

/** Breadth-first distance from `from` over floor cells; -1 where unreachable. */
export function floodDistances(walls: Uint8Array, w: number, h: number, from: Cell): Int32Array {
  const dist = new Int32Array(w * h).fill(-1);
  if (isWall(walls, w, h, from.x, from.y)) return dist;
  const queue = [from.y * w + from.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % w, y = (i - x) / w;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy, ni = ny * w + nx;
      if (isWall(walls, w, h, nx, ny) || dist[ni] >= 0) continue;
      dist[ni] = dist[i] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/** Cellular-automata cave, reduced to its largest open region; a plain hall when no attempt is roomy enough. */
function carveCave(rng: Rng, w: number, h: number): Uint8Array {
  const interior = (w - 2) * (h - 2);
  for (let attempt = 0; attempt < CAVE_ATTEMPTS; attempt++) {
    let walls = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) walls[y * w + x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || rng() < WALL_CHANCE ? 1 : 0;
    for (let step = 0; step < SMOOTH_STEPS; step++) {
      const next = new Uint8Array(w * h).fill(1);
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const n = N8.reduce((s, [dx, dy]) => s + walls[(y + dy) * w + x + dx], 0);
          next[y * w + x] = n >= 5 ? 1 : n <= 3 ? 0 : walls[y * w + x];
        }
      walls = next;
    }
    const kept = keepLargestRegion(walls, w, h);
    if (kept >= interior * MIN_OPEN_SHARE) return walls;
  }
  const hall = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hall[y * w + x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? 1 : 0;
  return hall;
}

/** Fills every floor region but the largest; returns its size. */
function keepLargestRegion(walls: Uint8Array, w: number, h: number): number {
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0;
  for (let i = 0; i < w * h; i++) {
    if (walls[i] || label[i] >= 0) continue;
    const dist = floodDistances(walls, w, h, { x: i % w, y: Math.floor(i / w) });
    let size = 0;
    for (let j = 0; j < w * h; j++) if (dist[j] >= 0) (label[j] = i), size++;
    if (size > bestSize) (best = i), (bestSize = size);
  }
  for (let i = 0; i < w * h; i++) if (!walls[i] && label[i] !== best) walls[i] = 1;
  return bestSize;
}

function shuffled<T>(rng: Rng, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks up to `count` cells, each at least `gap` (Chebyshev) from the others and from `taken`. */
function spread(rng: Rng, pool: Cell[], count: number, gap: number, taken: Cell[]): Cell[] {
  const picked: Cell[] = [];
  for (const c of shuffled(rng, pool)) {
    if (picked.length >= count) break;
    if ([...taken, ...picked].some((o) => Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) < gap)) continue;
    picked.push(c);
  }
  return picked;
}

function paint(rng: Rng, biome: Biome, walls: Uint8Array, w: number, h: number, reserved: Set<number>): { terrain: number[]; objects: number[] } {
  const patchSeed = (rng() * 2 ** 32) >>> 0;
  const terrain: number[] = [], objects: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (walls[i]) {
        terrain.push(biome.wallTerrain);
        const facesFloor = N8.some(([dx, dy]) => !isWall(walls, w, h, x + dx, y + dy));
        objects.push(rng() < (facesFloor ? 0.55 : biome.deepFill) ? biome.wallProps[Math.floor(rng() * biome.wallProps.length)] : 0);
        continue;
      }
      // 4×4 patches of one floor tile read as ground, not noise
      terrain.push(biome.floor[mixSeed(patchSeed, ((y >> 2) << 16) | (x >> 2)) % biome.floor.length]);
      objects.push(!reserved.has(i) && rng() < 0.05 ? biome.decals[Math.floor(rng() * biome.decals.length)] : 0);
    }
  return { terrain, objects };
}

/** Same area (same seed) always yields the same grid. Pure: no Phaser, no Math.random. */
export function generateArea(area: HuntArea): HuntGrid {
  const { w, h, enemies: enemyCount, piles: pileCount } = SIZES[area.size];
  const rng = mulberry32(area.seed);
  const walls = carveCave(rng, w, h);
  const floor: Cell[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!walls[y * w + x]) floor.push({ x, y });

  const roomy = floor.filter((c) => openAround(walls, w, h, c, N8));
  const westmost = (list: Cell[]) => list.reduce((a, c) => (c.x * 4 + Math.abs(c.y - h / 2) < a.x * 4 + Math.abs(a.y - h / 2) ? c : a));
  const playerSpawn = westmost(roomy.length ? roomy : floor);
  const dist = floodDistances(walls, w, h, playerSpawn);
  const d = (c: Cell) => dist[c.y * w + c.x];

  const exitPool = floor.filter((c) => d(c) >= 3 && d(c) <= 5 && openAround(walls, w, h, c, N4));
  const exit = exitPool[0] ?? floor.reduce((a, c) => (d(c) > d(a) ? c : a));

  const far = roomy.filter((c) => d(c) >= 10);
  const enemyCells = spread(rng, far.length >= enemyCount ? far : roomy.filter((c) => d(c) >= 4), enemyCount, 4, [playerSpawn, exit]);
  const kinds = area.enemies;
  const enemies = enemyCells.map((c, i) => ({ ...c, kind: i < kinds.length ? kinds[i] : kinds[Math.floor(rng() * kinds.length)] }));

  const pilePool = floor.filter((c) => d(c) >= 4 && openAround(walls, w, h, c, N4));
  const piles = spread(rng, pilePool, pileCount, 3, [playerSpawn, exit, ...enemyCells]).map((c) => ({ ...c, table: area.loot }));

  const reserved = new Set([playerSpawn, exit, ...enemyCells, ...piles].map((c) => c.y * w + c.x));
  const { terrain, objects } = paint(rng, BIOMES[regionOf(area).biome], walls, w, h, reserved);
  objects[exit.y * w + exit.x] = TILES.exitArrow;
  return { width: w, height: h, walls, terrain, objects, playerSpawn, exit, enemies, piles };
}
