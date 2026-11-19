import { expect, test, type Page } from '@playwright/test';
import { enterWorld, press, seedSave } from './helpers';

/** Screenshots land here when set (review), otherwise in the test output folder. */
const shot = (name: string) => (process.env.MAPA_SHOTS_DIR ? `${process.env.MAPA_SHOTS_DIR}/${name}` : test.info().outputPath(name));
const win = (page: Page) => page.locator('#panel .mapw');
/** The arrival title fades on its own; screenshots wait so it does not cover the window. */
const bannerGone = (page: Page) => expect(page.locator('#area-banner')).toHaveCount(0, { timeout: 5_000 });

async function openMap(page: Page): Promise<void> {
  await press(page, 'm');
  await expect(page.locator('#panel h2')).toHaveText('Mapa');
  await expect(win(page)).toBeVisible();
}

/** Area ids of a region whose enemies take ×2 from `attack`, computed from the game data in the page. */
const weakAreas = (page: Page, regionId: string, attack: string): Promise<string[]> =>
  page.evaluate(async ([rid, el]) => {
    const hunt = await import('/src/data/hunt.ts' as string);
    const elements = await import('/src/core/elements.ts' as string);
    const weak: string[] = elements.weakTo(el);
    return hunt.areasIn(rid).filter((a: any) => hunt.areaElements(a).some((e: string) => weak.includes(e))).map((a: any) => a.id);
  }, [regionId, attack]);

test('M abre o mapa; no Nv 1 só a primeira região abre e as outras pedem nível', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  await enterWorld(page, 'patio');
  await openMap(page);
  await expect(page.locator('#panel')).toHaveAttribute('data-dock-kind', 'map');

  const tabs = win(page).getByRole('tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  const foundry = win(page).locator('[data-region="fundicoes"]');
  await expect(foundry).toBeDisabled();
  await expect(foundry).toHaveAttribute('title', 'Exige Nv 10');
  await expect(win(page).locator('.mapw-mark')).toHaveCount(7);
  await expect(win(page).locator('.mapw-foot')).toHaveText(/^7 de 7 áreas em Várzea da Ferrugem/);

  await win(page).locator('.mapw-mark[data-area="corrego_ferro_velho"]').hover();
  await expect(win(page).locator('.mapw-tip')).toContainText('Ferro-Velho do Córrego');
  await expect(win(page).locator('.mapw-tip .el-chip[data-el="eletrico"]')).toBeVisible();

  const viewport = win(page).locator('.mapw-viewport');
  await expect(viewport).toHaveAttribute('data-scale', '1.00');
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => Number(await viewport.getAttribute('data-scale'))).toBeGreaterThan(1);

  await press(page, 'Escape');
  await expect(page.locator('#panel')).toBeHidden();
  await page.locator('.skill.map-btn').click();
  await expect(win(page)).toBeVisible();
});

test('Térmico + "Fraco contra" mostra só áreas com inimigos Elétricos ou Magnéticos', async ({ page }) => {
  await seedSave(page, { xp: 5000 });
  await enterWorld(page, 'patio');
  await openMap(page);
  await expect(win(page).locator('.mapw-tab.is-on')).toHaveAttribute('data-region', 'fundicoes');
  await win(page).locator('[data-region="varzea"]').click();

  await win(page).locator('.mapw-dd').click();
  await expect(win(page).locator('.mapw-pop')).toBeVisible();
  await win(page).getByRole('button', { name: 'Fraco contra' }).click();
  await win(page).locator('.mapw-pop input[data-el="termico"]').check();
  await expect(win(page).locator('.mapw-help')).toContainText('×2');

  const expected = await weakAreas(page, 'varzea', 'termico');
  expect(expected.length).toBeGreaterThan(0);
  expect(expected.length).toBeLessThan(7);
  const shown = await win(page).locator('.mapw-mark').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.area));
  expect(shown.sort()).toEqual([...expected].sort());
  await expect(win(page).locator('.mapw-foot')).toHaveText(new RegExp(`^${expected.length} de 7 áreas`));
  await expect(win(page).locator('.mapw-dd')).toContainText('Fraco contra: Térmico');
  await bannerGone(page);
  await page.screenshot({ path: shot('mapa-3.png') });

  await press(page, 'Escape');
  await expect(win(page).locator('.mapw-pop')).toBeHidden();
  await expect(page.locator('#panel')).toBeVisible();
});

test('lista ordena por nível e "Caçar aqui" leva até a área', async ({ page }) => {
  await seedSave(page, { xp: 5000 });
  await enterWorld(page, 'patio');
  await openMap(page);
  await win(page).locator('.mapw-mark[data-area="cadinho_rachado"]').click();
  await expect(win(page).locator('.mapw-card')).toContainText('Cadinho Rachado');
  await expect(win(page).locator('.mapw-card')).toContainText('Acima do seu nível');
  await expect(win(page).locator('.mapw-card .mapw-go')).toBeDisabled();
  await expect(win(page).locator('.mapw-card .mapw-go')).toHaveText('Exige Nv 16');
  await bannerGone(page);
  await page.screenshot({ path: shot('mapa-1.png') });

  await win(page).getByRole('button', { name: 'Lista' }).click();
  const rows = win(page).locator('.mapw-table tbody tr');
  await expect(rows).toHaveCount(7);
  await expect(rows.first()).toHaveAttribute('data-row', 'forno_frio');
  await win(page).locator('[data-sort="level"]').click();
  await expect(rows.first()).toHaveAttribute('data-row', 'chamine_caida');
  await page.screenshot({ path: shot('mapa-2.png') });

  await win(page).locator('[data-region="varzea"]').click();
  await win(page).getByRole('button', { name: 'Caçar em Valas de Lata' }).click();
  await page.waitForFunction(() => {
    const w = (window as any).__scrapo.world();
    return w.mapId === 'hunt' && !!w.player?.body && w.areaName === 'Valas de Lata';
  }, null, { timeout: 20_000 });
  await expect(page.locator('#panel')).toBeHidden();
});

test('a área onde o herói está aparece como "Caçando" no mapa e na lista', async ({ page }) => {
  await seedSave(page, { xp: 0 });
  await enterWorld(page, 'patio');
  await openMap(page);
  await expect(win(page).locator('.mapw-here')).toHaveCount(0);
  await win(page).locator('.mapw-mark[data-area="valas_de_lata"]').click();
  await win(page).getByRole('button', { name: 'Caçar em Valas de Lata' }).click();
  await page.waitForFunction(() => {
    const w = (window as any).__scrapo.world();
    return w.mapId === 'hunt' && !!w.player?.body && w.areaName === 'Valas de Lata';
  }, null, { timeout: 20_000 });

  await openMap(page);
  const here = win(page).locator('.mapw-mark.is-here');
  await expect(here).toHaveCount(1);
  await expect(here).toHaveAttribute('data-area', 'valas_de_lata');
  await expect(here.locator('.mapw-here')).toHaveText('Caçando');
  await expect(here.locator('.mapw-here')).toBeVisible();
  await expect(here).toHaveAttribute('aria-label', /caçando aqui/);
  await bannerGone(page);
  await page.screenshot({ path: shot('mapa-cacando.png') });

  await win(page).getByRole('button', { name: 'Lista' }).click();
  const row = win(page).locator('.mapw-table tr.is-here');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-row', 'valas_de_lata');
  await expect(row.locator('.mapw-here')).toHaveText('Caçando');
  await expect(row.getByRole('button', { name: 'Caçar em Valas de Lata' })).toBeEnabled();
});

test('selecionar uma área mostra a previsão (XP/h, Sucata/h) e "Caçar aqui" viaja', async ({ page }) => {
  await seedSave(page, { xp: 5000 });
  await enterWorld(page, 'patio');
  await openMap(page);
  await win(page).locator('[data-region="varzea"]').click();
  await win(page).locator('.mapw-mark[data-area="corrego_ferro_velho"]').click();
  const card = win(page).locator('.mapw-card');
  await expect(card).toContainText('Ferro-Velho do Córrego');
  const xp = card.locator('[data-fc="xp"] dd');
  const scrap = card.locator('[data-fc="scrap"] dd');
  await expect(card.locator('[data-fc="xp"] dt')).toHaveText('XP/h');
  await expect(card.locator('[data-fc="scrap"] dt')).toHaveText('Sucata/h');
  await expect(xp).toHaveText(/^[\d.]+$/);
  expect(Number((await xp.innerText()).replace(/\./g, ''))).toBeGreaterThan(0);
  expect(Number((await scrap.innerText()).replace(/\./g, ''))).toBeGreaterThan(0);
  await expect(card.locator('.mapw-fc-note')).toHaveText('estimativa');
  await expect(card.locator('.mapw-fc-drop').first()).toContainText('%');
  await expect(card.locator('.mapw-fc-el .el-chip[data-el="eletrico"]')).toBeVisible();
  await bannerGone(page);
  await card.screenshot({ path: process.env.MAPA_CARD_SHOT ?? shot('mapa-previsao.png') });

  const go = card.getByRole('button', { name: 'Caçar em Ferro-Velho do Córrego' });
  await expect(go).toHaveText('Caçar aqui');
  await expect(go).toBeEnabled();
  await go.click();
  await page.waitForFunction(() => {
    const w = (window as any).__scrapo.world();
    return w.mapId === 'hunt' && !!w.player?.body && w.areaName === 'Ferro-Velho do Córrego';
  }, null, { timeout: 20_000 });
  await expect(page.locator('#panel')).toBeHidden();
});
