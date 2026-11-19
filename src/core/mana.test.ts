import { describe, expect, it } from 'vitest';
import { SPELLS, type SkillNodeId } from '../data/ferromancy';
import { levelOf, manaRegen, maxMana, useItem, xpForLevel, xpOf } from './mana';
import { buildNode, learnNode } from './progression';
import { parseSave } from './save';
import { castProblem, castSpell, discover, equipSpell, spellPower, type SpellCooldowns } from './spells';
import { addItems, countOf, newGame, type GameState } from './state';

const T0 = 1_700_000_000_000;

function mage(): GameState {
  const s = newGame(T0);
  addItems(s, { scrap: 200, gear: 30, cable: 30, ether_shard: 10 });
  discover(s, 'ether_vein');
  s.stats.kills = 100;
  for (const id of ['b_workshop', 'b_alchemy'] as const) expect(buildNode(s, id).ok).toBe(true);
  for (const id of ['s_mag_init', 's_mag_ward', 's_mag_lode'] as SkillNodeId[]) expect(learnNode(s, id).ok).toBe(true);
  expect(equipSpell(s, 0, 'spell_ember').ok).toBe(true);
  return s;
}

describe('character level', () => {
  it('follows the 60·L·(L−1)/2 curve and caps at 30', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 60, 180, 360]);
    const s = newGame(T0);
    expect(levelOf(s)).toEqual({ level: 1, xp: 0, into: 0, need: 60 });
    s.stats.kills = 5;
    s.stats.searches = 2;
    expect(levelOf(s)).toEqual({ level: 1, xp: 58, into: 58, need: 60 });
    s.stats.searches = 3;
    expect(levelOf(s)).toEqual({ level: 2, xp: 62, into: 2, need: 120 });
    s.stats.kills = 1_000_000;
    expect(levelOf(s)).toMatchObject({ level: 30, need: 0 });
  });

  it('derives the level of an old save from its stats, with no migration', () => {
    const v2 = JSON.stringify({
      version: 2, currency: 0, inventory: {}, equipped: {}, flags: {}, afk: null, claimedSessions: [], lastHeartbeat: T0,
      stats: { searches: 10, kills: 12, extractions: 2 },
    });
    const s = parseSave(v2, T0);
    expect(s.ferro.manaBonus).toBe(0);
    expect(xpOf(s)).toBe(12 * 10 + 10 * 4 + 2 * 25);
    expect(levelOf(s).level).toBe(3);
    expect(maxMana(s)).toBe(40);
  });

  it('counts built and learned nodes as XP', () => {
    const s = newGame(T0);
    s.ferro.built = ['b_workshop', 'b_alchemy'];
    s.ferro.learned = ['s_mag_init'];
    expect(xpOf(s)).toBe(2 * 15 + 10);
  });

  it('drops a broken manaBonus from a save', () => {
    const raw = JSON.parse(JSON.stringify({ ...newGame(T0), ferro: { ...newGame(T0).ferro, manaBonus: -3 } }));
    expect(parseSave(JSON.stringify(raw), T0).ferro.manaBonus).toBe(0);
    raw.ferro.manaBonus = 10;
    expect(parseSave(JSON.stringify(raw), T0).ferro.manaBonus).toBe(10);
  });
});

describe('max mana', () => {
  it('sums base, level, equipment and crystal bonus', () => {
    const s = newGame(T0);
    expect(maxMana(s)).toBe(30);
    s.stats.kills = 6;
    expect(maxMana(s)).toBe(35);
    s.equipped.head = 'head_scrap_cap';
    s.equipped.accessory = 'accessory_lucky_bolt';
    s.equipped.relic = 'relic_capacitor';
    expect(maxMana(s)).toBe(35 + 5 + 10 + 15);
    s.ferro.manaBonus = 5;
    expect(maxMana(s)).toBe(70);
  });

  it('regenerates faster out of combat', () => {
    expect(manaRegen(false)).toBe(2);
    expect(manaRegen(true)).toBe(4);
  });
});

describe('useItem', () => {
  it('Cristal de Éter adds +5 max mana and is consumed once', () => {
    const s = newGame(T0);
    addItems(s, { ether_crystal: 2 });
    const mana = { value: 10 };
    expect(useItem(s, 'ether_crystal', mana).ok).toBe(true);
    expect(s.ferro.manaBonus).toBe(5);
    expect(maxMana(s)).toBe(35);
    expect(countOf(s, 'ether_crystal')).toBe(1);
    expect(mana.value).toBe(10);
  });

  it('Frasco de Éter restores 30 mana up to the max and is consumed once', () => {
    const s = newGame(T0);
    addItems(s, { mana_flask: 2 });
    const mana = { value: 20 };
    expect(useItem(s, 'mana_flask', mana).ok).toBe(true);
    expect(mana.value).toBe(30);
    expect(countOf(s, 'mana_flask')).toBe(1);
    mana.value = 0;
    expect(useItem(s, 'mana_flask', mana).ok).toBe(true);
    expect(mana.value).toBe(30);
    expect(countOf(s, 'mana_flask')).toBe(0);
  });

  it('fails without the item and changes nothing', () => {
    const s = newGame(T0);
    const mana = { value: 5 };
    expect(useItem(s, 'mana_flask', mana).ok).toBe(false);
    expect(useItem(s, 'ether_crystal', mana).ok).toBe(false);
    expect(mana.value).toBe(5);
    expect(s.ferro.manaBonus).toBe(0);
  });
});

describe('casting with mana', () => {
  it('refuses on low mana without consuming anything', () => {
    const s = mage();
    addItems(s, { reagent_ember: 2 });
    const cds: SpellCooldowns = {};
    const mana = { value: SPELLS.spell_ember.mana - 1 };
    expect(castProblem(s, cds, 'spell_ember', 0, mana)).toBe('Mana insuficiente.');
    const res = castSpell(s, cds, 'spell_ember', 0, mana);
    expect(res).toEqual({ ok: false, msg: 'Mana insuficiente.' });
    expect(mana.value).toBe(SPELLS.spell_ember.mana - 1);
    expect(countOf(s, 'reagent_ember')).toBe(2);
    expect(cds.spell_ember).toBeUndefined();
  });

  it('empowered cast consumes the reagent and boosts power by 50%', () => {
    const s = mage();
    addItems(s, { reagent_ember: 1 });
    const mana = { value: 30 };
    const res = castSpell(s, {}, 'spell_ember', 0, mana);
    expect(res).toEqual({ ok: true, msg: SPELLS.spell_ember.name, empowered: true });
    expect(countOf(s, 'reagent_ember')).toBe(0);
    expect(mana.value).toBe(18);
    expect(spellPower(s, 'spell_ember', true)).toBe(36);
    expect(spellPower(s, 'spell_ember')).toBe(24);
  });

  it('casts at base power with no reagent', () => {
    const s = mage();
    const mana = { value: 30 };
    const res = castSpell(s, {}, 'spell_ember', 0, mana);
    expect(res).toEqual({ ok: true, msg: SPELLS.spell_ember.name, empowered: false });
    expect(mana.value).toBe(18);
    expect(countOf(s, 'reagent_ember')).toBe(0);
  });
});
