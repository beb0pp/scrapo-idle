import { describe, expect, it } from 'vitest';
import { COMBAT_LOCK_MS, combatLockMs, combatLockSeconds } from './combatLock';

describe('combatLockMs', () => {
  it('is free when the hero never fought', () => {
    expect(combatLockMs(100_000, { hurtAt: null, hitAt: null })).toBe(0);
  });

  it('counts from the last damage taken', () => {
    expect(combatLockMs(10_000, { hurtAt: 9_000, hitAt: null })).toBe(COMBAT_LOCK_MS - 1_000);
  });

  it('counts from the last damage dealt', () => {
    expect(combatLockMs(10_000, { hurtAt: null, hitAt: 7_500 })).toBe(COMBAT_LOCK_MS - 2_500);
  });

  it('uses the most recent of the two', () => {
    expect(combatLockMs(10_000, { hurtAt: 6_000, hitAt: 9_800 })).toBe(COMBAT_LOCK_MS - 200);
  });

  it('frees exactly when the window ends', () => {
    expect(combatLockMs(15_000, { hurtAt: 10_000, hitAt: null })).toBe(0);
    expect(combatLockMs(14_999, { hurtAt: 10_000, hitAt: null })).toBe(1);
  });
});

describe('combatLockSeconds', () => {
  it('rounds the remaining time up to whole seconds', () => {
    expect(combatLockSeconds(0)).toBe(0);
    expect(combatLockSeconds(1)).toBe(1);
    expect(combatLockSeconds(1_000)).toBe(1);
    expect(combatLockSeconds(4_001)).toBe(5);
  });
});
