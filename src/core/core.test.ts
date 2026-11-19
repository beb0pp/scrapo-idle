import { describe, expect, it } from 'vitest';
import { claimAfk, computeProgress, endAfk, finalizeAfterReload, settleFull, startAfk } from './afk';
import { buy, craft, dismantle, equip, sell } from './economy';
import { loadState, parseSave, saveState, type KeyValueStore } from './save';
import { addItems, bagTotal, countOf, newGame, BAG_CAPACITY, type GameState } from './state';

const T0 = 1_700_000_000_000;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function withDrone(): GameState {
  const s = newGame(T0);
  addItems(s, { pulse_core: 1, gear: 2, cable: 1, scrap: 10 });
  expect(craft(s, 'rcp_mod_claw').ok).toBe(true);
  expect(craft(s, 'rcp_drone_spark').ok).toBe(true);
  return s;
}

describe('workshop', () => {
  it('builds the drone from chassis, core and module and installs it', () => {
    const s = withDrone();
    expect(s.equipped.drone).toBe('drone_spark');
    expect(s.equipped.module).toBe('mod_claw');
    expect(countOf(s, 'drone_chassis')).toBe(0);
    expect(countOf(s, 'mod_claw')).toBe(0);
    expect(s.flags.drone_built).toBe(true);
  });

  it('refuses a recipe with missing parts and keeps the inventory intact', () => {
    const s = newGame(T0);
    addItems(s, { gear: 1, scrap: 50 });
    const r = craft(s, 'rcp_mod_claw');
    expect(r.ok).toBe(false);
    expect(countOf(s, 'gear')).toBe(1);
    expect(countOf(s, 'scrap')).toBe(50);
  });

  it('turns the boss coil into the magnetic module and swaps it in', () => {
    const s = withDrone();
    addItems(s, { relic_crane_coil: 1, cable: 2, gear: 1 });
    expect(craft(s, 'rcp_mod_magnet').ok).toBe(true);
    expect(equip(s, 'mod_magnet').ok).toBe(true);
    expect(s.equipped.module).toBe('mod_magnet');
    expect(countOf(s, 'mod_claw')).toBe(1);
  });

  it('locks the cargo recipe until the blueprint is bought', () => {
    const s = withDrone();
    addItems(s, { gear: 3, servo: 1, scrap: 8 });
    expect(craft(s, 'rcp_mod_cargo').ok).toBe(false);
    s.currency = 40;
    expect(buy(s, 'offer_bp_cargo').ok).toBe(true);
    expect(buy(s, 'offer_bp_cargo').ok).toBe(false);
    expect(craft(s, 'rcp_mod_cargo').ok).toBe(true);
  });
});

describe('items with several uses', () => {
  it('keeps the equipment unchanged when a full bag cannot receive the swapped item', () => {
    const s = newGame(T0);
    addItems(s, { tool_wrench_reinforced: 2 });
    for (const id of Object.keys(s.inventory)) if (id !== 'tool_wrench_reinforced') delete s.inventory[id as keyof typeof s.inventory];
    const fillers = ['scrap','gear','cable','servo','cell','drone_chassis','pulse_core','mod_claw','mod_magnet','mod_cargo','drone_spark','relic_crane_coil','relic_capacitor','tool_hydraulic_pry','head_scrap_cap','body_work_jacket','hands_grip_gloves','feet_rail_boots','accessory_lucky_bolt'] as const;
    fillers.forEach((id) => s.inventory[id] = 1);
    expect(Object.keys(s.inventory)).toHaveLength(BAG_CAPACITY - 10);
    // The configured capacity is intentionally wider than the current catalog; simulate the remaining occupied stacks.
    for (let n = Object.keys(s.inventory).length; n < BAG_CAPACITY; n++) (s.inventory as Record<string, number>)[`filled_${n}`] = 1;
    expect(equip(s, 'tool_wrench_reinforced').ok).toBe(false);
    expect(s.equipped.tool).toBe('tool_wrench_old');
  });
  it('sells for currency and cannot oversell', () => {
    const s = newGame(T0);
    addItems(s, { gear: 2 });
    expect(sell(s, 'gear', 3).ok).toBe(false);
    expect(sell(s, 'gear', 2).ok).toBe(true);
    expect(s.currency).toBe(10 + 8);
    expect(countOf(s, 'gear')).toBe(0);
  });

  it('refuses to sell the quest core', () => {
    const s = newGame(T0);
    addItems(s, { pulse_core: 1 });
    expect(sell(s, 'pulse_core', 1).ok).toBe(false);
  });

  it('dismantles a relic into components', () => {
    const s = newGame(T0);
    addItems(s, { relic_crane_coil: 1 });
    expect(dismantle(s, 'relic_crane_coil').ok).toBe(true);
    expect(countOf(s, 'cable')).toBe(3);
    expect(countOf(s, 'gear')).toBe(2);
  });

  it('equipped items leave the inventory, so they cannot be sold', () => {
    const s = newGame(T0);
    addItems(s, { relic_capacitor: 1 });
    expect(equip(s, 'relic_capacitor').ok).toBe(true);
    expect(sell(s, 'relic_capacitor', 1).ok).toBe(false);
  });
});

describe('AFK extraction', () => {
  it('freezes the extraction bonus when the session starts', () => {
    const s = withDrone();
    expect(s.equipped.tool).toBe('tool_wrench_old');
    startAfk(s, 'afk_yard_edge', T0, 2);
    expect(s.afk!.extraction).toBe(2);
    expect(s.afk!.cycleMs).toBeLessThan(6000);
  });
  it('requires a built drone', () => {
    const s = newGame(T0);
    expect(startAfk(s, 'afk_yard_edge', T0, 1)).not.toBeNull();
  });

  it('progress depends only on the clock, not on how often it is sampled', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 42);
    const session = s.afk!;
    const direct = computeProgress(session, T0 + 3 * session.cycleMs + 10);
    for (let t = T0; t < T0 + 3 * session.cycleMs; t += 777) computeProgress(session, t);
    expect(computeProgress(session, T0 + 3 * session.cycleMs + 10)).toEqual(direct);
    expect(direct.cycles).toBe(3);
  });

  it('stops at drone capacity and dates the end at the cycle that filled it', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 7);
    const p = computeProgress(s.afk!, T0 + 10 * 60_000);
    expect(p.full).toBe(true);
    expect(p.load).toBe(10);
    expect(bagTotal(p.loot)).toBe(10);
    expect(settleFull(s, T0 + 10 * 60_000)).toBe(true);
    expect(s.afk!.endedAt).toBe(p.fullAt);
  });

  it('stopping early keeps finished cycles only', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 3);
    const cycle = s.afk!.cycleMs;
    endAfk(s, T0 + cycle * 1.5, 'stopped');
    expect(computeProgress(s.afk!, T0 + cycle * 50).cycles).toBe(1);
  });

  it('claims exactly once', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 9);
    const before = bagTotal(s.inventory);
    const loot = claimAfk(s, T0 + 2 * s.afk!.cycleMs);
    expect(loot).not.toBeNull();
    const after = bagTotal(s.inventory);
    expect(after - before).toBe(bagTotal(loot!));
    expect(claimAfk(s, T0 + 999_999)).toBeNull();
    expect(bagTotal(s.inventory)).toBe(after);
  });

  it('a stale copy of a claimed session cannot be claimed again', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 11);
    const stale = structuredClone(s.afk!);
    claimAfk(s, T0 + 20_000);
    const total = bagTotal(s.inventory);
    s.afk = stale;
    expect(claimAfk(s, T0 + 30_000)).toBeNull();
    expect(bagTotal(s.inventory)).toBe(total);
  });

  it('after a tab close, only cycles before the last heartbeat count', () => {
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 5);
    const cycle = s.afk!.cycleMs;
    s.lastHeartbeat = T0 + cycle * 1.2;
    finalizeAfterReload(s, T0 + 60 * 60_000);
    expect(s.afk!.endReason).toBe('tab_closed');
    expect(computeProgress(s.afk!, T0 + 60 * 60_000).cycles).toBe(1);
  });

  it('the magnetic module doubles rare odds', () => {
    const s = withDrone();
    addItems(s, { relic_crane_coil: 1, cable: 2, gear: 1 });
    craft(s, 'rcp_mod_magnet');
    equip(s, 'mod_magnet');
    startAfk(s, 'afk_yard_edge', T0, 1);
    expect(s.afk!.rareFactor).toBe(2);
  });
});

describe('save', () => {
  it('migrates v1 saves with the starting tool equipped', () => {
    const old = parseSave(JSON.stringify({ version: 1, inventory: { scrap: 3 }, equipped: {} }), T0);
    expect(old.version).toBe(3);
    expect(old.equipped.tool).toBe('tool_wrench_old');
    expect(old.inventory.scrap).toBe(3);
  });
  it('round-trips inventory, equipment and an AFK session', () => {
    const store = memoryStore();
    const s = withDrone();
    startAfk(s, 'afk_yard_edge', T0, 77);
    saveState(store, s);
    expect(loadState(store, T0 + 1)).toEqual(s);
  });

  it('starts fresh on garbage or a wrong version', () => {
    expect(parseSave('{nope', T0).inventory).toEqual({ drone_chassis: 1, tool_hydraulic_pry: 1 });
    expect(parseSave(JSON.stringify({ version: 99, currency: 9999 }), T0).currency).toBe(10);
  });

  it('drops unknown item ids from a tampered save', () => {
    const s = parseSave(JSON.stringify({ version: 1, inventory: { scrap: 3, gold_bar: 50 } }), T0);
    expect(s.inventory).toEqual({ scrap: 3 });
  });
});
