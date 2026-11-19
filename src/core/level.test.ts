import { describe, expect, it } from 'vitest';
import { XP } from '../data/xp';
import { claimAfk, computeProgress, startAfk } from './afk';
import { craft } from './economy';
import { grantXp, levelFor, levelOf, levelProgress, MAX_LEVEL, xpAt, xpToNext } from './level';
import { maxMana } from './mana';
import { parseSave } from './save';
import { addItems, newGame } from './state';

const T0 = 1_700_000_000_000;

describe('xp curve', () => {
  it('starts at zero and grows by XP_BASE·(L−1)^XP_EXP', () => {
    expect([1, 2, 3, 10, 25, 50, 100].map(xpAt)).toEqual([0, 22, 101, 2765, 23927, 115041, 540530]);
  });

  it('needs more XP for every next level', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('maps XP to level at the exact thresholds', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(21)).toBe(1);
    expect(levelFor(22)).toBe(2);
    expect(levelFor(xpAt(10) - 1)).toBe(9);
    expect(levelFor(xpAt(10))).toBe(10);
  });

  it('reports progress inside the current level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, into: 0, need: 22 });
    expect(levelProgress(30)).toEqual({ level: 2, into: 8, need: 79 });
  });

  it('caps at Nv 100 with nothing left to earn', () => {
    expect(levelProgress(10_000_000)).toEqual({ level: MAX_LEVEL, into: 10_000_000 - xpAt(MAX_LEVEL), need: 0 });
    expect(xpToNext(MAX_LEVEL)).toBe(0);
  });
});

describe('grantXp', () => {
  it('adds XP and returns the levels gained', () => {
    const s = newGame(T0);
    expect(grantXp(s, 10)).toBe(0);
    expect(s.xp).toBe(10);
    expect(grantXp(s, xpAt(4) - 10)).toBe(3);
    expect(levelOf(s).level).toBe(4);
  });

  it('ignores zero, negative and non-finite amounts', () => {
    const s = newGame(T0);
    for (const bad of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) expect(grantXp(s, bad)).toBe(0);
    expect(s.xp).toBe(0);
  });

  it('raises max mana with the level', () => {
    const s = newGame(T0);
    const base = maxMana(s);
    grantXp(s, xpAt(3));
    expect(maxMana(s)).toBe(base + 10);
  });
});

describe('xp in the save', () => {
  it('round-trips stored XP', () => {
    const s = newGame(T0);
    grantXp(s, 1234);
    expect(parseSave(JSON.stringify(s), T0).xp).toBe(1234);
  });

  it('a new game starts at Nv 1 with 0 XP', () => {
    const s = parseSave(null, T0);
    expect(s.xp).toBe(0);
    expect(levelOf(s).level).toBe(1);
  });

  it('migrates a v3 save with no xp field from the old stats-derived formula', () => {
    const { xp: _drop, ...old } = newGame(T0);
    old.stats = { searches: 10, kills: 12, extractions: 2 };
    old.ferro.built = ['b_workshop'];
    old.ferro.learned = ['s_mag_init'];
    const s = parseSave(JSON.stringify(old), T0);
    expect(s.xp).toBe(12 * 10 + 10 * 4 + 2 * 25 + 15 + 10);
  });

  it('migrates an empty v2 save to 0 XP', () => {
    const v2 = JSON.stringify({ version: 2, currency: 0, inventory: {}, equipped: {}, flags: {}, afk: null, claimedSessions: [], lastHeartbeat: T0 });
    expect(parseSave(v2, T0).xp).toBe(0);
  });

  it('drops a broken xp value back to the migrated one', () => {
    const raw = { ...newGame(T0), xp: -5 };
    expect(parseSave(JSON.stringify(raw), T0).xp).toBe(0);
    expect(parseSave(JSON.stringify({ ...raw, xp: 'lots' }), T0).xp).toBe(0);
  });
});

describe('afk claim xp', () => {
  it('grants XP per finished cycle, once per session', () => {
    const s = newGame(T0);
    addItems(s, { pulse_core: 1, gear: 2, cable: 1, scrap: 10 });
    expect(craft(s, 'rcp_mod_claw').ok).toBe(true);
    expect(craft(s, 'rcp_drone_spark').ok).toBe(true);
    expect(startAfk(s, 'afk_yard_edge', T0, 7)).toBeNull();
    const cycles = computeProgress(s.afk!, T0 + 3 * s.afk!.cycleMs).cycles;
    expect(cycles).toBeGreaterThan(0);
    claimAfk(s, T0 + 3 * s.afk!.cycleMs);
    expect(s.xp).toBe(cycles * XP.afkCycle);
    const after = s.xp;
    claimAfk(s, T0 + 999_999);
    expect(s.xp).toBe(after);
  });
});
