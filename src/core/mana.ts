import { ITEMS } from '../data/items';
import { playerStats } from './derived';
import { levelOf } from './level';
import type { Result } from './economy';
import type { ManaHolder } from './spells';
import { countOf, removeItems, type GameState } from './state';

export const BASE_MANA = 30;
export const MANA_PER_LEVEL = 5;
/** Levels past this only open hunt regions; mana keeps the old Nv 30 ceiling. */
export const MANA_LEVEL_CAP = 30;
export const CRYSTAL_BONUS = 5;
export const FLASK_RESTORE = 30;
export const OUT_OF_COMBAT_MS = 4000;

export type { ManaHolder };
// ui/panels.ts imports levelOf from here; kept so that file needs no edit.
export { levelOf } from './level';

export function maxMana(state: GameState): number {
  return BASE_MANA + MANA_PER_LEVEL * (Math.min(levelOf(state).level, MANA_LEVEL_CAP) - 1) + playerStats(state).mana + state.ferro.manaBonus;
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
