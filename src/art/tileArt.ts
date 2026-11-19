// Pure raster code (no DOM, no imports) so Node can bake the Tiled tileset PNG from the same source.

export const TILE_SIZE = 16;
export const TILESET_COLUMNS = 12;

export const TILES = {
  dirt: 1, dirtDark: 2, grass: 3, tallGrass: 4, gravel: 5, concrete: 6,
  railH: 7, railV: 8, railX: 9, floor: 10, path: 11, conveyor: 12,
  mound: 13, moundSmall: 14, fence: 15, wall: 16, crate: 17, barrel: 18,
  wagonL: 19, wagonR: 20, forklift: 21, weeds: 22, cables: 23, sign: 24,
  bush: 25, container: 26, bwall: 27, roof: 28, lamp: 29, hatch: 30,
  exitArrow: 31, solid: 32, wagonT: 33, wagonB: 34, debris: 35, pipe: 36,
  tires: 37, engine: 38, carTL: 39, carTR: 40, carBL: 41, carBR: 42, girders: 43, fridge: 44,
  robotHusk: 45, pallet: 46, oilStain: 47, puddle: 48, locoL: 49, locoR: 50, moundRust: 51,
  drums: 52, plates: 53, craneArm: 54, tree: 55,
} as const;

export const TILE_COUNT = 55;

export const BLOCKING: readonly number[] = [
  TILES.mound, TILES.moundSmall, TILES.fence, TILES.wall, TILES.crate, TILES.barrel,
  TILES.wagonL, TILES.wagonR, TILES.forklift, TILES.sign, TILES.container, TILES.bwall,
  TILES.roof, TILES.lamp, TILES.wagonT, TILES.wagonB, TILES.pipe,
  TILES.tires, TILES.engine, TILES.carTL, TILES.carTR, TILES.carBL, TILES.carBR, TILES.girders,
  TILES.fridge, TILES.robotHusk, TILES.locoL, TILES.locoR, TILES.moundRust, TILES.drums, TILES.craneArm, TILES.tree,
];

/** Flat ground decals: no shadow, no collision. */
export const DECALS: readonly number[] = [TILES.oilStain, TILES.puddle, TILES.plates, TILES.debris, TILES.cables, TILES.exitArrow, TILES.hatch];

type RGBA = [number, number, number, number];

function hex(h: string, a = 255): RGBA {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

const C = {
  ink: hex('#1b1a24'),
  dirt: hex('#b68a57'), dirtLo: hex('#805638'), dirtHi: hex('#dfb571'),
  dirtDark: hex('#78513b'),
  grass: hex('#638443'), grassLo: hex('#3e663d'), grassHi: hex('#9aae52'),
  gravel: hex('#a3916e'), gravelLo: hex('#716a57'), gravelHi: hex('#c8b889'),
  concrete: hex('#d4c58f'), concreteLo: hex('#9a8a63'), concreteHi: hex('#eee0ad'),
  wood: hex('#89502e'), woodLo: hex('#553129'), woodHi: hex('#c08045'),
  rail: hex('#b8bcc4'), railHi: hex('#e0e4ea'), railLo: hex('#6a6e76'),
  floor: hex('#766c88'), floorLo: hex('#4e4b65'), floorHi: hex('#a094b4'),
  path: hex('#a88d63'), pathLo: hex('#937a54'), pathHi: hex('#bea276'),
  belt: hex('#3a3d44'), beltHi: hex('#555a63'), hazard: hex('#d9a62b'),
  rust: hex('#9b5a32'), rustLo: hex('#6f3c22'), rustHi: hex('#b8733f'),
  metal: hex('#8d949c'), metalLo: hex('#5d636b'), metalHi: hex('#c4c9cf'),
  mesh: hex('#a7adb5', 200),
  wall: hex('#2e3138'), wallHi: hex('#40454e'), wallLo: hex('#22252b'),
  crate: hex('#9c6b3a'), crateLo: hex('#74502b'),
  barrel: hex('#8c3b2e'), barrelHi: hex('#b5523f'),
  wagon: hex('#7a3326'), wagonLo: hex('#561f17'), wagonHi: hex('#9c4a35'),
  yellow: hex('#d9a62b'), yellowLo: hex('#a57a1c'),
  leaf: hex('#3f7a34'), leafHi: hex('#62a14b'), leafLo: hex('#2d5a26'),
  copper: hex('#c4713a'),
  paper: hex('#d8c48f'),
  blue: hex('#3d6a8a'), blueLo: hex('#2c4f69'), blueHi: hex('#5585a6'),
  brick: hex('#6b5847'), brickLo: hex('#54453a'),
  roof: hex('#8a5a3c'), roofLo: hex('#6d4630'), roofHi: hex('#a46e4b'),
  glow: hex('#f6e7a1'), cyan: hex('#5fd0d8'), cyanLo: hex('#2e8c96'),
  solid: hex('#ff00ff', 90),
};

export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Tile {
  r: Raster;
  ox: number;
  oy: number;
  constructor(r: Raster, ox: number, oy: number) {
    this.r = r;
    this.ox = ox;
    this.oy = oy;
  }
  px(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) return;
    const i = ((this.oy + y) * this.r.width + (this.ox + x)) * 4;
    this.r.data[i] = c[0];
    this.r.data[i + 1] = c[1];
    this.r.data[i + 2] = c[2];
    this.r.data[i + 3] = c[3];
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  speckle(rng: () => number, colors: RGBA[], density: number): void {
    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++) if (rng() < density) this.px(x, y, colors[Math.floor(rng() * colors.length)]);
  }
  disc(cx: number, cy: number, r: number, c: RGBA): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) this.px(cx + x, cy + y, c);
  }
}

type Painter = (t: Tile, rng: () => number) => void;

const ground = (base: RGBA, lo: RGBA, hi: RGBA, d = 0.18): Painter => (t, rng) => {
  t.rect(0, 0, 16, 16, base);
  t.speckle(rng, [lo, hi], d);
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rng() * 15), y = Math.floor(rng() * 14);
    t.px(x, y, hi);
    t.px(x + 1, y, hi);
    t.px(x, y + 1, lo);
    t.px(x + 1, y + 1, lo);
  }
};

function stoneGround(t: Tile, rng: () => number, base: RGBA, lo: RGBA, hi: RGBA): void {
  t.rect(0, 0, 16, 16, base);
  for (const [x, y, w] of [[1, 2, 6], [8, 2, 6], [0, 6, 5], [6, 6, 8], [2, 10, 6], [9, 10, 7]] as [number, number, number][]) {
    t.rect(x, y, w, 1, hi); t.rect(x, y + 2, w, 1, lo); t.px(x, y + 1, hi); t.px(x + w - 1, y + 1, lo);
  }
  if (rng() < 0.7) { t.rect(2, 12, 4, 1, C.leafLo); t.rect(4, 11, 2, 1, C.leaf); }
}

function lumps(t: Tile, rng: () => number, n: number, minR: number, maxR: number, area: number): void {
  for (let i = 0; i < n; i++) {
    const r = minR + Math.floor(rng() * (maxR - minR + 1));
    const cx = 8 + Math.floor((rng() - 0.5) * area);
    const cy = 9 + Math.floor((rng() - 0.5) * area);
    const pick = rng();
    const [base, lo, hi] = pick < 0.45 ? [C.rust, C.rustLo, C.rustHi] : pick < 0.85 ? [C.metal, C.metalLo, C.metalHi] : [C.wood, C.woodLo, C.woodHi];
    t.disc(cx, cy + 1, r, C.ink);
    t.disc(cx, cy, r, lo);
    t.disc(cx, cy - 1, Math.max(0, r - 1), base);
    t.px(cx - 1, cy - r + 1, hi);
    t.px(cx, cy - r + 1, hi);
  }
}

function railBed(t: Tile, rng: () => number): void {
  ground(C.gravel, C.gravelLo, C.gravelHi, 0.3)(t, rng);
}

const PAINTERS: Record<number, Painter> = {
  [TILES.dirt]: (t, rng) => { ground(C.dirt, C.dirtLo, C.dirtHi, 0.04)(t, rng); for (const [x, y] of [[3, 4], [11, 8], [6, 13]]) { t.px(x, y, C.dirtHi); t.px(x + 1, y, C.dirtLo); } },
  [TILES.dirtDark]: (t, rng) => { ground(C.dirtDark, C.dirtLo, C.dirt, 0.04)(t, rng); for (let i = 0; i < 3; i++) t.disc(3 + Math.floor(rng() * 10), 4 + Math.floor(rng() * 9), 1, C.dirtLo); },
  [TILES.grass]: (t, rng) => {
    ground(C.grass, C.grassLo, C.grassHi, 0.04)(t, rng);
    t.rect(1, 3, 4, 2, C.grassLo); t.rect(2, 2, 2, 1, C.grassHi);
    if (rng() < 0.65) { t.disc(12, 11, 2, C.gravelLo); t.disc(11, 10, 1, C.gravelHi); t.rect(9, 11, 2, 2, C.leafLo); }
    if (rng() < 0.55) { t.px(6, 8, C.yellow); t.px(7, 8, C.yellow); t.px(6, 9, C.yellow); t.px(7, 9, C.grassHi); }
  },
  [TILES.tallGrass]: (t, rng) => {
    t.rect(0, 0, 16, 16, C.grassLo);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rng() * 16), y = 3 + Math.floor(rng() * 13), h = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < h; k++) t.px(x, y - k, k === h - 1 ? C.grassHi : C.grass);
    }
  },
  [TILES.gravel]: (t, rng) => { ground(C.gravel, C.gravelLo, C.gravelHi, 0.05)(t, rng); for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(rng() * 13), y = 2 + Math.floor(rng() * 12); t.disc(x, y, 1, C.gravelLo); t.px(x - 1, y - 1, C.gravelHi); } },
  [TILES.concrete]: (t, rng) => {
    t.rect(0, 0, 16, 16, C.concrete);
    t.rect(0, 0, 16, 1, C.concreteHi); t.rect(0, 0, 1, 16, C.concreteHi); t.rect(15, 0, 1, 16, C.concreteLo); t.rect(0, 15, 16, 1, C.concreteLo);
    t.rect(7, 0, 1, 16, C.concreteLo); t.rect(0, 8, 16, 1, C.concreteLo); t.rect(7, 1, 1, 7, C.concreteHi); t.rect(1, 8, 6, 1, C.concreteHi);
    if (rng() < 0.6) { t.px(3, 4, C.concreteLo); t.px(4, 5, C.concreteLo); t.px(5, 5, C.concreteLo); }
  },
  [TILES.railH]: (t, rng) => {
    railBed(t, rng);
    for (let x = 1; x < 16; x += 4) t.rect(x, 2, 2, 12, C.wood), t.rect(x, 13, 2, 1, C.woodLo);
    for (const y of [4, 11]) t.rect(0, y, 16, 1, C.railHi), t.rect(0, y + 1, 16, 1, C.railLo);
  },
  [TILES.railV]: (t, rng) => {
    railBed(t, rng);
    for (let y = 1; y < 16; y += 4) t.rect(2, y, 12, 2, C.wood), t.rect(2, y + 2, 12, 1, C.woodLo);
    for (const x of [4, 11]) t.rect(x, 0, 1, 16, C.railHi), t.rect(x + 1, 0, 1, 16, C.railLo);
  },
  [TILES.railX]: (t, rng) => {
    railBed(t, rng);
    t.rect(2, 2, 12, 12, C.wood);
    for (const y of [4, 11]) t.rect(0, y, 16, 1, C.railHi), t.rect(0, y + 1, 16, 1, C.railLo);
    for (const x of [4, 11]) t.rect(x, 0, 1, 16, C.railHi), t.rect(x + 1, 0, 1, 16, C.railLo);
  },
  [TILES.floor]: (t, rng) => stoneGround(t, rng, C.floor, C.floorLo, C.floorHi),
  [TILES.path]: (t, rng) => { t.rect(0, 0, 16, 16, C.path); for (let y = 1; y < 16; y += 5) { t.rect(0, y, 16, 1, C.pathLo); for (let x = (y % 2 ? 2 : 0); x < 16; x += 7) t.rect(x, y - 3, 1, 4, C.pathLo); } for (let i = 0; i < 3; i++) t.px(2 + Math.floor(rng() * 12), 2 + Math.floor(rng() * 12), C.pathHi); },
  [TILES.conveyor]: (t) => {
    t.rect(0, 0, 16, 16, C.belt);
    t.rect(0, 1, 16, 1, C.hazard);
    t.rect(0, 14, 16, 1, C.hazard);
    for (let x = 0; x < 16; x += 3) t.rect(x, 3, 1, 10, C.beltHi);
  },
  [TILES.mound]: (t, rng) => lumps(t, rng, 9, 2, 4, 12),
  [TILES.moundSmall]: (t, rng) => lumps(t, rng, 4, 2, 3, 8),
  [TILES.fence]: (t) => {
    for (let i = 0; i < 16; i++) {
      t.px(i, (i + 0) % 16 < 16 ? 7 + ((i % 4) < 2 ? 0 : 1) : 7, C.mesh);
      t.px(i, 4, C.mesh);
      t.px(i, 11, C.mesh);
    }
    for (let i = 0; i < 16; i += 2) t.px(i, 6, C.mesh), t.px(i + 1, 9, C.mesh);
    t.rect(1, 2, 2, 12, C.railLo);
    t.rect(1, 2, 1, 12, C.metal);
    t.rect(13, 2, 2, 12, C.railLo);
    t.rect(13, 2, 1, 12, C.metal);
  },
  [TILES.wall]: (t) => {
    t.rect(0, 0, 16, 16, C.wall);
    for (let y = 0; y < 16; y += 4) {
      t.rect(0, y, 16, 1, C.wallLo);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) t.rect(x, y, 1, 4, C.wallLo);
      t.rect(0, y + 1, 16, 1, C.wallHi);
    }
  },
  [TILES.crate]: (t) => {
    t.rect(1, 2, 14, 13, C.ink);
    t.rect(2, 2, 12, 11, C.crate);
    for (const y of [5, 9]) t.rect(2, y, 12, 1, C.crateLo);
    t.rect(2, 2, 12, 1, C.woodHi);
    t.rect(2, 13, 12, 1, C.crateLo);
  },
  [TILES.barrel]: (t) => {
    t.disc(8, 9, 6, C.ink);
    t.disc(8, 8, 5, C.barrel);
    t.disc(8, 8, 3, C.barrelHi);
    t.disc(8, 8, 1, C.ink);
    t.px(6, 5, C.metalHi);
  },
  [TILES.wagonL]: (t, rng) => {
    // Open hopper: rail lines at y=4/11 remain visible except beneath its bogie.
    t.rect(1, 5, 15, 1, C.ink); t.rect(1, 10, 15, 1, C.ink);
    t.rect(1, 6, 15, 4, C.wagon); t.rect(2, 6, 14, 1, C.wagonHi); t.rect(2, 9, 14, 1, C.wagonLo);
    t.rect(3, 7, 13, 2, C.ink); t.rect(4, 7, 12, 1, C.rustLo);
    for (const x of [2, 7, 12]) { t.rect(x, 5, 1, 6, C.wagonHi); t.px(x, 5, C.metalHi); t.px(x, 10, C.rust); }
    t.rect(0, 7, 2, 2, C.metalLo); t.px(0, 7, C.metalHi);
    t.rect(4, 3, 4, 2, C.ink); t.rect(5, 4, 2, 1, C.metalLo);
    for (let i = 0; i < 3; i++) t.px(4 + Math.floor(rng() * 10), 7 + Math.floor(rng() * 2), C.rust);
  },
  [TILES.wagonR]: (t, rng) => {
    t.rect(0, 5, 15, 1, C.ink); t.rect(0, 10, 15, 1, C.ink);
    t.rect(0, 6, 15, 4, C.wagon); t.rect(0, 6, 14, 1, C.wagonHi); t.rect(0, 9, 14, 1, C.wagonLo);
    t.rect(0, 7, 13, 2, C.ink); t.rect(0, 7, 12, 1, C.rustLo);
    for (const x of [2, 7, 12]) { t.rect(x, 5, 1, 6, C.wagonHi); t.px(x, 5, C.metalHi); t.px(x, 10, C.rust); }
    t.rect(14, 7, 2, 2, C.metalLo); t.px(15, 7, C.metalHi);
    t.rect(8, 3, 4, 2, C.ink); t.rect(9, 4, 2, 1, C.metalLo);
    for (let i = 0; i < 3; i++) t.px(1 + Math.floor(rng() * 10), 7 + Math.floor(rng() * 2), C.rust);
  },
  [TILES.wagonT]: (t, rng) => {
    t.rect(5, 1, 1, 15, C.ink); t.rect(10, 1, 1, 15, C.ink);
    t.rect(6, 1, 4, 15, C.wagon); t.rect(6, 2, 1, 14, C.wagonHi); t.rect(9, 2, 1, 14, C.wagonLo);
    t.rect(7, 3, 2, 13, C.ink); t.rect(7, 4, 1, 12, C.rustLo);
    for (const y of [2, 7, 12]) { t.rect(5, y, 6, 1, C.wagonHi); t.px(5, y, C.metalHi); t.px(10, y, C.rust); }
    t.rect(7, 0, 2, 2, C.metalLo); t.px(7, 0, C.metalHi);
    t.rect(3, 4, 2, 4, C.ink); t.rect(4, 5, 1, 2, C.metalLo);
    for (let i = 0; i < 3; i++) t.px(7 + Math.floor(rng() * 2), 4 + Math.floor(rng() * 10), C.rust);
  },
  [TILES.wagonB]: (t, rng) => {
    t.rect(5, 0, 1, 15, C.ink); t.rect(10, 0, 1, 15, C.ink);
    t.rect(6, 0, 4, 15, C.wagon); t.rect(6, 0, 1, 14, C.wagonHi); t.rect(9, 0, 1, 14, C.wagonLo);
    t.rect(7, 0, 2, 13, C.ink); t.rect(7, 0, 1, 12, C.rustLo);
    for (const y of [2, 7, 12]) { t.rect(5, y, 6, 1, C.wagonHi); t.px(5, y, C.metalHi); t.px(10, y, C.rust); }
    t.rect(7, 14, 2, 2, C.metalLo); t.px(7, 15, C.metalHi);
    t.rect(3, 8, 2, 4, C.ink); t.rect(4, 9, 1, 2, C.metalLo);
    for (let i = 0; i < 3; i++) t.px(7 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 10), C.rust);
  },
  [TILES.forklift]: (t) => {
    t.rect(2, 3, 10, 11, C.ink);
    t.rect(3, 3, 8, 10, C.yellow);
    t.rect(3, 9, 8, 4, C.yellowLo);
    t.rect(5, 4, 4, 4, C.ink);
    t.rect(12, 4, 1, 3, C.metal);
    t.rect(12, 10, 1, 3, C.metal);
    t.rect(13, 4, 3, 1, C.metalHi);
    t.rect(13, 12, 2, 1, C.metalHi);
    t.rect(2, 14, 3, 2, C.ink);
    t.rect(9, 14, 3, 2, C.ink);
  },
  [TILES.weeds]: (t, rng) => {
    for (let i = 0; i < 9; i++) {
      const x = 2 + Math.floor(rng() * 12), y = 8 + Math.floor(rng() * 7), h = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < h; k++) t.px(x + (k > 2 ? (i % 2 ? 1 : -1) : 0), y - k, k === h - 1 ? C.leafHi : C.leaf);
    }
  },
  [TILES.cables]: (t) => {
    for (let x = 0; x < 16; x++) {
      t.px(x, 6 + Math.round(Math.sin(x / 2.5) * 2), C.ink);
      t.px(x, 10 + Math.round(Math.cos(x / 3) * 2), C.copper);
    }
  },
  [TILES.sign]: (t) => {
    t.rect(7, 8, 2, 8, C.woodLo);
    t.rect(2, 2, 12, 7, C.ink);
    t.rect(3, 3, 10, 5, C.paper);
    t.rect(4, 4, 6, 1, C.woodLo);
    t.rect(4, 6, 8, 1, C.woodLo);
  },
  [TILES.bush]: (t) => {
    t.disc(8, 10, 6, C.ink);
    t.disc(8, 9, 5, C.leafLo);
    t.disc(7, 8, 4, C.leaf);
    t.disc(6, 7, 2, C.leafHi);
  },
  [TILES.container]: (t) => {
    t.rect(0, 1, 16, 14, C.ink);
    t.rect(0, 2, 16, 12, C.blue);
    for (let x = 1; x < 16; x += 3) t.rect(x, 2, 1, 12, C.blueLo);
    t.rect(0, 2, 16, 1, C.blueHi);
  },
  [TILES.bwall]: (t) => {
    t.rect(0, 0, 16, 16, C.brick);
    for (let y = 2; y < 16; y += 4) t.rect(0, y, 16, 1, C.brickLo);
    t.rect(4, 4, 8, 6, C.ink);
    t.rect(5, 5, 6, 4, C.cyanLo);
    t.rect(5, 5, 2, 1, C.cyan);
    t.rect(0, 15, 16, 1, C.ink);
  },
  [TILES.roof]: (t) => {
    t.rect(0, 0, 16, 16, C.roof);
    for (let x = 0; x < 16; x += 4) t.rect(x, 0, 1, 16, C.roofLo), t.rect(x + 1, 0, 1, 16, C.roofHi);
  },
  [TILES.lamp]: (t) => {
    t.disc(8, 4, 3, hex('#f6e7a1', 110));
    t.rect(7, 4, 2, 12, C.ink);
    t.rect(7, 4, 1, 12, C.metalLo);
    t.rect(6, 2, 4, 3, C.ink);
    t.rect(7, 3, 2, 1, C.glow);
  },
  [TILES.hatch]: (t) => {
    t.rect(0, 0, 16, 16, C.ink);
    for (let i = 0; i < 16; i += 4) {
      t.rect(i, 0, 2, 2, C.hazard), t.rect(i + 2, 14, 2, 2, C.hazard);
      t.rect(0, i + 2, 2, 2, C.hazard), t.rect(14, i, 2, 2, C.hazard);
    }
    t.rect(3, 3, 10, 10, hex('#0b0b10'));
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) t.px(5 + i, 5 + k * 2 + i, C.cyan), t.px(10 - i, 5 + k * 2 + i, C.cyan);
  },
  [TILES.exitArrow]: (t) => {
    const c = hex('#f6e7a1', 150);
    for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) t.px(5 + k * 4 + i, 4 + i, c), t.px(5 + k * 4 + i, 11 - i, c);
  },
  [TILES.solid]: (t) => t.rect(0, 0, 16, 16, C.solid),
  [TILES.debris]: (t, rng) => {
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(rng() * 13), y = 1 + Math.floor(rng() * 13);
      t.rect(x, y, 2, 1, rng() < 0.5 ? C.metalLo : C.rustLo);
      t.px(x, y - 1, C.metal);
    }
  },
  [TILES.tires]: (t) => {
    for (const [cx, cy] of [[5, 10], [11, 10], [8, 5]]) {
      t.disc(cx, cy + 1, 4, C.ink);
      t.disc(cx, cy, 4, hex('#2b2a30'));
      t.disc(cx, cy, 2, hex('#45434c'));
      t.disc(cx, cy, 1, C.ink);
      t.px(cx - 2, cy - 3, hex('#6a6872'));
    }
  },
  [TILES.engine]: (t) => {
    t.rect(1, 3, 14, 12, C.ink);
    t.rect(2, 4, 12, 10, C.metalLo);
    t.rect(2, 4, 12, 3, C.metal);
    for (let x = 3; x < 13; x += 3) t.rect(x, 7, 2, 2, C.ink), t.rect(x, 7, 1, 1, C.metalHi);
    t.rect(3, 11, 10, 2, C.rustLo);
    t.rect(10, 1, 3, 3, C.ink);
    t.rect(11, 1, 1, 3, C.copper);
    t.px(2, 4, C.metalHi);
  },
  [TILES.carTL]: (t) => {
    t.rect(2, 4, 14, 12, C.ink);
    t.rect(3, 5, 13, 11, hex('#5b7f8c'));
    t.rect(3, 5, 13, 2, hex('#7fa3ae'));
    t.rect(7, 9, 9, 7, hex('#1f2a30'));
    t.rect(8, 10, 3, 2, hex('#5fd0d8', 120));
    t.rect(3, 9, 2, 4, C.rustLo);
    t.rect(1, 6, 2, 3, C.ink);
  },
  [TILES.carTR]: (t) => {
    t.rect(0, 4, 14, 12, C.ink);
    t.rect(0, 5, 13, 11, hex('#5b7f8c'));
    t.rect(0, 5, 13, 2, hex('#7fa3ae'));
    t.rect(0, 9, 9, 7, hex('#1f2a30'));
    t.rect(10, 8, 3, 5, C.rust);
    t.rect(13, 6, 2, 3, C.ink);
  },
  [TILES.carBL]: (t) => {
    t.rect(2, 0, 14, 12, C.ink);
    t.rect(3, 0, 13, 11, hex('#4a6a76'));
    t.rect(7, 0, 9, 4, hex('#1f2a30'));
    t.rect(4, 6, 6, 3, C.rust);
    t.rect(1, 7, 2, 3, C.ink);
    t.rect(3, 11, 13, 1, hex('#2d3f46'));
  },
  [TILES.carBR]: (t) => {
    t.rect(0, 0, 14, 12, C.ink);
    t.rect(0, 0, 13, 11, hex('#4a6a76'));
    t.rect(0, 0, 9, 4, hex('#1f2a30'));
    t.rect(8, 6, 4, 4, C.rustLo);
    t.rect(13, 7, 2, 3, C.ink);
    t.rect(0, 11, 13, 1, hex('#2d3f46'));
  },
  [TILES.girders]: (t) => {
    for (const [y, c] of [[3, C.rust], [7, C.rustHi], [11, C.rust]] as [number, RGBA][]) {
      t.rect(0, y + 1, 16, 3, C.ink);
      t.rect(0, y, 16, 3, c);
      t.rect(0, y + 1, 16, 1, C.rustLo);
      for (let x = 2; x < 16; x += 5) t.px(x, y + 1, C.metalHi);
    }
  },
  [TILES.fridge]: (t) => {
    t.rect(3, 1, 10, 15, C.ink);
    t.rect(4, 1, 8, 14, hex('#d8d4c8'));
    t.rect(4, 6, 8, 1, hex('#9e9a90'));
    t.rect(10, 3, 1, 2, C.metalLo);
    t.rect(10, 8, 1, 3, C.metalLo);
    t.rect(4, 12, 3, 3, C.rustHi);
    t.rect(4, 1, 8, 1, hex('#f2efe6'));
  },
  [TILES.robotHusk]: (t) => {
    t.rect(3, 6, 10, 8, C.ink);
    t.rect(4, 7, 8, 6, C.metalLo);
    t.rect(4, 7, 8, 2, C.metal);
    t.rect(6, 9, 2, 2, hex('#4a1c18'));
    t.rect(1, 9, 3, 2, C.metalLo);
    t.rect(12, 12, 4, 2, C.metalLo);
    t.disc(10, 4, 2, C.ink);
    t.disc(10, 4, 1, C.metal);
    t.px(5, 13, C.rustHi);
    t.px(11, 8, C.rustHi);
  },
  [TILES.pallet]: (t) => {
    t.rect(1, 3, 14, 11, C.ink);
    for (let y = 4; y < 13; y += 3) t.rect(2, y, 12, 2, C.woodHi), t.rect(2, y + 1, 12, 1, C.wood);
    for (const x of [2, 7, 12]) t.rect(x, 4, 2, 9, C.woodLo);
  },
  [TILES.oilStain]: (t, rng) => {
    const c = hex('#1a1820', 120);
    t.disc(8, 9, 4, c);
    t.disc(5 + Math.floor(rng() * 3), 6, 2, c);
    t.disc(11, 11, 2, c);
    t.px(7, 7, hex('#5a4a7a', 160));
    t.px(9, 10, hex('#4a6a7a', 160));
  },
  [TILES.puddle]: (t) => {
    t.disc(8, 9, 5, hex('#2c4f69', 200));
    t.disc(7, 8, 4, hex('#3d6a8a', 210));
    t.rect(5, 6, 3, 1, hex('#9fd6e8', 200));
    t.px(10, 10, hex('#9fd6e8', 160));
  },
  [TILES.locoL]: (t) => {
    // Diesel nose: the headlight and diagonal hazard band make its left-facing direction explicit.
    t.rect(1, 5, 15, 1, C.ink); t.rect(1, 10, 15, 1, C.ink);
    t.rect(1, 6, 15, 4, C.wall); t.rect(2, 6, 14, 1, C.wallHi); t.rect(2, 9, 14, 1, C.wallLo);
    t.rect(1, 7, 3, 2, C.yellow);
    t.px(1, 7, C.ink); t.px(2, 8, C.ink); t.px(3, 7, C.ink); t.px(1, 8, C.metalHi);
    t.rect(0, 7, 1, 2, C.metalLo); t.px(0, 7, C.metalHi);
    t.rect(4, 7, 2, 2, C.ink); t.px(4, 7, C.glow); t.px(5, 7, C.metalHi);
    for (const x of [7, 10, 13]) { t.rect(x, 6, 1, 4, C.metalLo); t.px(x, 6, C.metalHi); }
    t.rect(7, 3, 4, 2, C.ink); t.rect(8, 4, 2, 1, C.metalLo);
    t.px(12, 8, C.rust); t.px(14, 9, C.rustHi);
  },
  [TILES.locoR]: (t) => {
    t.rect(0, 5, 15, 1, C.ink); t.rect(0, 10, 15, 1, C.ink);
    t.rect(0, 6, 15, 4, C.wall); t.rect(0, 6, 14, 1, C.wallHi); t.rect(0, 9, 14, 1, C.wallLo);
    // Cab on the rear half: blue windows, roof lip, and a visible rear coupler.
    t.rect(7, 4, 7, 2, C.ink); t.rect(8, 4, 6, 1, C.metalHi); t.rect(8, 5, 6, 1, C.wallHi);
    t.rect(8, 6, 5, 3, C.ink); t.rect(9, 6, 3, 2, C.blueLo); t.px(9, 6, C.blueHi); t.px(11, 6, C.blueHi);
    t.rect(7, 6, 1, 4, C.metalLo); t.px(7, 6, C.metalHi);
    t.rect(3, 7, 3, 2, C.ink); for (let y = 7; y < 9; y++) for (let x = 3; x < 6; x++) if ((x + y) % 2 === 0) t.px(x, y, C.metalHi);
    for (const x of [2, 5, 13]) { t.rect(x, 6, 1, 4, C.metalLo); t.px(x, 6, C.metalHi); }
    t.rect(14, 7, 2, 2, C.metalLo); t.px(15, 7, C.metalHi); t.px(12, 9, C.rust); t.px(4, 8, C.rustHi);
  },
  [TILES.moundRust]: (t, rng) => {
    lumps(t, rng, 7, 2, 4, 12);
    for (let i = 0; i < 4; i++) t.rect(2 + Math.floor(rng() * 10), 3 + Math.floor(rng() * 9), 4, 1, i % 2 ? C.copper : C.rustHi);
  },
  [TILES.drums]: (t) => {
    for (const [cx, cy, c, h] of [[5, 6, C.barrel, C.barrelHi], [11, 7, C.blue, C.blueHi], [7, 11, C.yellowLo, C.yellow]] as [number, number, RGBA, RGBA][]) {
      t.disc(cx, cy + 1, 4, C.ink);
      t.disc(cx, cy, 3, c);
      t.disc(cx - 1, cy - 1, 1, h);
    }
  },
  [TILES.plates]: (t, rng) => {
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(rng() * 9), y = 2 + Math.floor(rng() * 10), w = 4 + Math.floor(rng() * 4);
      t.rect(x, y + 1, w, 3, hex('#1b1a24', 140));
      t.rect(x, y, w, 3, i % 2 ? C.metalLo : C.rustLo);
      t.rect(x, y, w, 1, i % 2 ? C.metal : C.rust);
    }
  },
  [TILES.craneArm]: (t) => {
    t.rect(0, 5, 16, 7, C.ink);
    t.rect(0, 6, 16, 5, C.yellow);
    t.rect(0, 9, 16, 2, C.yellowLo);
    for (let x = 1; x < 16; x += 4) t.px(x, 7, C.ink), t.px(x + 1, 8, C.ink), t.px(x + 2, 7, C.ink);
    t.disc(13, 8, 3, C.ink);
    t.disc(13, 8, 2, C.metalLo);
  },
  [TILES.tree]: (t) => {
    t.disc(8, 8, 7, C.ink);
    t.disc(8, 8, 6, C.leafLo);
    t.disc(7, 7, 4, C.leaf);
    t.disc(6, 6, 2, C.leafHi);
    t.rect(7, 13, 2, 3, C.woodLo);
  },
  [TILES.pipe]: (t) => {
    t.rect(0, 3, 16, 11, C.ink);
    t.rect(0, 4, 16, 8, C.metalLo);
    t.rect(0, 5, 16, 3, C.metal);
    t.rect(0, 5, 16, 1, C.metalHi);
    t.rect(6, 3, 3, 11, C.rustLo);
  },
};

export function drawTileset(): Raster {
  const rows = Math.ceil(TILE_COUNT / TILESET_COLUMNS);
  const r: Raster = { width: TILESET_COLUMNS * TILE_SIZE, height: rows * TILE_SIZE, data: new Uint8ClampedArray(TILESET_COLUMNS * TILE_SIZE * rows * TILE_SIZE * 4) };
  for (let gid = 1; gid <= TILE_COUNT; gid++) {
    const idx = gid - 1;
    const tile = new Tile(r, (idx % TILESET_COLUMNS) * TILE_SIZE, Math.floor(idx / TILESET_COLUMNS) * TILE_SIZE);
    PAINTERS[gid]?.(tile, makeRng(gid * 7919));
  }
  return r;
}
