import { mixSeed, mulberry32, type Rng } from '../core/rng';
import type { BiomeId, HuntArea, Region } from '../data/hunt';

/** Logical map size in CSS px; markers are placed on it by their 0..1 pos. */
export const MAP_W = 800;
export const MAP_H = 500;
/** One painted pixel covers PX×PX logical px, which keeps the map in the game's pixel-art grain. */
const PX = 4;
const GW = MAP_W / PX;
const GH = MAP_H / PX;

interface Palette {
  water: [string, string];
  shore: string;
  land: [string, string, string];
  prop: string;
  accent: string;
  route: string;
  /** Higher = less land. */
  sea: number;
}

const PALETTES: Record<BiomeId, Palette> = {
  rust: { water: ['#24403f', '#2d4f4c'], shore: '#6e6440', land: ['#7a5634', '#86603b', '#6a4a2c'], prop: '#3b281a', accent: '#a8481e', route: '#e0b33a', sea: 0.52 },
  foundry: { water: ['#2e1a16', '#3b2019'], shore: '#6b4a3a', land: ['#4f4b55', '#5a5660', '#45424b'], prop: '#28252e', accent: '#e06a2a', route: '#f0b35a', sea: 0.5 },
  flooded: { water: ['#1d3550', '#25466a'], shore: '#5f7470', land: ['#4f5a5e', '#5b676a', '#465155'], prop: '#7a4a2a', accent: '#5fd0d8', route: '#e0d08a', sea: 0.62 },
  magnetic: { water: ['#1d1730', '#251d3d'], shore: '#5b4f7c', land: ['#463d5c', '#52476a', '#3d3550'], prop: '#2a2340', accent: '#b48ae6', route: '#d8c0ff', sea: 0.54 },
  core: { water: ['#1c121b', '#26151f'], shore: '#6a4250', land: ['#4a3440', '#563c4a', '#3f2c37'], prop: '#2a1b24', accent: '#c83a3a', route: '#f08a6a', sea: 0.56 },
};

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Smooth value noise on a coarse random lattice. */
function noise(rng: Rng, cols: number, rows: number): (x: number, y: number) => number {
  const grid = Array.from({ length: (cols + 1) * (rows + 1) }, rng);
  const at = (i: number, j: number) => grid[j * (cols + 1) + i];
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * cols, fy = y * rows;
    const i = Math.min(cols - 1, Math.floor(fx)), j = Math.min(rows - 1, Math.floor(fy));
    const u = ease(fx - i), v = ease(fy - j);
    const top = at(i, j) * (1 - u) + at(i + 1, j) * u;
    const bottom = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u;
    return top * (1 - v) + bottom * v;
  };
}

/** Land mask: every area sits on a landmass, the rest is noise-shaped islands and water. */
function landMask(areas: readonly HuntArea[], rng: Rng, pal: Palette): Float32Array {
  const coarse = noise(rng, 6, 4);
  const fine = noise(rng, 18, 12);
  const blobs = [
    ...areas.map((a) => ({ x: a.pos.x, y: a.pos.y, r: 0.1 })),
    ...Array.from({ length: 7 }, () => ({ x: rng(), y: rng(), r: 0.05 + rng() * 0.08 })),
  ];
  const field = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx / GW, y = gy / GH;
      let pull = 0;
      for (const b of blobs) {
        const dx = (x - b.x) * 1.6, dy = y - b.y;
        pull += (b.r * b.r) / (dx * dx + dy * dy + 0.0004);
      }
      const edge = Math.min(x, 1 - x, y, 1 - y);
      field[gy * GW + gx] = Math.min(pull, 2) * 0.35 + coarse(x, y) * 0.45 + fine(x, y) * 0.2 - (edge < 0.04 ? 0.25 : 0);
    }
  }
  return field.map((v) => (v > pal.sea ? 1 : 0));
}

function px(ctx: CanvasRenderingContext2D, color: string, gx: number, gy: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, w * PX, h * PX);
}

function paintGround(ctx: CanvasRenderingContext2D, land: Float32Array, pal: Palette, rng: Rng): void {
  const tone = noise(rng, 24, 15);
  const isLand = (gx: number, gy: number) => gx < 0 || gy < 0 || gx >= GW || gy >= GH || land[gy * GW + gx] === 1;
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      if (!isLand(gx, gy)) {
        px(ctx, (gy + (gx >> 3)) % 7 === 0 ? pal.water[1] : pal.water[0], gx, gy);
        continue;
      }
      const coast = !isLand(gx + 1, gy) || !isLand(gx - 1, gy) || !isLand(gx, gy + 1) || !isLand(gx, gy - 1);
      const t = tone(gx / GW, gy / GH);
      px(ctx, coast ? pal.shore : pal.land[t < 0.38 ? 2 : t > 0.62 ? 1 : 0], gx, gy);
    }
  }
  for (let i = 0; i < 160; i++) {
    const gx = Math.floor(rng() * GW), gy = Math.floor(rng() * GH);
    if (isLand(gx, gy) && isLand(gx + 2, gy + 1)) px(ctx, i % 9 === 0 ? pal.accent : pal.prop, gx, gy, 1 + (i % 3 === 0 ? 1 : 0), 1);
  }
}

/** Biome flourishes: field rings, ember cracks, flooded stripes, hot pipes. */
function paintBiome(ctx: CanvasRenderingContext2D, biome: BiomeId, pal: Palette, rng: Rng): void {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = PX;
  if (biome === 'magnetic') {
    const cx = MAP_W * (0.4 + rng() * 0.2), cy = MAP_H * (0.4 + rng() * 0.2);
    for (let r = 60; r < MAP_W; r += 70) { ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.62, 0.3, 0, Math.PI * 2); ctx.stroke(); }
  } else if (biome === 'foundry' || biome === 'core') {
    for (let i = 0; i < 9; i++) {
      let x = rng() * MAP_W, y = rng() * MAP_H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (rng() - 0.5) * 90; y += (rng() - 0.3) * 50; ctx.lineTo(Math.round(x / PX) * PX, Math.round(y / PX) * PX); }
      ctx.stroke();
    }
  } else if (biome === 'flooded') {
    for (let y = 12; y < MAP_H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y + 6); ctx.stroke(); }
  }
  ctx.restore();
}

/** Dashed trail visiting the areas in level order. */
function paintRoute(ctx: CanvasRenderingContext2D, areas: readonly HuntArea[], pal: Palette): void {
  const path = [...areas].sort((a, b) => a.level - b.level);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = pal.route;
  ctx.lineWidth = PX / 2;
  ctx.setLineDash([PX * 2, PX * 2]);
  ctx.beginPath();
  path.forEach((a, i) => (i ? ctx.lineTo(a.pos.x * MAP_W, a.pos.y * MAP_H) : ctx.moveTo(a.pos.x * MAP_W, a.pos.y * MAP_H)));
  ctx.stroke();
  ctx.restore();
}

/** Paints the stylised region map (same region, same picture) and returns its water colour for the letterbox. */
export function paintRegionMap(canvas: HTMLCanvasElement, region: Region, areas: readonly HuntArea[]): string {
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  const pal = PALETTES[region.biome];
  if (!ctx) return pal.water[0];
  const rng = mulberry32(mixSeed(seedOf(region.id), 0x5ca1ab1e));
  paintGround(ctx, landMask(areas, rng, pal), pal, rng);
  paintBiome(ctx, region.biome, pal, rng);
  paintRoute(ctx, areas, pal);
  ctx.strokeStyle = '#14121e';
  ctx.lineWidth = PX;
  ctx.strokeRect(PX / 2, PX / 2, MAP_W - PX, MAP_H - PX);
  return pal.water[0];
}

/** One region's footprint on the world map, in 0..1 units. */
export interface WorldZoneShape { id: string; biome: BiomeId; rect: { x: number; y: number; w: number; h: number } }

const WORLD_SEA: [string, string] = ['#14202a', '#1a2a36'];
const BORDER = '#1b1922';

/** Owner zone of each grid cell (index into zones), -1 for sea; zones swell from their rect with noisy coasts. */
function worldOwners(zones: readonly WorldZoneShape[], patio: { x: number; y: number }, rng: Rng): Int8Array {
  const coast = noise(rng, 20, 12);
  const owners = new Int8Array(GW * GH).fill(-1);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) / GW, y = (gy + 0.5) / GH;
      let best = 0, owner = -1;
      zones.forEach((z, i) => {
        const hw = z.rect.w / 2, hh = z.rect.h / 2;
        const dx = Math.abs(x - z.rect.x - hw) / hw, dy = Math.abs(y - z.rect.y - hh) / hh;
        const v = 1.12 - (Math.max(dx, dy) + Math.hypot(dx, dy)) / 2 + (coast(x, y) - 0.5) * 0.4;
        if (v > best) { best = v; owner = i; }
      });
      if (owner < 0 && Math.hypot((x - patio.x) * 1.6, y - patio.y) < 0.06) owner = 0;
      owners[gy * GW + gx] = owner;
    }
  }
  return owners;
}

/** Paints the world map: each region a biome-coloured land in one continent, a trail from the Pátio by level. */
export function paintWorldMap(canvas: HTMLCanvasElement, zones: readonly WorldZoneShape[], patio: { x: number; y: number }): string {
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return WORLD_SEA[0];
  const rng = mulberry32(mixSeed(seedOf('mundo'), 0x5ca1ab1e));
  const owners = worldOwners(zones, patio, rng);
  const tone = noise(rng, 30, 18);
  const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= GW || gy >= GH ? -1 : owners[gy * GW + gx]);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const o = at(gx, gy);
      if (o < 0) { px(ctx, (gy + (gx >> 3)) % 7 === 0 ? WORLD_SEA[1] : WORLD_SEA[0], gx, gy); continue; }
      const pal = PALETTES[zones[o].biome];
      const near = [at(gx + 1, gy), at(gx - 1, gy), at(gx, gy + 1), at(gx, gy - 1)];
      const t = tone(gx / GW, gy / GH);
      const color = near.includes(-1) ? pal.shore : near.some((n) => n > o) ? BORDER : pal.land[t < 0.38 ? 2 : t > 0.62 ? 1 : 0];
      px(ctx, color, gx, gy);
    }
  }
  for (const z of zones) {
    const pal = PALETTES[z.biome];
    ctx.save();
    ctx.beginPath();
    ctx.rect(z.rect.x * MAP_W, z.rect.y * MAP_H, z.rect.w * MAP_W, z.rect.h * MAP_H);
    ctx.clip();
    paintBiome(ctx, z.biome, pal, rng);
    ctx.restore();
  }
  const stops = [patio, ...zones.map((z) => ({ x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 }))];
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#e0b33a';
  ctx.lineWidth = PX / 2;
  ctx.setLineDash([PX * 2, PX * 2]);
  ctx.beginPath();
  stops.forEach((p, i) => (i ? ctx.lineTo(p.x * MAP_W, p.y * MAP_H) : ctx.moveTo(p.x * MAP_W, p.y * MAP_H)));
  ctx.stroke();
  ctx.restore();
  px(ctx, '#e0b33a', Math.round(patio.x * GW) - 1, Math.round(patio.y * GH) - 1, 3, 3);
  px(ctx, '#14121e', Math.round(patio.x * GW), Math.round(patio.y * GH));
  ctx.strokeStyle = '#14121e';
  ctx.lineWidth = PX;
  ctx.strokeRect(PX / 2, PX / 2, MAP_W - PX, MAP_H - PX);
  return WORLD_SEA[0];
}

