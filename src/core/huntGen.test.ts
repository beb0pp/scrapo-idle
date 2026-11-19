import { describe, expect, it } from 'vitest';
import { BLOCKING, TILES } from '../art/tileArt';
import { PILE_TABLES } from '../data/areas';
import { ENEMY_KINDS } from '../data/enemies';
import { AREAS, REGIONS, areaById, areaElements, areasIn, areaUnlocked, regionOf, regionUnlocked, type AreaSize, type HuntArea } from '../data/hunt';
import { floodDistances, generateArea, SIZES } from './huntGen';
import { huntTiledMap } from './huntMap';
import { xpAt } from './level';
import { newGame } from './state';

const SIZE_LIST: AreaSize[] = ['small', 'medium', 'large'];

describe('hunt data', () => {
  it('has five regions gated at Nv 1, 10, 25, 50, 75 and ~25 areas', () => {
    expect(REGIONS.map((r) => r.minLevel)).toEqual([1, 10, 25, 50, 75]);
    expect(AREAS.length).toBeGreaterThanOrEqual(23);
    expect(AREAS.length).toBeLessThanOrEqual(27);
    expect(areasIn(REGIONS[0]).length).toBeGreaterThanOrEqual(6);
    expect(areasIn('fundicoes').length).toBeGreaterThanOrEqual(6);
    for (const r of REGIONS.slice(2)) expect(areasIn(r).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every area valid: unique id and seed, level inside its region band, known enemies and loot, map pos in 0..1', () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    expect(new Set(AREAS.map((a) => a.seed)).size).toBe(AREAS.length);
    REGIONS.forEach((r, i) => {
      const next = REGIONS[i + 1]?.minLevel ?? 101;
      for (const a of areasIn(r)) {
        expect(a.level).toBeGreaterThanOrEqual(r.minLevel);
        expect(a.level).toBeLessThan(next);
      }
    });
    for (const a of AREAS) {
      expect(a.enemies.length).toBeGreaterThanOrEqual(1);
      expect(a.enemies.length).toBeLessThanOrEqual(3);
      for (const k of a.enemies) expect(ENEMY_KINDS).toContain(k);
      expect(PILE_TABLES[a.loot]).toBeDefined();
      for (const v of [a.pos.x, a.pos.y]) expect(v >= 0 && v <= 1).toBe(true);
      expect(regionOf(a).id).toBe(a.regionId);
    }
  });

  it('derives area elements from the enemies, without repeats', () => {
    expect(areaElements(areaById('valas_de_lata')!)).toEqual(['termico']);
    expect(areaElements({ ...AREAS[0], enemies: ['sorter', 'sparkbot', 'sorter'] })).toEqual(['termico', 'eletrico']);
  });

  it('unlocks a region only from its minimum level', () => {
    const s = newGame(0);
    expect(regionUnlocked(s, REGIONS[0])).toBe(true);
    expect(regionUnlocked(s, REGIONS[1])).toBe(false);
    s.xp = xpAt(10);
    expect(regionUnlocked(s, REGIONS[1])).toBe(true);
    expect(regionUnlocked(s, REGIONS[2])).toBe(false);
  });

  it('unlocks an area only from its own level, even inside an open region', () => {
    const s = newGame(0);
    expect(areaUnlocked(s, areaById('valas_de_lata')!)).toBe(true);
    expect(areaUnlocked(s, areaById('corrego_ferro_velho')!)).toBe(false);
    s.xp = xpAt(2);
    expect(areaUnlocked(s, areaById('corrego_ferro_velho')!)).toBe(true);
    expect(areaUnlocked(s, areaById('trilho_torto')!)).toBe(false);
  });
});

function check(area: HuntArea) {
  const g = generateArea(area);
  const dist = floodDistances(g.walls, g.width, g.height, g.playerSpawn);
  const reach = (c: { x: number; y: number }) => dist[c.y * g.width + c.x];
  return { g, reach };
}

describe('generateArea', () => {
  it('connects spawn to exit, every enemy and every pile over 240 seeds of all sizes', () => {
    for (let seed = 1; seed <= 240; seed++) {
      const size = SIZE_LIST[seed % 3];
      const { g, reach } = check({ ...AREAS[seed % AREAS.length], seed: seed * 7919, size });
      expect(reach(g.playerSpawn), `seed ${seed}`).toBe(0);
      expect(reach(g.exit), `seed ${seed} exit`).toBeGreaterThanOrEqual(2);
      for (const e of g.enemies) expect(reach(e), `seed ${seed} enemy`).toBeGreaterThan(0);
      for (const p of g.piles) expect(reach(p), `seed ${seed} pile`).toBeGreaterThan(0);
      expect(g.enemies.length, `seed ${seed} enemies`).toBe(SIZES[size].enemies);
      expect(g.piles.length, `seed ${seed} piles`).toBeGreaterThanOrEqual(SIZES[size].piles - 1);
    }
  });

  it('never puts a blocking object on the floor, so wall flood fill is the whole truth', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { g } = check({ ...AREAS[0], seed, size: SIZE_LIST[seed % 3] });
      g.objects.forEach((t, i) => {
        if (!g.walls[i] && t) expect(BLOCKING).not.toContain(t);
      });
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = AREAS[3];
    const one = generateArea(a), two = generateArea(a);
    expect(two).toEqual(one);
    const other = generateArea({ ...a, seed: a.seed + 1 });
    expect(Array.from(other.walls)).not.toEqual(Array.from(one.walls));
  });

  it('scales the map and its population with size', () => {
    const counts = SIZE_LIST.map((size) => generateArea({ ...AREAS[0], size }));
    expect(counts.map((g) => g.width)).toEqual(SIZE_LIST.map((s) => SIZES[s].w));
    expect(counts[0].enemies.length).toBeLessThan(counts[1].enemies.length);
    expect(counts[1].enemies.length).toBeLessThan(counts[2].enemies.length);
  });

  it('uses every listed enemy kind and the area loot table', () => {
    const a = areaById('trilho_torto')!;
    const g = generateArea(a);
    expect(new Set(g.enemies.map((e) => e.kind))).toEqual(new Set(a.enemies));
    for (const p of g.piles) expect(p.table).toBe(a.loot);
  });

  it('paints each region with its own floor tiles', () => {
    const rust = generateArea(areaById('valas_de_lata')!);
    const core = generateArea(areaById('prensa_primordial')!);
    const floorOf = (g: typeof rust) => new Set(g.terrain.filter((_, i) => !g.walls[i]));
    const rustTiles: number[] = [TILES.dirt, TILES.gravel, TILES.dirtDark];
    const coreTiles: number[] = [TILES.floor, TILES.concrete];
    expect([...floorOf(rust)].every((t) => rustTiles.includes(t))).toBe(true);
    expect([...floorOf(core)].every((t) => coreTiles.includes(t))).toBe(true);
  });
});

describe('huntTiledMap', () => {
  it('emits the layers and objects WorldScene reads from hand-made maps', () => {
    const area = areaById('ladeira_molas')!;
    const g = generateArea(area);
    const map = huntTiledMap(area, regionOf(area), g);
    expect(map.layers.map((l) => l.name)).toEqual(['terrain', 'objects', 'collision', 'interact']);
    for (const l of map.layers.slice(0, 3)) expect('data' in l && l.data.length).toBe(g.width * g.height);
    const objs = map.layers[3] as { objects: { type: string; name: string; properties: { name: string; value: unknown }[] }[] };
    const byType = (t: string) => objs.objects.filter((o) => o.type === t);
    expect(byType('spawn').map((o) => o.name)).toEqual(['default']);
    expect(byType('exit')[0].properties.find((p) => p.name === 'target')?.value).toBe('patio');
    expect(byType('enemy')).toHaveLength(g.enemies.length);
    expect(byType('enemy').every((o) => o.properties.some((p) => p.name === 'level' && p.value === area.level))).toBe(true);
    expect(new Set(byType('pile').map((o) => o.name)).size).toBe(g.piles.length);
    expect(map.properties.find((p) => p.name === 'displayName')?.value).toBe(area.name);
  });
});
