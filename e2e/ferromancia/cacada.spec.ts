import { expect, test, type Page } from '@playwright/test';
import { openGame, readState, seedSave, teleportFeet } from './helpers';

/** Screenshots land here when set (phase review), otherwise in the test output folder. */
const shot = (name: string) => (process.env.HUNT_SHOTS_DIR ? `${process.env.HUNT_SHOTS_DIR}/${name}` : test.info().outputPath(name));

async function travel(page: Page, areaId: string): Promise<boolean> {
  await openGame(page);
  return page.evaluate((id) => {
    const s = (window as any).__scrapo;
    s.game.scene.getScene('Title')?.clearTitleScreen?.();
    return s.travel(id) as boolean;
  }, areaId);
}

async function waitForHunt(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = (window as any).__scrapo;
    const w = s.world();
    return s.game.scene.isActive('World') && w.mapId === 'hunt' && !!w.player?.body && w.enemies.length > 0 && !document.getElementById('hud')!.hidden;
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(700);
}

const enemies = (page: Page) =>
  page.evaluate(() => ((window as any).__scrapo.world().enemies as any[]).map((e) => ({ kind: e.kind as string, level: e.level as number, hp: e.hp as number, alive: e.alive as boolean })));

test('Nv 1: viaja para uma área, derrota um inimigo e volta ao Pátio pelo portal', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  expect(await travel(page, 'valas_de_lata')).toBe(true);
  await waitForHunt(page);

  expect(await page.evaluate(() => (window as any).__scrapo.world().areaName)).toBe('Valas de Lata');
  const list = await enemies(page);
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((e) => e.kind === 'sorter' && e.level === 1 && e.hp === 30)).toBe(true);
  await page.screenshot({ path: shot('area-1.png') });

  const kills = await readState<number>(page, 's.stats.kills');
  const xp = await readState<number>(page, 's.xp');
  await page.evaluate(() => {
    const w = (window as any).__scrapo.world();
    w.damageEnemy(w.enemies[0], 9999);
  });
  expect((await enemies(page))[0].alive).toBe(false);
  expect(await readState<number>(page, 's.stats.kills')).toBe(kills + 1);
  expect(await readState<number>(page, 's.xp')).toBe(xp + 10);

  const exit = await page.evaluate(() => {
    const r = (window as any).__scrapo.world().exits[0].rect;
    return { x: r.centerX, y: r.centerY };
  });
  await teleportFeet(page, exit.x, exit.y);
  await page.waitForFunction(() => {
    const w = (window as any).__scrapo.world();
    return w.mapId === 'patio' && !!w.player?.body;
  }, null, { timeout: 10_000 });
});

test('região bloqueada recusa a viagem com um aviso', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  expect(await travel(page, 'forno_frio')).toBe(false);
  await expect(page.locator('#toasts .toast.warn', { hasText: 'Fundições Apagadas exige Nv 10.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__scrapo.game.scene.isActive('World'))).toBe(false);
});

test('área acima do nível recusa a viagem mesmo com a região aberta', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  expect(await travel(page, 'corrego_ferro_velho')).toBe(false);
  await expect(page.locator('#toasts .toast.warn', { hasText: 'Ferro-Velho do Córrego exige Nv 2.' })).toBeVisible();
});

test('Nv 25: inimigos de outra região chegam escalados e com o nível à vista', async ({ page }) => {
  // 100 000 XP is Nv 46: Docas Alagadas (Nv 25) open, Cinturão Magnético (Nv 50) still closed
  await seedSave(page, { xp: 100_000 });
  await openGame(page);
  expect(await page.evaluate(() => (window as any).__scrapo.travel('anel_inducao'))).toBe(false);
  expect(await travel(page, 'armazem_submerso')).toBe(true);
  await waitForHunt(page);

  const list = await enemies(page);
  expect(list.every((e) => e.level === 25)).toBe(true);
  const spark = list.find((e) => e.kind === 'sparkbot');
  expect(spark?.hp).toBe(92);
  const tags = await page.evaluate(() =>
    ((window as any).__scrapo.world().children.list as any[]).filter((c) => c.type === 'Text' && c.text === 'Nv 25').length);
  expect(tags).toBe(list.length);
  await page.screenshot({ path: shot('area-2.png') });
});
