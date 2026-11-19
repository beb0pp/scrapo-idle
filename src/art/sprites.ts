import Phaser from 'phaser';
import { ITEM_IDS, type ItemId } from '../data/items';
import { buildProps } from './props';

type Pal = Record<string, string>;

// Hero is 24×32 with boots on the bottom row for its centered world origin.
const HERO_PAL: Pal = {
  k: '#14121e', h: '#3a3438', H: '#5a5054', g: '#a8481e', G: '#d7833b',
  c: '#219ba3', C: '#5fd0d8', w: '#ffffff', s: '#e8b080', S: '#c4875c',
  j: '#d06a2a', J: '#a8481e', q: '#e88a3e', t: '#5a3a22', B: '#d7833b',
  p: '#4a5468', P: '#5e6b82', l: '#7b8aa3', b: '#2a2d38', m: '#414858',
  u: '#5a3a22', U: '#8b6340', z: '#7b8aa3', Z: '#a9b4c6',
};

const H_FRONT = [
  '..........h.............', '.......k.hhHhh.k........', '......khhhHHhhh.hk.......', '.....khhHHHHHhhh.hk......',
  '....khhhhkkkkkhhhh.k....', '....khhkkGGkkGGkkhhk....', '....khhkGCCGkGCCGkhk....', '....khhkkGGkkGGkkhhk....',
  '.....khhhkkkkkhhhhk.....', '.....khhkscskcshhk......', '.....khhksCwkCshhk......', '......khhsssssshhk.......',
  '.......kJJjjqJk....kk...', '.....kkjJJjjjjjk...kZk..', '....kppkjjkkkkjjk..kZkk.', '...kplPpkjkkkkjjk..kZgk.',
  '..kplllpkkttttkkk..kZZk.', '..kppPppkktBttkssk..ktk.', '..kpppppkjBttBjsCk..kBtk', '...kppppkkjJJjkssk..ktk.',
  '....kppppkkkkkkk...kZk..', '....kpbbbk..kbbbk.......', '....kpbbbk..kbbbk.......', '....kmbmbk..kbmbk.......',
];
const H_BACK = [
  '...........k............', '.........kkhkk..........', '........khHhhhk.........', '.......khhHHhhhk........',
  '.......kggkggggk........', '......kgCGkCGGgk........', '......kGgkkkkGgk........', '.....khhhhhhhhhhk.......',
  '.....khhhhhhhhhhk.......', '.....khhhHhhhhhhk.......', '......kJJJJJJJJk........', '.....kjJJjjjjJJk........',
  '....kpppkkkkkkppk.......', '...kplPpkgggGkppk.......', '...kplllpkGGGkpppk......', '...kppPppkgggkpppk......',
  '...kpppppkttttkppk......', '....kppppktBBtkppk......', '....kppppkJJJJkppk......', '.....kpppkkkkkkpk.......',
  '......kpppk..kpppk......', '......kpbbk..kbbpk......', '......kpbbk..kbbpk......', '......kmbmk..kbmbk......',
];
const H_SIDE = [
  '...........k............', '.........kkhkk..........', '........khHhhhk.........', '.......khhHHhhhk........',
  '.......kggkggggk........', '......kgCGkCGGgk........', '......kGgkkkkGgk........', '.....khhhhhhhhhhk.......',
  '.....khhhhkscskhk.......', '.....khhhhksCwkhk.......', '......khhssssshk........', '.......khsSSssk.........',
  '.......kJJjjJJk.........', '......kppkjjjjjkk.......', '.....kplPpkjjjkkk.......', '....kplllpkjkkssk.......',
  '....kppPppktttkssk......', '.....kppppktBtkssk......', '......kpppkjBjkssk......', '.......kppkJJJkssk......',
  '.......kppkkkkksssk.....', '.......kpbbk..kbbbk.....', '.......kpbbk..kbbbk.....', '.......kmbmk..kbmbk.....',
];
const LEGS_STAND = [
  '....kuUUk....kuUUk......', '....kuUUk....kuUUk......', '....kuBbk....kuBbk......', '....kuUUk....kuUUk......',
  '...kuuuUzk..kuuuUzk.....', '...kuuuUzzk.kuuuUzzk....', '...kkkkkkkk.kkkkkkkk....', '...kkkkkkkk.kkkkkkkk....',
];
const LEGS_STEP = [
  '....kuUUk....kuUUk......', '....kuUUk....kuUUk......', '....kuBbk....kuBbk......', '...kuUUk.....kuUUk......',
  '..kuuuUzk...kuuuUzk.....', '..kuuuUzzk..kuuuUzzk....', '..kkkkkkkk..kkkkkkkk....', '..kkkkkkkk..kkkkkkkk....',
];
const LEGS_SIDE = [
  '.......kuUUk..kuUUk.....', '.......kuUUk..kuUUk.....', '.......kuBbk..kuBbk.....', '.......kuUUk..kuUUk.....',
  '......kuuuUzkkuuuUzk....', '......kuuuUzzkuuuUzzk...', '......kkkkkkkkkkkkkk....', '......kkkkkkkkkkkkkk....',
];
const LEGS_SIDE_STEP = [
  '.......kuUUk..kuUUk.....', '.......kuUUk..kuUUk.....', '......kuBbk...kuBbk.....', '.....kuUUk....kuUUk.....',
  '....kuuuUzk...kuuuUzk...', '....kuuuUzzk..kuuuUzzk..', '....kkkkkkkk..kkkkkkkk..', '....kkkkkkkk..kkkkkkkk..',
];
const HERO_FRAMES = [
  [...H_FRONT, ...LEGS_STAND], [...H_FRONT, ...LEGS_STEP],
  [...H_BACK, ...LEGS_STAND], [...H_BACK, ...LEGS_STEP],
  [...H_SIDE, ...LEGS_SIDE], [...H_SIDE, ...LEGS_SIDE_STEP],
];

const BASE: Pal = {
  k: '#1b1a24', s: '#e0a477', h: '#5b3a29', y: '#f2d36b', j: '#d27d2c', J: '#a95f1f',
  p: '#3b4b6b', b: '#2a2230', g: '#6b6f7a', w: '#b8bcc4', m: '#7d8792', M: '#4a515c',
  r: '#e8433a', R: '#ff8a6a', o: '#a8552e', Y: '#e0b33a', c: '#5fd0d8', C: '#2e8c96',
};

const SORTER = [
  [
    '................', '................', '.....kkkkkk.....', '....kmmmmmmk....', '...kmmrrrmmmk...', '...kmMMMMMMmk...',
    '..kkmmmmmmmmkk..', '..kokmmmmmmkok..', '..kokmoommmkok..', '...kkmmmmmmkk...', '....kMMMMMMk....',
    '...kMkMkkMkMk...', '...kkkkkkkkkk...', '................', '................', '................',
  ],
  [
    '................', '................', '.....kkkkkk.....', '....kmmmmmmk....', '...kmmmrrrmmk...', '...kmMMMMMMmk...',
    '..kkmmmmmmmmkk..', '..kokmmmmmmkok..', '..kokmmmoomkok..', '...kkmmmmmmkk...', '....kMMMMMMk....',
    '...kkMkMMkMkk...', '...kkkkkkkkkk...', '................', '................', '................',
  ],
];

const PRESS = [
  [
    '................', '..kkkkkkkkkkkk..', '..kYkYkYkYkYkk..', '..kkkkkkkkkkkk..', '...kMMMMMMMMk...', '..kmmmmrrmmmmk..',
    '..kmMMMMMMMMmk..', '.kkmmmmmmmmmmkk.', '.kokmmmmmmmmkok.', '.kokmmmmmmmmkok.', '.kkkmMMMMMMmkkk.',
    '...kmmmmmmmmk...', '..kMkMkMkMkMkk..', '..kkkkkkkkkkkk..', '................', '................',
  ],
  [
    '................', '................', '..kkkkkkkkkkkk..', '..kYkYkYkYkYkk..', '..kkkkkkkkkkkk..', '..kmmmmrrmmmmk..',
    '..kmMMMMMMMMmk..', '.kkmmmmmmmmmmkk.', '.kokmmmmmmmmkok.', '.kokmmmmmmmmkok.', '.kkkmMMMMMMmkkk.',
    '...kmmmmmmmmk...', '..kkMkMkMkMkMk..', '..kkkkkkkkkkkk..', '................', '................',
  ],
];

function drawRows(ctx: CanvasRenderingContext2D, rows: string[], ox: number, oy: number, pal: Pal): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

function sheet(scene: Phaser.Scene, key: string, frames: string[][], pal: Pal, w = 16, h = 16): void {
  const tex = scene.textures.createCanvas(key, w * frames.length, h)!;
  const ctx = tex.getContext();
  frames.forEach((rows, i) => drawRows(ctx, rows, i * w, 0, pal));
  frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
  tex.refresh();
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, frames: number, draw: (ctx: CanvasRenderingContext2D, frame: number, ox: number) => void): void {
  const tex = scene.textures.createCanvas(key, w * frames, h)!;
  const ctx = tex.getContext();
  for (let f = 0; f < frames; f++) {
    draw(ctx, f, f * w);
    tex.add(f, 0, f * w, 0, w, h);
  }
  tex.refresh();
}

function r(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function disc(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, rad: number): void {
  ctx.fillStyle = color;
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad) ctx.fillRect(cx + x, cy + y, 1, 1);
}

// Item icons, 16×16: shapes lit from the top-left, then a warm 1px outline around and between parts.
const OUT = '#2a1a14';
type Ramp = readonly [shadow: string, base: string, light: string, glint: string];
type Pred = (x: number, y: number) => boolean;
type Pt = [number, number];

const SLATE: Ramp = ['#4a5468', '#7b8aa3', '#a9b4c6', '#eef2f8'];
const STEEL: Ramp = ['#353b4b', '#4a5468', '#7b8aa3', '#a9b4c6'];
const COPPER: Ramp = ['#a8481e', '#d7833b', '#f0aa62', '#ffe0b0'];
const RUST: Ramp = ['#6e2a12', '#a8481e', '#d7833b', '#f0aa62'];
const BRASS: Ramp = ['#a8761e', '#e0b33a', '#f6d77a', '#fff6d0'];
const TEAL: Ramp = ['#1f7f8a', '#5fd0d8', '#9fe8ee', '#ffffff'];
const LEATHER: Ramp = ['#4a3020', '#6b4a2e', '#8a5a34', '#b07a4a'];
const WOOD: Ramp = ['#6b4a2e', '#8a5a34', '#b07a4a', '#d8a670'];

const inRect = (x0: number, y0: number, w: number, h: number): Pred => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
const inDisc = (cx: number, cy: number, rad: number): Pred => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + rad;
const inSeg = (x0: number, y0: number, x1: number, y1: number, half: number): Pred => (x, y) => {
  const dx = x1 - x0, dy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x0 - t * dx, y - y0 - t * dy) <= half;
};
const any = (...ps: Pred[]): Pred => (x, y) => ps.some((p) => p(x, y));
const all = (...ps: Pred[]): Pred => (x, y) => ps.every((p) => p(x, y));
const not = (p: Pred): Pred => (x, y) => !p(x, y);

class IconGrid {
  private readonly cells: (string | undefined)[] = new Array(256);

  private at(x: number, y: number): string | undefined {
    return x >= 0 && x < 16 && y >= 0 && y < 16 ? this.cells[y * 16 + x] : undefined;
  }

  private put(x: number, y: number, color: string | undefined): void {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) this.cells[y * 16 + x] = color;
  }

  dot(color: string, ...pts: Pt[]): void {
    pts.forEach(([x, y]) => this.put(x, y, color));
  }

  fill(color: string, p: Pred): void {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p(x, y)) this.put(x, y, color);
  }

  clear(p: Pred): void {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p(x, y)) this.put(x, y, undefined);
  }

  // Shaded part: lit top/left edges, shadowed bottom/right edges, one glint just inside the top-left; outlined against earlier parts.
  blob(ramp: Ramp, p: Pred, seam = true): void {
    if (seam) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!p(x, y) && this.at(x, y) && (p(x - 1, y) || p(x + 1, y) || p(x, y - 1) || p(x, y + 1))) this.put(x, y, OUT);
      }
    }
    let glint = false;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!p(x, y)) continue;
      const lit = !p(x - 1, y) || !p(x, y - 1);
      const shade = !p(x + 1, y) || !p(x, y + 1);
      this.put(x, y, lit && !shade ? ramp[2] : shade && !lit ? ramp[0] : ramp[1]);
      if (!glint && p(x - 1, y) && p(x, y - 1) && p(x + 1, y) && p(x, y + 1)) {
        this.put(x, y, ramp[3]);
        glint = true;
      }
    }
  }

  paint(c: CanvasRenderingContext2D): void {
    const rim: Pt[] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!this.at(x, y) && (this.at(x - 1, y) || this.at(x + 1, y) || this.at(x, y - 1) || this.at(x, y + 1))) rim.push([x, y]);
    }
    this.dot(OUT, ...rim);
    for (let i = 0; i < 256; i++) {
      const color = this.cells[i];
      if (color) r(c, color, i % 16, Math.floor(i / 16), 1, 1);
    }
  }
}

const icon = (draw: (g: IconGrid) => void) => (c: CanvasRenderingContext2D): void => {
  const g = new IconGrid();
  draw(g);
  g.paint(c);
};

const wrench = (steel: Ramp, grip: Ramp, wear: string) => icon((g) => {
  g.blob(steel, any(inSeg(5, 10, 10, 5, 1), inDisc(11, 4, 3)));
  g.clear(inSeg(12, 3, 15, 0, 0.8));
  g.blob(grip, inSeg(2, 13, 6, 9, 1.2));
  g.dot(wear, [8, 7], [10, 6], [3, 13]);
});

const ICON_ART: Record<ItemId, (c: CanvasRenderingContext2D) => void> = {
  scrap: icon((g) => {
    g.blob(RUST, inSeg(9, 3, 13, 8, 1.3));
    g.blob(SLATE, any(inRect(2, 7, 8, 5), inRect(4, 5, 4, 2), inSeg(9, 9, 11, 12, 1)));
    g.fill(SLATE[0], inSeg(3, 9, 7, 9, 0.4));
    g.blob(BRASS, inDisc(12, 12, 1));
    g.dot(OUT, [12, 12]);
  }),
  gear: icon((g) => {
    g.blob(SLATE, any(
      inDisc(8, 8, 5),
      inRect(7, 1, 3, 2), inRect(7, 14, 3, 1), inRect(1, 7, 2, 3), inRect(14, 7, 1, 3),
      inRect(3, 3, 2, 2), inRect(12, 3, 2, 2), inRect(3, 12, 2, 2), inRect(12, 12, 2, 2),
    ));
    g.blob(BRASS, inDisc(8, 8, 2));
    g.clear(inDisc(8, 8, 0));
  }),
  cable: icon((g) => {
    const coil = all(inDisc(8, 8, 6), not(inDisc(8, 8, 2)));
    g.blob(COPPER, coil);
    g.fill(RUST[1], all(coil, (x, y) => (x + 2 * y) % 4 === 0));
    g.clear(inDisc(8, 8, 1));
    g.blob(COPPER, inSeg(12, 12, 14, 14, 0.6));
  }),
  servo: icon((g) => {
    g.blob(STEEL, any(inRect(1, 8, 2, 3), inRect(13, 8, 2, 3)));
    g.blob(SLATE, inRect(3, 6, 10, 8));
    g.blob(COPPER, inRect(5, 9, 5, 3));
    g.blob(BRASS, inRect(9, 3, 3, 3));
    g.blob(BRASS, inRect(7, 1, 7, 2));
    g.dot(SLATE[3], [4, 12], [11, 12]);
  }),
  cell: icon((g) => {
    g.blob(TEAL, inRect(4, 4, 8, 8));
    g.dot(TEAL[0], [9, 5], [8, 6], [8, 7], [9, 7], [9, 8], [8, 9]);
    g.dot(TEAL[3], [5, 6], [5, 7], [6, 5]);
    g.blob(SLATE, inRect(4, 2, 8, 2));
    g.blob(SLATE, inRect(4, 12, 8, 2));
    g.blob(STEEL, inRect(6, 1, 4, 1));
  }),
  drone_chassis: icon((g) => {
    g.blob(STEEL, any(inSeg(2, 3, 6, 7, 0.7), inSeg(10, 7, 12, 5, 0.7), inSeg(5, 11, 3, 13, 0.7), inSeg(11, 11, 13, 13, 0.7)));
    g.blob(SLATE, inRect(1, 2, 4, 1), false);
    g.dot(RUST[1], [12, 4], [13, 5]);
    g.blob(SLATE, inDisc(8, 9, 4));
    g.clear(inDisc(8, 9, 1));
  }),
  pulse_core: icon((g) => {
    g.blob(BRASS, any(inRect(7, 1, 3, 2), inRect(7, 14, 3, 1), inRect(1, 7, 2, 3), inRect(14, 7, 1, 3)));
    g.blob(TEAL, inDisc(8, 8, 5));
    g.fill(TEAL[2], inDisc(8, 8, 2));
    g.fill(TEAL[3], inDisc(8, 8, 0));
    g.dot(TEAL[3], [5, 5], [6, 4]);
  }),
  mod_claw: icon((g) => {
    g.blob(SLATE, any(inRect(3, 8, 2, 4), inSeg(4, 11, 6, 13, 0.6), inRect(11, 8, 2, 4), inSeg(11, 11, 9, 13, 0.6)));
    g.blob(STEEL, inRect(3, 6, 10, 2));
    g.blob(BRASS, inRect(4, 1, 8, 5));
    g.blob(TEAL, inRect(7, 3, 2, 2));
  }),
  mod_magnet: icon((g) => {
    const arc = all(inDisc(8, 7, 6), not(inDisc(8, 7, 2)), (_x, y) => y <= 7);
    g.blob(RUST, any(arc, inRect(2, 7, 4, 4), inRect(11, 7, 4, 4)));
    g.blob(SLATE, any(inRect(2, 11, 4, 3), inRect(11, 11, 4, 3)));
  }),
  mod_cargo: icon((g) => {
    g.blob(WOOD, inRect(2, 5, 12, 8));
    g.fill(WOOD[0], all(inRect(3, 9, 10, 1), not(inRect(7, 0, 2, 16))));
    g.blob(WOOD, inRect(1, 3, 14, 3));
    g.blob(BRASS, inRect(7, 3, 2, 10));
    g.dot(OUT, [7, 7]);
  }),
  drone_spark: icon((g) => {
    g.blob(SLATE, inRect(1, 2, 14, 2));
    g.blob(STEEL, inRect(7, 4, 2, 2));
    g.blob(BRASS, inDisc(8, 10, 4));
    g.blob(TEAL, inDisc(8, 10, 1));
    g.dot(TEAL[3], [7, 9]);
  }),
  relic_crane_coil: icon((g) => {
    const wind = inRect(4, 4, 8, 8);
    g.blob(COPPER, wind);
    g.fill(RUST[1], all(wind, (_x, y) => y % 2 === 1));
    g.blob(SLATE, inRect(3, 2, 10, 2));
    g.blob(SLATE, inRect(3, 12, 10, 2));
    g.dot(BRASS[3], [1, 7], [14, 9]);
  }),
  relic_capacitor: icon((g) => {
    g.blob(TEAL, inRect(4, 3, 8, 9));
    g.blob(SLATE, inRect(9, 4, 2, 7));
    g.dot(OUT, [9, 6], [9, 9]);
    g.dot(TEAL[3], [5, 5], [5, 6]);
    g.blob(STEEL, inRect(4, 1, 8, 2));
    g.blob(BRASS, any(inRect(5, 12, 1, 2), inRect(10, 12, 1, 2)));
  }),
  tool_wrench_old: wrench(STEEL, LEATHER, RUST[1]),
  tool_wrench_reinforced: wrench(SLATE, COPPER, BRASS[1]),
  tool_hydraulic_pry: icon((g) => {
    g.blob(SLATE, any(inSeg(3, 13, 12, 4, 0.8), inSeg(12, 4, 13, 2, 0.8), inSeg(13, 2, 14, 3, 0.6), inSeg(2, 14, 3, 13, 0.6)));
    g.blob(BRASS, inSeg(5, 11, 8, 8, 1.5));
    g.dot(OUT, [7, 9]);
  }),
  head_scrap_cap: icon((g) => {
    g.blob(COPPER, all(inDisc(7, 10, 6), (_x, y) => y <= 10));
    g.fill(COPPER[0], inSeg(7, 5, 7, 9, 0.3));
    g.blob(LEATHER, inRect(6, 10, 9, 2));
    g.blob(SLATE, inRect(3, 7, 2, 2));
    g.blob(BRASS, inRect(6, 3, 2, 1), false);
  }),
  body_work_jacket: icon((g) => {
    g.blob(RUST, any(inSeg(4, 4, 2, 12, 1.1), inSeg(11, 4, 13, 12, 1.1)));
    g.blob(COPPER, inRect(4, 3, 8, 11));
    g.fill(SLATE[2], inRect(7, 4, 1, 9));
    g.fill(SLATE[0], inRect(8, 4, 1, 9));
    g.fill(COPPER[0], any(inRect(5, 10, 2, 1), inRect(9, 10, 2, 1)));
    g.blob(LEATHER, any(inSeg(5, 2, 7, 6, 0.7), inSeg(10, 2, 8, 6, 0.7)));
  }),
  hands_grip_gloves: icon((g) => {
    const glove = any(inRect(4, 3, 2, 3), inRect(6, 2, 2, 4), inRect(8, 2, 2, 4), inRect(10, 3, 2, 3), inRect(4, 5, 8, 6), inSeg(3, 9, 2, 6, 0.8));
    g.blob(LEATHER, glove);
    g.fill(LEATHER[0], all(glove, any(inRect(5, 3, 1, 2), inRect(7, 2, 1, 3), inRect(9, 2, 1, 3))));
    g.blob(BRASS, inRect(4, 11, 8, 3));
  }),
  feet_rail_boots: icon((g) => {
    g.blob(LEATHER, any(inRect(3, 2, 5, 8), inRect(3, 8, 8, 4), all(inDisc(10, 10, 2), (_x, y) => y >= 8)));
    g.blob(BRASS, inRect(3, 2, 5, 1), false);
    g.blob(STEEL, inRect(2, 12, 12, 2));
    g.dot(SLATE[2], [10, 9], [11, 9], [9, 9]);
    g.dot(BRASS[1], [5, 4], [5, 6]);
  }),
  accessory_lucky_bolt: icon((g) => {
    const shank = inRect(6, 6, 4, 8);
    g.blob(BRASS, shank);
    g.fill(BRASS[0], all(shank, (x, y) => (x + y) % 3 === 0));
    g.blob(BRASS, all(inRect(4, 2, 8, 4), not(any(inRect(4, 2, 1, 1), inRect(11, 2, 1, 1), inRect(4, 5, 1, 1), inRect(11, 5, 1, 1)))));
    g.fill(BRASS[0], inRect(8, 3, 1, 3));
    g.dot(BRASS[3], [13, 1], [12, 2], [13, 2], [14, 2], [13, 3]);
  }),
};

export const iconUrls: Partial<Record<ItemId, string>> = {};

/** Hero standing (64×72 frame from the baked sheet). Scale it up with image-rendering: pixelated. */
export const heroPortraitUrl = 'sprites/hero-portrait.png';

export function buildSprites(scene: Phaser.Scene): void {
  buildProps(scene);

  canvasTex(scene, 'wrench', 16, 16, 1, (c) => {
    for (let i = 0; i < 8; i++) r(c, '#1b1a24', 2 + i, 13 - i, 3, 3);
    for (let i = 0; i < 8; i++) r(c, i < 3 ? '#a8552e' : '#b8bcc4', 3 + i, 13 - i, 1, 1), r(c, i < 3 ? '#7d4527' : '#8d949c', 3 + i, 14 - i, 1, 1);
    r(c, '#1b1a24', 9, 1, 6, 6);
    r(c, '#c4c9cf', 10, 2, 4, 4);
    r(c, '#1b1a24', 12, 1, 3, 3);
    r(c, '#e0e4ea', 10, 2, 1, 1);
  });

  canvasTex(scene, 'marker', 10, 6, 1, (c) => {
    r(c, '#e0b33a', 0, 2, 2, 2); r(c, '#e0b33a', 8, 2, 2, 2); r(c, '#e0b33a', 4, 0, 2, 2); r(c, '#e0b33a', 4, 4, 2, 2);
  });
  sheet(scene, 'vendor', [HERO_FRAMES[0], HERO_FRAMES[1]], {
    ...HERO_PAL, h: '#245a5f', H: '#3d8281', p: '#2d6d70', P: '#43858a', l: '#71a9a5',
    j: '#58737d', J: '#3c535f', q: '#8ab9ba', B: '#5fd0d8',
  }, 24, 32);
  sheet(scene, 'sorter', SORTER, BASE);
  sheet(scene, 'press', PRESS, BASE);

  canvasTex(scene, 'crane', 40, 40, 2, (c, f, ox) => {
    r(c, '#1b1a24', ox + 4, 26, 32, 12);
    for (let x = 5; x < 35; x += 3) r(c, f ? '#4a515c' : '#5d636b', ox + x, 27, 2, 10);
    r(c, '#1b1a24', ox + 9, 13, 22, 16);
    r(c, '#e0b33a', ox + 10, 14, 20, 14);
    r(c, '#a57a1c', ox + 10, 24, 20, 4);
    for (let x = 10; x < 30; x += 4) r(c, '#1b1a24', ox + x, 24, 2, 4);
    r(c, '#1b1a24', ox + 13, 16, 8, 6);
    r(c, '#5fd0d8', ox + 14, 17, 6, 4);
    r(c, '#1b1a24', ox + 24, 2, 4, 14);
    r(c, '#b8bcc4', ox + 25, 2, 2, 14);
    disc(c, '#1b1a24', ox + 26, 4, 4);
    disc(c, f ? '#ff8a6a' : '#e8433a', ox + 26, 4, 3);
    r(c, '#e8433a', ox + 33, 16, 2, 2);
  });

  canvasTex(scene, 'pile', 20, 16, 3, (c, f, ox) => {
    const searched = f === 2;
    disc(c, '#1b1a24', ox + 10, 10, 6);
    disc(c, searched ? '#4a3a30' : '#7d4527', ox + 10, 10, 5);
    disc(c, searched ? '#5d5a58' : '#8d949c', ox + 7, 9, 3);
    disc(c, searched ? '#5b4436' : '#9b5a32', ox + 13, 8, 3);
    r(c, searched ? '#6b6f7a' : '#c4c9cf', ox + 6, 6, 2, 1);
    if (!searched) {
      const gx = f ? 14 : 5, gy = f ? 3 : 4;
      r(c, '#fffbe0', ox + gx, gy - 1, 1, 3);
      r(c, '#fffbe0', ox + gx - 1, gy, 3, 1);
    }
  });

  canvasTex(scene, 'relic', 16, 16, 2, (c, f, ox) => {
    disc(c, f ? '#f6b24a55' : '#f6b24a33', ox + 8, 8, 7);
    c.save();
    c.translate(ox, 0);
    ICON_ART.relic_crane_coil(c);
    c.restore();
  });

  canvasTex(scene, 'bench', 24, 16, 1, (c) => {
    r(c, '#1b1a24', 0, 4, 24, 11);
    r(c, '#8b6340', 1, 5, 22, 5);
    r(c, '#6a4a30', 1, 10, 22, 4);
    r(c, '#b8bcc4', 3, 3, 5, 2);
    r(c, '#e0b33a', 12, 2, 3, 3);
    r(c, '#5fd0d8', 18, 3, 3, 2);
  });

  canvasTex(scene, 'terminal', 16, 20, 2, (c, f, ox) => {
    r(c, '#1b1a24', ox + 2, 2, 12, 17);
    r(c, '#4a515c', ox + 3, 3, 10, 15);
    r(c, '#0e1a1c', ox + 4, 4, 8, 6);
    r(c, f ? '#5fd0d8' : '#2e8c96', ox + 5, 5, 6, 1);
    r(c, '#5fd0d8', ox + 5, 7, f ? 4 : 2, 1);
    r(c, '#e0b33a', ox + 5, 13, 2, 2);
    r(c, '#e8433a', ox + 9, 13, 2, 2);
  });

  canvasTex(scene, 'bin', 18, 14, 1, (c) => {
    r(c, '#1b1a24', 0, 2, 18, 12);
    r(c, '#3d6a8a', 1, 3, 16, 10);
    r(c, '#2c4f69', 2, 4, 14, 3);
  });

  canvasTex(scene, 'dot', 2, 2, 1, (c) => r(c, '#ffffff', 0, 0, 2, 2));

  canvasTex(scene, 'glow', 64, 64, 1, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });

  for (const id of ITEM_IDS) {
    canvasTex(scene, `icon_${id}`, 16, 16, 1, (c) => ICON_ART[id](c));
    iconUrls[id] = (scene.textures.get(`icon_${id}`).getSourceImage() as HTMLCanvasElement).toDataURL();
  }
  // the drone icon is baked with its sprite by tools/bake-drone.py
  if (scene.textures.exists('drone-icon')) {
    scene.textures.remove('icon_drone_spark');
    scene.textures.addImage('icon_drone_spark', scene.textures.get('drone-icon').getSourceImage() as HTMLImageElement);
    iconUrls.drone_spark = 'sprites/drone-icon.png';
  }

  const anim = (key: string, tex: string, frames: number[], rate: number) =>
    scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate: rate, repeat: -1 });
  const once = (key: string, tex: string, frames: number[], rate: number) =>
    scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate: rate, repeat: 0 });
  // public/sprites/hero.png, baked by tools/bake-sprites.py (frame order documented there)
  anim('hero-idle', 'hero', [0, 0, 1, 1], 3);
  anim('hero-walk', 'hero', [2, 3, 4, 5], 9);
  anim('hero-idle-up', 'hero', [15], 1);
  anim('hero-walk-up', 'hero', [16, 17, 18, 19], 9);
  anim('hero-idle-side', 'hero', [20], 1);
  anim('hero-walk-side', 'hero', [21, 22, 23, 24], 9);
  once('hero-attack', 'hero', [6, 7, 8], 20);
  anim('hero-collect', 'hero', [9, 10], 1000 / 120);
  once('hero-hurt', 'hero', [11], 6);
  once('hero-dash', 'hero', [12], 6);
  once('hero-cast', 'hero', [13, 14], 10);
  anim('dog-idle', 'robodog', [0, 1], 2);
  anim('dog-run', 'robodog', [2, 3, 4, 5], 12);
  once('dog-bite', 'robodog', [6, 7, 6], 14);
  anim('dog-fetch', 'robodog', [8, 0], 6);
  anim('vendor-idle', 'vendor', [0, 1], 2);
  anim('sorter-walk', 'sorter', [0, 1], 5);
  anim('press-walk', 'press', [0, 1], 3);
  anim('drone-fly', 'drone', [0, 1, 2, 3], 14);
  anim('crane-idle', 'crane', [0, 1], 3);
  anim('pile-glint', 'pile', [0, 1], 2);
  anim('relic-pulse', 'relic', [0, 1], 3);
  anim('terminal-blink', 'terminal', [0, 1], 2);
}
