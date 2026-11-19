import { describe, expect, it } from 'vitest';
import { SKILL_NODES, SPELLS } from '../data/ferromancy';
import { elementDamage } from './elements';
import {
  ACID_RADIUS, acidSplashTargets, acidTickCount, acidTickDamage, chainDamage, chainTargets,
  CHAIN_JUMP_RANGE, CRUSH_RADIUS, crushDamage, crushTargets,
} from './attackSpells';

const at = (x: number, y = 0) => ({ x, y });

describe('attack spell catalogue', () => {
  it('gives each element without an attack spell its own one', () => {
    expect(SPELLS.spell_arc.element).toBe('eletrico');
    expect(SPELLS.spell_crush.element).toBe('magnetico');
    expect(SPELLS.spell_acid.element).toBe('corrosivo');
    for (const id of ['spell_arc', 'spell_crush', 'spell_acid'] as const) {
      expect(SPELLS[id].school).toBe('ataque');
      expect(SPELLS[id].target).toBe('enemy');
      expect(Object.values(SKILL_NODES).some((n) => n.unlocksSpell === id)).toBe(true);
    }
  });

  it('keeps every spell colour on its own hue', () => {
    const colors = Object.values(SPELLS).map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('Arco Encadeado: chain', () => {
  it('hops to the nearest unhit enemy, at most three jumps', () => {
    const a = at(0), b = at(40), c = at(80), d = at(120), e = at(160);
    expect(chainTargets(a, [e, d, c, b, a])).toEqual([a, b, c, d]);
  });

  it('stops when the next enemy is out of jump range and never hits one twice', () => {
    const a = at(0), b = at(30), far = at(30 + CHAIN_JUMP_RANGE + 1);
    expect(chainTargets(a, [a, b, far])).toEqual([a, b]);
    expect(chainTargets(a, [a])).toEqual([a]);
  });

  it('loses a quarter of the damage per jump, never below 1', () => {
    expect([0, 1, 2, 3].map((hop) => chainDamage(18, hop))).toEqual([18, 14, 10, 8]);
    expect(chainDamage(1, 3)).toBe(1);
  });

  it('is doubled on Corrosivo and halved on Magnético', () => {
    expect(elementDamage(chainDamage(18, 0), SPELLS.spell_arc.element, 'corrosivo').amount).toBe(36);
    expect(elementDamage(chainDamage(18, 0), SPELLS.spell_arc.element, 'magnetico').amount).toBe(9);
  });
});

describe('Prensa Magnética: pull and crush', () => {
  it('catches only enemies inside the radius', () => {
    const near = at(CRUSH_RADIUS), out = at(CRUSH_RADIUS + 1);
    expect(crushTargets(at(0), [near, out])).toEqual([near]);
  });

  it('crushes harder the more bodies it catches, capped at three extras', () => {
    expect(crushDamage(16, 1)).toBe(16);
    expect(crushDamage(16, 2)).toBe(20);
    expect(crushDamage(16, 4)).toBe(28);
    expect(crushDamage(16, 9)).toBe(28);
  });

  it('is doubled on Elétrico', () => {
    expect(elementDamage(crushDamage(16, 1), SPELLS.spell_crush.element, 'eletrico').amount).toBe(32);
  });
});

describe('Respingo Ácido: splash and puddle', () => {
  it('splashes everyone inside the radius', () => {
    const hit = at(ACID_RADIUS - 1, 0), miss = at(0, ACID_RADIUS + 1);
    expect(acidSplashTargets(at(0), [hit, miss])).toEqual([hit]);
  });

  it('ticks a fifth of the power, six times over three seconds', () => {
    expect(acidTickDamage(14)).toBe(3);
    expect(acidTickDamage(2)).toBe(1);
    expect(acidTickCount()).toBe(6);
  });

  it('is doubled on Blindado', () => {
    expect(elementDamage(acidTickDamage(14), SPELLS.spell_acid.element, 'blindado').amount).toBe(6);
  });
});
