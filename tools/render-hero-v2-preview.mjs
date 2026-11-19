import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('src/art/sprites.ts', 'utf8');
const start = source.indexOf('const HERO_PAL');
const end = source.indexOf('const BASE');
const art = source.slice(start, end).replaceAll(': Pal', '');
const { HERO_PAL, HERO_FRAMES } = Function(`${art}; return { HERO_PAL, HERO_FRAMES };`)();

const SCALE = 8;
const CELL_W = 28 * SCALE;
const CELL_H = 38 * SCALE;
const COLUMNS = 4;
const ROWS = 3;
const width = CELL_W * COLUMNS;
const height = CELL_H * ROWS;
const pixels = Buffer.alloc(width * height * 4, 255);

function color(hex) {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16), 255];
}

function setPixel(x, y, rgba) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels.set(rgba, offset);
}

function block(x, y, rgba) {
  for (let py = 0; py < SCALE; py++) for (let px = 0; px < SCALE; px++) setPixel(x * SCALE + px, y * SCALE + py, rgba);
}

function fillCell(index, hex) {
  const x0 = (index % COLUMNS) * CELL_W / SCALE;
  const y0 = Math.floor(index / COLUMNS) * CELL_H / SCALE;
  for (let y = 0; y < CELL_H / SCALE; y++) for (let x = 0; x < CELL_W / SCALE; x++) block(x0 + x, y0 + y, color(hex));
}

function drawRows(rows, palette, index) {
  const x0 = (index % COLUMNS) * CELL_W / SCALE + 2;
  const y0 = Math.floor(index / COLUMNS) * CELL_H / SCALE + 2;
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (palette[key]) block(x0 + x, y0 + y, color(palette[key]));
  }));
}

function dog(index, frame) {
  const x0 = (index % COLUMNS) * CELL_W / SCALE + 2;
  const y0 = Math.floor(index / COLUMNS) * CELL_H / SCALE + 9;
  const r = (hex, x, y, w, h) => {
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) block(x0 + x + px, y0 + y + py, color(hex));
  };
  const k = '#14121e', iron = '#2a2d38', steel = '#4a5468', steelHi = '#7b8aa3', copper = '#d7833b', rust = '#a8481e', teal = '#5fd0d8';
  r(k, 0, 2, 2, 6); r(steelHi, 1, 2, 1, 2); r(k, 1, 1, 2, 2); r(rust, 2, 1, 1, 1);
  r(k, 2, 7, 3, 6); r(rust, 3, 8, 2, 4); r(copper, 3, 8, 2, 1);
  r(k, 4, 6, 13, 8); r(steel, 5, 7, 11, 6); r(steelHi, 5, 7, 8, 2); r(iron, 5, 11, 11, 2); r(copper, 6, 8, 1, 1); r(copper, 14, 12, 1, 1);
  r(k, 8, 8, 5, 5); r(rust, 9, 9, 3, 3); r(copper, 9, 9, 2, 1); r(teal, 10, 9, 1, 1); r(teal, 9, 11, 3, 1); r(teal, 11, 10, 1, 1); r(copper, 8, 9, 1, 1); r(copper, 12, 11, 1, 1);
  r(k, 14, 2, 8, 9); r(steel, 15, 3, 6, 6); r(steelHi, 15, 3, 4, 2); r(k, 15, 0, 4, 4); r(steelHi, 16, 1, 2, 2); r(copper, 16, 1, 1, 1);
  r(k, 19, 2, 4, 4); r(rust, 20, 3, 2, 2); r(copper, 20, 3, 1, 1); r(teal, 19, 5, 1, 1); r('#ffffff', 19, 5, 1, 1);
  r(k, 20, 7, 4, 4); r('#b8bcc4', 20, 8, 3, 2); r('#e0e4ea', 20, 8, 2, 1); r('#e8b080', 22, 8, 1, 1); r(k, 21, 10, 2, 1);
  r(k, 15, 10, 5, 3); r('#d06a2a', 16, 10, 3, 2); r('#e88a3e', 16, 10, 2, 1); r(k, 18, 12, 2, 3); r(rust, 19, 12, 1, 2);
  const legs = frame ? [5, 9, 13, 17] : [6, 10, 12, 16];
  legs.forEach((x, i) => { const kneeY = frame && i % 2 === 0 ? 13 : 12; r(k, x, 13, 3, 4); r(iron, x + 1, 13, 1, 2); r(rust, x + 1, kneeY, 1, 1); r(k, x - 1, 16, 4, 2); r(steelHi, x, 16, 2, 1); });
}

for (let i = 0; i < 10; i++) fillCell(i, i % 2 ? '#4b7b3a' : '#17202e');
HERO_FRAMES.forEach((rows, i) => drawRows(rows, HERO_PAL, i));
const vendorPal = { ...HERO_PAL, h: '#245a5f', H: '#3d8281', p: '#2d6d70', P: '#43858a', l: '#71a9a5', j: '#58737d', J: '#3c535f', q: '#8ab9ba', B: '#5fd0d8' };
drawRows(HERO_FRAMES[0], vendorPal, 6); drawRows(HERO_FRAMES[1], vendorPal, 7); dog(8, 0); dog(9, 1);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const name = Buffer.from(type); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
writeFileSync('.snapshots/hero-v2-preview.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
