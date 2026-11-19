import { TILES } from '../art/tileArt';
import { levelOf } from '../core/level';
import type { GameState } from '../core/state';
import type { ElementId } from './elements';
import { ENEMY_INFO, type EnemyKind } from './enemies';

/** Look of a region: which existing tiles make its floor, walls and clutter, plus the light tint. */
export interface Biome {
  floor: readonly number[];
  wallTerrain: number;
  /** Blocking single-tile props drawn on walls that face the floor. */
  wallProps: readonly number[];
  /** Walk-over decals on the floor. */
  decals: readonly number[];
  /** Share of walls away from the floor that also get a prop (scrap mountains vs bare rock). */
  deepFill: number;
  ambient: number;
}

export const BIOME_IDS = ['rust', 'foundry', 'flooded', 'magnetic', 'core'] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

export const BIOMES: Record<BiomeId, Biome> = {
  rust: { floor: [TILES.dirt, TILES.dirt, TILES.gravel, TILES.dirtDark], wallTerrain: TILES.dirtDark, wallProps: [TILES.mound, TILES.moundRust, TILES.moundSmall, TILES.tires, TILES.fridge], decals: [TILES.oilStain, TILES.debris, TILES.weeds], deepFill: 0.45, ambient: 0xf2d6b0 },
  foundry: { floor: [TILES.concrete, TILES.floor, TILES.gravel], wallTerrain: TILES.wall, wallProps: [TILES.girders, TILES.engine, TILES.drums, TILES.pipe, TILES.crate], decals: [TILES.plates, TILES.oilStain, TILES.debris], deepFill: 0.06, ambient: 0xf0b98c },
  flooded: { floor: [TILES.concrete, TILES.floor, TILES.dirtDark], wallTerrain: TILES.wall, wallProps: [TILES.container, TILES.barrel, TILES.drums, TILES.pipe], decals: [TILES.puddle, TILES.puddle, TILES.oilStain], deepFill: 0.06, ambient: 0x9db9cc },
  magnetic: { floor: [TILES.gravel, TILES.concrete, TILES.floor], wallTerrain: TILES.wall, wallProps: [TILES.robotHusk, TILES.girders, TILES.engine, TILES.moundSmall], decals: [TILES.cables, TILES.plates], deepFill: 0.06, ambient: 0xb8aedc },
  core: { floor: [TILES.floor, TILES.concrete, TILES.floor], wallTerrain: TILES.wall, wallProps: [TILES.engine, TILES.robotHusk, TILES.drums, TILES.craneArm], decals: [TILES.debris, TILES.plates, TILES.oilStain], deepFill: 0.06, ambient: 0x9a7f96 },
};

export interface Region {
  id: string;
  name: string;
  minLevel: number;
  desc: string;
  biome: BiomeId;
}

export const REGIONS: readonly Region[] = [
  { id: 'varzea', name: 'Várzea da Ferrugem', minLevel: 1, desc: 'Campos de lata baixa às margens do Pátio. Bom lugar para aprender a caçar.', biome: 'rust' },
  { id: 'fundicoes', name: 'Fundições Apagadas', minLevel: 10, desc: 'Fornos frios e esteiras paradas. As prensas ainda guardam o caminho.', biome: 'foundry' },
  { id: 'docas', name: 'Docas Alagadas', minLevel: 25, desc: 'Depósitos meio submersos onde a corrente vaza pela água parada.', biome: 'flooded' },
  { id: 'cinturao', name: 'Cinturão Magnético', minLevel: 50, desc: 'Bobinas gigantes puxam a sucata em espirais. Nada fica no lugar.', biome: 'magnetic' },
  { id: 'coracao', name: 'Coração da Prensa', minLevel: 75, desc: 'A máquina que moeu a cidade. Quem volta de lá traz relíquias.', biome: 'core' },
];

export type AreaSize = 'small' | 'medium' | 'large';

export interface HuntArea {
  id: string;
  regionId: string;
  name: string;
  level: number;
  enemies: readonly EnemyKind[];
  seed: number;
  size: AreaSize;
  /** Marker position on the region map, 0..1 on both axes. */
  pos: { x: number; y: number };
  /** Key of PILE_TABLES used for piles and enemy drops. */
  loot: string;
}

const area = (regionId: string, loot: string) =>
  (id: string, name: string, level: number, enemies: EnemyKind[], seed: number, size: AreaSize, x: number, y: number): HuntArea =>
    ({ id, regionId, name, level, enemies, seed, size, pos: { x, y }, loot });

const varzea = area('varzea', 'hunt_rust');
const fundicoes = area('fundicoes', 'hunt_foundry');
const docas = area('docas', 'hunt_flooded');
const cinturao = area('cinturao', 'hunt_magnetic');
const coracao = area('coracao', 'hunt_core');

export const AREAS: readonly HuntArea[] = [
  varzea('valas_de_lata', 'Valas de Lata', 1, ['sorter'], 1101, 'small', 0.16, 0.62),
  varzea('corrego_ferro_velho', 'Ferro-Velho do Córrego', 2, ['sorter', 'sparkbot'], 1102, 'small', 0.3, 0.38),
  varzea('vagoes_mortos', 'Pátio dos Vagões Mortos', 3, ['sorter', 'sparkbot'], 1103, 'medium', 0.44, 0.7),
  varzea('ladeira_molas', 'Ladeira das Molas', 5, ['sparkbot', 'sorter'], 1104, 'medium', 0.55, 0.28),
  varzea('fios_soltos', 'Depósito de Fios Soltos', 6, ['sparkbot'], 1105, 'medium', 0.68, 0.55),
  varzea('cemiterio_geladeiras', 'Cemitério de Geladeiras', 7, ['sorter', 'magnetron'], 1106, 'large', 0.8, 0.32),
  varzea('trilho_torto', 'Trilho Torto', 9, ['sorter', 'sparkbot', 'magnetron'], 1107, 'large', 0.88, 0.72),
  fundicoes('forno_frio', 'Forno Frio', 10, ['press', 'sorter'], 2201, 'small', 0.14, 0.5),
  fundicoes('galpao_escorias', 'Galpão das Escórias', 12, ['press', 'sparkbot'], 2202, 'medium', 0.27, 0.25),
  fundicoes('esteira_parada', 'Esteira Parada', 14, ['sorter', 'magnetron'], 2203, 'medium', 0.38, 0.66),
  fundicoes('cadinho_rachado', 'Cadinho Rachado', 16, ['press', 'magnetron'], 2204, 'medium', 0.52, 0.42),
  fundicoes('laminadora_muda', 'Laminadora Muda', 18, ['press'], 2205, 'large', 0.64, 0.74),
  fundicoes('patio_lingotes', 'Pátio de Lingotes', 21, ['press', 'sparkbot', 'magnetron'], 2206, 'large', 0.76, 0.3),
  fundicoes('chamine_caida', 'Chaminé Caída', 24, ['press', 'scrapgolem'], 2207, 'large', 0.88, 0.6),
  docas('armazem_submerso', 'Armazém Submerso', 25, ['sparkbot', 'magnetron'], 3301, 'medium', 0.2, 0.4),
  docas('cais_boias', 'Cais das Boias', 30, ['magnetron', 'scrapgolem'], 3302, 'medium', 0.42, 0.7),
  docas('comporta_enferrujada', 'Comporta Enferrujada', 36, ['sparkbot', 'scrapgolem'], 3303, 'large', 0.62, 0.3),
  docas('tanques_lodo', 'Tanques de Lodo', 44, ['scrapgolem', 'magnetron', 'sparkbot'], 3304, 'large', 0.82, 0.62),
  cinturao('campo_bobinas', 'Campo de Bobinas', 50, ['magnetron', 'sparkbot'], 4401, 'medium', 0.22, 0.6),
  cinturao('torre_ima', 'Torre do Ímã', 56, ['magnetron', 'press'], 4402, 'medium', 0.4, 0.3),
  cinturao('vale_limalhas', 'Vale das Limalhas', 63, ['scrapgolem', 'magnetron'], 4403, 'large', 0.62, 0.66),
  cinturao('anel_inducao', 'Anel de Indução', 70, ['sparkbot', 'magnetron', 'scrapgolem'], 4404, 'large', 0.82, 0.36),
  coracao('prensa_primordial', 'Prensa Primordial', 75, ['press', 'scrapgolem'], 5501, 'medium', 0.26, 0.5),
  coracao('fosso_rebites', 'Fosso dos Rebites', 85, ['scrapgolem', 'magnetron', 'press'], 5502, 'large', 0.54, 0.3),
  coracao('camara_martelo', 'Câmara do Martelo', 95, ['press', 'scrapgolem', 'sparkbot'], 5503, 'large', 0.78, 0.66),
];

export const regionById = (id: string): Region | undefined => REGIONS.find((r) => r.id === id);
export const areaById = (id: string): HuntArea | undefined => AREAS.find((a) => a.id === id);

export function regionOf(a: HuntArea): Region {
  const r = regionById(a.regionId);
  if (!r) throw new Error(`Área ${a.id} aponta para região inexistente ${a.regionId}`);
  return r;
}

export function areasIn(region: Region | string): HuntArea[] {
  const id = typeof region === 'string' ? region : region.id;
  return AREAS.filter((a) => a.regionId === id);
}

/** Distinct elements of the area's enemies, in first-seen order. */
export function areaElements(a: HuntArea): ElementId[] {
  return [...new Set(a.enemies.map((k) => ENEMY_INFO[k].element))];
}

export function regionUnlocked(state: GameState, region: Region): boolean {
  return levelOf(state).level >= region.minLevel;
}
