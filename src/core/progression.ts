import {
  BUILD_NODES, NO_MODS, SKILL_NODES, SYNERGIES,
  type BuildNodeId, type FerroMods, type NodeDef, type NodeId, type SkillNodeId, type SpellId, type SynergyDef,
} from '../data/ferromancy';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';
import type { Result } from './economy';
import { hasItems, removeItems, type GameState } from './state';

export type NodeStatus = 'owned' | 'available' | 'unaffordable' | 'locked';
export type TreeKind = 'build' | 'skill';

const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export function nodeDef(id: NodeId): NodeDef<NodeId> {
  return (BUILD_NODES as Record<string, NodeDef<NodeId>>)[id] ?? (SKILL_NODES as Record<string, NodeDef<NodeId>>)[id];
}

export function isBuildNode(id: NodeId): id is BuildNodeId {
  return Object.hasOwn(BUILD_NODES, id);
}

export function owns(state: GameState, id: NodeId): boolean {
  return isBuildNode(id) ? state.ferro.built.includes(id) : state.ferro.learned.includes(id as SkillNodeId);
}

/** Points come from play itself, so old saves get credit for what they already did. */
export function skillPoints(state: GameState): { earned: number; spent: number; free: number } {
  const s = state.stats;
  const earned = 1 + Math.floor(s.kills / 5) + Math.floor(s.searches / 8) + s.extractions + state.ferro.built.length;
  const spent = state.ferro.learned.reduce((sum, id) => sum + (SKILL_NODES[id].cost.points ?? 0), 0);
  return { earned, spent, free: Math.max(0, earned - spent) };
}

/** Requirements not met yet, as display names. Empty means the node can be bought if affordable. */
export function missingRequirements(state: GameState, node: NodeDef<NodeId>): string[] {
  const missing = node.requires.filter((id) => !owns(state, id)).map((id) => nodeDef(id).name);
  if (node.requiresDiscovery && !state.ferro.discovered.includes(node.requiresDiscovery)) missing.push('descobrir um Veio de Éter');
  return missing;
}

function affordable(state: GameState, node: NodeDef<NodeId>): boolean {
  if (node.cost.items && !hasItems(state, node.cost.items)) return false;
  return !node.cost.points || skillPoints(state).free >= node.cost.points;
}

export function nodeStatus(state: GameState, id: NodeId): NodeStatus {
  if (owns(state, id)) return 'owned';
  const node = nodeDef(id);
  if (missingRequirements(state, node).length) return 'locked';
  return affordable(state, node) ? 'available' : 'unaffordable';
}

function acquire(state: GameState, id: NodeId, verb: string): Result {
  const node = nodeDef(id);
  if (!node) return fail('Nó desconhecido.');
  if (owns(state, id)) return fail(`${node.name} já foi ${verb}.`);
  const missing = missingRequirements(state, node);
  if (missing.length) return fail(`Requer: ${missing.join(', ')}.`);
  if (node.cost.points && skillPoints(state).free < node.cost.points) return fail('Pontos de ofício insuficientes.');
  if (node.cost.items && !removeItems(state, node.cost.items)) return fail('Faltam materiais.');
  if (isBuildNode(id)) state.ferro.built.push(id);
  else state.ferro.learned.push(id as SkillNodeId);
  return ok(`${node.name} ${verb}.`);
}

export function buildNode(state: GameState, id: BuildNodeId): Result {
  if (!Object.hasOwn(BUILD_NODES, id)) return fail('Construção desconhecida.');
  return acquire(state, id, 'construída');
}

export function learnNode(state: GameState, id: SkillNodeId): Result {
  if (!Object.hasOwn(SKILL_NODES, id)) return fail('Habilidade desconhecida.');
  return acquire(state, id, 'aprendida');
}

/** Synergies are formation pairs: who stands in front and who stays back. */
export function activeSynergies(state: GameState): SynergyDef[] {
  const { front, back } = state.ferro.formation;
  return Object.values(SYNERGIES).filter((s) => s.front === front && s.back === back);
}

export function ferroMods(state: GameState): FerroMods {
  const mods: FerroMods = { ...NO_MODS };
  const sources = [
    ...state.ferro.built.map((id) => BUILD_NODES[id].mods),
    ...state.ferro.learned.map((id) => SKILL_NODES[id].mods),
    ...activeSynergies(state).map((s) => s.mods),
  ];
  for (const m of sources) {
    for (const [key, value] of Object.entries(m ?? {}) as [keyof FerroMods, number][]) {
      mods[key] = key.endsWith('Mul') ? mods[key] * value : mods[key] + value;
    }
  }
  return mods;
}

export function alchemyUnlocked(state: GameState): boolean {
  return state.ferro.built.some((id) => BUILD_NODES[id].unlocksAlchemy);
}

export function unlockedSpells(state: GameState): SpellId[] {
  return state.ferro.learned.map((id) => SKILL_NODES[id].unlocksSpell).filter((s): s is SpellId => !!s);
}

export function costText(cost: { items?: ItemBag; points?: number }): string {
  const parts = Object.entries(cost.items ?? {}).map(([id, qty]) => `${qty}× ${ITEMS[id as ItemId].name}`);
  if (cost.points) parts.unshift(`${cost.points} ponto${cost.points > 1 ? 's' : ''}`);
  return parts.join(' · ') || 'grátis';
}

/** Returns problems with a node graph: unknown requirements and cycles. Empty means valid. */
export function graphErrors(nodes: Record<string, { requires: string[] }>, known: Record<string, unknown> = nodes): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    for (const req of node.requires) if (!Object.hasOwn(known, req)) errors.push(`${id} requer ${req}, que não existe`);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done' || !nodes[id]) return;
    if (state.get(id) === 'visiting') {
      errors.push(`ciclo: ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 'visiting');
    for (const req of nodes[id].requires) visit(req, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of Object.keys(nodes)) visit(id, []);
  return errors;
}
