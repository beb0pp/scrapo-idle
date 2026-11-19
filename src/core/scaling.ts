import { ENEMY_INFO, type EnemyKind } from '../data/enemies';
import { XP } from '../data/xp';
import { MAX_LEVEL } from './level';

/** Per enemy level above 1: Nv 1 is the hand-tuned yard, Nv 100 has ~16× hp and ~7× damage. */
export const HP_PER_LEVEL = 0.15;
export const DMG_PER_LEVEL = 0.06;

function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) : 1;
}

export const hpMul = (level: number): number => 1 + HP_PER_LEVEL * (clampLevel(level) - 1);
export const dmgMul = (level: number): number => 1 + DMG_PER_LEVEL * (clampLevel(level) - 1);

export const scaledHp = (kind: EnemyKind, level: number): number => Math.round(ENEMY_INFO[kind].hp * hpMul(level));
export const scaledDmg = (base: number, level: number): number => Math.round(base * dmgMul(level));

export const killXp = (kind: EnemyKind, level = 1): number => Math.round(scaledHp(kind, level) / XP.hpPerKillXp);
