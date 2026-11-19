import { expect, test, type Page } from '@playwright/test';
import { enterWorld, press, seedSave } from './helpers';

const panel = (page: Page) => page.locator('#panel');
const box = async (page: Page) => (await panel(page).boundingBox())!;

const openFerro = async (page: Page) => {
  await press(page, 'k');
  await expect(page.locator('#panel .ferro')).toBeVisible();
};
const openWorkshop = async (page: Page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: 'workshop' })));
  await expect(page.locator('#panel h2')).toHaveText('Oficina');
};

/** Cycles the dock button until the window floats. */
async function makeFree(page: Page): Promise<void> {
  const btn = page.locator('#panel .dock-btn');
  for (let i = 0; i < 3 && !(await btn.textContent())?.includes('Livre'); i++) await btn.click();
  await expect(btn).toContainText('Livre');
  await expect(panel(page)).toHaveAttribute('data-dock', 'free');
}

/** Drags the window by its title and returns where it ended up. */
async function dragTitle(page: Page, dx: number): Promise<{ x: number; y: number }> {
  const title = (await page.locator('#panel .panel-head h2').boundingBox())!;
  const sx = title.x + 10, sy = title.y + title.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx, sy, { steps: 8 });
  await page.mouse.up();
  const after = await box(page);
  return { x: after.x, y: after.y };
}

async function checkWindow(page: Page, open: (p: Page) => Promise<void>): Promise<void> {
  await seedSave(page, { ferro: { built: ['b_workshop', 'b_alchemy'], discovered: ['ether_vein'] } });
  await enterWorld(page, 'patio');
  await open(page);
  const viewport = page.viewportSize()!;
  const docked = await box(page);
  await expect(panel(page)).toHaveAttribute('data-dock', 'right');
  expect(docked.width).toBeLessThan(viewport.width * 0.55);
  expect(docked.x + docked.width).toBeGreaterThan(viewport.width - 40);

  await makeFree(page);
  const before = await box(page);
  const moved = await dragTitle(page, -200);
  expect(Math.abs(moved.x - (before.x - 200))).toBeLessThan(4);
  expect(Math.abs(moved.y - before.y)).toBeLessThan(4);

  await page.reload();
  await enterWorld(page, 'patio');
  await open(page);
  await expect(panel(page)).toHaveAttribute('data-dock', 'free');
  const restored = await box(page);
  expect(Math.abs(restored.x - moved.x)).toBeLessThan(2);
  expect(Math.abs(restored.y - moved.y)).toBeLessThan(2);
}

test('Ferromancia abre encaixada à direita, vira janela livre, arrasta e lembra a posição', async ({ page }) => {
  await checkWindow(page, openFerro);
  await expect(page.locator('#panel .fe-treewrap')).toBeVisible();
  const scroll = await page.locator('#panel .panel-body').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(scroll).toBeLessThanOrEqual(1);
});

test('Oficina abre encaixada à direita, vira janela livre, arrasta e lembra a posição', async ({ page }) => {
  await checkWindow(page, openWorkshop);
});

test('cada janela guarda a própria posição', async ({ page }) => {
  await seedSave(page);
  await page.addInitScript(() => {
    try { if (localStorage.getItem('scrapo.invDock') === null) localStorage.setItem('scrapo.invDock', JSON.stringify({ mode: 'left', x: 80, y: 70 })); } catch { /* storage unavailable */ }
  });
  await enterWorld(page, 'patio');
  await openFerro(page);
  await expect(panel(page)).toHaveAttribute('data-dock', 'right');
  await press(page, 'Escape');
  await expect(panel(page)).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: 'inventory' })));
  await expect(panel(page)).toHaveAttribute('data-dock', 'left');
});
