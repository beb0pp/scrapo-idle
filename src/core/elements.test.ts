import { describe, expect, it } from 'vitest';
import { elementChip } from '../ui/elementChip';
import { ADVANTAGE, ELEMENT_IDS, ELEMENTS } from '../data/elements';
import { ENEMY_INFO, ENEMY_KINDS, killXp } from '../data/enemies';
import { SPELLS } from '../data/ferromancy';
import { ITEMS } from '../data/items';
import { elementDamage, elementMul, elementTint, strongAgainst, weakTo } from './elements';

describe('elementMul', () => {
  it('doubles a thematic counter: heat past the Curie point beats magnets', () => {
    expect(elementMul('termico', 'magnetico')).toBe(2);
    expect(elementMul('corrosivo', 'blindado')).toBe(2);
  });

  it('halves a resisted hit, including an element against itself', () => {
    expect(elementMul('termico', 'blindado')).toBe(0.5);
    expect(elementMul('eletrico', 'eletrico')).toBe(0.5);
  });

  it('is neutral for unrelated pairs and for neutral attacks or defenders', () => {
    expect(elementMul('termico', 'corrosivo')).toBe(1);
    expect(elementMul(null, 'blindado')).toBe(1);
    expect(elementMul(undefined, 'blindado')).toBe(1);
    expect(elementMul('termico', null)).toBe(1);
  });
});

describe('advantage chart balance', () => {
  it('gives every element 1–2 strengths and 1–2 resistances that never overlap', () => {
    for (const el of ELEMENT_IDS) {
      const { strong, resistedBy } = ADVANTAGE[el];
      expect(strong.length).toBeGreaterThanOrEqual(1);
      expect(strong.length).toBeLessThanOrEqual(2);
      expect(resistedBy.length).toBeGreaterThanOrEqual(1);
      expect(resistedBy.length).toBeLessThanOrEqual(2);
      expect(strong.filter((d) => resistedBy.includes(d))).toEqual([]);
    }
  });

  it('makes every element weak to exactly two others, so no element is a free pick', () => {
    for (const el of ELEMENT_IDS) expect(ELEMENT_IDS.filter((a) => elementMul(a, el) === 2)).toHaveLength(2);
  });

  it('never lets two elements both beat each other', () => {
    for (const a of ELEMENT_IDS) for (const d of ELEMENT_IDS) if (elementMul(a, d) === 2) expect(elementMul(d, a)).not.toBe(2);
  });
});

describe('filter helpers (attack element → defender elements)', () => {
  it('weakTo lists defenders that take ×2 from the attack', () => {
    expect(weakTo('termico')).toEqual(['eletrico', 'magnetico']);
  });

  it('strongAgainst lists defenders that resist the attack', () => {
    expect(strongAgainst('termico')).toEqual(['termico', 'blindado']);
  });
});

describe('elementDamage', () => {
  it('rounds the scaled hit and never drops below 1', () => {
    expect(elementDamage(24, 'termico', 'eletrico')).toEqual({ amount: 48, mul: 2 });
    expect(elementDamage(7, 'termico', 'blindado')).toEqual({ amount: 4, mul: 0.5 });
    expect(elementDamage(1, 'termico', 'blindado')).toEqual({ amount: 1, mul: 0.5 });
    expect(elementDamage(10, null, 'blindado')).toEqual({ amount: 10, mul: 1 });
  });
});

describe('element data', () => {
  it('uses distinct colours and parses them to Phaser tints', () => {
    const colors = ELEMENT_IDS.map((el) => ELEMENTS[el].color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
    expect(elementTint('termico')).toBe(0xf08a3a);
  });

  it('renders the UI chip with the element hook and its data colour', () => {
    const chip = elementChip('termico');
    expect(chip).toContain('data-el="termico"');
    expect(chip).toContain('--el:#f08a3a');
    expect(chip).toContain('>Térmico</span>');
  });

  it('tags every enemy kind and keeps kill XP derived from hp', () => {
    for (const kind of ENEMY_KINDS) expect(ELEMENT_IDS).toContain(ENEMY_INFO[kind].element);
    expect(ENEMY_INFO.sparkbot.element).toBe('eletrico');
    expect(ENEMY_INFO.magnetron.element).toBe('magnetico');
    expect(killXp('scrapgolem')).toBeGreaterThan(killXp('sparkbot'));
  });

  it('tags the elemental spells and leaves the others neutral', () => {
    expect(SPELLS.spell_ember.element).toBe('termico');
    expect(SPELLS.spell_lodestone.element).toBe('magnetico');
    expect(SPELLS.spell_ward.element).toBeUndefined();
    expect(ITEMS.tool_hydraulic_pry.element).toBe('blindado');
    expect(ITEMS.tool_wrench_old.element).toBeUndefined();
  });
});
