import './minimap.css';

// Survey-map style minimap. The static layer (terrain, props, markers) is painted once per map at an
// integer scale; each refresh only blits it and draws fog, live enemies, the camera box and the player.

export interface MinimapData {
  mapId: string;
  name: string;
  widthTiles: number;
  heightTiles: number;
  blocked: Uint8Array;
  terrain?: Uint8Array;
  markers: Array<{ kind: 'entrance' | 'extraction' | 'pile' | 'npc' | 'boss' | 'junk' | 'tree'; x: number; y: number; label: string }>;
}

export const TERRAIN_CLASS = {
  dirt: 0, grass: 1, gravel: 2, rail: 3, concrete: 4, floor: 5, path: 6, wall: 7, building: 8, fence: 9, water: 10,
} as const;

const BOX_W = 292;
const BOX_H = 196;
const REVEAL = 12;
const REFRESH_MS = 200;

/** [base, light speckle, dark speckle] per terrain class. */
const PALETTE: [string, string, string][] = [
  ['#b08c5c', '#c29e6c', '#9b7a4e'], // dirt
  ['#7f9a58', '#93ad68', '#6c864a'], // grass
  ['#8a8780', '#9d9a92', '#76736d'], // gravel
  ['#8a8780', '#9d9a92', '#76736d'], // rail bed (rails drawn on top)
  ['#b4b1a8', '#c4c1b8', '#a19e96'], // concrete
  ['#6d6f78', '#7b7d86', '#5f616a'], // dungeon floor
  ['#d4b882', '#e0c692', '#c4a872'], // path
  ['#3b3f48', '#474b55', '#30333b'], // wall
  ['#7a4b34', '#93603f', '#5e3826'], // building roof
  ['#b08c5c', '#c29e6c', '#9b7a4e'], // fence (drawn on top)
  ['#4f7f8c', '#6295a2', '#41707c'], // water
];

let data: MinimapData | null = null;
let layer: HTMLCanvasElement | null = null;
let scale = 4;
const explored = new Map<string, Uint8Array>();
let player = { x: 0, y: 0 };
let heading = -Math.PI / 2;
let view = { x: 0, y: 0, w: 0, h: 0 };
let enemies: { x: number; y: number }[] = [];
let lastPaint = 0;

function hash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

export function setMinimap(next: MinimapData): void {
  data = next;
  scale = Math.max(2, Math.floor(Math.min(BOX_W / next.widthTiles, BOX_H / next.heightTiles)));
  layer = document.createElement('canvas');
  layer.width = next.widthTiles * scale;
  layer.height = next.heightTiles * scale;
  if (!explored.has(next.mapId)) explored.set(next.mapId, new Uint8Array(next.widthTiles * next.heightTiles));
  paintStatic(layer.getContext('2d')!);
  const title = document.querySelector('.minimap-card h3');
  if (title) title.textContent = next.name;
  reveal();
  draw(true);
}

export function setMinimapPlayer(tileX: number, tileY: number): void {
  if (tileX !== player.x || tileY !== player.y) heading = Math.atan2(tileY - player.y, tileX - player.x);
  player = { x: tileX, y: tileY };
  reveal();
  draw(false);
}

/** Visible camera area, in tiles. */
export function setMinimapView(x: number, y: number, w: number, h: number): void {
  view = { x, y, w, h };
}

/** Live enemy positions, in tiles. */
export function setMinimapEnemies(points: { x: number; y: number }[]): void {
  enemies = points;
}

export function openMapView(): void {
  const el = document.getElementById('map-view');
  if (!el) return;
  el.hidden = false;
  draw(true);
}

export function closeMapView(): void {
  const el = document.getElementById('map-view');
  if (el) el.hidden = true;
}

// ---------------- static layer ----------------

function paintStatic(c: CanvasRenderingContext2D): void {
  if (!data) return;
  const s = scale;
  for (let y = 0; y < data.heightTiles; y++)
    for (let x = 0; x < data.widthTiles; x++) {
      const i = y * data.widthTiles + x;
      const t = data.terrain?.[i] ?? (data.blocked[i] ? TERRAIN_CLASS.wall : TERRAIN_CLASS.dirt);
      const [base, light, dark] = PALETTE[t] ?? PALETTE[0];
      const h = hash(x, y);
      c.fillStyle = base;
      c.fillRect(x * s, y * s, s, s);
      if (s >= 4) {
        c.fillStyle = h % 3 === 0 ? light : dark;
        c.fillRect(x * s + (h % s), y * s + ((h >> 3) % s), 1, 1);
      }
      if (t === TERRAIN_CLASS.rail) paintRail(c, data, x, y);
      if (t === TERRAIN_CLASS.building) {
        c.fillStyle = '#4a2c1e';
        c.fillRect(x * s, y * s + s - 1, s, 1);
      }
      if (t === TERRAIN_CLASS.fence && (x + y) % 2 === 0) {
        c.fillStyle = '#5a4a3a';
        c.fillRect(x * s + s / 2 - 1, y * s + s / 2 - 1, 2, 2);
      }
    }
  for (const m of data.markers) if (m.kind === 'junk' || m.kind === 'tree' || m.kind === 'pile') paintProp(c, m);
  for (const m of data.markers) if (m.kind !== 'junk' && m.kind !== 'tree' && m.kind !== 'pile') paintIcon(c, m);
}

function paintRail(c: CanvasRenderingContext2D, d: MinimapData, x: number, y: number): void {
  const s = scale;
  const isRail = (tx: number, ty: number) => d.terrain?.[ty * d.widthTiles + tx] === TERRAIN_CLASS.rail;
  const horizontal = isRail(x - 1, y) || isRail(x + 1, y);
  const vertical = isRail(x, y - 1) || isRail(x, y + 1);
  c.fillStyle = '#5a4030';
  if (horizontal) for (let k = 0; k < s; k += 2) c.fillRect(x * s + k, y * s + 1, 1, s - 2);
  if (vertical) for (let k = 0; k < s; k += 2) c.fillRect(x * s + 1, y * s + k, s - 2, 1);
  c.fillStyle = '#d8dce4';
  if (horizontal) {
    c.fillRect(x * s, y * s + 1, s, 1);
    c.fillRect(x * s, y * s + s - 2, s, 1);
  }
  if (vertical) {
    c.fillRect(x * s + 1, y * s, 1, s);
    c.fillRect(x * s + s - 2, y * s, 1, s);
  }
}

function paintProp(c: CanvasRenderingContext2D, m: MinimapData['markers'][number]): void {
  const s = scale, cx = m.x * s + s / 2, cy = m.y * s + s / 2, h = hash(m.x, m.y);
  if (m.kind === 'tree') {
    c.fillStyle = '#2d4a2a';
    c.beginPath();
    c.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4f7a3f';
    c.beginPath();
    c.arc(cx - s * 0.2, cy - s * 0.2, s * 0.45, 0, Math.PI * 2);
    c.fill();
  } else if (m.kind === 'pile') {
    c.fillStyle = '#1b1a24';
    c.fillRect(cx - s / 2 - 1, cy - s / 2 - 1, s + 2, s + 2);
    c.fillStyle = '#e0b33a';
    c.fillRect(cx - s / 2, cy - s / 2, s, s);
  } else {
    const junk = ['#8a4a2a', '#6f6a66', '#9b5a32', '#4f5560', '#7a5a3a'];
    c.fillStyle = junk[h % junk.length];
    c.fillRect(m.x * s, m.y * s + Math.floor(s / 4), s, Math.ceil(s * 0.75));
    c.fillStyle = 'rgba(255,240,210,0.35)';
    c.fillRect(m.x * s, m.y * s + Math.floor(s / 4), Math.ceil(s / 2), 1);
  }
}

function paintIcon(c: CanvasRenderingContext2D, m: MinimapData['markers'][number]): void {
  const s = scale, x = m.x * s + s / 2, y = m.y * s + s / 2, r = Math.max(4, s);
  c.save();
  c.lineWidth = 2;
  c.strokeStyle = '#1b1a24';
  if (m.kind === 'entrance') {
    c.fillStyle = '#f6c84a';
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r, y);
    c.lineTo(x, y + r);
    c.lineTo(x - r, y);
    c.closePath();
    c.stroke();
    c.fill();
  } else if (m.kind === 'extraction') {
    c.fillStyle = '#5fd0d8';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.fill();
    c.fillStyle = '#1b1a24';
    c.fillRect(x - 1, y - r + 2, 2, r * 2 - 4);
  } else if (m.kind === 'npc') {
    c.fillStyle = '#e8d6b0';
    c.beginPath();
    c.moveTo(x - r, y);
    c.lineTo(x, y - r);
    c.lineTo(x + r, y);
    c.lineTo(x + r, y + r);
    c.lineTo(x - r, y + r);
    c.closePath();
    c.stroke();
    c.fill();
  } else if (m.kind === 'boss') {
    c.fillStyle = '#e8433a';
    c.beginPath();
    c.arc(x, y, r + 1, 0, Math.PI * 2);
    c.stroke();
    c.fill();
    c.fillStyle = '#1b1a24';
    c.fillRect(x - 3, y - 2, 2, 2);
    c.fillRect(x + 1, y - 2, 2, 2);
    c.fillRect(x - 2, y + 2, 4, 1);
  }
  c.restore();
}

// ---------------- dynamic layer ----------------

function reveal(): void {
  if (!data) return;
  const map = explored.get(data.mapId);
  if (!map) return;
  for (let y = Math.max(0, player.y - REVEAL); y <= Math.min(data.heightTiles - 1, player.y + REVEAL); y++)
    for (let x = Math.max(0, player.x - REVEAL); x <= Math.min(data.widthTiles - 1, player.x + REVEAL); x++)
      if ((x - player.x) ** 2 + (y - player.y) ** 2 <= REVEAL * REVEAL) map[y * data.widthTiles + x] = 1;
}

function draw(force: boolean): void {
  const now = performance.now();
  if (!force && now - lastPaint < REFRESH_MS) return;
  lastPaint = now;
  paint(document.getElementById('minimap') as HTMLCanvasElement | null, 1);
  const big = document.getElementById('map-view-canvas') as HTMLCanvasElement | null;
  if (big && !document.getElementById('map-view')?.hidden) paint(big, 2);
}

function paint(canvas: HTMLCanvasElement | null, zoom: number): void {
  if (!canvas || !data || !layer) return;
  const w = layer.width * zoom, h = layer.height * zoom;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const c = canvas.getContext('2d');
  const map = explored.get(data.mapId);
  if (!c || !map) return;
  const s = scale * zoom;
  c.imageSmoothingEnabled = false;
  c.drawImage(layer, 0, 0, w, h);
  // fog: unexplored land stays readable but dim, like an old survey sheet
  c.fillStyle = 'rgba(44, 30, 22, 0.62)';
  for (let y = 0; y < data.heightTiles; y++) {
    let run = -1;
    for (let x = 0; x <= data.widthTiles; x++) {
      const hidden = x < data.widthTiles && !map[y * data.widthTiles + x];
      if (hidden && run < 0) run = x;
      if (!hidden && run >= 0) {
        c.fillRect(run * s, y * s, (x - run) * s, s);
        run = -1;
      }
    }
  }
  c.fillStyle = '#e8433a';
  for (const e of enemies) {
    if (!map[e.y * data.widthTiles + e.x]) continue;
    c.fillRect(e.x * s + s / 2 - 2, e.y * s + s / 2 - 2, 4, 4);
  }
  if (view.w > 0) {
    c.strokeStyle = 'rgba(255, 241, 207, 0.7)';
    c.lineWidth = 1;
    c.strokeRect(Math.round(view.x * s) + 0.5, Math.round(view.y * s) + 0.5, Math.round(view.w * s), Math.round(view.h * s));
  }
  paintPlayer(c, s);
}

function paintPlayer(c: CanvasRenderingContext2D, s: number): void {
  const x = (player.x + 0.5) * s, y = (player.y + 0.5) * s;
  // The hero must pop out of a busy map: bright amber arrow, dark outline, a strong pulsing ring.
  const pulse = 7 + ((performance.now() / 110) % 8);
  c.save();
  c.fillStyle = 'rgba(246, 200, 74, 0.25)';
  c.beginPath();
  c.arc(x, y, 7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgba(246, 200, 74, ${1 - (pulse - 7) / 9})`;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, pulse, 0, Math.PI * 2);
  c.stroke();
  c.translate(x, y);
  c.rotate(heading + Math.PI / 2);
  c.fillStyle = '#1b1a24';
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(7, 7);
  c.lineTo(0, 4);
  c.lineTo(-7, 7);
  c.closePath();
  c.fill();
  c.fillStyle = '#f6c84a';
  c.beginPath();
  c.moveTo(0, -6.5);
  c.lineTo(4.8, 5);
  c.lineTo(0, 2.5);
  c.lineTo(-4.8, 5);
  c.closePath();
  c.fill();
  c.fillStyle = '#fffbe0';
  c.fillRect(-1, -4, 2, 3);
  c.restore();
}
