import type { HuntForecast, Matchup } from '../core/huntForecast';
import { ITEMS } from '../data/items';
import { elementChip } from './elementChip';
import { esc, icon } from './shared';

const MATCHUP_LABEL: Record<Matchup, string> = { eficaz: 'Eficaz', resiste: 'Resiste', neutro: 'Neutro' };
const MATCHUP_HELP: Record<Matchup, string> = {
  eficaz: 'Seus golpes causam ×2 neste tipo.',
  resiste: 'Este tipo resiste (×0,5) aos seus golpes.',
  neutro: 'Seus golpes causam dano normal neste tipo.',
};

const num = (n: number) => n.toLocaleString('pt-BR');
const pct = (p: number) => `${Math.max(1, Math.round(p * 100))}%`;

function stat(key: string, label: string, value: number): string {
  return `<div class="mapw-fc-stat" data-fc="${key}"><dt>${label}</dt><dd>${num(value)}</dd></div>`;
}

/** Compact estimate block of the detail card: rates, likely drops and how the hero's hits fare per element. */
export function forecastBlock(fc: HuntForecast): string {
  const drops = fc.drops.map((d) => {
    const name = ITEMS[d.item].name;
    return `<li class="mapw-fc-drop" title="${esc(`${name}: ${pct(d.chance)} por abate`)}">${icon(d.item, 'mapw-lico')}<span>${pct(d.chance)}</span><span class="mapw-sr">${esc(name)}</span></li>`;
  }).join('');
  const seen = new Set<string>();
  const matchups = fc.enemies.filter((e) => !seen.has(e.element) && seen.add(e.element)).map((e) =>
    `<li class="mapw-fc-el is-${e.matchup}" title="${MATCHUP_HELP[e.matchup]}">${elementChip(e.element)}<small>${MATCHUP_LABEL[e.matchup]}</small></li>`).join('');
  return `<section class="mapw-fc" aria-label="Previsão de caçada (estimativa)">`
    + `<dl class="mapw-fc-stats">${stat('xp', 'XP/h', fc.xpPerHour)}${stat('scrap', 'Sucata/h', fc.scrapPerHour)}${stat('kills', 'Abates/h', fc.killsPerHour)}</dl>`
    + (drops ? `<ul class="mapw-fc-drops" aria-label="Drops por abate">${drops}</ul>` : '')
    + `<ul class="mapw-fc-els" aria-label="Seus golpes contra">${matchups}</ul>`
    + `<small class="mapw-fc-note">estimativa</small></section>`;
}
