import { PILE_TABLES } from '../data/areas';
import type { ElementId } from '../data/elements';
import { ENEMY_INFO, type EnemyKind } from '../data/enemies';
import { areaUnlocked, type HuntArea } from '../data/hunt';
import type { ItemId } from '../data/items';
import { meleeElement, playerStats } from './derived';
import { elementDamage, elementMul, RESIST_MUL, STRONG_MUL } from './elements';
import { SIZES } from './huntGen';
import { killXp, scaledHp } from './scaling';
import type { GameState } from './state';

/** Melee swing cadence; mirrors COOLDOWN.attack in WorldScene. */
export const SWING_MS = 340;
/** Time to find and reach the next enemy after a kill, a flat guess for an average area. */
export const KILL_WALK_MS = 4000;
/** Enemies never respawn: each clear ends with a trip out and back in through the Mapa. */
export const REENTRY_MS = 15_000;
const HOUR_MS = 3_600_000;
const MAX_DROPS = 4;

export type Matchup = 'eficaz' | 'resiste' | 'neutro';

export interface ForecastEnemy { kind: EnemyKind; element: ElementId; matchup: Matchup }
export interface ForecastDrop { item: ItemId; chance: number }

export interface HuntForecast {
  locked: boolean;
  /** Base melee hit before elements. */
  hit: number;
  killsPerHour: number;
  xpPerKill: number;
  xpPerHour: number;
  scrapPerHour: number;
  drops: ForecastDrop[];
  enemies: ForecastEnemy[];
}

function matchupOf(attack: ElementId | null, defend: ElementId): Matchup {
  const mul = elementMul(attack, defend);
  return mul === STRONG_MUL ? 'eficaz' : mul === RESIST_MUL ? 'resiste' : 'neutro';
}

/** Steady-state hunt estimate: each kill takes its swings plus a walk, each clear a re-entry; one loot roll per kill. */
export function forecast(state: GameState, area: HuntArea | undefined): HuntForecast | null {
  if (!area || area.enemies.length === 0) return null;
  const hit = Math.max(1, playerStats(state).combate);
  const attack = meleeElement(state);
  const killMs = area.enemies.map((k) => {
    const dmg = elementDamage(hit, attack, ENEMY_INFO[k].element).amount;
    return Math.ceil(scaledHp(k, area.level) / dmg) * SWING_MS + KILL_WALK_MS;
  });
  const avgKillMs = killMs.reduce((a, b) => a + b, 0) / killMs.length;
  const avgXp = area.enemies.reduce((sum, k) => sum + killXp(k, area.level), 0) / area.enemies.length;
  const perVisit = SIZES[area.size].enemies;
  const kills = (HOUR_MS * perVisit) / (perVisit * avgKillMs + REENTRY_MS);

  const table = PILE_TABLES[area.loot]?.loot ?? [];
  const total = table.reduce((s, e) => s + e.weight, 0);
  const scrapPerKill = table.filter((e) => e.item === 'scrap').reduce((s, e) => s + (e.weight / total) * ((e.min + e.max) / 2), 0);
  const drops = table
    .filter((e) => e.item !== 'scrap')
    .map((e) => ({ item: e.item, chance: e.weight / total }))
    .sort((a, b) => b.chance - a.chance)
    .slice(0, MAX_DROPS);

  return {
    locked: !areaUnlocked(state, area),
    hit,
    killsPerHour: Math.round(kills),
    xpPerKill: Math.round(avgXp),
    xpPerHour: Math.round(kills * avgXp),
    scrapPerHour: Math.round(kills * scrapPerKill),
    drops,
    enemies: area.enemies.map((k) => ({ kind: k, element: ENEMY_INFO[k].element, matchup: matchupOf(attack, ENEMY_INFO[k].element) })),
  };
}
