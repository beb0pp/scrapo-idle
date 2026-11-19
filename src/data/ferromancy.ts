import type { ElementId } from './elements';
import type { ItemBag } from './items';

// Ferromancia catalogue: build tree, skill tree, spells, transmutations, allies and synergies.
// Stable snake_case ids; display text lives only here.

export type BuildNodeId =
  | 'b_workshop' | 'b_bench_tools' | 'b_bench_modules' | 'b_drone_servos' | 'b_drone_bay' | 'b_alchemy' | 'b_alembic';
export type SkillNodeId =
  | 's_cmb_arm' | 's_cmb_dash' | 's_cmb_fury'
  | 's_ext_eye' | 's_ext_hands' | 's_ext_magnet'
  | 's_mag_init' | 's_mag_ward' | 's_mag_lode' | 's_mag_channel'
  | 's_mag_haste' | 's_mag_net' | 's_mag_harvest'
  | 's_mag_arc' | 's_mag_crush' | 's_mag_acid';
export type NodeId = BuildNodeId | SkillNodeId;
export type SpellId =
  | 'spell_ember' | 'spell_ward' | 'spell_lodestone' | 'spell_haste' | 'spell_net' | 'spell_harvest'
  | 'spell_arc' | 'spell_crush' | 'spell_acid';
export type TransmuteId = 't_ember' | 't_ward' | 't_lodestone' | 't_flask';
export type DiscoveryId = 'ether_vein' | 'automaton';
export type AllyId = 'cobalto';
export type MemberId = 'ferrugem' | AllyId;
export type FormationSlot = 'front' | 'back';
export type SynergyId = 'resonance' | 'bulwark';
export type Branch = 'oficina' | 'bancadas' | 'drone' | 'alquimia' | 'combate' | 'extracao' | 'magia';

/** Numeric modifiers. Adds start at 0, multipliers at 1. */
export interface FerroMods {
  combate: number;
  extracao: number;
  defesa: number;
  sorte: number;
  droneCapacity: number;
  droneDamageMul: number;
  dashCooldownMul: number;
  searchTimeMul: number;
  pickupRadius: number;
  spellCooldownMul: number;
  spellPowerMul: number;
  wardMul: number;
  transmuteBonus: number;
}

export const NO_MODS: FerroMods = {
  combate: 0, extracao: 0, defesa: 0, sorte: 0, droneCapacity: 0,
  droneDamageMul: 1, dashCooldownMul: 1, searchTimeMul: 1, pickupRadius: 0,
  spellCooldownMul: 1, spellPowerMul: 1, wardMul: 1, transmuteBonus: 0,
};

export interface NodeDef<Id extends NodeId> {
  id: Id;
  name: string;
  branch: Branch;
  /** Grid position in the tree view: column (branch lane) and row (depth). */
  col: number;
  row: number;
  requires: NodeId[];
  requiresDiscovery?: DiscoveryId;
  cost: { items?: ItemBag; points?: number };
  effect: string;
  mods?: Partial<FerroMods>;
  unlocksSpell?: SpellId;
  unlocksAlchemy?: boolean;
}

export const BUILD_NODES: Record<BuildNodeId, NodeDef<BuildNodeId>> = {
  b_workshop: {
    id: 'b_workshop', name: 'Oficina Restaurada', branch: 'oficina', col: 1, row: 0, requires: [],
    cost: { items: { scrap: 6 } }, effect: 'Bancada limpa e ferramentas no lugar. +1 de defesa e libera as bancadas.', mods: { defesa: 1 },
  },
  b_bench_tools: {
    id: 'b_bench_tools', name: 'Bancada de Ferramentas', branch: 'bancadas', col: 0, row: 1, requires: ['b_workshop'],
    cost: { items: { gear: 2, scrap: 6 } }, effect: 'Afia e balanceia a ferramenta equipada: +3 de combate, +1 de extração.', mods: { combate: 3, extracao: 1 },
  },
  b_bench_modules: {
    id: 'b_bench_modules', name: 'Bancada de Módulos', branch: 'bancadas', col: 1, row: 1, requires: ['b_workshop'],
    cost: { items: { gear: 2, cable: 1 } }, effect: 'Suportes para o drone: +2 de carga na extração. Permite consertar autômatos.', mods: { droneCapacity: 2 },
  },
  b_drone_servos: {
    id: 'b_drone_servos', name: 'Servos Calibrados', branch: 'drone', col: 0, row: 2, requires: ['b_bench_modules'],
    cost: { items: { servo: 1, gear: 1 } }, effect: 'O drone mira melhor: +30% de dano nos ataques automáticos do drone.', mods: { droneDamageMul: 1.3 },
  },
  b_drone_bay: {
    id: 'b_drone_bay', name: 'Porão do Drone', branch: 'drone', col: 1, row: 2, requires: ['b_bench_modules'],
    cost: { items: { cable: 2, scrap: 8 } }, effect: 'Compartimento extra: +4 de carga na extração.', mods: { droneCapacity: 4 },
  },
  b_alchemy: {
    id: 'b_alchemy', name: 'Estação Alquímica', branch: 'alquimia', col: 2, row: 1, requires: ['b_workshop'], requiresDiscovery: 'ether_vein',
    cost: { items: { scrap: 8, cable: 1, ether_shard: 1 } }, effect: 'Círculo de transmutação: converte sucata em reagentes. Abre o ramo de magia.', unlocksAlchemy: true,
  },
  b_alembic: {
    id: 'b_alembic', name: 'Alambique Rúnico', branch: 'alquimia', col: 2, row: 2, requires: ['b_alchemy', 'b_bench_tools'],
    cost: { items: { ether_shard: 2, gear: 2 } }, effect: 'Destila melhor: cada transmutação rende +1 reagente.', mods: { transmuteBonus: 1 },
  },
};

export const SKILL_NODES: Record<SkillNodeId, NodeDef<SkillNodeId>> = {
  s_cmb_arm: {
    id: 's_cmb_arm', name: 'Braço de Sucateiro', branch: 'combate', col: 0, row: 0, requires: [],
    cost: { points: 1 }, effect: '+3 de combate.', mods: { combate: 3 },
  },
  s_cmb_dash: {
    id: 's_cmb_dash', name: 'Investida Treinada', branch: 'combate', col: 0, row: 1, requires: ['s_cmb_arm'],
    cost: { points: 1 }, effect: 'Recarga da Investida 20% menor.', mods: { dashCooldownMul: 0.8 },
  },
  s_cmb_fury: {
    id: 's_cmb_fury', name: 'Fúria Rúnica', branch: 'combate', col: 0, row: 2, requires: ['s_cmb_dash', 's_mag_init'],
    cost: { points: 2 }, effect: 'Feitiços causam +25% de efeito.', mods: { spellPowerMul: 1.25 },
  },
  s_ext_eye: {
    id: 's_ext_eye', name: 'Olho Clínico', branch: 'extracao', col: 1, row: 0, requires: [],
    cost: { points: 1 }, effect: '+2 de sorte.', mods: { sorte: 2 },
  },
  s_ext_hands: {
    id: 's_ext_hands', name: 'Mãos Rápidas', branch: 'extracao', col: 1, row: 1, requires: ['s_ext_eye'],
    cost: { points: 1 }, effect: 'Vasculha pilhas 30% mais rápido.', mods: { searchTimeMul: 0.7 },
  },
  s_ext_magnet: {
    id: 's_ext_magnet', name: 'Ímã de Bolso', branch: 'extracao', col: 1, row: 2, requires: ['s_ext_hands'],
    cost: { points: 1 }, effect: 'Atrai achados do chão de mais longe (+40 px).', mods: { pickupRadius: 40 },
  },
  s_mag_init: {
    id: 's_mag_init', name: 'Iniciação Ferromante', branch: 'magia', col: 2, row: 0, requires: ['b_alchemy'],
    cost: { points: 1 }, effect: 'Aprende a Lança de Brasa (ataque).', unlocksSpell: 'spell_ember',
  },
  s_mag_ward: {
    id: 's_mag_ward', name: 'Égide de Ferro', branch: 'magia', col: 2, row: 1, requires: ['s_mag_init'],
    cost: { points: 1 }, effect: 'Aprende a Égide de Ferro (defesa).', unlocksSpell: 'spell_ward',
  },
  s_mag_lode: {
    id: 's_mag_lode', name: 'Chamado Imantado', branch: 'magia', col: 3, row: 1, requires: ['s_mag_init'],
    cost: { points: 1 }, effect: 'Aprende o Chamado Imantado (extração).', unlocksSpell: 'spell_lodestone',
  },
  s_mag_channel: {
    id: 's_mag_channel', name: 'Canalização', branch: 'magia', col: 2, row: 2, requires: ['s_mag_ward'],
    cost: { points: 2, items: { ether_shard: 1 } }, effect: 'Recarga de todos os feitiços 20% menor.', mods: { spellCooldownMul: 0.8 },
  },
  s_mag_haste: {
    id: 's_mag_haste', name: 'Pressa Rúnica', branch: 'magia', col: 3, row: 2, requires: ['s_mag_lode'],
    cost: { points: 1 }, effect: 'Aprende a Pressa Rúnica (auxílio).', unlocksSpell: 'spell_haste',
  },
  s_mag_net: {
    id: 's_mag_net', name: 'Rede Magnética', branch: 'magia', col: 1, row: 3, requires: ['s_ext_magnet', 's_mag_lode'],
    cost: { points: 1 }, effect: 'Aprende a Rede Magnética (auxílio).', unlocksSpell: 'spell_net',
  },
  s_mag_harvest: {
    id: 's_mag_harvest', name: 'Colheita em Lote', branch: 'magia', col: 3, row: 3, requires: ['s_mag_haste'],
    cost: { points: 2, items: { ether_shard: 2 } }, effect: 'Aprende a Colheita em Lote (auxílio).', unlocksSpell: 'spell_harvest',
  },
  s_mag_arc: {
    id: 's_mag_arc', name: 'Arco Encadeado', branch: 'magia', col: 4, row: 1, requires: ['s_mag_init'],
    cost: { points: 1 }, effect: 'Aprende o Arco Encadeado (ataque elétrico).', unlocksSpell: 'spell_arc',
  },
  s_mag_crush: {
    id: 's_mag_crush', name: 'Prensa Magnética', branch: 'magia', col: 4, row: 2, requires: ['s_mag_arc', 's_mag_lode'],
    cost: { points: 2 }, effect: 'Aprende a Prensa Magnética (ataque magnético).', unlocksSpell: 'spell_crush',
  },
  s_mag_acid: {
    id: 's_mag_acid', name: 'Respingo Ácido', branch: 'magia', col: 4, row: 3, requires: ['s_mag_crush'],
    cost: { points: 2, items: { ether_shard: 1 } }, effect: 'Aprende o Respingo Ácido (ataque corrosivo).', unlocksSpell: 'spell_acid',
  },
};

export type SpellSchool = 'ataque' | 'defesa' | 'extracao' | 'auxilio';
export type SpellTarget = 'enemy' | 'self' | 'area';

export interface SpellDef {
  id: SpellId;
  name: string;
  school: SpellSchool;
  /** Mana paid on every cast. */
  mana: number;
  /** Optional reforço: consumed when in stock for +50% power. */
  cost: ItemBag;
  cooldownMs: number;
  target: SpellTarget;
  /** Max distance to the target (enemy) or radius of the area. */
  range: number;
  /** Damage (ataque), shield points (defesa), pull radius bonus (extracao) or buff strength / pile count (auxilio). */
  power: number;
  durationMs?: number;
  effect: string;
  color: number;
  /** Absent = neutral. */
  element?: ElementId;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  spell_ember: {
    id: 'spell_ember', name: 'Lança de Brasa', school: 'ataque', mana: 12, cost: { reagent_ember: 1 }, cooldownMs: 6000,
    target: 'enemy', range: 150, power: 24, color: 0xf08a3a, element: 'termico',
    effect: 'Crava uma lança de brasa no inimigo mais próximo (ou sob o cursor): 24 de dano e respingo em volta.',
  },
  spell_ward: {
    id: 'spell_ward', name: 'Égide de Ferro', school: 'defesa', mana: 18, cost: { reagent_ward: 1 }, cooldownMs: 15000,
    target: 'self', range: 0, power: 40, durationMs: 6000, color: 0x5fd0d8,
    effect: 'Escudo rúnico que absorve 40 de dano por 6 s.',
  },
  spell_lodestone: {
    id: 'spell_lodestone', name: 'Chamado Imantado', school: 'extracao', mana: 10, cost: { reagent_lodestone: 1 }, cooldownMs: 12000,
    target: 'area', range: 170, power: 1, color: 0xb48ae6, element: 'magnetico',
    effect: 'Puxa todos os achados num raio de 170 px e a próxima pilha vasculhada rende um achado extra.',
  },
  spell_haste: {
    id: 'spell_haste', name: 'Pressa Rúnica', school: 'auxilio', mana: 15, cost: { reagent_ember: 1 }, cooldownMs: 40000,
    target: 'self', range: 0, power: 50, durationMs: 15000, color: 0xe0b33a,
    effect: 'Vasculha pilhas e veios 50% mais rápido por 15 s.',
  },
  spell_net: {
    id: 'spell_net', name: 'Rede Magnética', school: 'auxilio', mana: 20, cost: { reagent_lodestone: 1 }, cooldownMs: 60000,
    target: 'self', range: 0, power: 120, durationMs: 20000, color: 0x9a6ae0,
    effect: 'Atrai achados do chão de muito mais longe (+120 px) por 20 s.',
  },
  spell_harvest: {
    id: 'spell_harvest', name: 'Colheita em Lote', school: 'auxilio', mana: 30, cost: { reagent_lodestone: 2 }, cooldownMs: 75000,
    target: 'area', range: 120, power: 4, color: 0x9fd86a,
    effect: 'Vasculha na hora até 4 pilhas prontas num raio de 120 px.',
  },
  spell_arc: {
    id: 'spell_arc', name: 'Arco Encadeado', school: 'ataque', mana: 14, cost: { reagent_ember: 1 }, cooldownMs: 7000,
    target: 'enemy', range: 140, power: 18, color: 0x6f9cff, element: 'eletrico',
    effect: 'Raio que salta do alvo para até 3 inimigos próximos: 18 de dano, 25% a menos a cada salto.',
  },
  spell_crush: {
    id: 'spell_crush', name: 'Prensa Magnética', school: 'ataque', mana: 16, cost: { reagent_lodestone: 1 }, cooldownMs: 9000,
    target: 'enemy', range: 130, power: 16, color: 0xe8506a, element: 'magnetico',
    effect: 'Arrasta os inimigos num raio de 56 px até o alvo e os esmaga: 16 de dano, +25% por inimigo extra preso.',
  },
  spell_acid: {
    id: 'spell_acid', name: 'Respingo Ácido', school: 'ataque', mana: 14, cost: { reagent_ward: 1 }, cooldownMs: 8000,
    target: 'enemy', range: 150, power: 14, color: 0x3fd49a, element: 'corrosivo',
    effect: 'Ácido que respinga 14 de dano em volta do alvo e deixa uma poça que corrói por 3 s.',
  },
};

export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];
export const SPELL_KEYS = ['Z', 'X', 'C'] as const;

export interface TransmuteDef { id: TransmuteId; name: string; inputs: ItemBag; output: 'reagent_ember' | 'reagent_ward' | 'reagent_lodestone' | 'mana_flask'; qty: number }

export const TRANSMUTES: Record<TransmuteId, TransmuteDef> = {
  t_ember: { id: 't_ember', name: 'Pó de Brasa', inputs: { scrap: 4, cable: 1 }, output: 'reagent_ember', qty: 2 },
  t_ward: { id: 't_ward', name: 'Sal de Ferro', inputs: { scrap: 4, gear: 1 }, output: 'reagent_ward', qty: 2 },
  t_lodestone: { id: 't_lodestone', name: 'Limalha Imantada', inputs: { scrap: 3, ether_shard: 1 }, output: 'reagent_lodestone', qty: 3 },
  t_flask: { id: 't_flask', name: 'Frasco de Éter', inputs: { scrap: 2, ether_shard: 1 }, output: 'mana_flask', qty: 2 },
};

export interface AllyDef {
  id: AllyId;
  name: string;
  title: string;
  discovery: DiscoveryId;
  requires: BuildNodeId;
  recruitCost: ItemBag;
  desc: string;
}

export const ALLIES: Record<AllyId, AllyDef> = {
  cobalto: {
    id: 'cobalto', name: 'Cobalto', title: 'Autômato Vigia', discovery: 'automaton', requires: 'b_bench_modules',
    recruitCost: { cell: 1, reagent_ward: 2, scrap: 6 },
    desc: 'Vigia rúnico da colônia, achado desligado no ferro-velho. Ainda grava runas com o dedo.',
  },
};

export interface RoleDef { name: string; desc: string }

export const ROLES: Record<MemberId, Record<FormationSlot, RoleDef>> = {
  ferrugem: {
    front: { name: 'Caçador', desc: 'Morde inimigos que chegam perto.' },
    back: { name: 'Coletor', desc: 'Não luta: busca achados do chão de mais longe.' },
  },
  cobalto: {
    front: { name: 'Guardião', desc: 'Pisa forte ao seu lado: dano em área curta.' },
    back: { name: 'Conjurador', desc: 'Dispara setas rúnicas de longe.' },
  },
};

export interface SynergyDef { id: SynergyId; name: string; front: MemberId; back: MemberId; effect: string; mods: Partial<FerroMods> }

export const SYNERGIES: Record<SynergyId, SynergyDef> = {
  resonance: {
    id: 'resonance', name: 'Ressonância Rúnica', front: 'ferrugem', back: 'cobalto',
    effect: 'Feitiços recarregam 20% mais rápido e a Lança de Brasa ecoa numa seta do Cobalto.',
    mods: { spellCooldownMul: 0.8 },
  },
  bulwark: {
    id: 'bulwark', name: 'Muralha de Ferro', front: 'cobalto', back: 'ferrugem',
    effect: '+4 de defesa e a Égide absorve 50% a mais.',
    mods: { defesa: 4, wardMul: 1.5 },
  },
};

export const DISCOVERY_TEXT: Record<DiscoveryId, string> = {
  ether_vein: 'Veio de Éter: cristais que crescem entre a sucata. Fonte de Fragmentos de Éter.',
  automaton: 'Autômato Adormecido: um vigia da colônia, desligado mas inteiro.',
};
