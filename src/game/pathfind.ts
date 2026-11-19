export interface Cell {
  x: number;
  y: number;
}

/** Grid A*, 8 directions, no corner cutting. `blocked(x, y)` must return true outside the map. */
export function findPath(blocked: (x: number, y: number) => boolean, from: Cell, to: Cell, maxNodes = 6000): Cell[] | null {
  if (blocked(to.x, to.y)) return null;
  const key = (x: number, y: number) => `${x},${y}`;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const open: { x: number; y: number; f: number }[] = [{ ...from, f: h(from.x, from.y) }];
  const g = new Map<string, number>([[key(from.x, from.y), 0]]);
  const came = new Map<string, Cell>();
  const closed = new Set<string>();
  while (open.length && closed.size < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === to.x && cur.y === to.y) {
      const path: Cell[] = [{ x: cur.x, y: cur.y }];
      let k = ck;
      while (came.has(k)) {
        const p = came.get(k)!;
        path.push(p);
        k = key(p.x, p.y);
      }
      return path.reverse();
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (blocked(nx, ny)) continue;
        if (dx && dy && (blocked(cur.x + dx, cur.y) || blocked(cur.x, cur.y + dy))) continue;
        const ng = g.get(ck)! + (dx && dy ? 1.414 : 1);
        const nk = key(nx, ny);
        if (ng >= (g.get(nk) ?? Infinity)) continue;
        g.set(nk, ng);
        came.set(nk, { x: cur.x, y: cur.y });
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
  }
  return null;
}

/** Nearest free cell to a blocked one, so clicking on a wall still walks next to it. */
export function nearestFree(blocked: (x: number, y: number) => boolean, c: Cell, radius = 4): Cell | null {
  if (!blocked(c.x, c.y)) return c;
  let best: Cell | null = null;
  let bestD = Infinity;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const d = dx * dx + dy * dy;
      if (d < bestD && !blocked(c.x + dx, c.y + dy)) (best = { x: c.x + dx, y: c.y + dy }), (bestD = d);
    }
  return best;
}

/** Drops waypoints that sit on a straight line, so movement doesn't zigzag tile by tile. */
export function simplify(path: Cell[]): Cell[] {
  if (path.length < 3) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1], b = path[i], c = path[i + 1];
    if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
