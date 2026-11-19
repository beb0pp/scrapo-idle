import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { enterGame, tap, trackErrors, warp } from './helpers';

// Three 5-minute unattended runs. Opt-in (≈16 min): SCRAPO_AUTO_SOAK=1 npx playwright test e2e/auto.spec.ts
const SOAK = !!process.env.SCRAPO_AUTO_SOAK;
const MINUTES = Number(process.env.SCRAPO_AUTO_MINUTES ?? 5);
const STALL_MS = 30_000;

interface Sample { t: number; map: string; x: number; y: number; items: number; kills: number; hp: number; busy: boolean }

const sample = (page: Page): Promise<Sample> => page.evaluate(() => {
  const S = (window as any).__scrapo;
  const w = S.world();
  const s = S.session.state;
  const modal = !document.getElementById('modal')!.hidden;
  return {
    t: Date.now(), map: w?.mapId ?? '?', x: Math.round(w?.feetX ?? 0), y: Math.round(w?.feetY ?? 0),
    items: Object.values(s.inventory as Record<string, number>).reduce((a, b) => a + b, 0),
    kills: s.stats.kills, hp: Math.round(S.session.hp),
    busy: !!w?.searching || !!w?.transitioning || modal,
  };
});

async function soak(page: Page, start: 'yard' | 'dungeon', withDrone: boolean, label: string) {
  const errors = trackErrors(page);
  await enterGame(page);
  if (withDrone) {
    await page.evaluate(() => (window as any).__scrapo.session.mutate((s: any) => {
      s.equipped.drone = 'drone_spark';
      s.equipped.module = 'mod_claw';
    }));
  }
  await warp(page, start);
  await tap(page, 't');
  const samples: Sample[] = [];
  let stalls = 0;
  let stillSince = Date.now();
  const end = Date.now() + MINUTES * 60_000;
  while (Date.now() < end) {
    await page.waitForTimeout(5000);
    const s = await sample(page);
    const prev = samples[samples.length - 1];
    if (prev && (Math.abs(s.x - prev.x) > 2 || Math.abs(s.y - prev.y) > 2 || s.items !== prev.items || s.busy || s.map !== prev.map)) stillSince = s.t;
    if (s.t - stillSince > STALL_MS) {
      stalls++;
      stillSince = s.t;
    }
    samples.push(s);
  }
  const log = await page.evaluate(() => (window as any).__scrapo.session.autoLog);
  const first = samples[0];
  const last = samples[samples.length - 1];
  const report = {
    label, start, withDrone, minutes: MINUTES, stalls,
    itemsGained: last.items - first.items, kills: last.kills - first.kills, minHp: Math.min(...samples.map((s) => s.hp)),
    maps: [...new Set(samples.map((s) => s.map))], ...log, errors,
  };
  fs.mkdirSync('.snapshots', { recursive: true });
  fs.appendFileSync('.snapshots/auto-sessions.jsonl', JSON.stringify(report) + '\n');
  console.log(JSON.stringify(report));
  expect(errors).toEqual([]);
  expect(stalls, 'hero stood still for 30 s+ outside salvage/modals').toBe(0);
  expect(report.itemsGained + report.kills).toBeGreaterThan(0);
}

test.describe('auto mode soak', () => {
  test.skip(!SOAK, 'set SCRAPO_AUTO_SOAK=1 to run the long auto sessions');
  test.describe.configure({ timeout: (MINUTES + 2) * 60_000 });
  test('session 1: rail yard, no drone', async ({ page }) => soak(page, 'yard', false, 's1-yard'));
  test('session 2: dungeon, no drone', async ({ page }) => soak(page, 'dungeon', false, 's2-dungeon'));
  test('session 3: dungeon then whatever auto reaches, with drone', async ({ page }) => soak(page, 'dungeon', true, 's3-dungeon-drone'));
});
