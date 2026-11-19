import { describe, expect, it } from 'vitest';
import { AREAS, REGIONS, areaElements, areasIn, type HuntArea } from '../data/hunt';
import { ENEMY_INFO } from '../data/enemies';
import { strongAgainst, weakTo } from './elements';
import { ANY_FILTER, defaultRegion, filterAreas, levelRanges, sortAreas, type AreaFilter } from './huntFilter';

const ids = (list: HuntArea[]) => list.map((a) => a.id);
const f = (patch: Partial<AreaFilter>): AreaFilter => ({ ...ANY_FILTER, ...patch });

describe('filterAreas', () => {
  it('keeps every area when nothing is selected', () => {
    expect(filterAreas(AREAS, ANY_FILTER, 1)).toHaveLength(AREAS.length);
  });

  it('"Do tipo" keeps areas with at least one enemy of a selected element', () => {
    const out = filterAreas(AREAS, f({ elements: ['corrosivo'], mode: 'of' }), 1);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => areaElements(a).includes('corrosivo'))).toBe(true);
    expect(out).toHaveLength(AREAS.filter((a) => a.enemies.includes('scrapgolem')).length);
  });

  it('"Fraco contra" reads the selection as the player attack: Térmico finds Elétrico and Magnético enemies', () => {
    const out = filterAreas(AREAS, f({ elements: ['termico'], mode: 'weak' }), 1);
    const weak = weakTo('termico');
    expect(weak.sort()).toEqual(['eletrico', 'magnetico']);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => areaElements(a).some((e) => weak.includes(e)))).toBe(true);
    expect(ids(out)).not.toContain('valas_de_lata');
    expect(ids(out)).toContain('corrego_ferro_velho');
  });

  it('"Forte contra" keeps areas whose enemies resist the selected attack', () => {
    const out = filterAreas(AREAS, f({ elements: ['termico'], mode: 'strong' }), 1);
    const resist = strongAgainst('termico');
    expect(out.every((a) => areaElements(a).some((e) => resist.includes(e)))).toBe(true);
    expect(ids(out)).toContain('valas_de_lata');
    expect(ids(out)).not.toContain('fios_soltos');
  });

  it('several selected elements widen the match (any of them)', () => {
    const one = filterAreas(AREAS, f({ elements: ['eletrico'] }), 1);
    const two = filterAreas(AREAS, f({ elements: ['eletrico', 'blindado'] }), 1);
    expect(two.length).toBeGreaterThan(one.length);
  });

  it('filters by enemy kind', () => {
    const out = filterAreas(AREAS, f({ enemy: 'press' }), 1);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => a.enemies.includes('press'))).toBe(true);
  });

  it('filters by a level range, inclusive', () => {
    const out = filterAreas(AREAS, f({ levelRange: { min: 5, max: 7 } }), 1);
    expect(ids(out)).toEqual(['ladeira_molas', 'fios_soltos', 'cemiterio_geladeiras']);
  });

  it('"reachable" keeps only areas at or below the hero level', () => {
    const out = filterAreas(areasIn('varzea'), f({ levelRange: 'reachable' }), 3);
    expect(ids(out)).toEqual(['valas_de_lata', 'corrego_ferro_velho', 'vagoes_mortos']);
  });

  it('searches the area name ignoring case and accents', () => {
    expect(ids(filterAreas(AREAS, f({ query: '  corrego ' }), 1))).toEqual(['corrego_ferro_velho']);
    expect(ids(filterAreas(AREAS, f({ query: 'CAMARA' }), 1))).toEqual(['camara_martelo']);
  });

  it('combines every criterion', () => {
    const out = filterAreas(areasIn('varzea'), f({ elements: ['magnetico'], mode: 'of', enemy: 'sorter', query: 'trilho' }), 9);
    expect(ids(out)).toEqual(['trilho_torto']);
  });
});

describe('levelRanges', () => {
  it('splits a region into up to three ranges that cover every area', () => {
    const areas = areasIn('varzea');
    const ranges = levelRanges(areas);
    expect(ranges).toEqual([{ min: 1, max: 3 }, { min: 5, max: 7 }, { min: 9, max: 9 }]);
    for (const a of areas) expect(ranges.some((r) => a.level >= r.min && a.level <= r.max)).toBe(true);
  });

  it('returns nothing for an empty list', () => {
    expect(levelRanges([])).toEqual([]);
  });
});

describe('sortAreas', () => {
  const areas = areasIn('varzea');
  it('sorts by level both ways without touching the input', () => {
    const copy = [...areas];
    expect(sortAreas(areas, 'level', 'desc')[0].id).toBe('trilho_torto');
    expect(areas).toEqual(copy);
  });

  it('sorts by name in Portuguese order', () => {
    expect(sortAreas(areas, 'name', 'asc')[0].name).toBe('Cemitério de Geladeiras');
  });

  it('sorts by size, then level', () => {
    const out = sortAreas(areas, 'size', 'asc');
    expect(out[0].size).toBe('small');
    expect(out.at(-1)!.size).toBe('large');
  });

  it('sorts by number of enemy kinds', () => {
    expect(sortAreas(areas, 'enemies', 'desc')[0].enemies.length).toBe(3);
  });
});

describe('defaultRegion', () => {
  it('opens on the highest region the hero can enter', () => {
    expect(defaultRegion(1).id).toBe('varzea');
    expect(defaultRegion(30).id).toBe('docas');
    expect(defaultRegion(100).id).toBe(REGIONS.at(-1)!.id);
  });
});

describe('enemy data used by the map', () => {
  it('every enemy kind has a display name', () => {
    for (const info of Object.values(ENEMY_INFO)) expect(info.name.length).toBeGreaterThan(2);
  });
});
