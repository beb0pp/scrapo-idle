import { BAG_SLOTS, BAG_WARN_RATIO, SLOT_KINDS, SLOT_STACK } from '../data/bag';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';
import { addItems, countOf, type GameState } from './state';

export type BagLevel = 'ok' | 'warn' | 'full';
export interface CappedAdd { added: ItemBag; left: ItemBag }

export function takesSlot(id: ItemId): boolean {
  return SLOT_KINDS.includes(ITEMS[id].kind);
}

export function slotsFor(qty: number): number {
  return qty > 0 ? Math.ceil(qty / SLOT_STACK) : 0;
}

function slotsIn(inv: ItemBag): number {
  return (Object.entries(inv) as [ItemId, number][]).reduce((n, [id, qty]) => n + (ITEMS[id] && takesSlot(id) ? slotsFor(qty) : 0), 0);
}

export function bagSlotsUsed(state: GameState): number {
  return slotsIn(state.inventory);
}

export function bagCapacity(_state: GameState): number {
  return BAG_SLOTS;
}

export function bagFull(state: GameState): boolean {
  return bagSlotsUsed(state) >= bagCapacity(state);
}

export function bagLevel(state: GameState): BagLevel {
  const used = bagSlotsUsed(state), cap = bagCapacity(state);
  if (used >= cap) return 'full';
  return used >= cap * BAG_WARN_RATIO ? 'warn' : 'ok';
}

function roomIn(inv: ItemBag, cap: number, id: ItemId): number {
  if (!takesSlot(id)) return Infinity;
  const have = inv[id] ?? 0;
  const topUp = slotsFor(have) * SLOT_STACK - have;
  return topUp + Math.max(0, cap - slotsIn(inv)) * SLOT_STACK;
}

/** Units of one item that still fit: top-up of its open stack plus free slots. */
export function spaceFor(state: GameState, id: ItemId): number {
  return roomIn(state.inventory, bagCapacity(state), id);
}

/** Pure split of a find into what fits now and what is left over, in bag order. */
export function splitFit(state: GameState, bag: ItemBag): CappedAdd {
  const inv: ItemBag = { ...state.inventory };
  const added: ItemBag = {}, left: ItemBag = {};
  for (const [id, qty] of Object.entries(bag) as [ItemId, number][]) {
    if (!(qty > 0)) continue;
    const take = Math.min(qty, roomIn(inv, bagCapacity(state), id));
    if (take > 0) (added[id] = take), (inv[id] = (inv[id] ?? 0) + take);
    if (qty > take) left[id] = qty - take;
  }
  return { added, left };
}

export function fitsAll(state: GameState, bag: ItemBag): boolean {
  return Object.keys(splitFit(state, bag).left).length === 0;
}

export function addItemsCapped(state: GameState, bag: ItemBag): CappedAdd {
  const split = splitFit(state, bag);
  addItems(state, split.added);
  return split;
}

/** Slots the player must free before the whole bag fits. */
export function slotsMissing(state: GameState, bag: ItemBag): number {
  const after: ItemBag = { ...state.inventory };
  for (const [id, qty] of Object.entries(bag) as [ItemId, number][]) if (qty > 0) after[id] = (after[id] ?? 0) + qty;
  return Object.keys(splitFit(state, bag).left).length ? Math.max(0, slotsIn(after) - bagCapacity(state)) : 0;
}

/** True when swapping `remove` for `add` still fits, so dismantling never overflows the bag. */
export function swapFits(state: GameState, remove: ItemBag, add: ItemBag): boolean {
  const inv: ItemBag = { ...state.inventory };
  for (const [id, qty] of Object.entries(remove) as [ItemId, number][]) inv[id] = countOf(state, id) - qty;
  return fitsAll({ ...state, inventory: inv }, add);
}
