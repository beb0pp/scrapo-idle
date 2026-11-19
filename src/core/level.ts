import type { GameState } from './state';

/** Total XP to reach level L is XP_BASE·(L−1)^XP_EXP: Nv 10 ≈ 30 min of normal play, Nv 25 ≈ 4 h. */
export const XP_BASE = 22;
export const XP_EXP = 2.2;
export const MAX_LEVEL = 100;

export interface LevelInfo { level: number; into: number; need: number }

export function xpAt(level: number): number {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return Math.round(XP_BASE * (l - 1) ** XP_EXP);
}

export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpAt(level + 1)) level++;
  return level;
}

/** XP from the start of `level` to the next one; 0 at the cap. */
export function xpToNext(level: number): number {
  return level >= MAX_LEVEL ? 0 : xpAt(level + 1) - xpAt(level);
}

export function levelProgress(xp: number): LevelInfo {
  const level = levelFor(xp);
  return { level, into: xp - xpAt(level), need: xpToNext(level) };
}

export function levelOf(state: GameState): LevelInfo {
  return levelProgress(state.xp);
}

/** Adds XP and returns how many levels were gained. Bad or negative amounts are ignored. */
export function grantXp(state: GameState, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const before = levelFor(state.xp);
  state.xp += Math.floor(amount);
  return levelFor(state.xp) - before;
}

/** Saves from before stored XP: same formula the level used to be derived from, so nobody loses a level. */
export function legacyXp(stats: GameState['stats'], built: number, learned: number): number {
  return stats.kills * 10 + stats.searches * 4 + stats.extractions * 25 + built * 15 + learned * 10;
}
