import { ALLIES, SPELLS, TRANSMUTES, type AllyId, type FormationSlot, type MemberId, type SpellId, type TransmuteId } from '../data/ferromancy';
import { ITEMS } from '../data/items';
import type { Result } from './economy';
import { alchemyUnlocked, ferroMods, owns, unlockedSpells } from './progression';
import { addItems, hasItems, removeItems, type GameState } from './state';

const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

/** Runtime only (never saved): spell id -> time it is ready again, in the scene clock. */
export type SpellCooldowns = Partial<Record<SpellId, number>>;

export function spellCooldownMs(state: GameState, id: SpellId): number {
  return Math.round(SPELLS[id].cooldownMs * ferroMods(state).spellCooldownMul);
}

export const EMPOWER_MUL = 1.5;

export function spellPower(state: GameState, id: SpellId, empowered = false): number {
  const mods = ferroMods(state);
  const base = SPELLS[id].power * mods.spellPowerMul * (empowered ? EMPOWER_MUL : 1);
  return Math.round(id === 'spell_ward' ? base * mods.wardMul : base);
}

export function equipSpell(state: GameState, slot: number, id: SpellId | null): Result {
  if (slot < 0 || slot > 2) return fail('Espaço de feitiço inválido.');
  if (id && !unlockedSpells(state).includes(id)) return fail('Feitiço ainda não aprendido.');
  const loadout = state.ferro.loadout;
  if (id) {
    const other = loadout.indexOf(id);
    if (other >= 0) loadout[other] = null;
  }
  loadout[slot] = id;
  return ok(id ? `${SPELLS[id].name} pronto no atalho ${'ZXC'[slot]}.` : 'Atalho livre.');
}

export interface ManaHolder { value: number }
export type CastResult = { ok: true; msg: string; empowered: boolean } | { ok: false; msg: string };

/** Reforço: the spell's reagent is in stock, so it is consumed for +50% power. */
export function canEmpower(state: GameState, id: SpellId): boolean {
  return hasItems(state, SPELLS[id].cost);
}

/** Same gate for manual and Auto: learned, equipped, off cooldown and enough mana. */
export function castProblem(state: GameState, cds: SpellCooldowns, id: SpellId, now: number, mana: ManaHolder): string | null {
  const spell = SPELLS[id];
  if (!unlockedSpells(state).includes(id)) return 'Feitiço ainda não aprendido.';
  if (!state.ferro.loadout.includes(id)) return 'Equipe o feitiço num atalho (Z X C).';
  if ((cds[id] ?? 0) > now) return `${spell.name} recarregando.`;
  if (mana.value < spell.mana) return 'Mana insuficiente.';
  return null;
}

/** Pays mana (and the reagent when in stock) once and starts the cooldown. The scene applies the effect only when this succeeds. */
export function castSpell(state: GameState, cds: SpellCooldowns, id: SpellId, now: number, mana: ManaHolder): CastResult {
  const problem = castProblem(state, cds, id, now, mana);
  if (problem) return { ok: false, msg: problem };
  mana.value -= SPELLS[id].mana;
  const empowered = removeItems(state, SPELLS[id].cost);
  cds[id] = now + spellCooldownMs(state, id);
  return { ok: true, msg: SPELLS[id].name, empowered };
}

export function transmute(state: GameState, id: TransmuteId): Result {
  const t = TRANSMUTES[id];
  if (!t) return fail('Transmutação desconhecida.');
  if (!alchemyUnlocked(state)) return fail('Construa a Estação Alquímica.');
  if (!removeItems(state, t.inputs)) return fail('Faltam materiais.');
  const qty = t.qty + ferroMods(state).transmuteBonus;
  addItems(state, { [t.output]: qty });
  return ok(`Transmutado: ${qty}× ${ITEMS[t.output].name}.`);
}

// ---------------- party ----------------

export function discover(state: GameState, id: GameState['ferro']['discovered'][number]): boolean {
  if (state.ferro.discovered.includes(id)) return false;
  state.ferro.discovered.push(id);
  return true;
}

export function recruitProblem(state: GameState, id: AllyId): string | null {
  const ally = ALLIES[id];
  if (!ally) return 'Aliado desconhecido.';
  if (state.ferro.recruited.includes(id)) return `${ally.name} já está na equipe.`;
  if (!state.ferro.discovered.includes(ally.discovery)) return 'Encontre o aliado explorando o ferro-velho.';
  if (!owns(state, ally.requires)) return 'Construa a Bancada de Módulos para consertá-lo.';
  return null;
}

export function recruit(state: GameState, id: AllyId): Result {
  const problem = recruitProblem(state, id);
  if (problem) return fail(problem);
  const ally = ALLIES[id];
  if (!removeItems(state, ally.recruitCost)) return fail('Faltam peças para o conserto.');
  state.ferro.recruited.push(id);
  const f = state.ferro.formation;
  if (!f.back) f.back = id;
  else if (!f.front) f.front = id;
  return ok(`${ally.name} entrou na equipe.`);
}

/** Puts a member in a slot; whoever was there swaps into the member's old slot. */
export function setFormation(state: GameState, slot: FormationSlot, member: MemberId | null): Result {
  if (member && member !== 'ferrugem' && !state.ferro.recruited.includes(member)) return fail('Recrute o aliado antes.');
  const f = state.ferro.formation;
  const other: FormationSlot = slot === 'front' ? 'back' : 'front';
  if (member && f[other] === member) f[other] = f[slot];
  f[slot] = member;
  if (!f.front && !f.back) {
    f[slot] = 'ferrugem';
    return fail('A equipe precisa de ao menos um companheiro.');
  }
  return ok('Formação atualizada.');
}

export function slotOf(state: GameState, member: MemberId): FormationSlot | null {
  const f = state.ferro.formation;
  return f.front === member ? 'front' : f.back === member ? 'back' : null;
}
