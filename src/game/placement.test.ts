import { describe, expect, it } from 'vitest';
import { reachableCells, spotNear } from './placement';

// 7×5 grid: '#' blocked, '.' free. The right pocket (x=5) is walled off from the start.
const GRID = [
  '#######',
  '#...#.#',
  '#...#.#',
  '#...#.#',
  '#######',
];
const blocked = (x: number, y: number) => GRID[y]?.[x] !== '.';

describe('reachableCells', () => {
  it('floods only the free cells connected to the start', () => {
    const reach = reachableCells(blocked, 7, 5, { x: 1, y: 1 });
    expect(reach.has('3,3')).toBe(true);
    expect(reach.has('5,2')).toBe(false);
    expect(reach.has('0,0')).toBe(false);
  });
});

describe('spotNear', () => {
  const reach = reachableCells(blocked, 7, 5, { x: 1, y: 1 });

  it('returns the target cell when it is free and reachable', () => {
    expect(spotNear(reach, { x: 2, y: 2 }, 6)).toEqual({ x: 2, y: 2 });
  });

  it('skips an unreachable pocket and settles on the nearest reachable cell', () => {
    expect(spotNear(reach, { x: 5, y: 2 }, 6)).toEqual({ x: 3, y: 2 });
  });

  it('is deterministic for the same input', () => {
    const a = spotNear(reach, { x: 6, y: 0 }, 6);
    expect(spotNear(reach, { x: 6, y: 0 }, 6)).toEqual(a);
    expect(a && reach.has(`${a.x},${a.y}`)).toBe(true);
  });

  it('gives up beyond the search radius', () => {
    expect(spotNear(new Set(), { x: 2, y: 2 }, 3)).toBeNull();
  });
});
