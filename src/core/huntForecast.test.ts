import { describe, expect, it } from 'vitest';
import { areaById, type HuntArea } from '../data/hunt';
import { forecast, KILL_WALK_MS, REENTRY_MS, SWING_MS } from './huntForecast';
import { SIZES } from './huntGen';
import { killXp, scaledHp } from './scaling';
import { newGame } from './state';
import type { GameState } from './state';

const area = (patch: Partial<HuntArea>): HuntArea => ({ ...areaById('valas_de_lata')!, ...patch });
const withPry = (): GameState => {
  const s = newGame(0);
  return { ...s, equipped: { ...s.equipped, tool: 'tool_hydraulic_pry' } };
};

describe('forecast', () => {
  it('returns null for an unknown area', () => {
    expect(forecast(newGame(0), undefined)).toBeNull();
  });

  it('turns hits per kill plus a walk, and a re-entry per clear, into kills per hour, XP and scrap per hour', () => {
    const s = newGame(0);
    const f = forecast(s, area({ enemies: ['sorter'], level: 1, size: 'small' }))!;
    const hits = Math.ceil(scaledHp('sorter', 1) / f.hit);
    const perVisit = SIZES.small.enemies;
    const kills = (3_600_000 * perVisit) / (perVisit * (hits * SWING_MS + KILL_WALK_MS) + REENTRY_MS);
    expect(f.killsPerHour).toBe(Math.round(kills));
    expect(f.xpPerHour).toBe(Math.round(kills * killXp('sorter', 1)));
    expect(f.scrapPerHour).toBeGreaterThan(0);
  });

  it('a higher level area gives fewer kills but more XP per kill', () => {
    const s = newGame(0);
    const low = forecast(s, area({ enemies: ['press'], level: 1 }))!;
    const high = forecast(s, area({ enemies: ['press'], level: 40 }))!;
    expect(high.killsPerHour).toBeLessThan(low.killsPerHour);
    expect(high.xpPerKill).toBeGreaterThan(low.xpPerKill);
  });

  it('lists drops by chance, scrap left out, chances summing with scrap to 100%', () => {
    const f = forecast(newGame(0), area({ loot: 'hunt_rust' }))!;
    expect(f.drops.map((d) => d.item)).toEqual(['gear', 'cable', 'servo', 'cell']);
    expect(f.drops[0].chance).toBeCloseTo(0.2);
    expect(f.drops.every((d) => d.item !== 'scrap')).toBe(true);
  });

  it('an unknown loot table yields no drops and no scrap, but still kills and XP', () => {
    const f = forecast(newGame(0), area({ loot: 'nope' }))!;
    expect(f.drops).toEqual([]);
    expect(f.scrapPerHour).toBe(0);
    expect(f.xpPerHour).toBeGreaterThan(0);
  });

  it('marks enemies the hero hits for ×2 as eficaz and ×0.5 as resiste; neutral tool is neutral', () => {
    const neutral = forecast(newGame(0), area({ enemies: ['sorter', 'magnetron'] }))!;
    expect(neutral.enemies.map((e) => e.matchup)).toEqual(['neutro', 'neutro']);
    const f = forecast(withPry(), area({ enemies: ['sorter', 'press'] }))!;
    expect(f.enemies).toEqual([
      { kind: 'sorter', element: 'termico', matchup: 'eficaz' },
      { kind: 'press', element: 'blindado', matchup: 'resiste' },
    ]);
  });

  it('flags a locked area but still estimates it', () => {
    const f = forecast(newGame(0), areaById('forno_frio'))!;
    expect(f.locked).toBe(true);
    expect(f.killsPerHour).toBeGreaterThan(0);
    expect(forecast(newGame(0), areaById('valas_de_lata'))!.locked).toBe(false);
  });

  it('is deterministic', () => {
    const s = newGame(0);
    expect(forecast(s, areaById('trilho_torto'))).toEqual(forecast(s, areaById('trilho_torto')));
  });
});
