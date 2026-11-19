// Renders a scene of tiles (by name) upscaled to a PNG for quick visual review.
// Usage: node tools/preview-tiles.ts <out.png> <scale> "<row>;<row>" where a row is "terrain/object terrain/object ...".
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { TILE_SIZE, TILES, TILESET_COLUMNS, drawTileset } from '../src/art/tileArt.ts';
import { PROPS } from '../src/art/props.ts';

const [out, scaleArg, spec] = process.argv.slice(2);
const scale = Number(scaleArg) || 6;
const envPreview = spec === '--env-v2';
const rows = (envPreview ? 'grass grass grass grass grass grass;dirt dirt dirt dirt dirt dirt;floor floor floor floor floor floor' : spec).split(';').map((r) => r.trim().split(/\s+/).map((cell) => cell.split('/')));
const set = drawTileset();
const propKeys = envPreview ? ['treeLeafy', 'treePine', 'treeDead', 'bush', 'tuft0', 'tuft1', 'tuft2', 'boulderMoss', 'rockPile', 'stonesDaisy', 'mushroomCluster', 'logPlain', 'logMoss', 'hedgeShort', 'stoneWallShort', 'flowerPatch'] : [];
const W = envPreview ? 192 : rows[0].length * TILE_SIZE, H = envPreview ? 160 : rows.length * TILE_SIZE;
const img = new Uint8ClampedArray(W * H * 4);

function blit(gid: number, tx: number, ty: number): void {
  const idx = gid - 1, sx = (idx % TILESET_COLUMNS) * TILE_SIZE, sy = Math.floor(idx / TILESET_COLUMNS) * TILE_SIZE;
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const s = ((sy + y) * set.width + sx + x) * 4, d = ((ty * TILE_SIZE + y) * W + tx * TILE_SIZE + x) * 4, a = set.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) img[d + c] = set.data[s + c] * a + img[d + c] * (1 - a);
      img[d + 3] = 255;
    }
}
rows.forEach((row, ty) => row.forEach(([t, o], tx) => {
  if (t) blit(TILES[t as keyof typeof TILES], tx, ty);
  if (o) blit(TILES[o as keyof typeof TILES], tx, ty);
}));
if (envPreview) {
  for (let ty = 3; ty < 10; ty++) for (let tx = 0; tx < 12; tx++) {
    blit(ty < 6 ? TILES.grass : TILES.dirt, tx, ty);
  }
}

function drawProps(): void {
  let x = 4, y = 52;
  for (const key of propKeys) {
    const def = PROPS[key];
    const pixels = new Uint8ClampedArray(def.w * def.h * 4);
    let color = '#000000';
    const context = {
      set fillStyle(value: string) { color = value; },
      get fillStyle() { return color; },
      fillRect(px: number, py: number, pw: number, ph: number) {
        const n = parseInt(color.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) if (xx >= 0 && yy >= 0 && xx < def.w && yy < def.h) {
          const i = (yy * def.w + xx) * 4; pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
        }
      },
      save() {}, restore() {}, translate() {},
    } as unknown as CanvasRenderingContext2D;
    def.draw(context);
    if (x + def.w > W - 2) { x = 4; y += 42; }
    for (let py = 0; py < def.h; py++) for (let px = 0; px < def.w; px++) {
      const s = (py * def.w + px) * 4, d = ((y + py) * W + x + px) * 4;
      if (pixels[s + 3]) { img[d] = pixels[s]; img[d + 1] = pixels[s + 1]; img[d + 2] = pixels[s + 2]; img[d + 3] = 255; }
    }
    x += def.w + 5;
  }
}
if (envPreview) drawProps();

const SW = W * scale, SH = H * scale, raw = Buffer.alloc((SW * 4 + 1) * SH);
for (let y = 0; y < SH; y++)
  for (let x = 0; x < SW; x++) {
    const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 4, d = y * (SW * 4 + 1) + 1 + x * 4;
    raw[d] = img[s]; raw[d + 1] = img[s + 1]; raw[d + 2] = img[s + 2]; raw[d + 3] = img[s + 3];
  }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(SW, 0); ihdr.writeUInt32BE(SH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, SW, 'x', SH);
