import { AFK_AREAS, type AfkAreaId } from '../data/areas';
import type { ItemBag } from '../data/items';
import { afkRareFactor, droneCapacity, droneReady, playerStats } from './derived';
import { mixSeed, mulberry32, rollEntry, rollQty } from './rng';
import { addItems, type AfkEndReason, type AfkSession, type GameState } from './state';

export interface AfkProgress {
  cycles: number;
  load: number;
  capacity: number;
  loot: ItemBag;
  rareFound: boolean;
  full: boolean;
  fullAt: number | null;
  /** 0..1 progress of the cycle in flight; 0 once the session ended. */
  cycleProgress: number;
  ended: boolean;
}

const CLAIM_HISTORY = 20;

/** Pure: the whole session result is a function of (session, now). Throttled timers cannot skew it. */
export function computeProgress(s: AfkSession, now: number): AfkProgress {
  const area = AFK_AREAS[s.areaId];
  const until = s.endedAt ?? now;
  const elapsed = Math.max(0, until - s.startedAt);
  const maxCycles = Math.floor(elapsed / s.cycleMs);
  const loot: ItemBag = {};
  let load = 0;
  let cycles = 0;
  let rareFound = false;
  let fullAt: number | null = null;
  while (cycles < maxCycles && load < s.capacity) {
    const rng = mulberry32(mixSeed(s.seed, cycles));
    const entry = rollEntry(rng, area.loot, s.rareFactor);
    const qty = Math.min(rollQty(rng, entry), s.capacity - load);
    loot[entry.item] = (loot[entry.item] ?? 0) + qty;
    load += qty;
    rareFound ||= !!entry.rare;
    cycles++;
    if (load >= s.capacity) fullAt = s.startedAt + cycles * s.cycleMs;
  }
  const full = load >= s.capacity;
  const ended = s.endedAt !== null || full;
  const cycleProgress = ended ? 0 : (elapsed % s.cycleMs) / s.cycleMs;
  return { cycles, load, capacity: s.capacity, loot, rareFound, full, fullAt, cycleProgress, ended };
}

export function availableAreas(state: GameState): AfkAreaId[] {
  return (Object.keys(AFK_AREAS) as AfkAreaId[]).filter((id) => state.flags[AFK_AREAS[id].requiresFlag]);
}

export function startAfk(state: GameState, areaId: AfkAreaId, now: number, seed: number): string | null {
  if (!droneReady(state)) return 'Monte e equipe um drone com módulo primeiro.';
  if (state.afk) return 'Já existe uma extração em andamento.';
  if (!availableAreas(state).includes(areaId)) return 'Área ainda bloqueada.';
  const area = AFK_AREAS[areaId];
  state.afk = {
    id: `afk-${now.toString(36)}-${(seed >>> 0).toString(36)}`,
    areaId,
    startedAt: now,
    cycleMs: Math.max(1000, area.cycleMs - playerStats(state).extracao * 250),
    capacity: droneCapacity(state),
    rareFactor: afkRareFactor(state),
    extraction: playerStats(state).extracao,
    seed: seed >>> 0,
    endedAt: null,
    endReason: null,
  };
  return null;
}

/** Closes the session clock if the cargo filled up. Returns true when it changed state. */
export function settleFull(state: GameState, now: number): boolean {
  const s = state.afk;
  if (!s || s.endedAt !== null) return false;
  const p = computeProgress(s, now);
  if (!p.full || p.fullAt === null) return false;
  s.endedAt = p.fullAt;
  s.endReason = 'full';
  return true;
}

export function endAfk(state: GameState, now: number, reason: AfkEndReason): void {
  const s = state.afk;
  if (!s || s.endedAt !== null) return;
  if (settleFull(state, now)) return;
  s.endedAt = Math.max(s.startedAt, now);
  s.endReason = reason;
}

/** On boot: a session left running means the tab closed. Count only cycles finished before the last heartbeat. */
export function finalizeAfterReload(state: GameState, now: number): void {
  const s = state.afk;
  if (!s || s.endedAt !== null) return;
  endAfk(state, Math.min(now, Math.max(state.lastHeartbeat, s.startedAt)), 'tab_closed');
}

/** Delivers loot exactly once per session id. */
export function claimAfk(state: GameState, now: number): ItemBag | null {
  const s = state.afk;
  if (!s) return null;
  endAfk(state, now, 'stopped');
  state.afk = null;
  if (state.claimedSessions.includes(s.id)) return null;
  const { loot } = computeProgress(s, now);
  addItems(state, loot);
  state.claimedSessions = [...state.claimedSessions, s.id].slice(-CLAIM_HISTORY);
  state.stats.extractions++;
  return loot;
}
