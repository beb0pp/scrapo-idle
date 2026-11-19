// Pure targeting and damage rules of the attack spells. The scene only feeds positions and applies the hits.

export interface Pt { x: number; y: number }

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------- Arco Encadeado (Elétrico) ----------------

export const CHAIN_JUMPS = 3;
export const CHAIN_JUMP_RANGE = 70;
export const CHAIN_FALLOFF = 0.75;

/** First target, then up to `jumps` more: each hop goes to the nearest unhit target within `range` of the last one. */
export function chainTargets<T extends Pt>(first: T, pool: readonly T[], jumps = CHAIN_JUMPS, range = CHAIN_JUMP_RANGE): T[] {
  const chain = [first];
  const left = pool.filter((t) => t !== first);
  while (chain.length <= jumps) {
    const last = chain[chain.length - 1];
    let best: T | null = null;
    for (const t of left) if (dist(last, t) <= range && (!best || dist(last, t) < dist(last, best))) best = t;
    if (!best) break;
    chain.push(best);
    left.splice(left.indexOf(best), 1);
  }
  return chain;
}

/** Hop 0 takes full power; every jump keeps `CHAIN_FALLOFF` of the previous one. */
export function chainDamage(power: number, hop: number): number {
  return Math.max(1, Math.round(power * CHAIN_FALLOFF ** hop));
}

// ---------------- Prensa Magnética (Magnético) ----------------

export const CRUSH_RADIUS = 56;
export const CRUSH_BONUS_PER_EXTRA = 0.25;
export const CRUSH_MAX_EXTRA = 3;

export function crushTargets<T extends Pt>(center: Pt, pool: readonly T[], radius = CRUSH_RADIUS): T[] {
  return pool.filter((t) => dist(center, t) <= radius);
}

/** Enemies crushed together hit each other: +25% per extra body caught, up to three extras. */
export function crushDamage(power: number, caught: number): number {
  const extra = Math.min(CRUSH_MAX_EXTRA, Math.max(0, caught - 1));
  return Math.max(1, Math.round(power * (1 + CRUSH_BONUS_PER_EXTRA * extra)));
}

// ---------------- Respingo Ácido (Corrosivo) ----------------

export const ACID_RADIUS = 30;
export const ACID_PUDDLE_MS = 3000;
export const ACID_TICK_MS = 500;
export const ACID_TICK_SHARE = 0.2;

export function acidSplashTargets<T extends Pt>(center: Pt, pool: readonly T[], radius = ACID_RADIUS): T[] {
  return pool.filter((t) => dist(center, t) <= radius);
}

/** Damage each puddle tick deals to whoever stands in it. */
export function acidTickDamage(power: number): number {
  return Math.max(1, Math.round(power * ACID_TICK_SHARE));
}

export function acidTickCount(durationMs = ACID_PUDDLE_MS, tickMs = ACID_TICK_MS): number {
  return Math.floor(durationMs / tickMs);
}
