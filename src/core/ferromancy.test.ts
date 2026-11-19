import { describe, expect, it } from 'vitest';
import { BUILD_NODES, NO_MODS, SKILL_NODES, type SkillNodeId } from '../data/ferromancy';
import { droneCapacity, playerStats } from './derived';
import { activeSynergies, buildNode, ferroMods, graphErrors, learnNode, nodeStatus, skillPoints, unlockedSpells } from './progression';
import { parseSave } from './save';
import { buffedMods, castProblem, castSpell, discover, equipSpell, recruit, setFormation, spellCooldownMs, spellPower, transmute, type SpellCooldowns } from './spells';
import { addItems, countOf, newGame, type GameState } from './state';

const T0 = 1_700_000_000_000;

/** A player who found Ether and can afford the whole build path. */
function rich(): GameState {
  const s = newGame(T0);
  addItems(s, { scrap: 200, gear: 30, cable: 30, servo: 5, cell: 5, ether_shard: 10 });
  discover(s, 'ether_vein');
  s.stats.kills = 100;
  return s;
}

function mage(): GameState {
  const s = rich();
  for (const id of ['b_workshop', 'b_alchemy'] as const) expect(buildNode(s, id).ok).toBe(true);
  for (const id of ['s_mag_init', 's_mag_ward', 's_mag_lode'] as SkillNodeId[]) expect(learnNode(s, id).ok).toBe(true);
  return s;
}

describe('trees', () => {
  it('have no cycles and no unknown requirements, including cross-tree links', () => {
    expect(graphErrors({ ...BUILD_NODES, ...SKILL_NODES })).toEqual([]);
  });

  it('detects a cycle', () => {
    expect(graphErrors({ a: { requires: ['b'] }, b: { requires: ['a'] } })[0]).toMatch(/ciclo/);
  });

  it('locks a node until its prerequisites are owned', () => {
    const s = rich();
    expect(nodeStatus(s, 'b_bench_tools')).toBe('locked');
    expect(buildNode(s, 'b_bench_tools').ok).toBe(false);
    expect(buildNode(s, 'b_workshop').ok).toBe(true);
    expect(nodeStatus(s, 'b_bench_tools')).toBe('available');
  });

  it('gates the alchemy station behind discovering an Ether vein', () => {
    const s = newGame(T0);
    addItems(s, { scrap: 50, cable: 5, ether_shard: 2 });
    expect(buildNode(s, 'b_workshop').ok).toBe(true);
    expect(nodeStatus(s, 'b_alchemy')).toBe('locked');
    discover(s, 'ether_vein');
    expect(nodeStatus(s, 'b_alchemy')).toBe('available');
  });

  it('consumes resources exactly once, even when bought twice', () => {
    const s = rich();
    buildNode(s, 'b_workshop');
    const scrap = countOf(s, 'scrap');
    expect(buildNode(s, 'b_workshop').ok).toBe(false);
    expect(countOf(s, 'scrap')).toBe(scrap);
    expect(s.ferro.built).toEqual(['b_workshop']);
  });

  it('keeps the inventory intact when a node is unaffordable', () => {
    const s = newGame(T0);
    addItems(s, { scrap: 6, gear: 1 });
    buildNode(s, 'b_workshop');
    expect(nodeStatus(s, 'b_bench_tools')).toBe('unaffordable');
    expect(buildNode(s, 'b_bench_tools').ok).toBe(false);
    expect(countOf(s, 'gear')).toBe(1);
  });

  it('earns skill points from play and spends them once', () => {
    const s = newGame(T0);
    expect(skillPoints(s).free).toBe(1);
    expect(learnNode(s, 's_cmb_arm').ok).toBe(true);
    expect(skillPoints(s).free).toBe(0);
    expect(learnNode(s, 's_ext_eye').ok).toBe(false);
    s.stats.kills = 5;
    expect(learnNode(s, 's_ext_eye').ok).toBe(true);
  });

  it('applies node effects to the derived stats', () => {
    const s = rich();
    const before = playerStats(s).combate;
    buildNode(s, 'b_workshop');
    buildNode(s, 'b_bench_tools');
    buildNode(s, 'b_bench_modules');
    buildNode(s, 'b_drone_bay');
    learnNode(s, 's_cmb_arm');
    expect(playerStats(s).combate).toBe(before + 6);
    expect(droneCapacity(s)).toBe(10 + 2 + 4);
  });

  it('completes a full branching path in each tree', () => {
    const s = rich();
    // Buy in dependency order: keep passing over the trees until nothing new can be bought.
    for (let pass = 0; pass < 5; pass++) {
      for (const id of Object.keys(BUILD_NODES)) buildNode(s, id as keyof typeof BUILD_NODES);
      for (const id of Object.keys(SKILL_NODES)) learnNode(s, id as SkillNodeId);
    }
    expect(s.ferro.built.length).toBe(Object.keys(BUILD_NODES).length);
    expect(s.ferro.learned.length).toBe(Object.keys(SKILL_NODES).length);
    expect(unlockedSpells(s).sort()).toEqual(['spell_ember', 'spell_harvest', 'spell_haste', 'spell_lodestone', 'spell_net', 'spell_ward']);
  });
});

describe('alchemy and spells', () => {
  it('turns scrap into reagents only after the station is built', () => {
    const s = rich();
    expect(transmute(s, 't_ember').ok).toBe(false);
    buildNode(s, 'b_workshop');
    buildNode(s, 'b_alchemy');
    const scrap = countOf(s, 'scrap');
    expect(transmute(s, 't_ember').ok).toBe(true);
    expect(countOf(s, 'reagent_ember')).toBe(2);
    expect(countOf(s, 'scrap')).toBe(scrap - 4);
    buildNode(s, 'b_bench_tools');
    buildNode(s, 'b_alembic');
    transmute(s, 't_ward');
    expect(countOf(s, 'reagent_ward')).toBe(3);
  });

  it('requires the spell to be learned and equipped', () => {
    const s = rich();
    expect(equipSpell(s, 0, 'spell_ember').ok).toBe(false);
    const m = mage();
    expect(castProblem(m, {}, 'spell_ember', 0, { value: 100 })).toMatch(/Equipe/);
    expect(equipSpell(m, 0, 'spell_ember').ok).toBe(true);
    expect(castProblem(m, {}, 'spell_ember', 0, { value: 0 })).toBe('Mana insuficiente.');
    expect(castProblem(m, {}, 'spell_ember', 0, { value: 100 })).toBeNull();
  });

  it('pays the cost once, then blocks during the cooldown', () => {
    const s = mage();
    equipSpell(s, 0, 'spell_ember');
    addItems(s, { reagent_ember: 2 });
    const cds: SpellCooldowns = {};
    const mana = { value: 100 };
    expect(castSpell(s, cds, 'spell_ember', 1000, mana).ok).toBe(true);
    expect(countOf(s, 'reagent_ember')).toBe(1);
    expect(mana.value).toBe(88);
    expect(castSpell(s, cds, 'spell_ember', 1000 + 5999, mana).ok).toBe(false);
    expect(countOf(s, 'reagent_ember')).toBe(1);
    expect(mana.value).toBe(88);
    expect(castSpell(s, cds, 'spell_ember', 1000 + 6000, mana).ok).toBe(true);
    expect(countOf(s, 'reagent_ember')).toBe(0);
    expect(mana.value).toBe(76);
  });

  it('moves a spell between hotkeys instead of duplicating it', () => {
    const s = mage();
    equipSpell(s, 0, 'spell_ward');
    equipSpell(s, 2, 'spell_ward');
    expect(s.ferro.loadout).toEqual([null, null, 'spell_ward']);
  });

  it('scales cooldown and power with the magic branch', () => {
    const s = mage();
    expect(spellCooldownMs(s, 'spell_ward')).toBe(15000);
    learnNode(s, 's_mag_channel');
    expect(spellCooldownMs(s, 'spell_ward')).toBe(12000);
    learnNode(s, 's_cmb_arm');
    learnNode(s, 's_cmb_dash');
    learnNode(s, 's_cmb_fury');
    expect(spellPower(s, 'spell_ember')).toBe(30);
  });
});

describe('auxílio spells', () => {
  it('learning the three auxílio nodes unlocks their spells', () => {
    const s = mage();
    for (const id of ['s_ext_eye', 's_ext_hands', 's_ext_magnet'] as SkillNodeId[]) expect(learnNode(s, id).ok).toBe(true);
    expect(unlockedSpells(s)).not.toContain('spell_haste');
    for (const id of ['s_mag_haste', 's_mag_net', 's_mag_harvest'] as SkillNodeId[]) expect(learnNode(s, id).ok).toBe(true);
    expect(unlockedSpells(s)).toEqual(expect.arrayContaining(['spell_haste', 'spell_net', 'spell_harvest']));
  });

  it('harvest needs haste first and costs Ether', () => {
    const s = mage();
    expect(learnNode(s, 's_mag_harvest').ok).toBe(false);
    expect(learnNode(s, 's_mag_haste').ok).toBe(true);
    const shards = countOf(s, 'ether_shard');
    expect(learnNode(s, 's_mag_harvest').ok).toBe(true);
    expect(countOf(s, 'ether_shard')).toBe(shards - 2);
  });

  it('active haste and net buff search time and pickup radius', () => {
    const mods = { ...NO_MODS, searchTimeMul: 0.7, pickupRadius: 40 };
    const out = buffedMods(mods, { haste: { until: T0 + 1, power: 50 }, net: { until: T0 + 1, power: 120 } }, T0);
    expect(out.searchTimeMul).toBeCloseTo(0.35);
    expect(out.pickupRadius).toBe(160);
  });

  it('applies only the buff that is still active', () => {
    const buffs = { haste: { until: T0 + 1, power: 50 }, net: { until: T0, power: 120 } };
    const out = buffedMods(NO_MODS, buffs, T0);
    expect(out.searchTimeMul).toBeCloseTo(0.5);
    expect(out.pickupRadius).toBe(0);
  });

  it('ignores expired buffs', () => {
    const out = buffedMods(NO_MODS, { haste: { until: T0 - 1, power: 50 }, net: { until: T0 - 1, power: 120 } }, T0);
    expect(out).toEqual(NO_MODS);
  });

  it('clamps haste at 20% of the search time', () => {
    expect(buffedMods(NO_MODS, { haste: { until: T0 + 1, power: 150 } }, T0).searchTimeMul).toBeCloseTo(0.2);
  });

  it('never mutates the base mods', () => {
    const mods = { ...NO_MODS };
    const out = buffedMods(mods, { haste: { until: T0 + 1, power: 50 }, net: { until: T0 + 1, power: 120 } }, T0);
    expect(mods).toEqual(NO_MODS);
    expect(out).not.toBe(mods);
  });
});

describe('party', () => {
  it('recruits only after discovering the ally and building the module bench', () => {
    const s = rich();
    expect(recruit(s, 'cobalto').ok).toBe(false);
    discover(s, 'automaton');
    expect(recruit(s, 'cobalto').ok).toBe(false);
    buildNode(s, 'b_workshop');
    buildNode(s, 'b_bench_modules');
    addItems(s, { reagent_ward: 2 });
    expect(recruit(s, 'cobalto').ok).toBe(true);
    expect(countOf(s, 'reagent_ward')).toBe(0);
    expect(recruit(s, 'cobalto').ok).toBe(false);
    expect(s.ferro.formation).toEqual({ front: 'ferrugem', back: 'cobalto' });
  });

  it('activates a synergy by formation and swaps members between slots', () => {
    const s = rich();
    discover(s, 'automaton');
    buildNode(s, 'b_workshop');
    buildNode(s, 'b_bench_modules');
    addItems(s, { reagent_ward: 2 });
    recruit(s, 'cobalto');
    expect(activeSynergies(s).map((x) => x.id)).toEqual(['resonance']);
    expect(ferroMods(s).spellCooldownMul).toBeCloseTo(0.8);
    const def = playerStats(s).defesa;
    expect(setFormation(s, 'front', 'cobalto').ok).toBe(true);
    expect(s.ferro.formation).toEqual({ front: 'cobalto', back: 'ferrugem' });
    expect(activeSynergies(s).map((x) => x.id)).toEqual(['bulwark']);
    expect(playerStats(s).defesa).toBe(def + 4);
    setFormation(s, 'back', null);
    expect(activeSynergies(s)).toEqual([]);
  });

  it('refuses an empty formation and unrecruited members', () => {
    const s = newGame(T0);
    expect(setFormation(s, 'front', 'cobalto').ok).toBe(false);
    expect(setFormation(s, 'front', null).ok).toBe(false);
    expect(s.ferro.formation.front).toBe('ferrugem');
  });
});

describe('save v3', () => {
  it('migrates a v2 save with an empty Ferromancia block', () => {
    const v2 = JSON.stringify({ version: 2, currency: 50, inventory: { scrap: 5 }, equipped: { tool: 'tool_wrench_old' }, flags: { intro_seen: true }, stats: { kills: 3, searches: 1, extractions: 0 } });
    const s = parseSave(v2, T0);
    expect(s.version).toBe(3);
    expect(s.currency).toBe(50);
    expect(s.ferro).toEqual(newGame(T0).ferro);
  });

  it('round-trips progress and drops unknown or inconsistent ids', () => {
    const s = mage();
    equipSpell(s, 1, 'spell_ember');
    const raw = JSON.parse(JSON.stringify(s));
    raw.ferro.built.push('b_hacked', 'b_workshop');
    raw.ferro.loadout = ['spell_ember', 'spell_ember', 'spell_fake'];
    raw.ferro.formation = { front: 'cobalto', back: 'ferrugem' };
    const back = parseSave(JSON.stringify(raw), T0);
    expect(back.ferro.built).toEqual(['b_workshop', 'b_alchemy']);
    expect(back.ferro.learned).toEqual(s.ferro.learned);
    expect(back.ferro.loadout).toEqual(['spell_ember', null, null]);
    expect(back.ferro.formation).toEqual({ front: null, back: 'ferrugem' });
  });
});
