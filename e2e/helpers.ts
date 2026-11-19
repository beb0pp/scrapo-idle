import { expect, type Page } from '@playwright/test';

/** Passes title and intro until the World scene is running. */
export async function enterGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.title-play').click();
  const skip = page.locator('.story-skip');
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();
  await expect.poll(() => page.evaluate(() => !!(window as any).__scrapo?.world()?.player?.active), { timeout: 15_000 }).toBe(true);
  await focusGame(page);
}

/** Keyboard input reaches the game only while its canvas has focus, as after a player's first click. */
export async function focusGame(page: Page): Promise<void> {
  await page.locator('canvas').first().focus();
}

/** Holds a key for a few frames so the game loop sees it. */
export async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
}

export async function warp(page: Page, mapId: 'patio' | 'yard' | 'dungeon'): Promise<void> {
  await page.evaluate((id) => (window as any).__scrapo.warp(id), mapId);
  await expect.poll(() => page.evaluate((id) => {
    const w = (window as any).__scrapo.world();
    return w?.mapId === id && !!w.player?.active && !w.transitioning;
  }, mapId), { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(400);
  await focusGame(page);
}

export const count = (page: Page, id: string) =>
  page.evaluate((item) => (window as any).__scrapo.session.state.inventory[item] ?? 0, id);

/** Walks to the interactable whose label contains `text` and uses it (same path as a mouse click). */
export async function useInteractable(page: Page, text: string): Promise<void> {
  const ok = await page.evaluate((t) => {
    const w = (window as any).__scrapo.world();
    const it = w.interactables.find((i: any) => (i.label() ?? '').includes(t));
    if (!it) return false;
    w.order = { kind: 'use', it, path: w.pathTo(it.x, it.y) };
    return true;
  }, text);
  expect(ok, `interactable "${text}"`).toBe(true);
}

/** Collects console errors so a test can assert none happened. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
