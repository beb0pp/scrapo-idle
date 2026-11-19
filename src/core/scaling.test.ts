import { describe, expect, it } from 'vitest';
import { ENEMY_INFO, ENEMY_KINDS } from '../data/enemies';
import { XP } from '../data/xp';
import { dmgMul, hpMul, killXp, scaledDmg, scaledHp } from './scaling';

describe('enemy level scaling', () => {
  it('keeps Nv 1 exactly at the hand-tuned yard numbers', () => {
    for (const kind of ENEMY_KINDS) expect(scaledHp(kind, 1)).toBe(ENEMY_INFO[kind].hp);
    expect(scaledDmg(10, 1)).toBe(10);
    expect(killXp('sorter')).toBe(Math.round(ENEMY_INFO.sorter.hp / XP.hpPerKillXp));
    expect(killXp('sorter', 1)).toBe(killXp('sorter'));
  });

  it('grows hp faster than damage and both strictly with level', () => {
    let prev = { hp: 0, dmg: 0 };
    for (const level of [1, 10, 25, 50, 75, 100]) {
      const now = { hp: hpMul(level), dmg: dmgMul(level) };
      expect(now.hp).toBeGreaterThan(prev.hp);
      expect(now.dmg).toBeGreaterThan(prev.dmg);
      expect(now.hp).toBeGreaterThanOrEqual(now.dmg);
      prev = now;
    }
    expect(scaledHp('press', 50)).toBeGreaterThan(scaledHp('press', 10));
    expect(scaledDmg(22, 75)).toBeGreaterThan(scaledDmg(22, 25));
  });

  it('pays kill XP in proportion to the scaled hp, through one formula', () => {
    expect(killXp('scrapgolem', 50)).toBe(Math.round(scaledHp('scrapgolem', 50) / XP.hpPerKillXp));
    expect(killXp('sparkbot', 25)).toBeGreaterThan(killXp('sparkbot', 1));
  });

  it('clamps bad levels to the 1–100 range', () => {
    expect(hpMul(0)).toBe(hpMul(1));
    expect(hpMul(-5)).toBe(1);
    expect(hpMul(500)).toBe(hpMul(100));
    expect(dmgMul(Number.NaN)).toBe(1);
  });
});
