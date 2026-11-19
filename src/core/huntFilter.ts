import type { ElementId } from '../data/elements';
import type { EnemyKind } from '../data/enemies';
import { REGIONS, areaElements, type AreaSize, type HuntArea, type Region } from '../data/hunt';
import { strongAgainst, weakTo } from './elements';

/** 'of': enemy is of the element · 'weak': enemy takes ×2 from it · 'strong': enemy resists it. */
export type ElementMode = 'of' | 'weak' | 'strong';
export interface LevelRange { min: number; max: number }

export interface AreaFilter {
  elements: readonly ElementId[];
  mode: ElementMode;
  enemy: EnemyKind | null;
  /** 'reachable': at or below the hero level. */
  levelRange: LevelRange | 'reachable' | null;
  query: string;
}

export const ANY_FILTER: AreaFilter = { elements: [], mode: 'of', enemy: null, levelRange: null, query: '' };

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Enemy elements that satisfy one selected element under the mode. */
function targets(el: ElementId, mode: ElementMode): readonly ElementId[] {
  if (mode === 'weak') return weakTo(el);
  if (mode === 'strong') return strongAgainst(el);
  return [el];
}

function matchesElements(area: HuntArea, elements: readonly ElementId[], mode: ElementMode): boolean {
  if (!elements.length) return true;
  const wanted = new Set(elements.flatMap((el) => targets(el, mode)));
  return areaElements(area).some((el) => wanted.has(el));
}

function matchesLevel(area: HuntArea, range: AreaFilter['levelRange'], heroLevel: number): boolean {
  if (range === null) return true;
  if (range === 'reachable') return area.level <= heroLevel;
  return area.level >= range.min && area.level <= range.max;
}

export function filterAreas(areas: readonly HuntArea[], filter: AreaFilter, heroLevel: number): HuntArea[] {
  const query = fold(filter.query);
  return areas.filter((a) =>
    matchesElements(a, filter.elements, filter.mode)
    && (!filter.enemy || a.enemies.includes(filter.enemy))
    && matchesLevel(a, filter.levelRange, heroLevel)
    && (!query || fold(a.name).includes(query)));
}

/** Up to three contiguous ranges over the areas' levels, each holding a similar number of areas. */
export function levelRanges(areas: readonly HuntArea[]): LevelRange[] {
  const levels = [...new Set(areas.map((a) => a.level))].sort((a, b) => a - b);
  if (!levels.length) return [];
  const per = Math.ceil(levels.length / 3);
  const out: LevelRange[] = [];
  for (let i = 0; i < levels.length; i += per) {
    const chunk = levels.slice(i, i + per);
    out.push({ min: chunk[0], max: chunk[chunk.length - 1] });
  }
  return out;
}

export type SortKey = 'name' | 'level' | 'enemies' | 'size';
export type SortDir = 'asc' | 'desc';
const SIZE_ORDER: Record<AreaSize, number> = { small: 0, medium: 1, large: 2 };
const byName = (a: HuntArea, b: HuntArea) => a.name.localeCompare(b.name, 'pt-BR');
const COMPARE: Record<SortKey, (a: HuntArea, b: HuntArea) => number> = {
  name: byName,
  level: (a, b) => a.level - b.level || byName(a, b),
  enemies: (a, b) => a.enemies.length - b.enemies.length || a.level - b.level,
  size: (a, b) => SIZE_ORDER[a.size] - SIZE_ORDER[b.size] || a.level - b.level,
};

export function sortAreas(areas: readonly HuntArea[], key: SortKey, dir: SortDir): HuntArea[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...areas].sort((a, b) => sign * COMPARE[key](a, b));
}

/** Highest region whose minimum level the hero meets; the first region otherwise. */
export function defaultRegion(heroLevel: number): Region {
  return [...REGIONS].reverse().find((r) => heroLevel >= r.minLevel) ?? REGIONS[0];
}
