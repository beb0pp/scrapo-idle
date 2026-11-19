import { availableAreas, computeProgress } from '../core/afk';
import { afkRareFactor, droneCapacity, droneReady, playerStats } from '../core/derived';
import { buy, craft, dismantle, equip, missingFor, offerAvailable, recipeKnown, sell, unequip } from '../core/economy';
import { BAG_CAPACITY, bagStacks, countOf, type GameState } from '../core/state';
import { AFK_AREAS, type AfkAreaId } from '../data/areas';
import { ITEMS, ITEM_IDS, KIND_LABEL, RARITY, rarityOf, type EquipSlot, type ItemId } from '../data/items';
import { RECIPES } from '../data/recipes';
import { VENDOR_NAME, VENDOR_OFFERS } from '../data/vendor';
import { session } from '../session';
import { heroPortraitUrl } from '../art/sprites';
import { $, esc, icon } from './shared';
import { applyDock, cycleDock, dockMode, DOCK_LABEL, enableDockDrag } from './dock';
import './mochila.css';

export type PanelKind = 'inventory' | 'workshop' | 'vendor' | 'terminal' | 'settings';
let openKind: PanelKind | null = null;
let selected: ItemId | null = null;
let filter = 'Todos';
let vendorTab: 'buy' | 'sell' = 'buy';
let slotFilter: EquipSlot | null = null;
let afkStart: (id: AfkAreaId) => void = () => {};
const listeners: Array<(open: boolean) => void> = [];
const playerSlots: EquipSlot[] = ['tool', 'head', 'body', 'hands', 'feet', 'accessory'];

export function onPanelChange(listener: (open: boolean) => void): void { listeners.push(listener); }
export function panelOpen(): boolean { return openKind !== null || !$('modal').hidden; }
export function openPanel(kind: PanelKind): void {
  openKind = kind;
  renderPanel();
  $('panel').hidden = false;
  applyDock($('panel'), kind === 'inventory');
  listeners.forEach((listener) => listener(true));
}

export function closePanel(): void {
  if (!openKind) return;
  openKind = null;
  $('panel').hidden = true;
  applyDock($('panel'), false);
  listeners.forEach((listener) => listener(false));
}
export function togglePanel(kind: PanelKind): void { if (openKind === kind) closePanel(); else openPanel(kind); }
export function onAfkStart(handler: (id: AfkAreaId) => void): void { afkStart = handler; }

export function initPanels(): void {
  $('panel').addEventListener('click', handlePanelClick);
  enableDockDrag($('panel'), () => openKind === 'inventory');
  window.addEventListener('resize', () => { if (openKind === 'inventory') applyDock($('panel'), true); });
  window.addEventListener('scrapo:panel', (event) => togglePanel((event as CustomEvent<PanelKind>).detail));
  window.addEventListener('scrapo:tool', (event) => session.run((state) => equip(state, (event as CustomEvent<ItemId>).detail)));
  session.onChange(() => { if (openKind) renderPanel(); });
}

function handlePanelClick(event: MouseEvent): void {
  const button = (event.target as HTMLElement).closest('button');
  if (!button?.dataset.act) return;
  const [action, value] = button.dataset.act.split(':');
  if (action === 'close') closePanel();
  if (action === 'dock') { cycleDock(); renderPanel(); applyDock($('panel'), true); }
  if (action === 'select') { selected = value as ItemId; renderPanel(); }
  if (action === 'filter') { filter = value; slotFilter = null; renderPanel(); }
  if (action === 'vendor-tab') { vendorTab = value as 'buy' | 'sell'; renderPanel(); }
  if (action === 'slot') { slotFilter = value as EquipSlot; selected = session.state.equipped[slotFilter]; renderPanel(); }
  if (action === 'equip') session.run((state) => equip(state, value as ItemId));
  if (action === 'unequip') session.run((state) => unequip(state, value as EquipSlot));
  if (action === 'dismantle') session.run((state) => dismantle(state, value as ItemId));
  if (action === 'craft') session.run((state) => craft(state, value));
  if (action === 'buy') session.run((state) => buy(state, value));
  if (action === 'sell') { const id = value as ItemId; const qty = button.dataset.qty === 'all' ? countOf(session.state, id) : 1; session.run((state) => sell(state, id, qty)); }
  if (action === 'afk') afkStart(value as AfkAreaId);
  if (action === 'reset' && window.confirm('Apagar todo o progresso local?')) { session.reset(); window.location.reload(); }
}

function renderPanel(): void {
  if (!openKind) return;
  const views: Record<PanelKind, (state: GameState) => string> = { inventory, workshop, vendor, terminal, settings };
  const titles: Record<PanelKind, string> = { inventory: 'Mochila', workshop: 'Oficina', vendor: `Mercado — ${VENDOR_NAME}`, terminal: 'Terminal de Extração', settings: 'Configurações' };
  const dock = openKind === 'inventory'
    ? `<button data-act="dock" class="dock-btn" title="Mudar posição da janela (ou arraste pelo título)">⇆ ${DOCK_LABEL[dockMode()]}</button>`
    : '';
  $('panel').innerHTML = `<div class="panel-head"><h2>${titles[openKind]}</h2>${dock}<span class="money">${session.state.currency} cr</span>`
    + `<button data-act="close">Esc ✕</button></div><div class="panel-body">${views[openKind](session.state)}</div>`;
}

function inventory(state: GameState): string {
  const ids = filteredItems(state);
  if (!selected || !ids.includes(selected)) selected = ids[0] ?? null;
  const used = bagStacks(state.inventory);
  const empty = Math.max(0, BAG_CAPACITY - Math.max(used, ids.length));
  const cells = ids.map((id) => bagCell(state, id)).join('') + '<span class="mo-cell is-empty"></span>'.repeat(empty);
  return `<div class="inventory-dock mochila">
    <section class="mo-card mo-char">${paperDoll(state)}${statChips(playerStats(state))}</section>
    <section class="mo-card mo-bag">
      <header class="mo-bag-head"><h3>Itens carregados</h3><span class="mo-cap">${used}/${BAG_CAPACITY}</span></header>
      ${filters()}
      <div class="mo-grid">${cells}</div>
    </section>
    <section class="mo-card mo-detail">${selected ? detail(state, ITEMS[selected]) : '<p class="mo-muted">Selecione um item.</p>'}</section>
    <div class="extraction-strip">${extractionStrip(state)}</div>
  </div>`;
}

function filteredItems(state: GameState): ItemId[] {
  return ITEM_IDS.filter((id) => {
    if (!countOf(state, id)) return false;
    if (slotFilter) return ITEMS[id].slot === slotFilter;
    if (filter === 'Ferramentas') return ITEMS[id].kind === 'tool';
    if (filter === 'Equipamentos') return ITEMS[id].kind === 'equipment';
    if (filter === 'Materiais') return !ITEMS[id].slot;
    return true;
  });
}

function filters(): string { return `<div class="filters">${['Todos', 'Ferramentas', 'Equipamentos', 'Materiais'].map((name) => `<button class="${filter === name ? 'active' : ''}" data-act="filter:${name}">${name}</button>`).join('')}</div>`; }
/** Faint example item shown in an empty slot so the player sees what goes there. */
const SLOT_HINT: Partial<Record<EquipSlot, ItemId>> = {
  tool: 'tool_wrench_old', head: 'head_scrap_cap', body: 'body_work_jacket',
  hands: 'hands_grip_gloves', feet: 'feet_rail_boots', accessory: 'accessory_lucky_bolt',
};

const STAT_META = [
  ['combate', 'Combate', '⚔'], ['extracao', 'Extração', '⛏'], ['defesa', 'Defesa', '⛨'], ['vida', 'Vida', '♥'], ['sorte', 'Sorte', '✦'],
] as const;

function rarityTag(id: ItemId): string {
  const r = rarityOf(id);
  return `<span class="mo-tag" style="--rc:${RARITY[r].color}">${RARITY[r].label}</span>`;
}

function slotTile(state: GameState, slot: EquipSlot): string {
  const id = state.equipped[slot];
  const style = id ? ` style="--rc:${RARITY[rarityOf(id)].color}"` : '';
  const inner = id ? icon(id, 'mo-ico') : icon(SLOT_HINT[slot] ?? 'scrap', 'mo-ico is-hint');
  const state_ = `${id ? 'is-full' : 'is-empty'} ${slotFilter === slot ? 'is-selected' : ''}`;
  return `<div class="mo-slot-wrap mo-at-${slot}">
    <button class="mo-slot ${state_}"${style} data-act="slot:${slot}" title="${slotLabel(slot)}${id ? `: ${esc(ITEMS[id].name)}` : ' (vazio)'}">${inner}</button>
    <small>${slotLabel(slot)}</small>
  </div>`;
}

function paperDoll(state: GameState): string {
  return `<div class="mo-doll">
    ${playerSlots.map((slot) => slotTile(state, slot)).join('')}
    <div class="mo-stage"><img class="mo-hero" src="${heroPortraitUrl}" alt="Personagem"></div>
  </div>`;
}

function statChips(stats: ReturnType<typeof playerStats>): string {
  return `<div class="mo-stats">${STAT_META.map(([key, label, glyph]) =>
    `<span class="mo-stat" title="${label}"><b>${glyph}</b>${stats[key]}</span>`).join('')}</div>`;
}

function bagCell(state: GameState, id: ItemId): string {
  const incompatible = slotFilter !== null && ITEMS[id].slot !== slotFilter;
  const qty = countOf(state, id);
  const cls = `${selected === id ? 'is-selected' : ''} ${incompatible ? 'is-incompatible' : ''}`;
  return `<button class="mo-cell ${cls}" style="--rc:${RARITY[rarityOf(id)].color}" data-act="select:${id}" title="${esc(ITEMS[id].name)}">
    <i class="mo-gem"></i>${icon(id, 'mo-ico')}${qty > 1 ? `<b class="mo-qty">${qty}</b>` : ''}
  </button>`;
}

function detail(state: GameState, item: typeof ITEMS[ItemId]): string {
  const equipped = item.slot ? state.equipped[item.slot] : null;
  const comparison = equipped && equipped !== item.id ? comparisonHtml(ITEMS[equipped], item) : ownStats(item);
  const uses = !item.slot ? materialUses(item.id) : '';
  const equipBtn = item.slot && equipped !== item.id ? `<button class="primary" data-act="equip:${item.id}">⚙ Equipar</button>` : '';
  const unequipBtn = item.slot && equipped === item.id ? `<button data-act="unequip:${item.slot}">Desequipar</button>` : '';
  const dismantleBtn = item.dismantle ? `<button data-act="dismantle:${item.id}">⚒ Desmontar</button>` : '';
  return `<div class="mo-detail-icon" style="--rc:${RARITY[rarityOf(item.id)].color}">${icon(item.id, 'mo-ico')}</div>
    <div class="mo-detail-body">
      <h3>${esc(item.name)}</h3>
      <p class="mo-sub">${rarityTag(item.id)} ${KIND_LABEL[item.kind]} · ×${countOf(state, item.id)}</p>
      <p class="mo-desc">${esc(item.desc)}</p>
      ${comparison}${uses}
    </div>
    <div class="mo-detail-acts">${equipBtn}${unequipBtn}${dismantleBtn}</div>`;
}

function ownStats(item: typeof ITEMS[ItemId]): string {
  const rows = STAT_META.filter(([key]) => item.stats?.[key]).map(([key, label, glyph]) => `<li>${glyph} ${label} +${item.stats?.[key]}</li>`);
  return rows.length ? `<ul class="mo-cmp">${rows.join('')}</ul>` : '';
}

function comparisonHtml(current: typeof ITEMS[ItemId], candidate: typeof ITEMS[ItemId]): string {
  const rows = STAT_META.map(([key, label]) => {
    const before = current.stats?.[key] ?? 0;
    const after = candidate.stats?.[key] ?? 0;
    const delta = after - before;
    if (!before && !after) return '';
    const cls = delta > 0 ? 'gain' : delta < 0 ? 'loss' : '';
    return `<li class="${cls}">${label} ${before} → ${after} (${delta >= 0 ? '+' : ''}${delta})</li>`;
  });
  return `<ul class="mo-cmp">${rows.join('')}</ul>`;
}

function materialUses(id: ItemId): string {
  const recipes = RECIPES.filter((recipe) => recipe.inputs[id]).map((recipe) => recipe.name);
  const item = ITEMS[id];
  const parts = [recipes.length ? `monta ${recipes.join(', ')}` : '', item.dismantle ? 'desmontável' : '', item.sell ? `vende por ${item.sell} cr` : ''];
  return `<p class="mo-uses">${parts.filter(Boolean).join(' · ')}</p>`;
}
function slotLabel(slot: EquipSlot): string {
  const labels: Partial<Record<EquipSlot, string>> = { tool: 'Ferramenta', head: 'Cabeça', body: 'Armadura', hands: 'Luvas', feet: 'Botas', accessory: 'Acessório' };
  return labels[slot] ?? slot;
}

function workshop(state: GameState): string {
  const modules = (['mod_claw', 'mod_magnet'] as ItemId[]).filter((id) => countOf(state, id));
  const drone = state.equipped.drone ? `<div class="drone-box">${icon('drone_spark', 'ico big')}<div><b>Drone Faísca</b><p>Módulo: ${state.equipped.module ? esc(ITEMS[state.equipped.module].name) : 'nenhum'} · Carga ${droneCapacity(state)} · Raros ×${afkRareFactor(state)}</p><p>${state.equipped.module ? esc(ITEMS[state.equipped.module].desc) : 'Sem módulo o drone não extrai.'}</p></div><div class="acts">${modules.map((id) => `<button data-act="equip:${id}">Instalar ${esc(ITEMS[id].name)}</button>`).join('')}${countOf(state, 'mod_cargo') ? '<button data-act="equip:mod_cargo">Instalar Compartimento</button>' : ''}</div></div>` : `<div class="drone-box broken">${icon('drone_chassis', 'ico big')}<p><b>Drone quebrado</b><br>Receita: chassi + núcleo + módulo + 6 sucatas.</p></div>`;
  return `${drone}<div class="recipes">${RECIPES.map((recipe) => recipeHtml(state, recipe)).join('')}</div>`;
}

function recipeHtml(state: GameState, recipe: typeof RECIPES[number]): string {
  const missing = missingFor(state, recipe); const known = recipeKnown(state, recipe); const built = recipe.equipsOutput && state.equipped.drone; const ready = known && !Object.keys(missing).length && !built;
  const inputs = (Object.entries(recipe.inputs) as [ItemId, number][]).map(([id, qty]) => `<span class="need ${countOf(state, id) >= qty ? 'ok' : 'lack'}">${icon(id)}${esc(ITEMS[id].name)} ${countOf(state, id)}/${qty}</span>`).join('');
  const status = !known ? 'Projeto necessário (comerciante).' : built ? 'Já montado.' : !ready ? `Falta: ${(Object.entries(missing) as [ItemId, number][]).map(([id, qty]) => `${qty} ${ITEMS[id].name}`).join(', ')}` : 'Pronto para montar.';
  return `<div class="recipe"><div class="r-head">${icon(recipe.output, 'ico big')}<b>${esc(recipe.name)}</b><button data-act="craft:${recipe.id}" ${ready ? '' : 'disabled'}>Montar</button></div><div class="inputs">${inputs}</div><div class="desc">${esc(recipe.effect)}</div><div class="status">${esc(status)}</div></div>`;
}

function vendor(state: GameState): string {
  const sellRows = ITEM_IDS.filter((id) => countOf(state, id) && ITEMS[id].sell > 0).map((id) => `<div class="row">${icon(id, 'ico big')}<div class="grow"><b>${esc(ITEMS[id].name)}</b><div>${ITEMS[id].sell} cr cada · ×${countOf(state, id)}</div></div><div class="acts"><button data-act="sell:${id}">Vender 1</button>${countOf(state, id) > 1 ? `<button data-act="sell:${id}" data-qty="all">Todos (${ITEMS[id].sell * countOf(state, id)} cr)</button>` : ''}</div></div>`).join('');
  const buyRows = VENDOR_OFFERS.map((offer) => {
    const available = offerAvailable(state, offer.id);
    const missing = Math.max(0, offer.price - state.currency);
    const label = !available ? 'Comprado' : missing ? `Faltam ${missing} cr` : 'Comprar';
    return `<article class="vendor-card" title="${esc(offer.desc)}">${offer.item ? icon(offer.item, 'ico big') : ''}<b>${esc(offer.name)}</b><span>◉ ${offer.price} cr</span><button data-act="buy:${offer.id}" ${available && !missing ? '' : 'disabled'}>${label}</button></article>`;
  }).join('');
  const tabs = `<div class="vendor-tabs"><button class="${vendorTab === 'buy' ? 'active' : ''}" data-act="vendor-tab:buy">Comprar</button><button class="${vendorTab === 'sell' ? 'active' : ''}" data-act="vendor-tab:sell">Vender</button></div>`;
  return `${tabs}<p class="vendor-note">Dona Rebite compra sucata e vende peças.</p><div class="vendor-grid">${vendorTab === 'buy' ? buyRows : sellRows || '<p class="muted">Nada para vender.</p>'}</div>`;
}

function terminal(state: GameState): string {
  if (!droneReady(state)) return '<p class="muted">Nenhum drone operacional. Monte o Drone Faísca na oficina.</p>';
  const rows = (Object.keys(AFK_AREAS) as AfkAreaId[]).map((id) => { const area = AFK_AREAS[id]; const unlocked = availableAreas(state).includes(id); return `<div class="row">${unlocked ? '' : '<span class="lock">🔒</span>'}<div class="grow"><b>${esc(area.name)}</b><div class="desc">${esc(area.desc)}</div><div>Ciclo ${area.cycleMs / 1000}s · carga ${droneCapacity(state)} · raros ×${afkRareFactor(state)} · extração +${playerStats(state).extracao}</div></div><button data-act="afk:${id}" ${unlocked ? '' : 'disabled'}>${unlocked ? 'Iniciar' : 'Bloqueada'}</button></div>`; }).join('');
  return `<p class="hint">Funciona enquanto a aba estiver aberta. Fechar a aba encerra mantendo ciclos concluídos. Uma extração por vez.</p><div class="list">${rows}</div>`;
}

function settings(): string { return '<p>Use a roda do mouse para ajustar o zoom.</p><button data-act="reset">Apagar progresso</button>'; }
function extractionStrip(state: GameState): string { if (!state.afk) return 'Extração parada — use o Terminal.'; const progress = computeProgress(state.afk, Date.now()); return `${AFK_AREAS[state.afk.areaId].name} · ${progress.ended ? 'pronta para recolher' : 'em andamento'} <span class="mini-progress"><i style="width:${progress.cycleProgress * 100}%"></i></span>`; }
