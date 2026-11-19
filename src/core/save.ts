import { ITEM_IDS, type ItemBag, type ItemId } from '../data/items';
import { AFK_AREA_IDS } from '../data/areas';
import { ALLIES, BUILD_NODES, DISCOVERY_TEXT, SKILL_NODES, SPELLS, type AllyId, type MemberId } from '../data/ferromancy';
import { newFerro, newGame, SAVE_VERSION, type AfkSession, type FerroState, type GameState, type SpellLoadout } from './state';

export const SAVE_KEY = 'scrapo.save';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isItem = (v: unknown): v is ItemId => typeof v === 'string' && (ITEM_IDS as readonly string[]).includes(v);

function parseBag(raw: unknown): ItemBag {
  const bag: ItemBag = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (isItem(k) && isNum(v) && v > 0) bag[k] = Math.floor(v);
  }
  return bag;
}

function parseAfk(raw: unknown): AfkSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const fields = [a.startedAt, a.cycleMs, a.capacity, a.rareFactor, a.seed];
  if (typeof a.id !== 'string' || !fields.every(isNum) || !(AFK_AREA_IDS as readonly unknown[]).includes(a.areaId)) return null;
  return {
    id: a.id,
    areaId: a.areaId as AfkSession['areaId'],
    startedAt: a.startedAt as number,
    cycleMs: Math.max(1000, a.cycleMs as number),
    capacity: a.capacity as number,
    rareFactor: a.rareFactor as number,
    extraction: isNum(a.extraction) ? a.extraction : 0,
    seed: a.seed as number,
    endedAt: isNum(a.endedAt) ? a.endedAt : null,
    endReason: (a.endReason as AfkSession['endReason']) ?? null,
  };
}

function idList<T extends string>(raw: unknown, known: Record<T, unknown>): T[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((v): v is T => typeof v === 'string' && Object.hasOwn(known, v)))];
}

/** v1/v2 saves have no Ferromancia block: they start with an empty one. Unknown ids are dropped. */
function parseFerro(raw: unknown): FerroState {
  const base = newFerro();
  if (!raw || typeof raw !== 'object') return base;
  const f = raw as Record<string, unknown>;
  const recruited = idList<AllyId>(f.recruited, ALLIES);
  const loadoutRaw = Array.isArray(f.loadout) ? f.loadout : [];
  const loadout = [0, 1, 2].map((i) => (typeof loadoutRaw[i] === 'string' && Object.hasOwn(SPELLS, loadoutRaw[i]) ? loadoutRaw[i] : null)) as SpellLoadout;
  const form = (f.formation ?? {}) as Record<string, unknown>;
  const member = (v: unknown): MemberId | null => (v === 'ferrugem' || recruited.includes(v as AllyId) ? (v as MemberId) : null);
  let front = member(form.front);
  let back = member(form.back);
  if (front && front === back) back = null;
  if (!front && !back) front = 'ferrugem';
  return {
    built: idList(f.built, BUILD_NODES),
    learned: idList(f.learned, SKILL_NODES),
    loadout: loadout.map((id, i) => (id && loadout.indexOf(id) === i ? id : null)) as SpellLoadout,
    discovered: idList(f.discovered, DISCOVERY_TEXT),
    recruited,
    formation: { front, back },
  };
}

/** Parses foreign JSON once at the boundary. Unknown or broken saves start a new game. */
export function parseSave(json: string | null, now: number): GameState {
  if (!json) return newGame(now);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return newGame(now);
  }
  if (!raw || ![1, 2, SAVE_VERSION].includes(raw.version as number)) return newGame(now);
  const base = newGame(now);
  const eq = (raw.equipped ?? {}) as Record<string, unknown>;
  const slot = (v: unknown) => (isItem(v) ? v : null);
  const stats = (raw.stats ?? {}) as Record<string, unknown>;
  const legacy = raw.version === 1;
  return {
    ...base,
    currency: isNum(raw.currency) ? Math.max(0, Math.floor(raw.currency)) : base.currency,
    inventory: parseBag(raw.inventory),
    equipped: {
      drone: slot(eq.drone), module: slot(eq.module), upgrade: slot(eq.upgrade), relic: slot(eq.relic),
      tool: legacy ? 'tool_wrench_old' : slot(eq.tool) ?? 'tool_wrench_old', head: legacy ? null : slot(eq.head), body: legacy ? null : slot(eq.body), hands: legacy ? null : slot(eq.hands), feet: legacy ? null : slot(eq.feet), accessory: legacy ? null : slot(eq.accessory),
    },
    flags: raw.flags && typeof raw.flags === 'object' ? (raw.flags as GameState['flags']) : {},
    afk: parseAfk(raw.afk),
    claimedSessions: Array.isArray(raw.claimedSessions) ? raw.claimedSessions.filter((s) => typeof s === 'string') : [],
    lastHeartbeat: isNum(raw.lastHeartbeat) ? raw.lastHeartbeat : now,
    stats: {
      searches: isNum(stats.searches) ? stats.searches : 0,
      kills: isNum(stats.kills) ? stats.kills : 0,
      extractions: isNum(stats.extractions) ? stats.extractions : 0,
    },
    ferro: parseFerro(raw.ferro),
  };
}

export function loadState(store: KeyValueStore, now: number): GameState {
  return parseSave(store.getItem(SAVE_KEY), now);
}

export function saveState(store: KeyValueStore, state: GameState): void {
  store.setItem(SAVE_KEY, JSON.stringify(state));
}
