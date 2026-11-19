import { ADVANTAGE, ELEMENT_IDS, ELEMENTS, type ElementId } from '../data/elements';

export const STRONG_MUL = 2;
export const RESIST_MUL = 0.5;

/** Neutral attacks and neutral defenders (null/undefined) always deal ×1. */
export function elementMul(attack: ElementId | null | undefined, defend: ElementId | null | undefined): number {
  if (!attack || !defend) return 1;
  const row = ADVANTAGE[attack];
  if (row.strong.includes(defend)) return STRONG_MUL;
  if (row.resistedBy.includes(defend)) return RESIST_MUL;
  return 1;
}

/** Defender elements that take ×2 from `attack` (map filter "Fraco contra"). */
export function weakTo(attack: ElementId): ElementId[] {
  return ELEMENT_IDS.filter((d) => elementMul(attack, d) === STRONG_MUL);
}

/** Defender elements that resist `attack` (map filter "Forte contra"). */
export function strongAgainst(attack: ElementId): ElementId[] {
  return ELEMENT_IDS.filter((d) => elementMul(attack, d) === RESIST_MUL);
}

export function elementDamage(base: number, attack: ElementId | null | undefined, defend: ElementId | null | undefined): { amount: number; mul: number } {
  const mul = elementMul(attack, defend);
  return { amount: Math.max(1, Math.round(base * mul)), mul };
}

export function elementTint(el: ElementId): number {
  return parseInt(ELEMENTS[el].color.slice(1), 16);
}
