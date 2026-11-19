import type { ItemKind } from './items';

export const BAG_SLOTS = 24;
export const SLOT_STACK = 100;
export const BAG_WARN_RATIO = 0.9;
export const BAG_FULL_MSG = 'Mochila cheia: venda ou desmonte peças';

// Only loose loot materials take slots; quest parts, gear, drone pieces and tools never do.
export const SLOT_KINDS: readonly ItemKind[] = ['scrap', 'component', 'reagent', 'consumable'];
