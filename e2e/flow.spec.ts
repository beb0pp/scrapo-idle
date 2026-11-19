import { expect, test } from '@playwright/test';
import { count, enterGame, focusGame, tap, trackErrors, useInteractable, warp } from './helpers';

const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const s = (window as any).__scrapo.session.state;
    return { currency: s.currency, drone: s.equipped.drone, tool: s.equipped.tool, afk: s.afk, claimed: s.claimedSessions.length, inv: { ...s.inventory } };
  });

test('fresh save: explore → salvage → build drone → AFK across tab close → claim once → sell', async ({ context }) => {
  let page = await context.newPage();
  const errors = trackErrors(page);
  await enterGame(page);

  // explore and salvage: the first wagon pile in the rail yard always gives the pulse core
  await warp(page, 'yard');
  await useInteractable(page, 'vagão');
  await expect.poll(() => count(page, 'pulse_core'), { timeout: 30_000 }).toBeGreaterThan(0);

  // collect the rest with auto mode (same rules as manual play)
  await tap(page, 't');
  await expect.poll(async () => {
    const s = await state(page);
    return (s.inv.gear ?? 0) >= 2 && (s.inv.cable ?? 0) >= 1 && (s.inv.scrap ?? 0) >= 10;
  }, { timeout: 90_000, intervals: [1000] }).toBe(true);
  await tap(page, 't');

  // equip and compare a tool from the backpack
  await tap(page, 'i');
  await expect(page.locator('#panel .mochila')).toBeVisible();
  await page.locator('[data-act="select:tool_hydraulic_pry"]').first().click();
  await page.locator('[data-act="equip:tool_hydraulic_pry"]').first().click();
  expect((await state(page)).tool).toBe('tool_hydraulic_pry');
  await tap(page, 'Escape');
  await focusGame(page);

  // build the claw module and the drone at the workshop
  await warp(page, 'patio');
  await useInteractable(page, 'Oficina');
  await expect(page.locator('#panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-act="craft:rcp_mod_claw"]').click();
  await page.locator('[data-act="craft:rcp_drone_spark"]').click();
  await expect.poll(async () => (await state(page)).drone).toBeTruthy();
  await tap(page, 'Escape');
  await focusGame(page);

  // start an extraction at the terminal
  await useInteractable(page, 'Terminal');
  await expect(page.locator('#panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-act^="afk:"]').first().click();
  await expect.poll(async () => (await state(page)).afk).toBeTruthy();

  // let cycles finish, close the tab, reopen: production arrives once
  const before = await state(page);
  // cycles finished while the tab was open survive the close (see finalizeAfterReload)
  await page.waitForTimeout(14_000);
  await page.close();
  await new Promise((r) => setTimeout(r, 3_000));
  page = await context.newPage();
  errors.push(...trackErrors(page));
  await page.goto('/');
  await page.locator('.title-play').click();
  const claim = page.locator('[data-x="claim"]');
  await expect(claim).toBeVisible({ timeout: 20_000 });
  await claim.click();
  const after = await state(page);
  const gained = Object.keys(after.inv).some((k) => (after.inv[k] ?? 0) > (before.inv[k] ?? 0));
  expect(gained).toBe(true);
  expect(after.afk).toBeNull();
  expect(after.claimed).toBe(before.claimed + 1);

  // reload: nothing to claim a second time
  await page.reload();
  await page.locator('.title-play').click();
  await expect.poll(() => page.evaluate(() => !!(window as any).__scrapo?.world()?.player?.active), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('[data-x="claim"]')).toHaveCount(0);
  expect((await state(page)).claimed).toBe(after.claimed);

  // sell scrap at the vendor
  await page.locator('#modal button.primary').click({ timeout: 2000 }).catch(() => {});
  await useInteractable(page, 'Comerciante');
  await expect(page.locator('#panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-act="vendor-tab:sell"]').click();
  const cash = (await state(page)).currency;
  await page.locator('[data-act^="sell:"]').first().click();
  await expect.poll(async () => (await state(page)).currency).toBeGreaterThan(cash);

  expect(errors).toEqual([]);
});

test('skills Q W E R fire with cooldowns in the dungeon', async ({ page }) => {
  const errors = trackErrors(page);
  await enterGame(page);
  await warp(page, 'dungeon');
  for (const key of ['q', 'e']) {
    await tap(page, key);
    await page.waitForTimeout(450);
  }
  const ready = await page.evaluate(() => {
    const w = (window as any).__scrapo.world();
    return { now: w.time.now, ...w.ready };
  });
  expect(ready.pulse).toBeGreaterThan(ready.now);
  expect(ready.dash).toBeGreaterThan(ready.now);
  // W needs a target in range and R needs a drone: both must refuse gracefully
  await tap(page, 'w');
  await tap(page, 'r');
  expect(errors).toEqual([]);
});

test('a version 1 save from an earlier build still loads', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('scrapo.save')) return;
    localStorage.setItem('scrapo.save', JSON.stringify({
      version: 1, currency: 42, inventory: { scrap: 7, gear: 1 },
      equipped: { drone: null, module: null, upgrade: null, relic: null },
      flags: { first_wagon: true }, afk: null, claimedSessions: [], lastHeartbeat: Date.now(),
      stats: { searches: 3, kills: 1, extractions: 0 },
    }));
  });
  await enterGame(page);
  const s = await page.evaluate(() => (window as any).__scrapo.session.state);
  expect(s.version).toBe(2);
  expect(s.currency).toBe(42);
  expect(s.inventory.scrap).toBe(7);
  expect(s.equipped.tool).toBe('tool_wrench_old');
});
