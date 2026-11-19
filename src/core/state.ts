import type { EquipSlot, ItemBag, ItemId } from '../data/items';
import type { AfkAreaId } from '../data/areas';
import type { AllyId, BuildNodeId, DiscoveryId, MemberId, SkillNodeId, SpellId } from '../data/ferromancy';

export const SAVE_VERSION = 3;
export const BAG_CAPACITY = 30;

export type FlagId =
  | 'intro_seen'
  | 'first_wagon_looted'
  | 'drone_built'
  | 'boss_defeated'
  | 'bp_cargo';

export type AfkEndReason = 'full' | 'stopped' | 'manual_control' | 'tab_closed';

export interface AfkSession {
  id: string;
  areaId: AfkAreaId;
  startedAt: number;
  cycleMs: number;
  capacity: number;
  rareFactor: number;
  extraction: number;
  seed: number;
  endedAt: number | null;
  endReason: AfkEndReason | null;
}

export type SpellLoadout = [SpellId | null, SpellId | null, SpellId | null];

/** Ferromancia progress: build tree, skill tree, spell loadout, exploration finds and party. */
export interface FerroState {
  built: BuildNodeId[];
  learned: SkillNodeId[];
  loadout: SpellLoadout;
  discovered: DiscoveryId[];
  recruited: AllyId[];
  formation: { front: MemberId | null; back: MemberId | null };
  /** Permanent max mana from Cristais de Éter. */
  manaBonus: number;
}

export function newFerro(): FerroState {
  return { built: [], learned: [], loadout: [null, null, null], discovered: [], recruited: [], formation: { front: 'ferrugem', back: null }, manaBonus: 0 };
}

export interface GameState {
  version: typeof SAVE_VERSION;
  currency: number;
  inventory: ItemBag;
  equipped: Record<EquipSlot, ItemId | null>;
  flags: Partial<Record<FlagId, boolean>>;
  afk: AfkSession | null;
  /** Recently claimed AFK session ids: second claim of the same id is a no-op. */
  claimedSessions: string[];
  /** Last time the open tab proved it was alive; caps AFK sessions after a tab close. */
  lastHeartbeat: number;
  stats: { searches: number; kills: number; extractions: number };
  ferro: FerroState;
}

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    currency: 10,
    inventory: { drone_chassis: 1, tool_hydraulic_pry: 1 },
    equipped: { drone: null, module: null, upgrade: null, relic: null, tool: 'tool_wrench_old', head: null, body: null, hands: null, feet: null, accessory: null },
    flags: {},
    afk: null,
    claimedSessions: [],
    lastHeartbeat: now,
    stats: { searches: 0, kills: 0, extractions: 0 },
    ferro: newFerro(),
  };
}

export function countOf(state: GameState, id: ItemId): number {
  return state.inventory[id] ?? 0;
}

export function addItems(state: GameState, bag: ItemBag): void {
  for (const [id, qty] of Object.entries(bag) as [ItemId, number][]) {
    if (qty > 0) state.inventory[id] = countOf(state, id) + qty;
  }
}

export function hasItems(state: GameState, bag: ItemBag): boolean {
  return (Object.entries(bag) as [ItemId, number][]).every(([id, qty]) => countOf(state, id) >= qty);
}

/** Removes the whole bag or nothing. */
export function removeItems(state: GameState, bag: ItemBag): boolean {
  if (!hasItems(state, bag)) return false;
  for (const [id, qty] of Object.entries(bag) as [ItemId, number][]) {
    const left = countOf(state, id) - qty;
    if (left > 0) state.inventory[id] = left;
    else delete state.inventory[id];
  }
  return true;
}

export function bagTotal(bag: ItemBag): number {
  return Object.values(bag).reduce((s, n) => s + (n ?? 0), 0);
}

export function bagStacks(bag: ItemBag): number {
  return Object.values(bag).filter((n) => (n ?? 0) > 0).length;
}
