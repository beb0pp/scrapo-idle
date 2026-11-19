export const SKILL_ICON_SIZE = 24;

export type SkillIconId = 'backpack' | 'auto' | 'pulse' | 'arc' | 'dash' | 'overload' | 'market' | 'map' | 'workshop';

const NAVY = '#14121e';
const COPPER = '#d7833b';
const RUST = '#a8481e';
const SLATE = '#4a5468';
const SLATE_LIGHT = '#7b8aa3';
const TEAL = '#5fd0d8';
const AMBER = '#f6c84a';
const WHITE = '#f4f0df';
type Painter = (context: CanvasRenderingContext2D) => void;

function pixel(context: CanvasRenderingContext2D, color: string, x: number, y: number, width = 1, height = 1): void { context.fillStyle = color; context.fillRect(x, y, width, height); }
function outlined(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill: string, light: string, shade: string): void {
  pixel(context, NAVY, x - 1, y - 1, width + 2, height + 2); pixel(context, fill, x, y, width, height); pixel(context, light, x, y, width, 1); pixel(context, light, x, y, 1, height); pixel(context, shade, x, y + height - 1, width, 1); pixel(context, shade, x + width - 1, y, 1, height);
}
function backpack(c: CanvasRenderingContext2D): void { outlined(c, 5, 6, 14, 14, COPPER, '#efb36a', RUST); outlined(c, 8, 3, 8, 5, RUST, COPPER, '#6f2e1a'); outlined(c, 3, 10, 3, 8, RUST, COPPER, '#6f2e1a'); outlined(c, 18, 10, 3, 8, RUST, COPPER, '#6f2e1a'); outlined(c, 9, 12, 6, 4, AMBER, '#fff0a0', '#b87826'); pixel(c, NAVY, 11, 13, 2, 2); }
function auto(c: CanvasRenderingContext2D): void { [[10, 2], [13, 2], [18, 6], [20, 10], [18, 15], [14, 19], [9, 19], [4, 15], [2, 11], [4, 6]].forEach(([x, y]) => outlined(c, x, y, 3, 3, TEAL, '#baf5ee', '#27858d')); outlined(c, 6, 6, 12, 12, SLATE, SLATE_LIGHT, '#263044'); pixel(c, NAVY, 10, 8, 6, 8); pixel(c, TEAL, 11, 9, 1, 6); pixel(c, TEAL, 12, 10, 2, 4); pixel(c, TEAL, 14, 11, 1, 2); }
function pulse(c: CanvasRenderingContext2D): void { outlined(c, 6, 8, 4, 9, RUST, COPPER, '#6f2e1a'); outlined(c, 14, 8, 4, 9, RUST, COPPER, '#6f2e1a'); pixel(c, NAVY, 8, 14, 8, 5); pixel(c, TEAL, 8, 14, 2, 2); pixel(c, TEAL, 14, 14, 2, 2); pixel(c, '#baf5ee', 10, 17, 4, 2); [[2, 4, 3], [19, 4, 3], [3, 7, 2], [19, 7, 2], [0, 10, 4], [20, 10, 4]].forEach(([x, y, w]) => pixel(c, TEAL, x, y, w)); }
function arc(c: CanvasRenderingContext2D): void { outlined(c, 2, 5, 4, 4, TEAL, WHITE, '#27858d'); outlined(c, 18, 15, 4, 4, TEAL, WHITE, '#27858d'); [[6, 8], [9, 8], [8, 11], [12, 10], [11, 14], [16, 13], [15, 16], [18, 16]].forEach(([x, y], index) => { pixel(c, NAVY, x - 1, y - 1, 3, 3); pixel(c, index % 2 ? WHITE : TEAL, x, y); }); }
function dash(c: CanvasRenderingContext2D): void { [[1, 5, 5], [0, 9, 7], [2, 14, 5]].forEach(([x, y, w]) => pixel(c, TEAL, x, y, w)); outlined(c, 8, 8, 10, 9, SLATE, SLATE_LIGHT, '#283142'); outlined(c, 12, 4, 5, 7, COPPER, '#efb36a', RUST); pixel(c, NAVY, 8, 16, 12, 3); pixel(c, COPPER, 9, 16, 8); pixel(c, '#c8d4e2', 15, 7, 2, 2); [[19, 7, 3], [20, 11, 3], [18, 15, 4]].forEach(([x, y, w]) => pixel(c, WHITE, x, y, w)); }
function overload(c: CanvasRenderingContext2D): void { [[11, 1, 2, 5], [2, 10, 5, 2], [17, 10, 5, 2], [11, 18, 2, 5], [5, 4, 3, 3], [16, 4, 3, 3], [5, 16, 3, 3], [16, 16, 3, 3]].forEach(([x, y, w, h]) => pixel(c, AMBER, x, y, w, h)); outlined(c, 6, 7, 12, 9, SLATE, SLATE_LIGHT, '#283142'); pixel(c, NAVY, 8, 10, 3, 2); pixel(c, NAVY, 14, 10, 3, 2); pixel(c, TEAL, 9, 10); pixel(c, TEAL, 15, 10); pixel(c, AMBER, 11, 12, 2, 3); pixel(c, NAVY, 9, 16, 2, 3); pixel(c, NAVY, 14, 16, 2, 3); }
function market(c: CanvasRenderingContext2D): void { outlined(c, 6, 8, 13, 12, RUST, COPPER, '#6f2e1a'); outlined(c, 8, 4, 8, 6, COPPER, '#efb36a', RUST); pixel(c, NAVY, 10, 6, 4, 2); outlined(c, 13, 11, 7, 7, AMBER, '#fff0a0', '#b87826'); pixel(c, COPPER, 15, 13, 3, 3); }

function map(c: CanvasRenderingContext2D): void { outlined(c, 2, 4, 6, 16, '#c9a86a', '#efd9a0', '#8a6a3a'); outlined(c, 9, 6, 6, 16, '#b8955a', '#e2c58a', '#7a5a2e'); outlined(c, 16, 4, 6, 16, '#c9a86a', '#efd9a0', '#8a6a3a'); pixel(c, TEAL, 3, 14, 4, 4); pixel(c, TEAL, 10, 16, 3, 4); [[5, 8], [7, 10], [10, 11], [12, 9], [15, 9], [17, 11]].forEach(([x, y]) => pixel(c, RUST, x, y)); outlined(c, 18, 9, 3, 3, '#e8433a', '#ff8a7a', '#8a1e18'); }

function workshop(c: CanvasRenderingContext2D): void { outlined(c, 13, 3, 7, 7, SLATE, SLATE_LIGHT, '#283142'); [[16, 1, 1, 2], [16, 10, 1, 2], [11, 6, 2, 1], [20, 6, 2, 1]].forEach(([x, y, w, h]) => pixel(c, SLATE_LIGHT, x, y, w, h)); pixel(c, NAVY, 15, 5, 3, 3); outlined(c, 3, 3, 4, 4, SLATE_LIGHT, WHITE, SLATE); pixel(c, NAVY, 4, 3, 2, 2); [[7, 7], [8, 8], [9, 9]].forEach(([x, y]) => { pixel(c, NAVY, x - 1, y - 1, 3, 3); pixel(c, WHITE, x, y); }); outlined(c, 2, 12, 20, 4, COPPER, '#efb36a', RUST); outlined(c, 4, 16, 3, 6, RUST, COPPER, '#6f2e1a'); outlined(c, 17, 16, 3, 6, RUST, COPPER, '#6f2e1a'); pixel(c, AMBER, 9, 13, 6, 1); }

const ART: Record<SkillIconId, Painter> = { backpack, auto, pulse, arc, dash, overload, market, map, workshop };
function toDataUrl(paint: Painter): string { const canvas = document.createElement('canvas'); canvas.width = SKILL_ICON_SIZE; canvas.height = SKILL_ICON_SIZE; const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas 2D is unavailable for skill icon rendering.'); paint(context); return canvas.toDataURL(); }
export const skillIconUrls: Record<SkillIconId, string> = Object.fromEntries(Object.entries(ART).map(([id, paint]) => [id, toDataUrl(paint)])) as Record<SkillIconId, string>;
