import { ITEMS, type EquipSlot, type ItemBag, type ItemId } from '../data/items';
import { RECIPE_BY_ID, type Recipe } from '../data/recipes';
import { BAG_FULL_MSG } from '../data/bag';
import { VENDOR_OFFERS } from '../data/vendor';
import { fitsAll, swapFits } from './bag';
import { addItems, bagStacks, countOf, removeItems, BAG_CAPACITY, type GameState } from './state';

export type Result = { ok: true; msg: string } | { ok: false; msg: string };
const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export function missingFor(state: GameState, recipe: Recipe): ItemBag {
  const missing: ItemBag = {};
  for (const [id, qty] of Object.entries(recipe.inputs) as [ItemId, number][]) {
    const lack = qty - countOf(state, id);
    if (lack > 0) missing[id] = lack;
  }
  return missing;
}

export function recipeKnown(state: GameState, recipe: Recipe): boolean {
  return !recipe.requiresFlag || !!state.flags[recipe.requiresFlag];
}

export function craft(state: GameState, recipeId: string): Result {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return fail('Receita desconhecida.');
  if (!recipeKnown(state, recipe)) return fail('Você ainda não tem o projeto desta receita.');
  const outSlot = ITEMS[recipe.output].slot;
  const autoEquip = !!recipe.equipsOutput && !!outSlot && state.equipped[outSlot] === null;
  if (recipe.equipsOutput && outSlot && !autoEquip) return fail(`Já existe um ${ITEMS[recipe.output].name} montado.`);
  if (!autoEquip && !swapFits(state, recipe.inputs, { [recipe.output]: 1 })) return fail(`${BAG_FULL_MSG}.`);
  if (!removeItems(state, recipe.inputs)) return fail('Faltam peças.');
  if (autoEquip && outSlot) {
    state.equipped[outSlot] = recipe.output;
    for (const [slot, item] of Object.entries(recipe.installs ?? {}) as [EquipSlot, ItemId][]) state.equipped[slot] = item;
  } else {
    addItems(state, { [recipe.output]: 1 });
  }
  if (recipe.output === 'drone_spark') state.flags.drone_built = true;
  return ok(`${recipe.name} montado.`);
}

export function equip(state: GameState, id: ItemId): Result {
  const slot = ITEMS[id].slot;
  if (!slot) return fail('Este item não é equipável.');
  if (countOf(state, id) < 1) return fail('Item não está no inventário.');
  if ((slot === 'module' || slot === 'upgrade') && !state.equipped.drone) return fail('Monte o drone antes.');
  const previous = state.equipped[slot];
  if (previous && previous !== id && countOf(state, id) > 1 && bagStacks(state.inventory) >= BAG_CAPACITY) return fail('Mochila cheia: não há espaço para guardar o item removido.');
  removeItems(state, { [id]: 1 });
  if (previous) addItems(state, { [previous]: 1 });
  state.equipped[slot] = id;
  return ok(`${ITEMS[id].name} equipado.`);
}

export function unequip(state: GameState, slot: EquipSlot): Result {
  const current = state.equipped[slot];
  if (!current) return fail('Slot vazio.');
  if (slot === 'drone') return fail('O drone fica montado no protótipo.');
  if (slot === 'module' && state.afk) return fail('O drone está em extração.');
  if (bagStacks(state.inventory) >= BAG_CAPACITY) return fail('Mochila cheia. Libere um espaço antes de retirar.');
  state.equipped[slot] = null;
  addItems(state, { [current]: 1 });
  return ok(`${ITEMS[current].name} voltou ao inventário.`);
}

export function dismantle(state: GameState, id: ItemId): Result {
  const out = ITEMS[id].dismantle;
  if (!out) return fail('Não dá para desmontar isto.');
  if (countOf(state, id) > 0 && !swapFits(state, { [id]: 1 }, out)) return fail(`${BAG_FULL_MSG}.`);
  if (!removeItems(state, { [id]: 1 })) return fail('Item não está no inventário.');
  addItems(state, out);
  return ok(`${ITEMS[id].name} desmontado.`);
}

export function sell(state: GameState, id: ItemId, qty: number): Result {
  const price = ITEMS[id].sell;
  if (price <= 0) return fail('A comerciante não compra isto.');
  if (qty < 1 || !removeItems(state, { [id]: qty })) return fail('Quantidade indisponível.');
  state.currency += price * qty;
  return ok(`Vendido: ${qty}× ${ITEMS[id].name} por ${price * qty} cr.`);
}

export function offerAvailable(state: GameState, offerId: string): boolean {
  const offer = VENDOR_OFFERS.find((o) => o.id === offerId);
  return !!offer && !(offer.grantsFlag && state.flags[offer.grantsFlag]);
}

export function buy(state: GameState, offerId: string): Result {
  const offer = VENDOR_OFFERS.find((o) => o.id === offerId);
  if (!offer || !offerAvailable(state, offerId)) return fail('Oferta indisponível.');
  if (state.currency < offer.price) return fail('Créditos insuficientes.');
  if (offer.item && !fitsAll(state, { [offer.item]: 1 })) return fail(`${BAG_FULL_MSG}.`);
  state.currency -= offer.price;
  if (offer.item) addItems(state, { [offer.item]: 1 });
  if (offer.grantsFlag) state.flags[offer.grantsFlag] = true;
  return ok(`Comprado: ${offer.name}.`);
}
