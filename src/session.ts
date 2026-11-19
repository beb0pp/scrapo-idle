import { claimAfk, claimPending, endAfk, finalizeAfterReload, settleFull, startAfk } from './core/afk';
import { playerStats } from './core/derived';
import { levelOf } from './core/level';
import { loadState, saveState, SAVE_KEY, type KeyValueStore } from './core/save';
import { newGame, type AfkEndReason, type GameState } from './core/state';
import type { Result } from './core/economy';
import type { AfkAreaId } from './data/areas';
import { BAG_FULL_MSG } from './data/bag';
import type { ItemBag } from './data/items';

type Listener = () => void;
type ToastListener = (msg: string, kind: 'ok' | 'warn' | 'loot') => void;

export const PILE_RESPAWN_MS = 120_000;
const HEARTBEAT_MS = 2000;

/** Owns the one GameState. Every mutation goes through here so it is saved and broadcast. */
export class Session {
  state: GameState;
  hp = 100;
  /** Base 100 plus the Vida bonus of the equipped gear. */
  get maxHp(): number {
    return playerStats(this.state).vida;
  }
  /** Runtime only: pile id -> time it was searched. */
  readonly searchedPiles = new Map<string, number>();
  /** Runtime only: hero plays by himself (fights, salvages, collects). */
  autoMode = false;
  /** Runtime counters for auto-mode QA (not saved). */
  readonly autoLog = { deaths: 0, dodges: 0, unstuck: 0, retreats: 0, skills: { pulse: 0, arc: 0, dash: 0, overdrive: 0 } };
  private readonly autoListeners = new Set<(on: boolean) => void>();

  onAutoChange(fn: (on: boolean) => void): void {
    this.autoListeners.add(fn);
    fn(this.autoMode);
  }

  toggleAuto(): void {
    this.autoMode = !this.autoMode;
    this.autoListeners.forEach((fn) => fn(this.autoMode));
    this.toast(this.autoMode ? 'Modo automático ligado: o sucateiro trabalha sozinho.' : 'Modo automático desligado.');
  }
  private readonly store: KeyValueStore;
  private readonly listeners = new Set<Listener>();
  private readonly toastListeners = new Set<ToastListener>();
  private lastBeat = 0;
  readonly recentFinds: Array<{ bag: ItemBag; source: string; at: number }> = [];

  private readonly levelListeners = new Set<(level: number) => void>();
  private level: number;

  constructor(store: KeyValueStore) {
    this.store = store;
    this.state = loadState(store, Date.now());
    this.level = levelOf(this.state).level;
    finalizeAfterReload(this.state, Date.now());
    this.save();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Fires once per commit that raised the hero level, with the new level. */
  onLevelUp(fn: (level: number) => void): () => void {
    this.levelListeners.add(fn);
    return () => this.levelListeners.delete(fn);
  }

  onToast(fn: ToastListener): void {
    this.toastListeners.add(fn);
  }

  toast(msg: string, kind: 'ok' | 'warn' | 'loot' = 'ok'): void {
    this.toastListeners.forEach((fn) => fn(msg, kind));
  }

  save(): void {
    this.state.lastHeartbeat = Date.now();
    saveState(this.store, this.state);
  }

  commit(): void {
    this.save();
    this.listeners.forEach((fn) => fn());
    const level = levelOf(this.state).level;
    const raised = level > this.level;
    this.level = level;
    if (raised) this.levelListeners.forEach((fn) => fn(level));
  }

  /** Runs a rule from core/, then saves, broadcasts and reports the outcome. */
  run(op: (s: GameState) => Result): Result {
    const res = op(this.state);
    if (res.ok) this.commit();
    this.toast(res.msg, res.ok ? 'ok' : 'warn');
    return res;
  }

  mutate(fn: (s: GameState) => void): void {
    fn(this.state);
    this.commit();
  }

  startAfk(areaId: AfkAreaId): string | null {
    const err = startAfk(this.state, areaId, Date.now(), (Math.random() * 2 ** 32) >>> 0);
    if (err) this.toast(err, 'warn');
    else this.commit();
    return err;
  }

  stopAfk(reason: AfkEndReason): void {
    endAfk(this.state, Date.now(), reason);
    this.commit();
  }

  claimAfk(): ItemBag | null {
    const loot = claimAfk(this.state, Date.now());
    if (loot) this.recordFinds(loot, 'Extração');
    this.commit();
    return loot;
  }

  claimPending(): ItemBag | null {
    const got = claimPending(this.state);
    if (got) this.recordFinds(got, 'Extração');
    else this.toast(`${BAG_FULL_MSG}.`, 'warn');
    this.commit();
    return got;
  }

  /** Runtime-only feed, deliberately bounded so the HUD never grows without limit. */
  recordFinds(bag: ItemBag, source: string): void {
    if (!Object.keys(bag).length) return;
    this.recentFinds.unshift({ bag: { ...bag }, source, at: Date.now() });
    this.recentFinds.splice(12);
  }

  /** Wall-clock driven; safe to call at any rate, including from a throttled background timer. */
  tick(): void {
    const now = Date.now();
    if (!this.state.afk) return;
    if (settleFull(this.state, now)) {
      this.commit();
      return;
    }
    if (now - this.lastBeat >= HEARTBEAT_MS) {
      this.lastBeat = now;
      this.save();
    }
  }

  reset(): void {
    this.store.removeItem(SAVE_KEY);
    this.state = newGame(Date.now());
    this.searchedPiles.clear();
    this.hp = this.maxHp;
    this.commit();
  }
}

export const session = new Session(window.localStorage);

setInterval(() => session.tick(), 1000);
document.addEventListener('visibilitychange', () => {
  session.tick();
  if (document.visibilityState === 'visible') session.commit();
});
window.addEventListener('pagehide', () => session.save());
