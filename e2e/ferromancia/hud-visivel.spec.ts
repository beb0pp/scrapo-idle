import { expect, test, type Page } from '@playwright/test';
import { enterWorld, press, seedSave, teleportFeet } from './helpers';

/** Screenshot lands in HUD_SHOT when set (review), otherwise in the test output folder. */
const shot = () => process.env.HUD_SHOT ?? test.info().outputPath('hud-visivel.png');
const panelTitle = (page: Page) => page.locator('#panel h2');

async function benchSpot(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const w = (window as any).__scrapo.world();
    const bench = (w.interactables as any[]).find((it) => it.label() === 'F —Oficina');
    return { x: bench.x, y: bench.y + 12 };
  });
}

test.beforeEach(async ({ page }) => {
  await seedSave(page, { xp: 0 });
  await enterWorld(page, 'patio');
});

test('cada ação nova tem botão visível com o atalho à mostra', async ({ page }) => {
  const badges: Array<[string, string]> = [
    ['#minimap-map-btn', 'M'],
    ['.skill.workshop-btn', 'O'],
    ['#attack-btn', 'Espaço'],
    ['#use-btn', 'F'],
  ];
  for (const [selector, key] of badges) {
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(`${selector} .skill-key`)).toBeVisible();
    await expect(page.locator(`${selector} .skill-key`)).toHaveText(key);
  }
  await expect(page.locator('#minimap-map-btn')).toHaveAttribute('aria-label', 'Mapa de caça (M)');
  await expect(page.getByRole('button', { name: 'Atacar (Espaço)' })).toBeEnabled();
});

test('clicar num botão do HUD não deixa foco nele, então Espaço não o clica de novo', async ({ page }) => {
  for (const selector of ['#auto-btn', '.skill.map-btn', '#minimap-map-btn']) {
    await page.locator(selector).click();
    expect(await page.evaluate(() => !!document.activeElement?.closest('#hud button'))).toBe(false);
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('#auto-btn')).toHaveClass(/is-on/);
});

test('botão de mapa do minimapa abre o Mapa de caça, não o mapa regional', async ({ page }) => {
  await page.locator('#minimap-map-btn').click();
  await expect(panelTitle(page)).toHaveText('Mapa');
  await expect(page.locator('#panel .mapw')).toBeVisible();
  await expect(page.locator('#map-view')).toBeHidden();
  await press(page, 'Escape');
  await expect(page.locator('#panel')).toBeHidden();

  await page.locator('#minimap').click();
  await expect(page.locator('#map-view')).toBeVisible();
  await press(page, 'Escape');
  await expect(page.locator('#map-view')).toBeHidden();
});

test('botão Oficina e a tecla O abrem a Oficina de qualquer lugar', async ({ page }) => {
  await page.locator('.skill.workshop-btn').click();
  await expect(panelTitle(page)).toHaveText('Oficina');
  await expect(page.locator('#panel .recipes')).toBeVisible();
  await page.locator('.skill.workshop-btn').click();
  await expect(page.locator('#panel')).toBeHidden();
  await press(page, 'o');
  await expect(panelTitle(page)).toHaveText('Oficina');
});

test('Usar só acende perto de algo e usa o que o F usaria; Atacar golpeia', async ({ page }) => {
  const use = page.locator('#use-btn');
  await expect(use).toBeDisabled();
  const spot = await benchSpot(page);
  await teleportFeet(page, spot.x, spot.y);
  await expect(use).toBeEnabled();
  await expect(use).toHaveAttribute('title', 'Usar (F): Oficina');
  await use.click();
  await expect(panelTitle(page)).toHaveText('Oficina');
  await press(page, 'Escape');

  const before = await page.evaluate(() => (window as any).__scrapo.world().ready.attack as number);
  await page.locator('#attack-btn').click();
  await expect.poll(() => page.evaluate(() => (window as any).__scrapo.world().ready.attack as number)).toBeGreaterThan(before);
  await expect(page.locator('#attack-btn')).not.toBeFocused();
});

test('HUD completo no Pátio a 1280×800', async ({ page }) => {
  await expect(page.locator('#area-banner')).toHaveCount(0, { timeout: 5_000 });
  const bar = await page.locator('.hud-bottom').boundingBox();
  expect(bar).not.toBeNull();
  expect(bar!.x).toBeGreaterThanOrEqual(0);
  expect(bar!.x + bar!.width).toBeLessThanOrEqual(1280);
  expect(bar!.height).toBeLessThan(80);
  await page.screenshot({ path: shot() });
});
