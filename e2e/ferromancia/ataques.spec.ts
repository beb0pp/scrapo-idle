import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { enterWorld, heroClip, press, readState, seedSave, teleportFeet } from './helpers';

// Arco Encadeado, Prensa Magnética e Respingo Ácido: aprender na árvore, equipar em Z/X/C e conjurar num inimigo.

const SHOTS_DIR = process.env.FERRO_SHOTS_DIR;
const SPELLS = [
  { id: 'spell_arc', node: 's_mag_arc', key: 'z', element: 'eletrico', shot: 'feitico-eletrico.png', shotMs: 430 },
  { id: 'spell_crush', node: 's_mag_crush', key: 'x', element: 'magnetico', shot: 'feitico-magnetico.png', shotMs: 480 },
  { id: 'spell_acid', node: 's_mag_acid', key: 'c', element: 'corrosivo', shot: 'feitico-corrosivo.png', shotMs: 560 },
] as const;

const shotPath = (name: string) => (SHOTS_DIR ? join(SHOTS_DIR, name) : test.info().outputPath(name));

/** Records every damageEnemy call as (enemy index, element) without changing what it does. */
async function spyDamage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = (window as any).__scrapo.world();
    const orig = w.damageEnemy.bind(w);
    (window as any).__hits = [];
    w.damageEnemy = (e: any, n: number, el: string | null = null) => {
      (window as any).__hits.push({ index: w.enemies.indexOf(e), el });
      orig(e, n, el);
    };
  });
}

/** Pauses the game loop `ms` of scene time from now, so the capture lands on the planned frame. */
const freezeAfter = (page: Page, ms: number) => page.evaluate((delay) => new Promise<void>((done) => {
  const s = (window as any).__scrapo;
  s.world().time.delayedCall(delay, () => { s.game.pause(); done(); });
}), ms);

const hits = (page: Page) => page.evaluate(() => (window as any).__hits as { index: number; el: string | null }[]);

/** A live enemy with no other enemy within 90 px, so the chain and the crush hit only it. */
const lonelyEnemy = (page: Page) => page.evaluate(() => {
  const all = (window as any).__scrapo.world().enemies as any[];
  const live = all.filter((e) => e.alive);
  const e = live.find((c) => live.every((o) => o === c || Math.hypot(o.x - c.x, o.y - c.y) > 90));
  return e ? { x: e.x as number, y: e.y as number, index: all.indexOf(e) } : null;
});

test('feitiços de ataque: aprender, equipar e conjurar com o elemento certo', async ({ page }) => {
  await seedSave(page, {
    inventory: { ether_shard: 1, reagent_ember: 2, reagent_ward: 2, reagent_lodestone: 2 },
    ferro: { built: ['b_workshop', 'b_alchemy'], learned: ['s_mag_init', 's_mag_lode'], discovered: ['ether_vein'] },
    stats: { kills: 30 },
  });
  await enterWorld(page, 'yard');

  await press(page, 'k');
  await expect(page.locator('#panel .ferro')).toBeVisible();
  await page.locator('[data-act="f-tab:skill"]').click();
  for (const s of SPELLS) {
    await page.locator(`[data-node="${s.node}"]`).click();
    await page.locator(`[data-act="f-learn:${s.node}"]`).click();
    await expect(page.locator(`[data-node="${s.node}"]`)).toHaveAttribute('data-status', 'owned');
  }
  expect(await readState<number>(page, 's.inventory.ether_shard ?? 0'), 'Respingo Ácido costs one Ether shard').toBe(0);

  await page.locator('[data-act="f-tab:grimoire"]').click();
  for (const [slot, s] of SPELLS.entries()) await page.locator(`[data-act="f-equip:${s.id}:${slot}"]`).click();
  expect(await readState<string[]>(page, 's.ferro.loadout')).toEqual(SPELLS.map((s) => s.id));
  for (const s of SPELLS) await expect(page.locator(`.fe-spell[data-spell="${s.id}"]`)).toHaveClass(/is-equipped/);
  await page.locator('.fe-spell[data-spell="spell_acid"]').scrollIntoViewIfNeeded();
  await page.locator('#panel').screenshot({ path: shotPath('feiticos-painel.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel .ferro')).toBeHidden();

  await spyDamage(page);
  // Closer camera for the captures only; it does not touch any rule.
  await page.evaluate(() => { const cam = (window as any).__scrapo.world().cameras.main; cam.setZoom(cam.zoom * 2); });
  for (const s of SPELLS) {
    const target = await lonelyEnemy(page);
    expect(target, `yard must hold a lonely enemy for ${s.id}`).not.toBeNull();
    await teleportFeet(page, target!.x - 34, target!.y);
    // Sturdy target and full mana: the check is about element and targeting, not about killing or regen.
    await page.evaluate((i) => {
      const s = (window as any).__scrapo;
      s.world().enemies[i].hp = 500;
      (window as any).__hits.length = 0;
      s.ferro().mana.value = 999;
    }, target!.index);

    await press(page, s.key);
    await freezeAfter(page, s.shotMs);
    await page.screenshot({ path: shotPath(s.shot), clip: await heroClip(page, 320) });
    await page.evaluate(() => (window as any).__scrapo.game.resume());

    await expect.poll(async () => (await hits(page)).filter((h) => h.index === target!.index && h.el === s.element).length,
      { timeout: 3000, message: `${s.id} damages the target with ${s.element}` }).toBeGreaterThan(0);
    const hp = await page.evaluate((i) => (window as any).__scrapo.world().enemies[i].hp as number, target!.index);
    expect(hp).toBeLessThan(500);
    expect(await page.locator(`#spellbar [data-spell-slot="${SPELLS.indexOf(s)}"]`).getAttribute('data-spell-id')).toBe(s.id);
  }

  // The acid puddle keeps corroding after the splash: more Corrosivo hits arrive over its 3 s.
  await expect.poll(async () => (await hits(page)).filter((h) => h.el === 'corrosivo').length,
    { timeout: 4000, message: 'puddle ticks land after the splash' }).toBeGreaterThanOrEqual(3);
});
