import type { ElementId } from './elements';
import { XP } from './xp';

export const ENEMY_KINDS = ['sorter', 'press', 'sparkbot', 'magnetron', 'scrapgolem'] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

/** Phaser-free enemy facts, read by the scene and by the hunt-area generator. */
export interface EnemyInfo {
  hp: number;
  element: ElementId;
}

export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  sorter: { hp: 30, element: 'termico' },
  press: { hp: 80, element: 'blindado' },
  sparkbot: { hp: 20, element: 'eletrico' },
  magnetron: { hp: 48, element: 'magnetico' },
  scrapgolem: { hp: 130, element: 'corrosivo' },
};

export const killXp = (kind: EnemyKind): number => Math.round(ENEMY_INFO[kind].hp / XP.hpPerKillXp);
