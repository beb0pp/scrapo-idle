import { BUILD_NODES, type BuildNodeId } from '../data/ferromancy';
import type { ItemId } from '../data/items';
import { owns } from './progression';
import { countOf, type GameState } from './state';

// The workshop plot around the Pátio bench: what stands there is read off the save, never stored.

export type ProgressDecorId = 'swept_ground' | 'lamps_low' | 'lamps_high' | 'banner' | 'reagent_crates';
export type DecorId = BuildNodeId | ProgressDecorId;

export type DecorRule =
  | { built: BuildNodeId }
  | { builtAtLeast: number }
  | { anyItem: readonly ItemId[] };

export interface DecorDef {
  rule: DecorRule;
  /** Tile offsets from the bench, tried in order; the first usable one wins. */
  slots: readonly (readonly [number, number])[];
  /** Ground decals lie under everything and do not claim a tile. */
  floor?: boolean;
}

const REAGENTS: readonly ItemId[] = ['reagent_ember', 'reagent_ward', 'reagent_lodestone'];

/** Two free tiles between usable buildings (bench included), so clicks, walking and reading never collide. */
export const BUILD_GAP = 3;
/** Plain decor never touches a building, which keeps every building's access tiles open. */
export const DECOR_GAP = 2;
const REACH_RADIUS = 16;

export const DECOR: Record<DecorId, DecorDef> = {
  b_workshop: { rule: { built: 'b_workshop' }, slots: [[-3, -1], [-3, 0], [-4, -1]] },
  b_bench_tools: { rule: { built: 'b_bench_tools' }, slots: [[3, -1], [3, 0], [3, 1]] },
  b_bench_modules: { rule: { built: 'b_bench_modules' }, slots: [[7, 0], [6, 0], [7, 1]] },
  b_drone_servos: { rule: { built: 'b_drone_servos' }, slots: [[10, 1], [9, 0], [10, 0]] },
  b_drone_bay: { rule: { built: 'b_drone_bay' }, slots: [[7, 3], [6, 3], [5, 3]] },
  b_alchemy: { rule: { built: 'b_alchemy' }, slots: [[-6, -1], [-6, 0], [-5, -1]] },
  b_alembic: { rule: { built: 'b_alembic' }, slots: [[-4, 2], [-5, 2], [-4, 3]] },
  swept_ground: { rule: { builtAtLeast: 1 }, slots: [[0, 1]], floor: true },
  lamps_low: { rule: { builtAtLeast: 3 }, slots: [[3, 2], [2, 2]] },
  lamps_high: { rule: { builtAtLeast: 6 }, slots: [[8, -2], [7, -2]] },
  banner: { rule: { built: 'b_alchemy' }, slots: [[-2, 2], [-2, 3]] },
  reagent_crates: { rule: { anyItem: REAGENTS }, slots: [[-6, 1], [-1, 2], [-1, 3]] },
};

/** Fixed order: placement claims slots in this order, so a layout is stable across reloads. */
export const DECOR_ORDER = Object.keys(DECOR) as DecorId[];

export const isUsable = (id: DecorId): id is BuildNodeId => Object.hasOwn(BUILD_NODES, id);

export function ruleMet(state: GameState, rule: DecorRule): boolean {
  if ('built' in rule) return owns(state, rule.built);
  if ('builtAtLeast' in rule) return state.ferro.built.filter((id) => Object.hasOwn(BUILD_NODES, id)).length >= rule.builtAtLeast;
  return rule.anyItem.some((id) => countOf(state, id) > 0);
}

export function decorFor(state: GameState): DecorId[] {
  return DECOR_ORDER.filter((id) => ruleMet(state, DECOR[id].rule));
}

export interface Tile { x: number; y: number }

export const tileKey = (t: Tile): string => `${t.x},${t.y}`;

/** Chebyshev distance: 3 means two whole tiles between, diagonals included. */
export const gap = (a: Tile, b: Tile): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export interface PlotGrid {
  /** May hold a prop: not blocked, no map decor, away from spawns and NPCs. */
  isFree(x: number, y: number): boolean;
  /** The hero can stand here. */
  walkable(x: number, y: number): boolean;
}

/** What the plot already holds: the bench is the first usable anchor. */
export interface Plot {
  origin: Tile;
  claimed: Set<string>;
  anchors: Tile[];
}

export function newPlot(origin: Tile): Plot {
  return { origin, claimed: new Set([tileKey(origin)]), anchors: [origin] };
}

const STEPS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function reachable(origin: Tile, walkable: PlotGrid['walkable']): Set<string> {
  const seen = new Set([tileKey(origin)]);
  const queue = [origin];
  while (queue.length) {
    const t = queue.shift()!;
    for (const [dx, dy] of STEPS) {
      const n = { x: t.x + dx, y: t.y + dy };
      const k = tileKey(n);
      if (seen.has(k) || gap(n, origin) > REACH_RADIUS || !walkable(n.x, n.y)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

function usableSlot(id: DecorId, t: Tile, plot: Plot, grid: PlotGrid, reach: Set<string>): boolean {
  if (!grid.isFree(t.x, t.y)) return false;
  if (DECOR[id].floor) return true;
  if (plot.claimed.has(tileKey(t))) return false;
  // Props are wider than a tile: a wall on either side would swallow their edges.
  if (!grid.walkable(t.x - 1, t.y) || !grid.walkable(t.x + 1, t.y)) return false;
  const minGap = isUsable(id) ? BUILD_GAP : DECOR_GAP;
  if (plot.anchors.some((a) => gap(a, t) < minGap)) return false;
  if (!isUsable(id)) return true;
  return STEPS.some(([dx, dy]) => {
    const n = { x: t.x + dx, y: t.y + dy };
    return reach.has(tileKey(n)) && !plot.claimed.has(tileKey(n));
  });
}

/** First usable slot per id, recorded in `plot`; an id with none is skipped rather than put on a path. */
export function placeDecor(ids: readonly DecorId[], plot: Plot, grid: PlotGrid): Map<DecorId, Tile> {
  const reach = reachable(plot.origin, (x, y) => grid.walkable(x, y));
  const out = new Map<DecorId, Tile>();
  for (const id of ids) {
    const t = DECOR[id].slots.map(([dx, dy]) => ({ x: plot.origin.x + dx, y: plot.origin.y + dy })).find((s) => usableSlot(id, s, plot, grid, reach));
    if (!t) continue;
    if (!DECOR[id].floor) plot.claimed.add(tileKey(t));
    if (isUsable(id)) plot.anchors.push(t);
    out.set(id, t);
  }
  return out;
}

export function releaseDecor(plot: Plot, id: DecorId, t: Tile): void {
  if (!DECOR[id].floor) plot.claimed.delete(tileKey(t));
  if (isUsable(id)) plot.anchors = plot.anchors.filter((a) => tileKey(a) !== tileKey(t));
}
