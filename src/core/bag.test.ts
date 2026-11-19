import { describe, expect, it } from 'vitest';
import { BAG_SLOTS } from '../data/bag';
import { claimAfk, claimPending, computeProgress, startAfk } from './afk';
import { addItemsCapped, bagCapacity, bagFull, bagLevel, bagSlotsUsed, slotsMissing, spaceFor, splitFit } from './bag';
import { craft, dismantle } from './economy';
import { parseSave } from './save';
import type { ItemBag } from '../data/items';
import { addItems, countOf, newGame, type GameState } from './state';

const T0 = 1_700_000_000_000;

function fresh(): GameState {
  const s = newGame(T0);
  s.inventory = {};
  return s;
}

function withScrapSlots(n: number): GameState {
  const s = fresh();
  addItems(s, { scrap: n * 100 });
  return s;
}

describe('bag slots', () => {
  it('counts one slot per started stack of 100 units', () => {
    const s = fresh();
    addItems(s, { scrap: 250, gear: 1, cable: 100 });
    expect(bagSlotsUsed(s)).toBe(3 + 1 + 1);
  });

  it('ignores quest parts, tools, modules, relics and gear', () => {
    const s = fresh();
    addItems(s, { pulse_core: 1, drone_chassis: 1, tool_hydraulic_pry: 1, mod_claw: 3, relic_capacitor: 1, body_work_jacket: 1, drone_spark: 1 });
    expect(bagSlotsUsed(s)).toBe(0);
  });

  it('counts reagents and consumables as loose materials', () => {
    const s = fresh();
    addItems(s, { ether_shard: 1, reagent_ember: 1, ether_crystal: 1, mana_flask: 1 });
    expect(bagSlotsUsed(s)).toBe(4);
  });

  it('has a base capacity of 24 slots', () => {
    expect(bagCapacity(fresh())).toBe(24);
    expect(BAG_SLOTS).toBe(24);
  });

  it('is full only at capacity', () => {
    expect(bagFull(withScrapSlots(23))).toBe(false);
    expect(bagFull(withScrapSlots(24))).toBe(true);
  });

  it('warns from 90% and turns full at capacity', () => {
    expect(bagLevel(withScrapSlots(21))).toBe('ok');
    expect(bagLevel(withScrapSlots(22))).toBe('warn');
    expect(bagLevel(withScrapSlots(24))).toBe('full');
  });
});

describe('capped add', () => {
  it('tops up an open stack without taking a new slot when the bag is full', () => {
    const s = withScrapSlots(23);
    addItems(s, { gear: 40 });
    const res = addItemsCapped(s, { gear: 60 });
    expect(res.added).toEqual({ gear: 60 });
    expect(res.left).toEqual({});
    expect(bagSlotsUsed(s)).toBe(24);
  });

  it('adds what fits and returns the rest when a find only partly fits', () => {
    const s = withScrapSlots(23);
    const res = addItemsCapped(s, { gear: 150, cable: 2 });
    expect(res.added).toEqual({ gear: 100 });
    expect(res.left).toEqual({ gear: 50, cable: 2 });
    expect(countOf(s, 'gear')).toBe(100);
    expect(countOf(s, 'cable')).toBe(0);
  });

  it('always accepts items that take no slot', () => {
    const s = withScrapSlots(24);
    expect(addItemsCapped(s, { mod_claw: 1, pulse_core: 1 }).left).toEqual({});
    expect(spaceFor(s, 'mod_claw')).toBe(Infinity);
  });

  it('reports free units for one item from free slots plus its open stack', () => {
    const s = withScrapSlots(22);
    addItems(s, { gear: 30 });
    expect(spaceFor(s, 'gear')).toBe(70 + 100);
    expect(spaceFor(s, 'cable')).toBe(100);
  });

  it('does not mutate the state when only splitting', () => {
    const s = withScrapSlots(24);
    splitFit(s, { gear: 5 });
    expect(countOf(s, 'gear')).toBe(0);
  });

  it('keeps every item of an over-cap save and treats it as full', () => {
    const s = parseSave(JSON.stringify({ version: 3, inventory: { scrap: 2500, gear: 30, cable: 5 } }), T0);
    expect(countOf(s, 'scrap')).toBe(2500);
    expect(bagSlotsUsed(s)).toBe(27);
    expect(bagFull(s)).toBe(true);
    expect(addItemsCapped(s, { servo: 1 }).left).toEqual({ servo: 1 });
    expect(slotsMissing(s, { servo: 1 })).toBe(4);
  });
});

describe('workshop under a full bag', () => {
  it('refuses a dismantle whose parts do not fit and keeps the source item', () => {
    const s = withScrapSlots(23);
    addItems(s, { servo: 1, gear: 100 });
    expect(dismantle(s, 'servo').ok).toBe(false);
    expect(countOf(s, 'servo')).toBe(1);
  });

  it('allows a dismantle when removing the source frees the slot the parts need', () => {
    const s = withScrapSlots(22);
    addItems(s, { scrap: 98, cell: 1 });
    expect(dismantle(s, 'cell').ok).toBe(true);
    expect(countOf(s, 'scrap')).toBe(2301);
    expect(bagSlotsUsed(s)).toBe(24);
  });

  it('still crafts slot-free outputs with a full bag', () => {
    const s = withScrapSlots(24);
    addItems(s, { gear: 2, cable: 1 });
    expect(craft(s, 'rcp_mod_claw').ok).toBe(true);
  });
});

describe('AFK claim with a full bag', () => {
  function droneOut(): GameState {
    const s = newGame(T0);
    addItems(s, { pulse_core: 1, gear: 2, cable: 1, scrap: 10 });
    craft(s, 'rcp_mod_claw');
    craft(s, 'rcp_drone_spark');
    startAfk(s, 'afk_yard_edge', T0, 9);
    return s;
  }

  const total = (bag: ItemBag) => Object.values(bag).reduce((a, b) => a + (b ?? 0), 0);

  it('claims what fits, keeps the rest pending and still grants XP', () => {
    const s = droneOut();
    const at = T0 + 6 * s.afk!.cycleMs;
    const loot = computeProgress(s.afk!, at).loot;
    s.inventory.scrap = 2400;
    const added = claimAfk(s, at)!;
    expect(total(s.afkPending)).toBeGreaterThan(0);
    expect(total(added) + total(s.afkPending)).toBe(total(loot));
    expect(s.xp).toBeGreaterThan(0);
    expect(s.afk).toBeNull();
  });

  it('claims everything and leaves nothing pending when the bag has room', () => {
    const s = droneOut();
    const at = T0 + 6 * s.afk!.cycleMs;
    const loot = computeProgress(s.afk!, at).loot;
    expect(claimAfk(s, at)).toEqual(loot);
    expect(s.afkPending).toEqual({});
  });

  it('delivers pending loot once slots are freed', () => {
    const s = withScrapSlots(24);
    s.afkPending = { gear: 3, cable: 2 };
    expect(claimPending(s)).toBeNull();
    s.inventory.scrap = 2200;
    expect(claimPending(s)).toEqual({ gear: 3, cable: 2 });
    expect(s.afkPending).toEqual({});
    expect(countOf(s, 'gear')).toBe(3);
  });

  it('delivers pending loot in part when only some fits', () => {
    const s = withScrapSlots(23);
    s.afkPending = { gear: 3, cable: 2 };
    expect(claimPending(s)).toEqual({ gear: 3 });
    expect(s.afkPending).toEqual({ cable: 2 });
  });

  it('round-trips pending loot through the save', () => {
    const s = parseSave(JSON.stringify({ version: 3, afkPending: { gear: 4, bogus: 2 } }), T0);
    expect(s.afkPending).toEqual({ gear: 4 });
  });
});
