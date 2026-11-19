import { ITEMS } from '../data/items';
import { playerStats } from './derived';
import type { Result } from './economy';
import type { ManaHolder } from './spells';
import { countOf, removeItems, type GameState } from './state';

export const BASE_MANA = 30;
export const MANA_PER_LEVEL = 5;
export const MAX_LEVEL = 30;
export const CRYSTAL_BONUS = 5;
export const FLASK_RESTORE = 30;
export const OUT_OF_COMBAT_MS = 4000;

export type { ManaHolder };
export interface LevelInfo { level: number; xp: number; into: number; need: number }

/** XP is derived from saved stats, so old saves get their level without migration. */
export function xpOf(state: GameState): number {
  const { kills, searches, extractions } = state.stats;
  return kills * 10 + searches * 4 + extractions * 25 + state.ferro.built.length * 15 + state.ferro.learned.length * 10;
}

export function xpForLevel(level: number): number {
  return (60 * level * (level - 1)) / 2;
}

export function levelOf(state: GameState): LevelInfo {
  const xp = xpOf(state);
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const need = level >= MAX_LEVEL ? 0 : xpForLevel(level + 1) - floor;
  return { level, xp, into: xp - floor, need };
}

export function maxMana(state: GameState): number {
  return BASE_MANA + MANA_PER_LEVEL * (levelOf(state).level - 1) + playerStats(state).mana + state.ferro.manaBonus;
}

export function manaRegen(outOfCombat: boolean): number {
  return outOfCombat ? 4 : 2;
}

export function useItem(state: GameState, id: 'ether_crystal' | 'mana_flask', mana: ManaHolder): Result {
  if (countOf(state, id) < 1) return { ok: false, msg: `Sem ${ITEMS[id].name}.` };
  if (id === 'ether_crystal') {
    removeItems(state, { ether_crystal: 1 });
    state.ferro.manaBonus += CRYSTAL_BONUS;
    return { ok: true, msg: `+${CRYSTAL_BONUS} de mana máxima.` };
  }
  const max = maxMana(state);
  if (mana.value >= max) return { ok: false, msg: 'Mana já está cheia.' };
  removeItems(state, { mana_flask: 1 });
  mana.value = Math.min(max, mana.value + FLASK_RESTORE);
  return { ok: true, msg: `+${FLASK_RESTORE} de mana.` };
}
