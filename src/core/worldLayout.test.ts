import { describe, expect, it } from 'vitest';
import { AREAS, REGIONS } from '../data/hunt';
import { MAP_H, MAP_W } from '../ui/mapCanvas';
import { PATIO_POS, WORLD_ZONES, worldPos, zoneCenter, zoneOf } from './worldLayout';

const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

describe('world map layout', () => {
  it('has one zone per region, inside the map', () => {
    expect(WORLD_ZONES.map((z) => z.region.id)).toEqual(REGIONS.map((r) => r.id));
    for (const { rect } of WORLD_ZONES) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(1);
      expect(rect.y + rect.h).toBeLessThanOrEqual(1);
    }
  });

  it('zones never overlap', () => {
    for (const a of WORLD_ZONES) {
      for (const b of WORLD_ZONES) {
        if (a === b) continue;
        const apart = a.rect.x + a.rect.w <= b.rect.x || b.rect.x + b.rect.w <= a.rect.x
          || a.rect.y + a.rect.h <= b.rect.y || b.rect.y + b.rect.h <= a.rect.y;
        expect(apart, `${a.region.id} x ${b.region.id}`).toBe(true);
      }
    }
  });

  it('regions lie farther from the Pátio as their level rises', () => {
    const dist = WORLD_ZONES.map((z) => Math.hypot(zoneCenter(z).x - PATIO_POS.x, zoneCenter(z).y - PATIO_POS.y));
    expect(WORLD_ZONES[0].region.id).toBe('varzea');
    expect(dist.indexOf(Math.min(...dist))).toBe(0);
    expect(dist.indexOf(Math.max(...dist))).toBe(WORLD_ZONES.findIndex((z) => z.region.id === 'coracao'));
  });

  it('places every area marker inside its own region zone', () => {
    for (const a of AREAS) expect(inside(worldPos(a), zoneOf(a.regionId).rect), a.id).toBe(true);
  });

  it('keeps world markers at least 36px apart so none hides another', () => {
    const pts = AREAS.map((a) => ({ id: a.id, x: worldPos(a).x * MAP_W, y: worldPos(a).y * MAP_H }));
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), `${pts[i].id} x ${pts[j].id}`).toBeGreaterThanOrEqual(36);
      }
    }
  });

  it('throws for a region without a zone', () => {
    expect(() => zoneOf('nenhuma')).toThrow();
  });
});
