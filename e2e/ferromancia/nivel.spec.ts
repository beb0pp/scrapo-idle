import { expect, test, type Page } from '@playwright/test';
import { enterWorld, firstEnemy, seedSave } from './helpers';

const level = (page: Page) => page.evaluate(() => (window as any).__scrapo.level() as { level: number; into: number; need: number });
const xp = (page: Page) => page.evaluate(() => (window as any).__scrapo.session.state.xp as number);
const badge = (page: Page) => page.locator('#lvl-num');
const levelToast = (page: Page, n: number) => page.locator('#toasts .toast', { hasText: `Nível ${n}!` });

test('matar um inimigo dá XP, sobe o nível no HUD e mostra o aviso', async ({ page }) => {
  // 21 XP: one short of Nv 2, so any kill crosses the threshold
  await seedSave(page, { xp: 21 });
  await enterWorld(page, 'yard');
  await expect(badge(page)).toHaveText('1');
  await expect(page.locator('#lvl-badge')).toHaveAttribute('aria-label', 'Nível 1');

  const enemy = await firstEnemy(page);
  await page.evaluate((i) => {
    const w = (window as any).__scrapo.world();
    w.damageEnemy(w.enemies[i], 9999);
  }, enemy.index);

  expect(await xp(page)).toBeGreaterThan(21);
  expect((await level(page)).level).toBe(2);
  await expect(badge(page)).toHaveText('2');
  await expect(levelToast(page, 2)).toBeVisible();
  await expect(page.locator('#xp-num')).toHaveText(/^XP \d+\/\d+$/);
});

test('o nível sobrevive a recarregar a página', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  await enterWorld(page, 'yard');
  const gained = await page.evaluate(() => (window as any).__scrapo.grantXp(2765));
  expect(gained).toBe(9);
  await expect(badge(page)).toHaveText('10');
  await expect(levelToast(page, 10)).toBeVisible();
  await page.locator('.vitals').screenshot({ path: test.info().outputPath('nivel-hud.png') });

  await page.reload();
  await enterWorld(page, 'yard');
  expect(await xp(page)).toBe(2765);
  expect(await level(page)).toMatchObject({ level: 10, into: 0 });
  await expect(badge(page)).toHaveText('10');
});

test('subir de nível durante a extração também toca o efeito, no drone', async ({ page }) => {
  await seedSave(page, { xp: 21, equipped: { drone: 'drone_spark', module: 'mod_claw' }, flags: { drone_built: true } });
  await enterWorld(page, 'patio');
  await page.evaluate(() => {
    const s = (window as any).__scrapo;
    s.session.startAfk('afk_yard_edge');
    s.game.scene.stop('World');
    s.game.scene.start('Extraction');
  });
  await page.waitForFunction(() => (window as any).__scrapo.game.scene.isActive('Extraction'));
  const children = () => page.evaluate(() => (window as any).__scrapo.game.scene.getScene('Extraction').children.length as number);
  const before = await children();
  expect(await page.evaluate(() => (window as any).__scrapo.grantXp(5))).toBe(1);
  expect(await children()).toBeGreaterThan(before + 5);
  await expect(levelToast(page, 2)).toBeVisible();
});

test('save antigo sem XP herda o nível das estatísticas', async ({ page }) => {
  // old formula: 12 kills × 10 + 10 searches × 4 = 160 XP → Nv 3 on the new curve
  await seedSave(page, { stats: { kills: 12, searches: 10 } });
  await enterWorld(page, 'yard');
  expect(await xp(page)).toBe(160);
  await expect(badge(page)).toHaveText('3');
});
