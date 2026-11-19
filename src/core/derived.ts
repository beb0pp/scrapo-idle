import type { GameState } from './state';
import type { ElementId } from '../data/elements';
import { ITEMS, type ItemId } from '../data/items';
import { ferroMods } from './progression';

export const BASE_DRONE_CAPACITY = 10;
export const PULSE_RADIUS = 72;
export const ARC_JUMPS = 3;

export interface PlayerStats { combate: number; extracao: number; defesa: number; vida: number; sorte: number; mana: number }
export function playerStats(s: GameState): PlayerStats {
  const total: PlayerStats = { combate: 0, extracao: 0, defesa: 0, vida: 100, sorte: 0, mana: 0 };
  for (const id of Object.values(s.equipped).filter((id): id is ItemId => id !== null)) {
    for (const [key, value] of Object.entries(ITEMS[id].stats ?? {})) total[key as keyof PlayerStats] += value ?? 0;
  }
  const mods = ferroMods(s);
  total.combate += mods.combate;
  total.extracao += mods.extracao;
  total.defesa += mods.defesa;
  total.sorte += mods.sorte;
  return total;
}

export function droneCapacity(s: GameState): number {
  return BASE_DRONE_CAPACITY + (s.equipped.upgrade === 'mod_cargo' ? 6 : 0) + ferroMods(s).droneCapacity;
}

export function afkRareFactor(s: GameState): number {
  return s.equipped.module === 'mod_magnet' ? 2 : 1;
}

export function pulseRadius(s: GameState): number {
  return s.equipped.relic === 'relic_crane_coil' ? PULSE_RADIUS * 1.5 : PULSE_RADIUS;
}

export function arcJumps(s: GameState): number {
  return ARC_JUMPS + (s.equipped.relic === 'relic_capacitor' ? 2 : 0);
}

/** Element of the hero's melee hit, from the equipped tool; null = neutral. */
export function meleeElement(s: GameState): ElementId | null {
  const tool = s.equipped.tool;
  return (tool && ITEMS[tool].element) || null;
}

export function droneReady(s: GameState): boolean {
  return s.equipped.drone !== null && s.equipped.module !== null;
}
