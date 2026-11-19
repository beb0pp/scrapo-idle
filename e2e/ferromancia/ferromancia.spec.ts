import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  enemyHp, enterWorld, firstEnemy, fullState, heroClip, modalHidden, openGame, press, readState, seedSave, teleportFeet,
} from './helpers';

const SHOTS = 'docs/capturas';
const LOADOUT: ['spell_ember', 'spell_ward', 'spell_lodestone'] = ['spell_ember', 'spell_ward', 'spell_lodestone'];
const MAGE = {
  built: ['b_workshop', 'b_alchemy'],
  learned: ['s_mag_init', 's_mag_ward', 's_mag_lode'],
  loadout: LOADOUT,
  discovered: ['ether_vein'],
};
const REAGENTS = { reagent_ember: 5, reagent_ward: 5, reagent_lodestone: 5 };

const openFerro = async (page: Page, tab?: string) => {
  await press(page, 'k');
  await expect(page.locator('#panel .ferro')).toBeVisible();
  if (tab) await page.locator(`[data-act="f-tab:${tab}"]`).click();
};
const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const inv = (page: Page, id: string) => readState<number>(page, `s.inventory.${id} ?? 0`);
const feetNear = async (page: Page, pt: { x: number; y: number }, dx = 40) => teleportFeet(page, pt.x + dx, pt.y);
const ferroProp = <T>(page: Page, prop: string) => page.evaluate((p) => (window as any).__scrapo.ferro()[p] as T, prop);

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

test('a. desbloquear: veio de Éter libera a Estação Alquímica', async ({ page }) => {
  await seedSave(page, { inventory: { scrap: 20, cable: 2 }, ferro: { built: ['b_workshop'] } });
  await enterWorld(page, 'yard');
  await openFerro(page, 'build');
  await expect(node(page, 'b_alchemy')).toHaveAttribute('data-status', 'locked');
  await page.keyboard.press('Escape');

  const vein = await page.evaluate(() => {
    const v = (window as any).__scrapo.ferro().veins[0];
    return v ? { x: v.x, y: v.y } : null;
  });
  expect(vein, 'yard must place at least one reachable Ether vein').not.toBeNull();
  await teleportFeet(page, vein!.x, vein!.y);
  await press(page, 'f');
  await expect.poll(() => readState<string[]>(page, 's.ferro.discovered'), { timeout: 5000 }).toContain('ether_vein');
  expect(await inv(page, 'ether_shard')).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal button.primary').click();
  expect(await modalHidden(page)).toBe(true);
  await openFerro(page, 'build');
  await expect(node(page, 'b_alchemy')).toHaveAttribute('data-status', 'available');
});

test('b. construir, aprender, transmutar e equipar pela UI, sem cobrança dupla', async ({ page }) => {
  await seedSave(page, {
    inventory: { scrap: 30, cable: 3, gear: 2, ether_shard: 3 },
    ferro: { discovered: ['ether_vein'] },
  });
  await enterWorld(page, 'yard');
  await openFerro(page, 'build');

  const scrap0 = await inv(page, 'scrap');
  await page.evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>('[data-act="f-build:b_workshop"]')!;
    b.click();
    b.click();
  });
  await expect(node(page, 'b_workshop')).toHaveAttribute('data-status', 'owned');
  expect(await inv(page, 'scrap')).toBe(scrap0 - 6);
  expect(await readState<string[]>(page, 's.ferro.built')).toEqual(['b_workshop']);

  await page.locator('[data-act="f-build:b_alchemy"]').click();
  await expect(node(page, 'b_alchemy')).toHaveAttribute('data-status', 'owned');
  expect(await inv(page, 'scrap')).toBe(scrap0 - 14);
  expect(await inv(page, 'ether_shard')).toBe(2);

  await page.locator('[data-act="f-tab:skill"]').click();
  for (const id of ['s_mag_init', 's_mag_ward', 's_mag_lode']) {
    await page.locator(`[data-act="f-learn:${id}"]`).click();
    await expect(node(page, id)).toHaveAttribute('data-status', 'owned');
  }
  expect(await readState<string[]>(page, 's.ferro.learned')).toEqual(['s_mag_init', 's_mag_ward', 's_mag_lode']);

  await page.locator('[data-act="f-tab:grimoire"]').click();
  for (const id of ['t_ember', 't_ward', 't_lodestone']) await page.locator(`[data-act="f-transmute:${id}"]`).click();
  expect(await inv(page, 'reagent_ember')).toBe(2);
  expect(await inv(page, 'reagent_ward')).toBe(2);
  expect(await inv(page, 'reagent_lodestone')).toBe(3);

  await page.locator('[data-act="f-equip:spell_ember:0"]').click();
  await page.locator('[data-act="f-equip:spell_ward:1"]').click();
  await page.locator('[data-act="f-equip:spell_lodestone:2"]').click();
  expect(await readState<string[]>(page, 's.ferro.loadout')).toEqual(LOADOUT);
  await expect(page.locator('#spellbar [data-spell-slot="0"]')).toContainText('Lança de Brasa');
});

test('c. conjurar manual: custo, cooldown e capturas', async ({ page }) => {
  await seedSave(page, { inventory: { scrap: 5, ...REAGENTS }, ferro: MAGE });
  await enterWorld(page, 'yard');
  const enemy = await firstEnemy(page);
  await feetNear(page, enemy, 40);

  const shot = async (spell: string) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${spell}-inicio.png`, clip: await heroClip(page) });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/${spell}-pico.png`, clip: await heroClip(page) });
  };

  const hp0 = enemy.hp;
  await press(page, 'z');
  await shot('ember');
  expect(await inv(page, 'reagent_ember')).toBe(4);
  await expect.poll(() => enemyHp(page, enemy.index), { timeout: 3000, message: 'impact lands after prep+circle+travel phases' }).toBeLessThan(hp0);
  await press(page, 'z');
  await page.waitForTimeout(200);
  expect(await inv(page, 'reagent_ember'), 'cooldown blocks a second paid cast').toBe(4);

  await press(page, 'x');
  await shot('ward');
  await expect.poll(() => ferroProp<number>(page, 'shield')).toBeGreaterThan(0);
  expect(await inv(page, 'reagent_ward')).toBe(4);

  await press(page, 'c');
  await shot('lodestone');
  expect(await inv(page, 'reagent_lodestone')).toBe(4);
  expect(await ferroProp<boolean>(page, 'searchBonus')).toBe(true);
});

test('d. conjurar no Auto: Égide com vida baixa e Lança em alcance', async ({ page }) => {
  await seedSave(page, { inventory: { scrap: 5, ...REAGENTS }, ferro: MAGE });
  await enterWorld(page, 'yard');
  const enemy = await firstEnemy(page);
  await feetNear(page, enemy, 30);
  await press(page, 't');
  expect(await page.evaluate(() => (window as any).__scrapo.session.autoMode)).toBe(true);
  await page.evaluate(() => { (window as any).__scrapo.session.hp = 30; });

  await expect.poll(() => inv(page, 'reagent_ward'), { timeout: 3000 }).toBeLessThan(5);
  await expect.poll(() => ferroProp<number>(page, 'shield'), { timeout: 3000 }).toBeGreaterThan(0);
  await expect.poll(() => inv(page, 'reagent_ember'), { timeout: 3000 }).toBeLessThan(5);
});

test.describe.serial('e/f. recrutar, sinergia e persistência', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: 'http://localhost:5192' })).newPage();
    await seedSave(page, {
      inventory: { scrap: 12, cell: 1, reagent_ward: 2, reagent_ember: 3 },
      ferro: { ...MAGE, built: ['b_workshop', 'b_bench_modules', 'b_alchemy'] },
    });
  });
  test.afterAll(async () => { await page.context().close(); });

  const defense = () => page.evaluate(async () => {
    const m = await import('/src/core/derived.ts');
    return m.playerStats((window as any).__scrapo.session.state).defesa as number;
  });

  test('e. recrutar Cobalto e ativar sinergias', async () => {
    await enterWorld(page, 'yard');
    const sleeper = await page.evaluate(() => {
      const s = (window as any).__scrapo.ferro().sleeper;
      return s ? { x: s.x, y: s.y } : null;
    });
    expect(sleeper, 'yard must place the sleeping automaton').not.toBeNull();
    await teleportFeet(page, sleeper!.x, sleeper!.y);
    await press(page, 'f');
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal button', { hasText: 'Consertar' }).click();
    await expect.poll(() => readState<string[]>(page, 's.ferro.recruited')).toContain('cobalto');
    expect(await page.evaluate(() => !!(window as any).__scrapo.ferro().ally?.sprite?.active)).toBe(true);
    expect(await inv(page, 'cell')).toBe(0);
    expect(await inv(page, 'reagent_ward')).toBe(0);

    await openFerro(page, 'party');
    await expect(page.locator('[data-slot="front"]')).toHaveAttribute('data-member', 'ferrugem');
    await expect(page.locator('[data-slot="back"]')).toHaveAttribute('data-member', 'cobalto');
    await expect(page.locator('[data-synergy="resonance"]')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-synergy="bulwark"]')).toHaveAttribute('data-active', 'false');
    const before = await defense();

    await page.locator('[data-act="f-form:front:cobalto"]').click();
    await expect(page.locator('[data-synergy="bulwark"]')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-synergy="resonance"]')).toHaveAttribute('data-active', 'false');
    expect(await defense()).toBe(before + 4);
  });

  test('f. salvar e voltar: reload mantém tudo e o aliado reaparece', async () => {
    const before = await fullState(page);
    await page.reload();
    await openGame(page);
    const after = await fullState(page);
    expect(after.ferro).toEqual(before.ferro);
    expect(after.ferro.built).toEqual(expect.arrayContaining(['b_workshop', 'b_bench_modules', 'b_alchemy']));
    expect(after.ferro.learned).toEqual(['s_mag_init', 's_mag_ward', 's_mag_lode']);
    expect(after.ferro.loadout).toEqual(LOADOUT);
    expect(after.ferro.recruited).toEqual(['cobalto']);
    expect(after.ferro.formation).toEqual({ front: 'cobalto', back: 'ferrugem' });
    await enterWorld(page, 'yard');
    await expect.poll(() => page.evaluate(() => !!(window as any).__scrapo.ferro().ally?.sprite?.active)).toBe(true);
  });
});

test('g. regressões: drone, mochila, mercado e cooldown no HUD', async ({ page }) => {
  await seedSave(page, {
    currency: 0,
    inventory: { pulse_core: 1, drone_chassis: 1, gear: 2, cable: 1, scrap: 12, ...REAGENTS },
    ferro: MAGE,
  });
  await enterWorld(page, 'patio');
  const panel = (kind: string) => page.evaluate((k) => window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: k })), kind);

  await panel('workshop');
  await page.locator('[data-act="craft:rcp_mod_claw"]').click();
  await page.locator('[data-act="craft:rcp_drone_spark"]').click();
  expect(await readState(page, 's.equipped.drone')).toBe('drone_spark');
  await page.keyboard.press('Escape');

  await press(page, 'i');
  await expect(page.locator('#panel h2')).toHaveText('Mochila');
  await expect(page.locator('[data-act="select:reagent_ember"]')).toBeVisible();
  await page.keyboard.press('Escape');

  await panel('vendor');
  await page.locator('[data-act="vendor-tab:sell"]').click();
  const money = await readState<number>(page, 's.currency');
  await page.locator('[data-act="sell:reagent_ember"]:not([data-qty])').click();
  expect(await readState<number>(page, 's.currency')).toBe(money + 3);
  expect(await inv(page, 'reagent_ember')).toBe(4);
  await page.keyboard.press('Escape');

  await press(page, 'x');
  await expect.poll(() => page.locator('#spellbar [data-spell-slot="1"] .cd').evaluate((el) => parseFloat((el as HTMLElement).style.height || '0')), { timeout: 3000 }).toBeGreaterThan(0);
  await expect(page.locator('#spellbar [data-spell-slot="1"]')).toHaveClass(/is-cooling/);
});
