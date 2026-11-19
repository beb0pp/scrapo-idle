import { describe, expect, it } from 'vitest';
import { findPath, nearestFree, simplify } from './pathfind';

const MAP = ['.......', '.####..', '....#..', '.#..#..', '.#.....'];
const blocked = (x: number, y: number) => MAP[y]?.[x] === undefined || MAP[y][x] === '#';

describe('click-to-move pathfinding', () => {
  it('walks around a wall instead of through it', () => {
    const p = findPath(blocked, { x: 0, y: 2 }, { x: 6, y: 2 })!;
    expect(p[0]).toEqual({ x: 0, y: 2 });
    expect(p[p.length - 1]).toEqual({ x: 6, y: 2 });
    expect(p.every((c) => !blocked(c.x, c.y))).toBe(true);
  });

  it('never cuts a wall corner diagonally', () => {
    const p = findPath(blocked, { x: 0, y: 0 }, { x: 0, y: 2 })!;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (a.x !== b.x && a.y !== b.y) expect(blocked(b.x, a.y) || blocked(a.x, b.y)).toBe(false);
    }
  });

  it('returns null for an enclosed target', () => {
    const closed = (x: number, y: number) => blocked(x, y) || (x === 3 && y === 2) === false && Math.abs(x - 3) <= 1 && Math.abs(y - 2) <= 1;
    expect(findPath(closed, { x: 0, y: 0 }, { x: 3, y: 2 })).toBeNull();
  });

  it('a click on a wall resolves to the closest walkable tile', () => {
    expect(nearestFree(blocked, { x: 2, y: 1 })).not.toBeNull();
    expect(blocked(nearestFree(blocked, { x: 2, y: 1 })!.x, nearestFree(blocked, { x: 2, y: 1 })!.y)).toBe(false);
  });

  it('simplify keeps endpoints and removes collinear points', () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }])).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }]);
  });
});
