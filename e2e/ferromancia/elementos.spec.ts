import { expect, test } from '@playwright/test';
import { enterWorld, heroClip, press, seedSave, teleportFeet } from './helpers';

const MAGE = {
  built: ['b_workshop', 'b_alchemy'],
  learned: ['s_mag_init', 's_mag_ward', 's_mag_lode'],
  loadout: ['spell_ember', 'spell_ward', 'spell_lodestone'] as [string, string, string],
  discovered: ['ether_vein'],
};

test('Lança de Brasa (Térmico) num inimigo Elétrico mostra "Eficaz!" e dobra o dano', async ({ page }) => {
  await seedSave(page, { inventory: { reagent_ember: 3 }, ferro: MAGE, stats: { kills: 30 } });
  await enterWorld(page, 'yard');

  const target = await page.evaluate(() => {
    const list = ((window as any).__scrapo.world().enemies as any[]).filter((e) => e.alive);
    const lonely = list.filter((e) => e.element === 'eletrico' && list.every((o) => o === e || Math.hypot(o.x - e.x, o.y - e.y) > 70));
    const e = lonely[0];
    return e ? { x: e.x, y: e.y, hp: e.hp as number, index: (window as any).__scrapo.world().enemies.indexOf(e) as number } : null;
  });
  expect(target, 'yard must hold an Elétrico enemy away from the others').not.toBeNull();
  await teleportFeet(page, target!.x - 28, target!.y);
  await expect.poll(() => page.evaluate(() => (window as any).__scrapo.ferro().mana.value as number)).toBeGreaterThanOrEqual(12);

  const eficaz = () => page.evaluate(() =>
    ((window as any).__scrapo.world().children.list as any[]).some((c) => c.type === 'Text' && c.text === 'Eficaz!' && c.active));
  expect(await eficaz()).toBe(false);
  await press(page, 'z');
  await page.waitForFunction(() =>
    ((window as any).__scrapo.world().children.list as any[]).some((c) => c.type === 'Text' && c.text === 'Eficaz!' && c.active),
  null, { timeout: 4000, polling: 'raf' });
  await page.waitForTimeout(120);
  await page.screenshot({ path: test.info().outputPath('eficaz.png'), clip: await heroClip(page, 240) });

  const hpAfter = await page.evaluate((i) => (window as any).__scrapo.world().enemies[i].hp as number, target!.index);
  expect(target!.hp - hpAfter, 'Térmico ×2 on Elétrico deals more than the 36 base of an empowered cast').toBeGreaterThan(36);
});
