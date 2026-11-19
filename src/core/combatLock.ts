// Fleeing mid-fight is not allowed: travel waits this long after the last hit taken or dealt.
export const COMBAT_LOCK_MS = 5_000;

/** Last damage the hero took and dealt, in the scene clock; null when it never happened. */
export interface CombatTimes {
  hurtAt: number | null;
  hitAt: number | null;
}

/** Milliseconds until travel is allowed again; 0 when free. */
export function combatLockMs(now: number, t: CombatTimes): number {
  const last = Math.max(t.hurtAt ?? -Infinity, t.hitAt ?? -Infinity);
  return Math.max(0, last + COMBAT_LOCK_MS - now);
}

export const combatLockSeconds = (ms: number): number => Math.ceil(ms / 1000);
