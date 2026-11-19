import type { ItemId } from './items';
import type { FlagId } from '../core/state';

export interface LootEntry {
  item: ItemId;
  weight: number;
  min: number;
  max: number;
  rare?: boolean;
}

export const AFK_AREA_IDS = ['afk_yard_edge', 'afk_sorting'] as const;
export type AfkAreaId = (typeof AFK_AREA_IDS)[number];

export interface AfkArea {
  id: AfkAreaId;
  name: string;
  desc: string;
  cycleMs: number;
  requiresFlag: FlagId;
  loot: LootEntry[];
}

export const AFK_AREAS: Record<AfkAreaId, AfkArea> = {
  afk_yard_edge: {
    id: 'afk_yard_edge',
    name: 'Borda do Pátio Ferroviário',
    desc: 'Vagões tombados perto da entrada. Muita sucata, pouca surpresa.',
    cycleMs: 6000,
    requiresFlag: 'drone_built',
    loot: [
      { item: 'scrap', weight: 60, min: 1, max: 3 },
      { item: 'gear', weight: 16, min: 1, max: 1 },
      { item: 'cable', weight: 13, min: 1, max: 1 },
      { item: 'servo', weight: 6, min: 1, max: 1, rare: true },
      { item: 'cell', weight: 4, min: 1, max: 1, rare: true },
      { item: 'relic_capacitor', weight: 1, min: 1, max: 1, rare: true },
    ],
  },
  afk_sorting: {
    id: 'afk_sorting',
    name: 'Estação de Triagem Soterrada',
    desc: 'Liberada ao derrotar o Guindaste. Esteiras cheias de componentes.',
    cycleMs: 8000,
    requiresFlag: 'boss_defeated',
    loot: [
      { item: 'scrap', weight: 38, min: 2, max: 3 },
      { item: 'gear', weight: 18, min: 1, max: 2 },
      { item: 'cable', weight: 16, min: 1, max: 2 },
      { item: 'servo', weight: 14, min: 1, max: 1, rare: true },
      { item: 'cell', weight: 10, min: 1, max: 1, rare: true },
      { item: 'relic_capacitor', weight: 4, min: 1, max: 1, rare: true },
    ],
  },
};

/** Manual search tables for piles placed on maps (Tiled property `loot`). */
export const PILE_TABLES: Record<string, { rolls: number; loot: LootEntry[] }> = {
  yard_pile: {
    rolls: 2,
    loot: [
      { item: 'scrap', weight: 48, min: 2, max: 4 },
      { item: 'gear', weight: 22, min: 1, max: 1 },
      { item: 'cable', weight: 18, min: 1, max: 1 },
      { item: 'servo', weight: 8, min: 1, max: 1 },
      { item: 'cell', weight: 4, min: 1, max: 1 },
    ],
  },
  dungeon_pile: {
    rolls: 2,
    loot: [
      { item: 'scrap', weight: 30, min: 2, max: 4 },
      { item: 'gear', weight: 24, min: 1, max: 2 },
      { item: 'cable', weight: 24, min: 1, max: 2 },
      { item: 'servo', weight: 14, min: 1, max: 1 },
      { item: 'cell', weight: 8, min: 1, max: 1 },
    ],
  },
  wreck_car: {
    rolls: 3,
    loot: [
      { item: 'scrap', weight: 40, min: 2, max: 4 },
      { item: 'cable', weight: 25, min: 1, max: 2 },
      { item: 'servo', weight: 15, min: 1, max: 1 },
      { item: 'cell', weight: 12, min: 1, max: 1 },
      { item: 'gear', weight: 8, min: 1, max: 1 },
    ],
  },
  wreck_loco: {
    rolls: 3,
    loot: [
      { item: 'scrap', weight: 35, min: 3, max: 5 },
      { item: 'gear', weight: 25, min: 1, max: 2 },
      { item: 'cable', weight: 20, min: 1, max: 2 },
      { item: 'servo', weight: 12, min: 1, max: 1 },
      { item: 'cell', weight: 8, min: 1, max: 1 },
    ],
  },
  wreck_appliance: {
    rolls: 2,
    loot: [
      { item: 'scrap', weight: 50, min: 1, max: 3 },
      { item: 'cable', weight: 35, min: 1, max: 1 },
      { item: 'gear', weight: 15, min: 1, max: 1 },
    ],
  },
  wreck_robot: {
    rolls: 2,
    loot: [
      { item: 'servo', weight: 30, min: 1, max: 1 },
      { item: 'gear', weight: 25, min: 1, max: 2 },
      { item: 'cell', weight: 15, min: 1, max: 1 },
      { item: 'scrap', weight: 30, min: 1, max: 3 },
    ],
  },
  wreck_engine: {
    rolls: 2,
    loot: [
      { item: 'gear', weight: 45, min: 1, max: 2 },
      { item: 'servo', weight: 20, min: 1, max: 1 },
      { item: 'scrap', weight: 35, min: 2, max: 3 },
    ],
  },
  wreck_small: {
    rolls: 1,
    loot: [
      { item: 'scrap', weight: 70, min: 1, max: 3 },
      { item: 'gear', weight: 15, min: 1, max: 1 },
      { item: 'cable', weight: 15, min: 1, max: 1 },
    ],
  },
  ground_scrap: {
    rolls: 1,
    loot: [
      { item: 'scrap', weight: 80, min: 1, max: 2 },
      { item: 'gear', weight: 10, min: 1, max: 1 },
      { item: 'cable', weight: 10, min: 1, max: 1 },
    ],
  },
  // Hunt areas (data/hunt.ts): piles and enemy drops of one region share its table.
  hunt_rust: {
    rolls: 2,
    loot: [
      { item: 'scrap', weight: 50, min: 2, max: 4 },
      { item: 'gear', weight: 20, min: 1, max: 1 },
      { item: 'cable', weight: 20, min: 1, max: 1 },
      { item: 'servo', weight: 7, min: 1, max: 1 },
      { item: 'cell', weight: 3, min: 1, max: 1 },
    ],
  },
  hunt_foundry: {
    rolls: 2,
    loot: [
      { item: 'scrap', weight: 36, min: 3, max: 5 },
      { item: 'gear', weight: 26, min: 1, max: 2 },
      { item: 'cable', weight: 16, min: 1, max: 2 },
      { item: 'servo', weight: 12, min: 1, max: 1 },
      { item: 'cell', weight: 8, min: 1, max: 1 },
      { item: 'ether_shard', weight: 2, min: 1, max: 1 },
    ],
  },
  hunt_flooded: {
    rolls: 3,
    loot: [
      { item: 'scrap', weight: 30, min: 3, max: 5 },
      { item: 'cable', weight: 24, min: 1, max: 2 },
      { item: 'cell', weight: 16, min: 1, max: 1 },
      { item: 'servo', weight: 16, min: 1, max: 1 },
      { item: 'gear', weight: 10, min: 1, max: 2 },
      { item: 'ether_shard', weight: 4, min: 1, max: 1 },
    ],
  },
  hunt_magnetic: {
    rolls: 3,
    loot: [
      { item: 'scrap', weight: 26, min: 4, max: 6 },
      { item: 'servo', weight: 22, min: 1, max: 2 },
      { item: 'cell', weight: 20, min: 1, max: 2 },
      { item: 'gear', weight: 16, min: 1, max: 2 },
      { item: 'ether_shard', weight: 10, min: 1, max: 1 },
      { item: 'relic_capacitor', weight: 1, min: 1, max: 1 },
    ],
  },
  hunt_core: {
    rolls: 3,
    loot: [
      { item: 'scrap', weight: 22, min: 5, max: 8 },
      { item: 'servo', weight: 22, min: 1, max: 2 },
      { item: 'cell', weight: 22, min: 1, max: 2 },
      { item: 'ether_shard', weight: 16, min: 1, max: 2 },
      { item: 'gear', weight: 14, min: 2, max: 3 },
      { item: 'ether_crystal', weight: 2, min: 1, max: 1 },
      { item: 'relic_capacitor', weight: 2, min: 1, max: 1 },
    ],
  },
  enemy_drop: {
    rolls: 1,
    loot: [
      { item: 'scrap', weight: 70, min: 1, max: 2 },
      { item: 'gear', weight: 18, min: 1, max: 1 },
      { item: 'cable', weight: 12, min: 1, max: 1 },
    ],
  },
};
