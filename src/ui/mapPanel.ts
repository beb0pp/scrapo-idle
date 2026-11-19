import { ANY_FILTER, defaultRegion, filterAreas, levelRanges, sortAreas, type AreaFilter, type ElementMode, type SortKey } from '../core/huntFilter';
import { forecast } from '../core/huntForecast';
import { levelOf } from '../core/level';
import { ELEMENT_IDS, ELEMENTS, type ElementId } from '../data/elements';
import { ENEMY_INFO, ENEMY_KINDS, type EnemyKind } from '../data/enemies';
import { REGIONS, areaById, areasIn, regionById, type HuntArea, type Region } from '../data/hunt';
import { session } from '../session';
import { currentHuntArea, travelToArea } from '../travel';
import { elementChip } from './elementChip';
import { paintRegionMap } from './mapCanvas';
import { detailCard, footer, listTable, marker, MODE_HELP, MODE_LABEL, regionTabs, tipCard } from './mapMarkup';
import { attachMapView, type MapView } from './mapView';
import { esc } from './shared';
import './map.css';

interface MapUi {
  region: string | null;
  filter: AreaFilter;
  view: 'map' | 'list';
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  selected: string | null;
  typeOpen: boolean;
}

const ui: MapUi = { region: null, filter: ANY_FILTER, view: 'map', sort: { key: 'level', dir: 'asc' }, selected: null, typeOpen: false };
let root: HTMLElement | null = null;
let mapView: MapView | null = null;
let paintedRegion = '';
let shownLevel = 0;

const heroLevel = () => levelOf(session.state).level;
const q = <T extends HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;

function region(): Region {
  const level = heroLevel();
  const picked = ui.region ? regionById(ui.region) : undefined;
  if (picked && level >= picked.minLevel) return picked;
  const fallback = defaultRegion(level);
  ui.region = fallback.id;
  return fallback;
}

/** Mounts the persistent window body into the panel slot; zoom, pan and selection survive re-renders. */
export function mountMapPanel(slot: Element | null): void {
  if (!slot) return;
  if (!root) build();
  slot.replaceWith(root!);
  refresh();
}

/** Called when the window opens: resets transient bits, keeps the player's filters. */
export function resetMapPanel(): void {
  ui.typeOpen = false;
  ui.region = null;
}

function build(): void {
  root = document.createElement('div');
  root.className = 'mapw';
  root.innerHTML = `<div class="mapw-tabs" role="tablist" aria-label="Regiões"></div>
    <div class="mapw-filters">
      <div class="mapw-type">
        <button class="mapw-dd" data-fk="type" aria-haspopup="true" aria-expanded="false" aria-controls="mapw-pop"></button>
        <div class="mapw-pop" id="mapw-pop" role="group" aria-label="Filtrar por tipo" hidden></div>
      </div>
      <select class="mapw-sel" data-fk="enemy" aria-label="Inimigo"></select>
      <select class="mapw-sel" data-fk="level" aria-label="Nível"></select>
      <input class="mapw-search" type="search" placeholder="Buscar área" aria-label="Buscar área" autocomplete="off" spellcheck="false">
      <div class="mapw-views" role="group" aria-label="Visualização">
        <button data-view="map" data-fk="view:map">Mapa</button><button data-view="list" data-fk="view:list">Lista</button>
      </div>
    </div>
    <div class="mapw-stage">
      <div class="mapw-viewport"><div class="mapw-world"><canvas class="mapw-canvas"></canvas><div class="mapw-marks"></div></div>
        <div class="mapw-zoom"><button data-zoom="in" aria-label="Aproximar">+</button><button data-zoom="out" aria-label="Afastar">−</button></div>
        <div class="mapw-tip" role="tooltip" hidden></div>
      </div>
      <div class="mapw-card" aria-live="polite"></div>
    </div>
    <div class="mapw-list"></div>
    <footer class="mapw-foot"></footer>`;
  mapView = attachMapView(q('.mapw-viewport'), q('.mapw-world'));
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKey);
  root.addEventListener('keyup', (e) => { if ((e.target as HTMLElement).matches('input, select')) e.stopPropagation(); });
  root.addEventListener('pointerover', (e) => hoverTip((e.target as HTMLElement).closest('.mapw-mark')));
  root.addEventListener('pointerout', (e) => { if ((e.target as HTMLElement).closest('.mapw-mark')) hoverTip(null); });
  root.addEventListener('focusin', (e) => hoverTip((e.target as HTMLElement).closest('.mapw-mark')));
  root.addEventListener('focusout', () => hoverTip(null));
  document.addEventListener('pointerdown', (e) => { if (ui.typeOpen && !(e.target as HTMLElement).closest('.mapw-type')) setTypeOpen(false); });
  session.onChange(() => { if (root?.isConnected && heroLevel() !== shownLevel) refresh(); });
}

function visibleAreas(r: Region): { all: HuntArea[]; shown: HuntArea[] } {
  const all = areasIn(r);
  return { all, shown: filterAreas(all, ui.filter, heroLevel()) };
}

function refresh(): void {
  if (!root) return;
  const focusKey = (document.activeElement as HTMLElement | null)?.closest('.mapw') === root ? (document.activeElement as HTMLElement).dataset.fk : undefined;
  const level = heroLevel();
  shownLevel = level;
  const r = region();
  const { all, shown } = visibleAreas(r);
  if (ui.selected && !shown.some((a) => a.id === ui.selected)) ui.selected = null;
  q('.mapw-tabs').innerHTML = regionTabs(r.id, level);
  renderType();
  renderSelects(all, level);
  root.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === ui.view)));
  root.dataset.layout = ui.view;
  if (ui.view === 'map') renderMap(r, all, shown, level);
  else q('.mapw-list').innerHTML = listTable(sortAreas(shown, ui.sort.key, ui.sort.dir), level, ui.sort, currentHuntArea());
  q('.mapw-foot').textContent = footer(shown.length, all.length, r, ui.view);
  if (focusKey) root.querySelector<HTMLElement>(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus();
}

function renderType(): void {
  const { elements, mode } = ui.filter;
  const names = elements.map((el) => ELEMENTS[el].name);
  const summary = names.length ? `${MODE_LABEL[mode]}: ${names.length > 2 ? `${names.length} tipos` : names.join(', ')}` : 'Todos os tipos';
  const dd = q('.mapw-dd');
  dd.innerHTML = `<span class="mapw-dd-k">Tipo</span><span class="mapw-dd-v">${esc(summary)}</span><i aria-hidden="true">▾</i>`;
  dd.classList.toggle('is-set', names.length > 0);
  dd.setAttribute('aria-expanded', String(ui.typeOpen));
  const modes = (Object.keys(MODE_LABEL) as ElementMode[]).map((m) =>
    `<button data-mode="${m}" data-fk="mode:${m}" aria-pressed="${m === mode}">${MODE_LABEL[m]}</button>`).join('');
  const boxes = ELEMENT_IDS.map((el) =>
    `<label class="mapw-opt"><input type="checkbox" data-el="${el}" data-fk="el:${el}"${elements.includes(el) ? ' checked' : ''}>${elementChip(el)}</label>`).join('');
  const pop = q('.mapw-pop');
  pop.hidden = !ui.typeOpen;
  pop.innerHTML = `<div class="mapw-seg" role="group" aria-label="Modo">${modes}</div><p class="mapw-help">${MODE_HELP[mode]}</p>`
    + `<label class="mapw-opt mapw-all"><input type="checkbox" data-el="all" data-fk="el:all"${elements.length ? '' : ' checked'}>Todos os tipos</label>${boxes}`;
}

function renderSelects(all: HuntArea[], level: number): void {
  const kinds = ENEMY_KINDS.filter((k) => all.some((a) => a.enemies.includes(k)));
  if (ui.filter.enemy && !kinds.includes(ui.filter.enemy)) ui.filter = { ...ui.filter, enemy: null };
  q<HTMLSelectElement>('[data-fk="enemy"]').innerHTML = `<option value="">Todos os inimigos</option>`
    + kinds.map((k) => `<option value="${k}"${ui.filter.enemy === k ? ' selected' : ''}>${esc(ENEMY_INFO[k].name)}</option>`).join('');
  const ranges = levelRanges(all);
  const current = ui.filter.levelRange;
  const value = current === null ? '' : current === 'reachable' ? 'reachable' : `${current.min}-${current.max}`;
  const options = [['', 'Todos os níveis'], ['reachable', `Até o meu (Nv ${level})`], ...ranges.map((r) => [`${r.min}-${r.max}`, r.min === r.max ? `Nv ${r.min}` : `Nv ${r.min}–${r.max}`])];
  if (!options.some(([v]) => v === value)) ui.filter = { ...ui.filter, levelRange: null };
  q<HTMLSelectElement>('[data-fk="level"]').innerHTML = options.map(([v, label]) => `<option value="${v}"${v === value ? ' selected' : ''}>${label}</option>`).join('');
}

function renderMap(r: Region, all: HuntArea[], shown: HuntArea[], level: number): void {
  if (paintedRegion !== r.id) {
    q('.mapw-viewport').style.background = paintRegionMap(q<HTMLCanvasElement>('.mapw-canvas'), r, all);
    paintedRegion = r.id;
    ui.selected = null;
  }
  const here = currentHuntArea();
  q('.mapw-marks').innerHTML = shown.map((a) => marker(a, level, a.id === ui.selected, a.id === here)).join('');
  const picked = ui.selected ? areaById(ui.selected) : undefined;
  const card = q('.mapw-card');
  card.hidden = !picked;
  card.innerHTML = picked ? detailCard(picked, level, forecast(session.state, picked)) : '';
}

function hoverTip(mark: HTMLElement | null): void {
  if (!root) return;
  const tip = q('.mapw-tip');
  const area = mark ? areaById(mark.dataset.area ?? '') : undefined;
  if (!mark || !area) { tip.hidden = true; return; }
  tip.innerHTML = tipCard(area, heroLevel());
  tip.hidden = false;
  const vp = q('.mapw-viewport').getBoundingClientRect();
  const m = mark.getBoundingClientRect();
  const left = Math.min(Math.max(6, m.left - vp.left + m.width / 2 - tip.offsetWidth / 2), vp.width - tip.offsetWidth - 6);
  const above = m.top - vp.top - tip.offsetHeight - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${above > 6 ? above : m.bottom - vp.top + 8}px`;
}

function setTypeOpen(open: boolean): void {
  ui.typeOpen = open;
  renderType();
  if (open) root?.querySelector<HTMLElement>('.mapw-pop [aria-pressed="true"]')?.focus();
}

function setFilter(patch: Partial<AreaFilter>): void {
  ui.filter = { ...ui.filter, ...patch };
  refresh();
}

function onClick(event: MouseEvent): void {
  const t = event.target as HTMLElement;
  const el = <T extends HTMLElement>(sel: string) => t.closest<T>(sel);
  const tab = el('[data-region]');
  if (tab) { ui.region = tab.dataset.region!; ui.selected = null; refresh(); return; }
  if (el('.mapw-dd')) { setTypeOpen(!ui.typeOpen); return; }
  const mode = el('[data-mode]');
  if (mode) { setFilter({ mode: mode.dataset.mode as ElementMode }); return; }
  const view = el('[data-view]');
  if (view) { ui.view = view.dataset.view as MapUi['view']; refresh(); return; }
  const zoom = el('[data-zoom]');
  if (zoom) { mapView?.zoomBy(zoom.dataset.zoom === 'in' ? 1.25 : 0.8); return; }
  const sort = el('[data-sort]');
  if (sort) {
    const key = sort.dataset.sort as SortKey;
    ui.sort = { key, dir: ui.sort.key === key && ui.sort.dir === 'asc' ? 'desc' : 'asc' };
    refresh();
    return;
  }
  const go = el('[data-travel]');
  if (go) { travelToArea(go.dataset.travel!); return; }
  const mark = el('.mapw-mark');
  if (mapView?.consumeDrag()) return;
  if (mark) {
    ui.selected = ui.selected === mark.dataset.area ? null : mark.dataset.area!;
    refresh();
    const a = ui.selected ? areaById(ui.selected) : undefined;
    if (a) mapView?.reveal(a.pos.x, a.pos.y);
  }
}

function onChange(event: Event): void {
  const t = event.target as HTMLInputElement | HTMLSelectElement;
  if (t.dataset.el) {
    const id = t.dataset.el;
    const next = id === 'all' ? [] : ui.filter.elements.includes(id as ElementId) ? ui.filter.elements.filter((e) => e !== id) : [...ui.filter.elements, id as ElementId];
    setFilter({ elements: ELEMENT_IDS.filter((e) => next.includes(e)) });
  } else if (t.dataset.fk === 'enemy') {
    setFilter({ enemy: (t.value || null) as EnemyKind | null });
  } else if (t.dataset.fk === 'level') {
    const [min, max] = t.value.split('-').map(Number);
    setFilter({ levelRange: t.value === '' ? null : t.value === 'reachable' ? 'reachable' : { min, max } });
  }
}

function onInput(event: Event): void {
  const t = event.target as HTMLInputElement;
  if (t.classList.contains('mapw-search')) setFilter({ query: t.value });
}

function onKey(event: KeyboardEvent): void {
  const t = event.target as HTMLElement;
  if (event.key === 'Escape' && ui.typeOpen) {
    event.stopPropagation();
    setTypeOpen(false);
    q('.mapw-dd').focus();
    return;
  }
  if (event.key !== 'Escape' && t.matches('input, select')) { event.stopPropagation(); return; }
  if (t.matches('[role="tab"]') && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
    event.stopPropagation();
    event.preventDefault();
    const open = REGIONS.filter((r) => heroLevel() >= r.minLevel);
    const at = open.findIndex((r) => r.id === ui.region);
    const next = open[(at + (event.key === 'ArrowRight' ? 1 : open.length - 1)) % open.length];
    ui.region = next.id;
    ui.selected = null;
    refresh();
    root?.querySelector<HTMLElement>(`[data-region="${next.id}"]`)?.focus();
  }
}
