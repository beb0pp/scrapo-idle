export const ITEM_IDS = [
  'scrap',
  'gear',
  'cable',
  'servo',
  'cell',
  'drone_chassis',
  'pulse_core',
  'mod_claw',
  'mod_magnet',
  'mod_cargo',
  'drone_spark',
  'relic_crane_coil',
  'relic_capacitor',
  'tool_wrench_old', 'tool_wrench_reinforced', 'tool_hydraulic_pry',
  'head_scrap_cap', 'body_work_jacket', 'hands_grip_gloves', 'feet_rail_boots', 'accessory_lucky_bolt',
  'ether_shard', 'reagent_ember', 'reagent_ward', 'reagent_lodestone',
] as const;

export type ItemId = (typeof ITEM_IDS)[number];
export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'reliquia';

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  comum: { label: 'Comum', color: '#b8bcc4' },
  incomum: { label: 'Incomum', color: '#8fd16a' },
  raro: { label: 'Raro', color: '#5fa8e8' },
  epico: { label: 'Épico', color: '#b48ae6' },
  reliquia: { label: 'Relíquia', color: '#f6b24a' },
};

const ITEM_RARITIES: Record<ItemId, Rarity> = {
  scrap: 'comum', gear: 'comum', cable: 'comum', tool_wrench_old: 'comum',
  servo: 'incomum', cell: 'incomum', drone_chassis: 'incomum', pulse_core: 'incomum',
  mod_claw: 'incomum', mod_magnet: 'incomum', mod_cargo: 'incomum', drone_spark: 'incomum',
  tool_wrench_reinforced: 'incomum', head_scrap_cap: 'incomum', body_work_jacket: 'incomum',
  hands_grip_gloves: 'incomum', feet_rail_boots: 'incomum', tool_hydraulic_pry: 'raro',
  accessory_lucky_bolt: 'raro', relic_capacitor: 'epico', relic_crane_coil: 'reliquia',
  ether_shard: 'epico', reagent_ember: 'incomum', reagent_ward: 'incomum', reagent_lodestone: 'raro',
};

export function rarityOf(id: ItemId): Rarity { return ITEM_RARITIES[id]; }
export type ItemKind = 'scrap' | 'component' | 'part' | 'module' | 'upgrade' | 'drone' | 'relic' | 'tool' | 'equipment' | 'reagent';
export type EquipSlot = 'drone' | 'module' | 'upgrade' | 'relic' | 'tool' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';
export type ItemBag = Partial<Record<ItemId, number>>;

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: ItemKind;
  desc: string;
  sell: number;
  dismantle?: ItemBag;
  slot?: EquipSlot;
  stats?: Partial<{ combate: number; extracao: number; defesa: number; vida: number; sorte: number }>;
  rarity?: 'comum' | 'incomum' | 'raro' | 'relíquia';
}

export const ITEMS: Record<ItemId, ItemDef> = {
  scrap: { id: 'scrap', name: 'Sucata', kind: 'scrap', sell: 1, desc: 'Metal retorcido. Base de quase toda montagem.' },
  gear: { id: 'gear', name: 'Engrenagem', kind: 'component', sell: 4, dismantle: { scrap: 2 }, desc: 'Dentes gastos, mas ainda giram.' },
  cable: { id: 'cable', name: 'Cabo de Cobre', kind: 'component', sell: 5, dismantle: { scrap: 2 }, desc: 'Rolo de cobre oxidado.' },
  servo: { id: 'servo', name: 'Servomotor', kind: 'component', sell: 9, dismantle: { gear: 1, scrap: 2 }, desc: 'Motor de precisão de um braço de triagem.' },
  cell: { id: 'cell', name: 'Célula de Carga', kind: 'component', sell: 12, dismantle: { scrap: 3 }, desc: 'Bateria selada. Ainda guarda um pouco de carga.' },
  drone_chassis: { id: 'drone_chassis', name: 'Chassi de Drone Avariado', kind: 'part', sell: 3, desc: 'O seu drone quebrado. Falta o núcleo e um módulo.' },
  pulse_core: { id: 'pulse_core', name: 'Núcleo Pulsante', kind: 'part', sell: 0, desc: 'Achado sob o primeiro vagão. Ainda pulsa.' },
  mod_claw: { id: 'mod_claw', name: 'Módulo de Garra', kind: 'module', slot: 'module', sell: 8, dismantle: { gear: 1, scrap: 2 }, desc: 'Drone dispara faíscas no inimigo mais próximo.' },
  mod_magnet: { id: 'mod_magnet', name: 'Módulo Magnético', kind: 'module', slot: 'module', sell: 30, dismantle: { cable: 2, scrap: 3 }, desc: 'Drone emite pulsos que puxam e atordoam inimigos leves. Na extração, dobra a chance de achados raros.' },
  mod_cargo: { id: 'mod_cargo', name: 'Compartimento de Carga', kind: 'upgrade', slot: 'upgrade', sell: 20, dismantle: { gear: 2, scrap: 4 }, desc: '+6 de carga na extração.' },
  drone_spark: { id: 'drone_spark', name: 'Drone Faísca', kind: 'drone', slot: 'drone', sell: 0, desc: 'Seu drone reparado. Luta ao seu lado e faz extrações.' },
  relic_crane_coil: { id: 'relic_crane_coil', name: 'Bobina do Guindaste', kind: 'relic', slot: 'relic', sell: 25, dismantle: { cable: 3, gear: 2 }, desc: 'Equipada: Pulso Magnético com +50% de alcance. Na oficina: vira o Módulo Magnético.' },
  relic_capacitor: { id: 'relic_capacitor', name: 'Capacitor Antigo', kind: 'relic', slot: 'relic', sell: 40, dismantle: { cell: 1, cable: 2 }, desc: 'Equipado: Arco Elétrico salta em +2 alvos.' },
  tool_wrench_old: { id: 'tool_wrench_old', name: 'Chave Inglesa Gasta', kind: 'tool', slot: 'tool', sell: 2, desc: 'A ferramenta que trouxe para o pátio.', stats: { combate: 10, extracao: 2 } },
  tool_wrench_reinforced: { id: 'tool_wrench_reinforced', name: 'Chave Inglesa Reforçada', kind: 'tool', slot: 'tool', sell: 18, desc: 'Mandíbula endurecida para metal pesado.', stats: { combate: 14, extracao: 3 } },
  tool_hydraulic_pry: { id: 'tool_hydraulic_pry', name: 'Pé-de-cabra Hidráulico', kind: 'tool', slot: 'tool', sell: 22, desc: 'Menos dano, muita força de extração.', stats: { combate: 9, extracao: 6 } },
  head_scrap_cap: { id: 'head_scrap_cap', name: 'Boné de Sucateiro', kind: 'equipment', slot: 'head', sell: 8, desc: 'Proteção leve contra lascas.', stats: { defesa: 1, sorte: 1 } },
  body_work_jacket: { id: 'body_work_jacket', name: 'Jaqueta de Trabalho', kind: 'equipment', slot: 'body', sell: 12, desc: 'Forrada para o turno longo.', stats: { defesa: 3, vida: 8 } },
  hands_grip_gloves: { id: 'hands_grip_gloves', name: 'Luvas de Aderência', kind: 'equipment', slot: 'hands', sell: 9, desc: 'Seguram ferramentas e cabos.', stats: { extracao: 1, defesa: 1 } },
  feet_rail_boots: { id: 'feet_rail_boots', name: 'Botas de Trilho', kind: 'equipment', slot: 'feet', sell: 10, desc: 'Sola grossa sobre sucata.', stats: { defesa: 2 } },
  accessory_lucky_bolt: { id: 'accessory_lucky_bolt', name: 'Parafuso da Sorte', kind: 'equipment', slot: 'accessory', sell: 15, desc: 'Um parafuso que sempre cai de pé.', stats: { sorte: 2 } },
  ether_shard: { id: 'ether_shard', name: 'Fragmento de Éter', kind: 'reagent', sell: 14, desc: 'Energia cristalizada da colônia. Base da Ferromancia.' },
  reagent_ember: { id: 'reagent_ember', name: 'Pó de Brasa', kind: 'reagent', sell: 3, desc: 'Sucata calcinada com cobre. Alimenta a Lança de Brasa.' },
  reagent_ward: { id: 'reagent_ward', name: 'Sal de Ferro', kind: 'reagent', sell: 3, desc: 'Cristais de ferro que endurecem ao toque rúnico. Alimenta a Égide.' },
  reagent_lodestone: { id: 'reagent_lodestone', name: 'Limalha Imantada', kind: 'reagent', sell: 5, desc: 'Limalha carregada de Éter. Alimenta o Chamado Imantado.' },
};

export const KIND_LABEL: Record<ItemKind, string> = {
  scrap: 'Sucata comum',
  component: 'Componente',
  part: 'Peça',
  module: 'Módulo',
  upgrade: 'Melhoria',
  drone: 'Drone',
  relic: 'Relíquia',
  tool: 'Ferramenta',
  equipment: 'Equipamento',
  reagent: 'Reagente',
};
