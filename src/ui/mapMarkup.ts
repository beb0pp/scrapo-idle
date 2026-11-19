import { enemyIconUrls } from '../art/enemyArt';
import type { ElementMode, SortDir, SortKey } from '../core/huntFilter';
import { PILE_TABLES } from '../data/areas';
import { ELEMENTS } from '../data/elements';
import { ENEMY_INFO, type EnemyKind } from '../data/enemies';
import { REGIONS, type AreaSize, type HuntArea, type Region } from '../data/hunt';
import { ITEMS, type ItemId } from '../data/items';
import { elementChip } from './elementChip';
import { esc, icon } from './shared';

export const SIZE_LABEL: Record<AreaSize, string> = { small: 'Pequena', medium: 'Média', large: 'Grande' };
export const MODE_LABEL: Record<ElementMode, string> = { of: 'Do tipo', weak: 'Fraco contra', strong: 'Forte contra' };
export const MODE_HELP: Record<ElementMode, string> = {
  of: 'Áreas com inimigos destes tipos.',
  weak: 'Seus ataques destes tipos causam ×2 nos inimigos da área.',
  strong: 'Inimigos da área resistem (×0,5) a ataques destes tipos.',
};

const LOCK = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3 4V3a2 2 0 0 1 4 0v1h1v5H2V4zm1 0h2V3a1 1 0 0 0-2 0z" fill="currentColor"/></svg>';

export function enemyIcon(kind: EnemyKind, cls = 'mapw-eico'): string {
  const url = enemyIconUrls[kind];
  return url ? `<img class="${cls}" src="${url}" alt="">` : `<i class="${cls}"></i>`;
}

export function regionTabs(current: string, heroLevel: number): string {
  return REGIONS.map((r) => {
    const locked = heroLevel < r.minLevel;
    const on = r.id === current;
    const tip = locked ? ` title="Exige Nv ${r.minLevel}"` : ` title="${esc(r.desc)}"`;
    return `<button role="tab" class="mapw-tab${on ? ' is-on' : ''}" data-region="${r.id}" data-fk="tab:${r.id}" aria-selected="${on}" tabindex="${on ? 0 : -1}"${locked ? ' disabled' : ''}${tip}>`
      + `<span>${esc(r.name)}</span><small>${locked ? `${LOCK} ` : ''}Nv ${r.minLevel}</small></button>`;
  }).join('');
}

/** Highest-weight finds of the area's table, scrap left out since every area drops it. */
function lootHint(area: HuntArea): string {
  const table = PILE_TABLES[area.loot]?.loot ?? [];
  const finds = table.filter((e) => e.item !== 'scrap').slice(0, 4).map((e) => e.item as ItemId);
  return finds.map((id) => `<span class="mapw-loot" title="${esc(ITEMS[id].name)}">${icon(id, 'mapw-lico')}</span>`).join('');
}

function enemyRows(area: HuntArea): string {
  return area.enemies.map((k) => `<li>${enemyIcon(k)}<span>${esc(ENEMY_INFO[k].name)}</span>${elementChip(ENEMY_INFO[k].element)}</li>`).join('');
}

export function marker(area: HuntArea, heroLevel: number, selected: boolean): string {
  const main = area.enemies[0];
  const above = area.level > heroLevel;
  const cls = `mapw-mark${above ? ' is-above' : ''}${selected ? ' is-sel' : ''}`;
  const label = `${area.name}, Nv ${area.level}${above ? ', acima do seu nível' : ''}`;
  return `<button class="${cls}" data-area="${area.id}" data-fk="mark:${area.id}" style="left:${area.pos.x * 100}%;top:${area.pos.y * 100}%;--el:${ELEMENTS[ENEMY_INFO[main].element].color}" aria-label="${esc(label)}" aria-pressed="${selected}">`
    + `${enemyIcon(main, 'mapw-mico')}<b class="mapw-lvl">${area.level}</b>${above ? `<i class="mapw-lock">${LOCK}</i>` : ''}</button>`;
}

export function tipCard(area: HuntArea, heroLevel: number): string {
  const above = area.level > heroLevel;
  return `<header><b>${esc(area.name)}</b><span class="mapw-nv">Nv ${area.level}</span></header>`
    + `<ul class="mapw-enemies">${enemyRows(area)}</ul>`
    + `<p class="mapw-meta"><span>Área ${SIZE_LABEL[area.size].toLowerCase()}</span><span class="mapw-loots">${lootHint(area)}</span></p>`
    + (above ? `<p class="mapw-warn">${LOCK} Acima do seu nível</p>` : '');
}

/** Travel button; an area above the hero's level shows its gate and stays disabled. */
function goButton(area: HuntArea, heroLevel: number, cls: string): string {
  if (area.level > heroLevel) {
    return `<button class="${cls}" data-fk="go:${area.id}" disabled title="Suba ao Nv ${area.level} para viajar">${LOCK} Exige Nv ${area.level}</button>`;
  }
  return `<button class="${cls}" data-travel="${area.id}" data-fk="go:${area.id}" aria-label="Viajar para ${esc(area.name)}">Viajar</button>`;
}

export function detailCard(area: HuntArea, heroLevel: number): string {
  return `<div class="mapw-card-body">${tipCard(area, heroLevel)}</div>` + goButton(area, heroLevel, 'primary mapw-go');
}

const COLUMNS: [SortKey, string][] = [['name', 'Área'], ['level', 'Nv'], ['enemies', 'Inimigos'], ['size', 'Tamanho']];

export function listTable(areas: readonly HuntArea[], heroLevel: number, sort: { key: SortKey; dir: SortDir }): string {
  const head = COLUMNS.map(([key, label]) => {
    const on = sort.key === key;
    const aria = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th aria-sort="${aria}" class="mapw-col-${key}"><button data-sort="${key}" data-fk="sort:${key}">${label}<i aria-hidden="true">${on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</i></button></th>`;
  }).join('');
  const rows = areas.map((a) => {
    const above = a.level > heroLevel;
    const enemies = a.enemies.map((k) => `<span class="mapw-ecell" title="${esc(ENEMY_INFO[k].name)}">${enemyIcon(k)}${elementChip(ENEMY_INFO[k].element)}</span>`).join('');
    return `<tr class="${above ? 'is-above' : ''}" data-row="${a.id}"><td class="mapw-col-name">${esc(a.name)}</td><td class="mapw-col-level">${above ? LOCK : ''}${a.level}</td>`
      + `<td class="mapw-col-enemies">${enemies}</td><td class="mapw-col-size">${SIZE_LABEL[a.size]}</td>`
      + `<td>${goButton(a, heroLevel, 'mapw-go')}</td></tr>`;
  }).join('');
  return `<table class="mapw-table"><thead><tr>${head}<th><span class="mapw-sr">Ação</span></th></tr></thead><tbody>${rows}</tbody></table>`
    + (areas.length ? '' : '<p class="mapw-empty">Nenhuma área com esses filtros.</p>');
}

export function footer(shown: number, total: number, region: Region, view: 'map' | 'list'): string {
  return `${shown} de ${total} áreas em ${esc(region.name)}${view === 'map' ? ' · roda do mouse para zoom, arraste para mover' : ''}`;
}
