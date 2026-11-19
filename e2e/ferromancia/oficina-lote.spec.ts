import { expect, test, type Page } from '@playwright/test';
import { enterWorld, press, seedSave, teleportFeet, type Pt } from './helpers';

const ALL_BUILT = ['b_workshop', 'b_bench_tools', 'b_bench_modules', 'b_drone_servos', 'b_drone_bay', 'b_alchemy', 'b_alembic'];

/** The plot building whose prompt reads `F —<name>`, as the scene registered it. */
const building = (page: Page, name: string): Promise<Pt & { r: number }> =>
  page.evaluate((label) => {
    const it = (window as any).__scrapo.world().interactables.find((i: any) => i.label() === label);
    if (!it) throw new Error(`no interactable "${label}"`);
    return { x: it.x, y: it.y, r: it.r };
  }, `F —${name}`);

/** Screen point over a world position, for a real mouse click on the canvas. */
const toScreen = (page: Page, pt: Pt): Promise<Pt> =>
  page.evaluate(({ x, y }) => {
    const w = (window as any).__scrapo.world();
    const cam = w.cameras.main;
    const box = w.game.canvas.getBoundingClientRect();
    const sx = box.width / w.game.canvas.width, sy = box.height / w.game.canvas.height;
    return { x: box.left + (x - cam.worldView.x) * cam.zoom * sx, y: box.top + (y - cam.worldView.y) * cam.zoom * sy };
  }, pt);

test.beforeEach(async ({ page }) => {
  await seedSave(page, { ferro: { built: ALL_BUILT, discovered: ['ether_vein'] } });
  await enterWorld(page, 'patio');
});

test('F na Estação Alquímica abre a Ferromancia na aba da Transmutação', async ({ page }) => {
  const alchemy = await building(page, 'Estação Alquímica');
  await teleportFeet(page, alchemy.x, alchemy.y + 14);
  await press(page, 'f');
  await expect(page.locator('#panel .ferro[data-tab="grimoire"]')).toBeVisible();
  await expect(page.locator('#panel h3', { hasText: 'Transmutação' })).toBeVisible();
});

test('F na Oficina Restaurada abre a árvore de Construção', async ({ page }) => {
  const workshop = await building(page, 'Oficina Restaurada');
  await teleportFeet(page, workshop.x, workshop.y + 14);
  await press(page, 'f');
  await expect(page.locator('#panel .ferro[data-tab="build"]')).toBeVisible();
});

test('clicar na Bancada de Módulos leva o herói até ela e abre a Oficina', async ({ page }) => {
  const bench = await building(page, 'Bancada de Módulos');
  const at = await toScreen(page, { x: bench.x, y: bench.y - 4 });
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('#panel h2')).toHaveText('Oficina', { timeout: 10_000 });
  const feet = await page.evaluate(() => { const w = (window as any).__scrapo.world(); return { x: w.feetX, y: w.feetY }; });
  expect(Math.hypot(feet.x - bench.x, feet.y - bench.y)).toBeLessThan(bench.r + 16);
});

test('hover destaca só a construção sob o cursor', async ({ page }) => {
  const tools = await building(page, 'Bancada de Ferramentas');
  const at = await toScreen(page, { x: tools.x, y: tools.y - 4 });
  await page.mouse.move(at.x, at.y);
  const tinted = await page.evaluate(() => {
    const w = (window as any).__scrapo.world();
    return w.interactables.filter((i: any) => i.sprite?.texture?.key?.startsWith('decor_') && i.sprite.isTinted).map((i: any) => i.label());
  });
  expect(tinted).toEqual(['F —Bancada de Ferramentas']);
});
