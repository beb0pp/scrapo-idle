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

// Item icons, 16×16: dark outline, three tones lit from the top-left, one readable silhouette per item.
const K = '#1b1a24';
const px = (c: CanvasRenderingContext2D, color: string, pts: [number, number][]) => pts.forEach(([x, y]) => r(c, color, x, y, 1, 1));

function wrench(c: CanvasRenderingContext2D, steel: string, light: string, dark: string, grip: string): void {
  for (let i = 0; i < 9; i++) r(c, K, 1 + i, 13 - i, 3, 3);
  for (let i = 0; i < 9; i++) {
    r(c, i < 4 ? grip : steel, 2 + i, 13 - i, 1, 1);
    r(c, i < 4 ? dark : light, 2 + i, 14 - i, 1, 1);
  }
  r(c, K, 9, 0, 7, 7);
  r(c, steel, 10, 1, 5, 5);
  r(c, light, 10, 1, 4, 1);
  r(c, dark, 14, 2, 1, 4);
  r(c, K, 12, 0, 3, 3);
  r(c, K, 13, 3, 1, 1);
}

const ICON_ART: Record<ItemId, (c: CanvasRenderingContext2D) => void> = {
  scrap: (c) => {
    disc(c, K, 8, 10, 6);
    r(c, '#6f3c22', 3, 8, 6, 5); r(c, '#9b5a32', 3, 8, 6, 2); r(c, '#c27a48', 3, 8, 3, 1);
    r(c, '#5d636b', 7, 6, 6, 6); r(c, '#8d949c', 7, 6, 6, 2); r(c, '#c4c9cf', 7, 6, 3, 1);
    r(c, '#3e3a3c', 5, 12, 7, 2);
    disc(c, K, 11, 12, 2); disc(c, '#b8bcc4', 11, 12, 1); r(c, K, 11, 12, 1, 1);
  },
  gear: (c) => {
    const teeth: [number, number][] = [[7, 0], [7, 14], [0, 7], [14, 7], [2, 2], [12, 2], [2, 12], [12, 12]];
    teeth.forEach(([x, y]) => r(c, K, x, y, 2, 2));
    disc(c, K, 8, 8, 6); disc(c, '#8d949c', 8, 8, 5); disc(c, '#b8bcc4', 7, 7, 3);
    disc(c, K, 8, 8, 2); r(c, '#3e3a3c', 8, 8, 1, 1);
    px(c, '#e0e4ea', [[5, 4], [4, 5], [6, 4]]);
  },
  cable: (c) => {
    r(c, K, 2, 2, 12, 12); r(c, '#8b6340', 3, 3, 10, 10);
    r(c, K, 4, 4, 8, 8);
    for (let y = 4; y < 12; y++) r(c, y % 2 ? '#a8552e' : '#d27d2c', 4, y, 8, 1);
    r(c, '#f0a860', 4, 4, 8, 1);
    r(c, '#6a4a30', 3, 3, 10, 1); r(c, '#6a4a30', 3, 12, 10, 1);
    px(c, '#d27d2c', [[12, 13], [13, 14], [14, 14], [15, 15]]);
  },
  servo: (c) => {
    r(c, K, 1, 4, 13, 10); r(c, '#4a515c', 2, 5, 11, 8); r(c, '#7d8792', 2, 5, 11, 2); r(c, '#9aa3ad', 2, 5, 5, 1);
    r(c, '#e0b33a', 4, 9, 5, 3); r(c, K, 5, 10, 3, 1);
    disc(c, K, 11, 4, 2); disc(c, '#c4c9cf', 11, 4, 1);
    r(c, K, 10, 0, 6, 3); r(c, '#e8e2d0', 11, 1, 4, 1);
    px(c, '#c4c9cf', [[3, 12], [12, 12]]);
  },
  cell: (c) => {
    r(c, K, 3, 2, 10, 13); r(c, '#2d5a26', 4, 3, 8, 11); r(c, '#3f7a34', 4, 3, 3, 11); r(c, '#62a14b', 4, 3, 1, 11);
    r(c, K, 6, 0, 4, 3); r(c, '#c4c9cf', 7, 1, 2, 1);
    for (let i = 0; i < 3; i++) r(c, '#9be36b', 6, 10 - i * 3, 4, 2);
  },
  drone_chassis: (c) => {
    r(c, K, 4, 5, 8, 7); r(c, '#5d636b', 5, 6, 6, 5); r(c, '#8d949c', 5, 6, 6, 1);
    r(c, K, 6, 7, 4, 3); r(c, '#2e8c96', 7, 8, 2, 1);
    r(c, K, 0, 3, 5, 2); r(c, '#8d949c', 1, 3, 3, 1);
    r(c, K, 11, 11, 5, 2); r(c, '#8d949c', 12, 11, 3, 1);
    px(c, '#c27a48', [[3, 9], [12, 4], [13, 5]]);
    px(c, K, [[9, 6], [10, 7]]);
  },
  pulse_core: (c) => {
    disc(c, '#3b1d5c', 8, 8, 7); disc(c, '#6a3aa8', 8, 8, 5); disc(c, '#a878f0', 8, 8, 3); disc(c, '#efe0ff', 7, 7, 1);
    r(c, K, 7, 0, 2, 3); r(c, K, 7, 13, 2, 3); r(c, K, 0, 7, 3, 2); r(c, K, 13, 7, 3, 2);
    r(c, '#8d949c', 7, 1, 1, 2); r(c, '#8d949c', 7, 14, 1, 1); r(c, '#8d949c', 1, 7, 2, 1); r(c, '#8d949c', 14, 7, 1, 1);
  },
  mod_claw: (c) => {
    r(c, K, 4, 1, 8, 7); r(c, '#b0962f', 5, 2, 6, 5); r(c, '#e0b33a', 5, 2, 6, 2); r(c, '#f6dd8a', 5, 2, 3, 1);
    r(c, K, 3, 7, 3, 7); r(c, K, 10, 7, 3, 7);
    r(c, '#b8bcc4', 4, 8, 1, 5); r(c, '#b8bcc4', 11, 8, 1, 5);
    r(c, K, 5, 13, 2, 2); r(c, K, 9, 13, 2, 2); r(c, '#e0e4ea', 5, 13, 1, 1); r(c, '#e0e4ea', 10, 13, 1, 1);
    r(c, '#2e8c96', 7, 4, 2, 2);
  },
  mod_magnet: (c) => {
    r(c, K, 2, 2, 12, 12);
    r(c, '#b13a2c', 3, 3, 10, 4); r(c, '#b13a2c', 3, 3, 3, 10); r(c, '#b13a2c', 10, 3, 3, 10);
    r(c, '#e8433a', 3, 3, 10, 2); r(c, '#e8433a', 3, 3, 1, 10); r(c, '#ff8a6a', 4, 3, 4, 1);
    r(c, K, 6, 7, 4, 7);
    r(c, '#e0e4ea', 3, 11, 3, 2); r(c, '#e0e4ea', 10, 11, 3, 2);
    px(c, '#9fe8ee', [[7, 13], [8, 12], [7, 11]]);
  },
  mod_cargo: (c) => {
    r(c, K, 1, 3, 14, 11); r(c, '#9c6b3a', 2, 4, 12, 9); r(c, '#c98e52', 2, 4, 12, 2); r(c, '#74502b', 2, 11, 12, 2);
    r(c, K, 6, 3, 1, 11); r(c, K, 9, 3, 1, 11);
    r(c, '#e0b33a', 7, 4, 2, 9);
    px(c, '#e8e2d0', [[3, 5], [12, 5]]);
  },
  drone_spark: (c) => {
    r(c, K, 0, 2, 16, 3); r(c, '#c4c9cf', 1, 3, 5, 1); r(c, '#c4c9cf', 10, 3, 5, 1);
    r(c, K, 7, 3, 2, 4);
    disc(c, K, 8, 10, 5); disc(c, '#b0962f', 8, 10, 4); disc(c, '#e0b33a', 7, 9, 3);
    disc(c, K, 8, 10, 2); r(c, '#5fd0d8', 7, 9, 2, 2); r(c, '#ffffff', 7, 9, 1, 1);
  },
  relic_crane_coil: (c) => {
    disc(c, '#f6b24a', 8, 8, 7); disc(c, '#3b2a1a', 8, 8, 6);
    r(c, K, 4, 3, 8, 10);
    for (let y = 4; y < 12; y++) r(c, y % 2 ? '#8f4f26' : '#d27d2c', 5, y, 6, 1);
    r(c, '#5d636b', 7, 2, 2, 12); r(c, '#b8bcc4', 7, 2, 1, 12);
    px(c, '#fff2b0', [[1, 8], [14, 6], [8, 1]]);
  },
  relic_capacitor: (c) => {
    disc(c, '#2e8c96', 8, 8, 7);
    r(c, K, 4, 1, 8, 13); r(c, '#253b46', 5, 2, 6, 11); r(c, '#2e8c96', 5, 2, 2, 11);
    r(c, '#9fe8ee', 6, 3, 1, 9);
    px(c, '#b48ae6', [[9, 4], [9, 7], [9, 10]]);
    r(c, K, 5, 14, 1, 2); r(c, K, 10, 14, 1, 2); r(c, '#c4c9cf', 5, 14, 1, 1); r(c, '#c4c9cf', 10, 14, 1, 1);
  },
  tool_wrench_old: (c) => wrench(c, '#8d949c', '#b8bcc4', '#5d636b', '#9b5a32'),
  tool_wrench_reinforced: (c) => wrench(c, '#b8bcc4', '#e8ecf2', '#7d8792', '#3d6a8a'),
  tool_hydraulic_pry: (c) => {
    for (let i = 0; i < 11; i++) r(c, K, 1 + i, 14 - i, 3, 2);
    for (let i = 0; i < 11; i++) r(c, i < 5 ? '#e0b33a' : '#8d949c', 2 + i, 14 - i, 1, 1);
    r(c, K, 11, 0, 5, 5); r(c, '#b8bcc4', 12, 1, 3, 3); r(c, K, 13, 2, 1, 1);
    r(c, K, 3, 8, 4, 4); r(c, '#5d636b', 4, 9, 2, 2); r(c, '#c4c9cf', 4, 9, 1, 1);
  },
  head_scrap_cap: (c) => {
    r(c, K, 3, 4, 10, 7); r(c, '#a8561a', 4, 5, 8, 5); r(c, '#d97b2b', 4, 5, 8, 2); r(c, '#f0a860', 5, 5, 3, 1);
    r(c, K, 1, 10, 14, 3); r(c, '#6b4a2e', 2, 11, 12, 1);
    r(c, '#5d636b', 9, 6, 2, 2);
    r(c, K, 7, 3, 2, 1);
  },
  body_work_jacket: (c) => {
    r(c, K, 2, 2, 12, 13); r(c, '#a8561a', 3, 3, 10, 11); r(c, '#d97b2b', 3, 3, 4, 11); r(c, '#f0a860', 3, 3, 1, 11);
    r(c, K, 7, 3, 2, 11); r(c, '#c4c9cf', 7, 4, 1, 9);
    r(c, K, 5, 2, 6, 2); r(c, '#6b4a2e', 6, 2, 4, 1);
    r(c, '#6b4a2e', 4, 9, 2, 2); r(c, '#6b4a2e', 10, 9, 2, 2);
    r(c, K, 0, 4, 2, 7); r(c, K, 14, 4, 2, 7);
  },
  hands_grip_gloves: (c) => {
    r(c, K, 1, 4, 7, 10); r(c, '#b0962f', 2, 5, 5, 8); r(c, '#e0b33a', 2, 5, 2, 8);
    r(c, K, 8, 2, 7, 10); r(c, '#b0962f', 9, 3, 5, 8); r(c, '#e0b33a', 9, 3, 2, 8);
    r(c, '#6b4a2e', 2, 11, 5, 2); r(c, '#6b4a2e', 9, 9, 5, 2);
    px(c, K, [[4, 4], [11, 2], [13, 2]]);
  },
  feet_rail_boots: (c) => {
    r(c, K, 2, 2, 6, 10); r(c, '#6b4a2e', 3, 3, 4, 8); r(c, '#8b6340', 3, 3, 1, 8);
    r(c, K, 2, 10, 13, 5); r(c, '#6b4a2e', 3, 11, 11, 3); r(c, '#8d949c', 11, 11, 3, 3); r(c, '#c4c9cf', 11, 11, 2, 1);
    r(c, '#3b2a1a', 3, 13, 11, 1);
    px(c, '#e0b33a', [[4, 5], [4, 7]]);
  },
  accessory_lucky_bolt: (c) => {
    r(c, K, 4, 1, 8, 5); r(c, '#b0962f', 5, 2, 6, 3); r(c, '#f6dd8a', 5, 2, 6, 1);
    r(c, K, 6, 5, 4, 10); r(c, '#b0962f', 7, 6, 2, 8);
    for (let y = 7; y < 14; y += 2) r(c, '#f6dd8a', 7, y, 2, 1);
    px(c, '#fffbe0', [[13, 3], [14, 2], [12, 2], [13, 1], [13, 4]]);
  },
};

export const iconUrls: Partial<Record<ItemId, string>> = {};

/** Data URL of the hero standing, front view (24×32). Scale it up with image-rendering: pixelated. */
export let heroPortraitUrl = '';

export function buildSprites(scene: Phaser.Scene): void {
  sheet(scene, 'hero', HERO_FRAMES, HERO_PAL, 24, 32);
  const portrait = document.createElement('canvas');
  portrait.width = 24;
  portrait.height = 32;
  drawRows(portrait.getContext('2d')!, HERO_FRAMES[0], 0, 0, HERO_PAL);
  heroPortraitUrl = portrait.toDataURL();
  buildProps(scene);

  canvasTex(scene, 'wrench', 16, 16, 1, (c) => {
    for (let i = 0; i < 8; i++) r(c, '#1b1a24', 2 + i, 13 - i, 3, 3);
    for (let i = 0; i < 8; i++) r(c, i < 3 ? '#a8552e' : '#b8bcc4', 3 + i, 13 - i, 1, 1), r(c, i < 3 ? '#7d4527' : '#8d949c', 3 + i, 14 - i, 1, 1);
    r(c, '#1b1a24', 9, 1, 6, 6);
    r(c, '#c4c9cf', 10, 2, 4, 4);
    r(c, '#1b1a24', 12, 1, 3, 3);
    r(c, '#e0e4ea', 10, 2, 1, 1);
  });

  // Ferrugem faces right: a compact riveted plate body with an alternating four-paw run.
  canvasTex(scene, 'robodog', 24, 18, 2, (c, f, ox) => {
    const k = '#14121e';
    const iron = '#2a2d38';
    const steel = '#4a5468';
    const steelHi = '#7b8aa3';
    const copper = '#d7833b';
    const rust = '#a8481e';
    const teal = '#5fd0d8';

    // Raised spring tail, rear haunch, then the plated body.
    r(c, k, ox + 0, 2, 2, 6); r(c, steelHi, ox + 1, 2, 1, 2);
    r(c, k, ox + 1, 1, 2, 2); r(c, rust, ox + 2, 1, 1, 1);
    r(c, k, ox + 2, 7, 3, 6); r(c, rust, ox + 3, 8, 2, 4); r(c, copper, ox + 3, 8, 2, 1);
    r(c, k, ox + 4, 6, 13, 8); r(c, steel, ox + 5, 7, 11, 6); r(c, steelHi, ox + 5, 7, 8, 2);
    r(c, iron, ox + 5, 11, 11, 2); r(c, copper, ox + 6, 8, 1, 1); r(c, copper, ox + 14, 12, 1, 1);

    // Copper power core: riveted ring and a turquoise alchemical triangle.
    r(c, k, ox + 8, 8, 5, 5); r(c, rust, ox + 9, 9, 3, 3); r(c, copper, ox + 9, 9, 2, 1);
    r(c, teal, ox + 10, 9, 1, 1); r(c, teal, ox + 9, 11, 3, 1); r(c, teal, ox + 11, 10, 1, 1);
    r(c, copper, ox + 8, 9, 1, 1); r(c, copper, ox + 12, 11, 1, 1);

    // Large head, folded front ear, upright rear ear, and friendly square muzzle.
    r(c, k, ox + 14, 2, 8, 9); r(c, steel, ox + 15, 3, 6, 6); r(c, steelHi, ox + 15, 3, 4, 2);
    r(c, k, ox + 15, 0, 4, 4); r(c, steelHi, ox + 16, 1, 2, 2); r(c, copper, ox + 16, 1, 1, 1);
    r(c, k, ox + 19, 2, 4, 4); r(c, rust, ox + 20, 3, 2, 2); r(c, copper, ox + 20, 3, 1, 1);
    r(c, teal, ox + 19, 5, 1, 1); r(c, '#ffffff', ox + 19, 5, 1, 1);
    r(c, k, ox + 20, 7, 4, 4); r(c, '#b8bcc4', ox + 20, 8, 3, 2); r(c, '#e0e4ea', ox + 20, 8, 2, 1);
    r(c, '#e8b080', ox + 22, 8, 1, 1); r(c, k, ox + 21, 10, 2, 1);

    // Scarf/collar and dangling knot at the chest.
    r(c, k, ox + 15, 10, 5, 3); r(c, '#d06a2a', ox + 16, 10, 3, 2); r(c, '#e88a3e', ox + 16, 10, 2, 1);
    r(c, k, ox + 18, 12, 2, 3); r(c, rust, ox + 19, 12, 1, 2);

    const legs = f ? [5, 9, 13, 17] : [6, 10, 12, 16];
    legs.forEach((x, i) => {
      const kneeY = f && i % 2 === 0 ? 13 : 12;
      r(c, k, ox + x, 13, 3, 4);
      r(c, iron, ox + x + 1, 13, 1, 2);
      r(c, rust, ox + x + 1, kneeY, 1, 1);
      r(c, k, ox + x - 1, 16, 4, 2);
      r(c, steelHi, ox + x, 16, 2, 1);
    });
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

  canvasTex(scene, 'drone', 16, 16, 2, (c, f, ox) => {
    r(c, '#1b1a24', ox, 2, 16, 3);
    r(c, '#c4c9cf', ox + (f ? 1 : 3), 3, 4, 1);
    r(c, '#c4c9cf', ox + (f ? 11 : 9), 3, 4, 1);
    r(c, '#1b1a24', ox + 7, 3, 2, 4);
    disc(c, '#1b1a24', ox + 8, 10, 5);
    disc(c, '#e0b33a', ox + 8, 10, 4);
    disc(c, '#a57a1c', ox + 8, 12, 2);
    disc(c, '#5fd0d8', ox + 8, 9, 2);
    r(c, '#ffffff', ox + 7, 8, 1, 1);
  });

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

  const anim = (key: string, tex: string, frames: number[], rate: number) =>
    scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate: rate, repeat: -1 });
  anim('hero-down', 'hero', [0, 1], 6);
  anim('hero-up', 'hero', [2, 3], 6);
  anim('hero-side', 'hero', [4, 5], 6);
  anim('vendor-idle', 'vendor', [0, 1], 2);
  anim('sorter-walk', 'sorter', [0, 1], 5);
  anim('press-walk', 'press', [0, 1], 3);
  anim('drone-fly', 'drone', [0, 1], 12);
  anim('dog-run', 'robodog', [0, 1], 10);
  anim('crane-idle', 'crane', [0, 1], 3);
  anim('pile-glint', 'pile', [0, 1], 2);
  anim('relic-pulse', 'relic', [0, 1], 3);
  anim('terminal-blink', 'terminal', [0, 1], 2);
}
