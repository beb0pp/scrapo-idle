import type { Cell } from './pathfind';

const key = (x: number, y: number) => `${x},${y}`;

/** Free cells reachable from `from` (4-neighbour flood fill), as "x,y" keys. */
export function reachableCells(blocked: (x: number, y: number) => boolean, w: number, h: number, from: Cell): Set<string> {
  const seen = new Set<string>();
  if (blocked(from.x, from.y)) return seen;
  const queue: Cell[] = [from];
  seen.add(key(from.x, from.y));
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || seen.has(key(x, y)) || blocked(x, y)) continue;
      seen.add(key(x, y));
      queue.push({ x, y });
    }
  }
  return seen;
}

/** Nearest reachable cell to `target`, scanning square rings outward in a fixed order. */
export function spotNear(reachable: Set<string>, target: Cell, maxRadius: number): Cell | null {
  for (let r = 0; r <= maxRadius; r++) {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = target.x + dx, y = target.y + dy;
        const d = dx * dx + dy * dy;
        if (d < bestD && reachable.has(key(x, y))) (best = { x, y }), (bestD = d);
      }
    }
    if (best) return best;
  }
  return null;
}
