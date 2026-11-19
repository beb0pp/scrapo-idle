import type { EquipSlot, ItemId } from '../data/items';

/** Items with a baked overlay sheet in public/sprites/gear/ (see tools/hero_gear.py). */
export const HERO_GEAR: readonly ItemId[] = [
  'head_scrap_cap',
  'body_work_jacket',
  'hands_grip_gloves',
  'feet_rail_boots',
  'accessory_lucky_bolt',
  'tool_wrench_reinforced',
  'tool_hydraulic_pry',
];

/** Draw order on the hero, back to front. */
export const GEAR_LAYERS: readonly EquipSlot[] = ['feet', 'body', 'hands', 'accessory', 'head', 'tool'];

export const gearTexture = (id: ItemId) => `gear_${id}`;
export const gearPortraitUrl = (id: ItemId) => `sprites/gear/${id}-portrait.png`;
export const hasGearArt = (id: ItemId | null): id is ItemId => !!id && HERO_GEAR.includes(id);
