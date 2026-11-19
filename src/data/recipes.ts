import type { EquipSlot, ItemBag, ItemId } from './items';
import type { FlagId } from '../core/state';

export interface Recipe {
  id: string;
  name: string;
  output: ItemId;
  inputs: ItemBag;
  effect: string;
  requiresFlag?: FlagId;
  /** Output goes straight to its equip slot when the slot is empty. */
  equipsOutput?: boolean;
  /** Inputs that move into an equip slot instead of being destroyed. */
  installs?: Partial<Record<EquipSlot, ItemId>>;
}

export const RECIPES: Recipe[] = [
  {
    id: 'rcp_mod_claw',
    name: 'Módulo de Garra',
    output: 'mod_claw',
    inputs: { gear: 2, cable: 1, scrap: 4 },
    effect: 'Módulo básico de drone: faíscas automáticas em combate.',
  },
  {
    id: 'rcp_drone_spark',
    name: 'Drone Faísca',
    output: 'drone_spark',
    inputs: { drone_chassis: 1, pulse_core: 1, mod_claw: 1, scrap: 6 },
    effect: 'Chassi + núcleo + módulo. O drone volta a voar, luta ao seu lado e libera a extração automática.',
    equipsOutput: true,
    installs: { module: 'mod_claw' },
  },
  {
    id: 'rcp_mod_magnet',
    name: 'Módulo Magnético',
    output: 'mod_magnet',
    inputs: { relic_crane_coil: 1, cable: 2, gear: 1 },
    effect: 'Consome a Bobina. O drone passa a puxar e atordoar inimigos leves; na extração, dobra a chance de raros.',
  },
  {
    id: 'rcp_mod_cargo',
    name: 'Compartimento de Carga',
    output: 'mod_cargo',
    inputs: { gear: 3, servo: 1, scrap: 8 },
    effect: '+6 de carga por extração.',
    requiresFlag: 'bp_cargo',
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
