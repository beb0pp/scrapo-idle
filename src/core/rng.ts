import type { ItemBag } from '../data/items';
import type { LootEntry } from '../data/areas';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function rollEntry(rng: Rng, table: LootEntry[], rareFactor = 1): LootEntry {
  const weightOf = (e: LootEntry) => e.weight * (e.rare ? rareFactor : 1);
  const total = table.reduce((s, e) => s + weightOf(e), 0);
  let r = rng() * total;
  for (const e of table) {
    r -= weightOf(e);
    if (r < 0) return e;
  }
  return table[table.length - 1];
}

export function rollQty(rng: Rng, e: LootEntry): number {
  return e.min + Math.floor(rng() * (e.max - e.min + 1));
}

export function rollTable(rng: Rng, table: LootEntry[], rolls: number): ItemBag {
  const bag: ItemBag = {};
  for (let i = 0; i < rolls; i++) {
    const e = rollEntry(rng, table);
    bag[e.item] = (bag[e.item] ?? 0) + rollQty(rng, e);
  }
  return bag;
}
