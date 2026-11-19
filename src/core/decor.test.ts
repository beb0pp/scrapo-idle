import { describe, expect, it } from 'vitest';
import { BUILD_NODES, type BuildNodeId } from '../data/ferromancy';
import { BUILD_GAP, DECOR, DECOR_GAP, DECOR_ORDER, decorFor, gap, isUsable, newPlot, placeDecor, releaseDecor, tileKey, type DecorId, type PlotGrid, type Tile } from './decor';
import { buildNode } from './progression';
import { discover } from './spells';
import { addItems, newGame, removeItems, type GameState } from './state';

const T0 = 1_700_000_000_000;
const ALL_BUILD = Object.keys(BUILD_NODES) as BuildNodeId[];
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function withBuilt(ids: readonly BuildNodeId[]): GameState {
  const s = newGame(T0);
  addItems(s, { scrap: 200, gear: 30, cable: 30, servo: 5, ether_shard: 10 });
  discover(s, 'ether_vein');
  for (const id of ids) expect(buildNode(s, id).ok).toBe(true);
  return s;
}

/** Pátio around the bench at (8,6), from public/maps/patio.json: '#' wall, 'o' map prop, 'R' next to a spawn/NPC. */
const PATIO = [
  '#####################',
  '#...................#',
  '#.##########.#..o...#',
  '#.##########........#',
  '#.####..####........#',
  '#............#......#',
  '#...........#......##',
  '#....o......o#......#',
  '#.#.....RRR.....RRR.#',
  '#.#.....RRR.....RRR.#',
  '#....RRRRRR.o...RRR.#',
  '#..#.RRR........RRR.#',
  '#....RRR........RRR.#',
  '#####################',
];
const BENCH = { x: 8, y: 6 };
const cell = (x: number, y: number) => PATIO[y]?.[x] ?? '#';
const patio: PlotGrid = { isFree: (x, y) => cell(x, y) === '.', walkable: (x, y) => cell(x, y) !== '#' };
const open: PlotGrid = { isFree: () => true, walkable: () => true };
const buildings = (placed: Map<DecorId, Tile>) => [...placed].filter(([id]) => isUsable(id)).map(([, t]) => t);

describe('decorFor', () => {
  it('leaves the plot empty on a new game', () => {
    expect(decorFor(newGame(T0))).toEqual([]);
  });

  it('shows the restored workshop and swept ground after the first build only', () => {
    expect(decorFor(withBuilt(['b_workshop']))).toEqual(['b_workshop', 'swept_ground']);
  });

  it('lights the first lamp at three builds and the second at six', () => {
    const three = decorFor(withBuilt(['b_workshop', 'b_bench_tools', 'b_bench_modules']));
    expect(three).toContain('lamps_low');
    expect(three).not.toContain('lamps_high');
    const six = decorFor(withBuilt(['b_workshop', 'b_bench_tools', 'b_bench_modules', 'b_drone_servos', 'b_drone_bay', 'b_alchemy']));
    expect(six).toContain('lamps_high');
  });

  it('raises the banner together with the alchemy station', () => {
    expect(decorFor(withBuilt(['b_workshop']))).not.toContain('banner');
    expect(decorFor(withBuilt(['b_workshop', 'b_alchemy']))).toEqual(expect.arrayContaining(['b_alchemy', 'banner']));
  });

  it('stacks reagent crates while any reagent is in stock and clears them when spent', () => {
    const s = newGame(T0);
    addItems(s, { reagent_ward: 2 });
    expect(decorFor(s)).toEqual(['reagent_crates']);
    removeItems(s, { reagent_ward: 2 });
    expect(decorFor(s)).toEqual([]);
  });

  it('does not count ether shards as reagents for the crates', () => {
    const s = newGame(T0);
    addItems(s, { ether_shard: 3 });
    expect(decorFor(s)).not.toContain('reagent_crates');
  });

  it('shows one prop per build node when everything is built', () => {
    const ids = decorFor(withBuilt(ALL_BUILD));
    for (const id of ALL_BUILD) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('placeDecor', () => {
  const origin = { x: 10, y: 10 };

  it('puts every decor on its first slot when the ground is open', () => {
    const placed = placeDecor(DECOR_ORDER, newPlot(origin), open);
    for (const id of DECOR_ORDER) {
      const [dx, dy] = DECOR[id].slots[0];
      expect(placed.get(id)).toEqual({ x: origin.x + dx, y: origin.y + dy });
    }
  });

  it('places every prop on the real Pátio with two free tiles between buildings and the bench', () => {
    const placed = placeDecor(DECOR_ORDER, newPlot(BENCH), patio);
    expect([...placed.keys()].sort()).toEqual([...DECOR_ORDER].sort());
    const anchors = [BENCH, ...buildings(placed)];
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) expect(gap(anchors[i], anchors[j]), `${tileKey(anchors[i])} vs ${tileKey(anchors[j])}`).toBeGreaterThanOrEqual(BUILD_GAP);
    }
    for (const [id, t] of placed) {
      expect(patio.isFree(t.x, t.y)).toBe(true);
      if (!DECOR[id].floor) expect(patio.walkable(t.x - 1, t.y) && patio.walkable(t.x + 1, t.y), `${id} beside a wall`).toBe(true);
      if (!isUsable(id) && !DECOR[id].floor) for (const a of anchors) expect(gap(a, t)).toBeGreaterThanOrEqual(DECOR_GAP);
    }
  });

  it('leaves every building an open neighbour tile the hero can walk to from the bench', () => {
    const placed = placeDecor(DECOR_ORDER, newPlot(BENCH), patio);
    const solid = new Set([...placed].filter(([id]) => !DECOR[id].floor).map(([, t]) => tileKey(t)));
    const seen = new Set([tileKey(BENCH)]);
    const queue: Tile[] = [BENCH];
    while (queue.length) {
      const t = queue.shift()!;
      for (const [dx, dy] of STEPS) {
        const n = { x: t.x + dx, y: t.y + dy };
        if (seen.has(tileKey(n)) || !patio.walkable(n.x, n.y) || solid.has(tileKey(n))) continue;
        seen.add(tileKey(n));
        queue.push(n);
      }
    }
    for (const t of buildings(placed)) {
      expect(STEPS.some(([dx, dy]) => seen.has(tileKey({ x: t.x + dx, y: t.y + dy }))), `building at ${tileKey(t)}`).toBe(true);
    }
  });

  it('falls back to the next slot when the first one is blocked', () => {
    const [first, second] = DECOR.b_bench_tools.slots;
    const grid: PlotGrid = { isFree: (x, y) => !(x === origin.x + first[0] && y === origin.y + first[1]), walkable: () => true };
    expect(placeDecor(['b_bench_tools'], newPlot(origin), grid).get('b_bench_tools')).toEqual({ x: origin.x + second[0], y: origin.y + second[1] });
  });

  it('falls back when another building would stand closer than the minimum gap', () => {
    const plot = newPlot(origin);
    const [first, second] = DECOR.b_alchemy.slots;
    plot.anchors.push({ x: origin.x + first[0], y: origin.y + first[1] - 2 });
    expect(placeDecor(['b_alchemy'], plot, open).get('b_alchemy')).toEqual({ x: origin.x + second[0], y: origin.y + second[1] });
  });

  it('skips a building whose neighbours are all walls, since the hero could not reach it', () => {
    const [dx, dy] = DECOR.b_drone_bay.slots[0];
    const only = (x: number, y: number) => x === origin.x + dx && y === origin.y + dy;
    expect(placeDecor(['b_drone_bay'], newPlot(origin), { isFree: only, walkable: only }).has('b_drone_bay')).toBe(false);
  });

  it('skips a decor whose every slot is blocked instead of placing it on a path', () => {
    expect(placeDecor(['banner'], newPlot(origin), { isFree: () => false, walkable: () => true }).has('banner')).toBe(false);
  });

  it('frees the tile and the anchor when a prop goes away', () => {
    const plot = newPlot(origin);
    const t = placeDecor(['b_bench_tools'], plot, open).get('b_bench_tools')!;
    releaseDecor(plot, 'b_bench_tools', t);
    expect(plot.claimed.has(tileKey(t))).toBe(false);
    expect(plot.anchors).toEqual([origin]);
  });
});
