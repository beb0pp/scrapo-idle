import type { Page } from '@playwright/test';

export const SAVE_KEY = 'scrapo.save';

export interface SeedState {
  currency?: number;
  inventory?: Record<string, number>;
  equipped?: Record<string, string | null>;
  flags?: Record<string, boolean>;
  stats?: { searches?: number; kills?: number; extractions?: number };
  ferro?: {
    built?: string[];
    learned?: string[];
    loadout?: [string | null, string | null, string | null];
    discovered?: string[];
    recruited?: string[];
    formation?: { front: string | null; back: string | null };
  };
}

function fullSave(partial: SeedState) {
  return {
    version: 3,
    currency: partial.currency ?? 10,
    inventory: partial.inventory ?? {},
    equipped: { drone: null, module: null, upgrade: null, relic: null, tool: 'tool_wrench_old', head: null, body: null, hands: null, feet: null, accessory: null, ...partial.equipped },
    flags: { intro_seen: true, ...partial.flags },
    afk: null,
    claimedSessions: [],
    lastHeartbeat: Date.now(),
    stats: { searches: 0, kills: 0, extractions: 0, ...partial.stats },
    ferro: {
      built: [], learned: [], loadout: [null, null, null], discovered: [], recruited: [],
      formation: { front: 'ferrugem', back: null },
      ...partial.ferro,
    },
  };
}

/** Writes a full v3 save before app scripts run. Only when storage is empty, so reloads keep progress. */
export async function seedSave(page: Page, partial: SeedState = {}): Promise<void> {
  const save = fullSave(partial);
  await page.addInitScript(({ key, json }) => {
    try {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, json);
    } catch { /* storage unavailable */ }
  }, { key: SAVE_KEY, json: JSON.stringify(save) });
}

export async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__scrapo?.game?.scene);
}

/** Warps into a map and waits until the World scene is running with its FerroController. */
export async function enterWorld(page: Page, mapId: 'patio' | 'yard' | 'dungeon' = 'yard'): Promise<void> {
  await openGame(page);
  await page.evaluate((id) => {
    const s = (window as any).__scrapo;
    s.game.scene.getScene('Title')?.clearTitleScreen?.();
    s.warp(id);
  }, mapId);
  await page.waitForFunction((id) => {
    const s = (window as any).__scrapo;
    const w = s.world();
    return s.game.scene.isActive('World') && w.mapId === id && !!w.ferro && !!w.player?.body && !document.getElementById('hud')!.hidden;
  }, mapId, { timeout: 20_000 });
  await page.waitForTimeout(300);
}

/** Places the hero so his feet land on (x, y). */
export async function teleportFeet(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([fx, fy]) => {
    const w = (window as any).__scrapo.world();
    const off = w.feetY - w.player.y;
    w.player.setPosition(fx, fy - off);
    w.player.body.reset(fx, fy - off);
  }, [x, y]);
  await page.waitForTimeout(150);
}

export const readState = <T = any>(page: Page, pick: string): Promise<T> =>
  page.evaluate((expr) => new Function('s', `return (${expr})`)((window as any).__scrapo.session.state), pick);

export const fullState = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__scrapo.session.state)));

export const press = async (page: Page, key: string): Promise<void> => {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
};

export const modalHidden = (page: Page) => page.evaluate(() => document.getElementById('modal')!.hidden);

export interface Pt { x: number; y: number }

export const firstEnemy = (page: Page): Promise<Pt & { hp: number; index: number }> =>
  page.evaluate(() => {
    const list = (window as any).__scrapo.world().enemies as any[];
    const index = list.findIndex((en) => en.alive);
    return { x: list[index].x, y: list[index].y, hp: list[index].hp, index };
  });

/** HP of one specific enemy (by index in the scene list), alive or not. */
export const enemyHp = (page: Page, index: number): Promise<number> =>
  page.evaluate((i) => (window as any).__scrapo.world().enemies[i].hp as number, index);

/** Screen-space (page px) clip around the hero. */
export async function heroClip(page: Page, size = 160): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate((sz) => {
    const s = (window as any).__scrapo;
    const w = s.world();
    const cam = w.cameras.main;
    const rect = s.game.canvas.getBoundingClientRect();
    const k = rect.width / s.game.scale.width;
    const gx = (w.feetX - cam.worldView.x) * cam.zoom;
    const gy = (w.feetY - 10 - cam.worldView.y) * cam.zoom;
    const px = rect.left + gx * k;
    const py = rect.top + gy * k;
    const x = Math.max(0, Math.min(window.innerWidth - sz, Math.round(px - sz / 2)));
    const y = Math.max(0, Math.min(window.innerHeight - sz, Math.round(py - sz / 2)));
    return { x, y, width: sz, height: sz };
  }, size);
}
