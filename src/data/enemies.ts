import type { ElementId } from './elements';

export const ENEMY_KINDS = ['sorter', 'press', 'sparkbot', 'magnetron', 'scrapgolem'] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

/** Phaser-free enemy facts, read by the scene and by the hunt-area generator. */
export interface EnemyInfo {
  name: string;
  hp: number;
  element: ElementId;
}

export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  sorter: { name: 'Triador', hp: 30, element: 'termico' },
  press: { name: 'Prensa Andante', hp: 80, element: 'blindado' },
  sparkbot: { name: 'Faiscador', hp: 20, element: 'eletrico' },
  magnetron: { name: 'Magnetron', hp: 48, element: 'magnetico' },
  scrapgolem: { name: 'Golem de Sucata', hp: 130, element: 'corrosivo' },
};
