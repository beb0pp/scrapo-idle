import { nodeIconUrls, spellIconUrls } from '../art/ferroArt';
import {
  ALLIES, BUILD_NODES, ROLES, SKILL_NODES, SPELL_IDS, SPELL_KEYS, SPELLS, SYNERGIES, TRANSMUTES,
  type AllyId, type BuildNodeId, type FormationSlot, type MemberId, type NodeDef, type NodeId,
  type SkillNodeId, type SpellId, type SpellSchool, type SpellTarget, type TransmuteId,
} from '../data/ferromancy';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';
import {
  activeSynergies, alchemyUnlocked, buildNode, costText, isBuildNode, learnNode, ferroMods, nodeDef, nodeStatus,
  owns, skillPoints, unlockedSpells, type NodeStatus, type TreeKind,
} from '../core/progression';
import { equipSpell, recruit, recruitProblem, setFormation, slotOf, spellCooldownMs, spellPower, transmute } from '../core/spells';
import { countOf, hasItems, type GameState } from '../core/state';
import { session } from '../session';
import { esc, icon } from './shared';
import './ferro.css';

export type FerroTab = 'build' | 'skill' | 'grimoire' | 'party';

const TABS: Array<[FerroTab, string]> = [['build', 'Construção'], ['skill', 'Habilidades'], ['grimoire', 'Grimório'], ['party', 'Equipe']];
const REAGENTS: ItemId[] = ['ether_shard', 'reagent_ember', 'reagent_ward', 'reagent_lodestone', 'mana_flask', 'ether_crystal'];
const SCHOOL_LABEL: Record<SpellSchool, string> = { ataque: 'Ataque', defesa: 'Defesa', extracao: 'Extração' };
const TARGET_LABEL: Record<SpellTarget, string> = { enemy: 'Alvo', self: 'Si mesmo', area: 'Área' };
const TARGET_GLYPH: Record<SpellTarget, string> = { enemy: '◎', self: '⛨', area: '◌' };
const SLOT_LABEL: Record<FormationSlot, string> = { front: 'Frente', back: 'Retaguarda' };
const MEMBER_NAME: Record<MemberId, string> = { ferrugem: 'Ferrugem', cobalto: ALLIES.cobalto.name };
const MEMBERS: MemberId[] = ['ferrugem', 'cobalto'];
const SLOTS: FormationSlot[] = ['front', 'back'];
const LOCK_SVG = '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M2 3.5V2.5a2 2 0 0 1 4 0v1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1" y="3.5" width="6" height="4.5" fill="currentColor"/></svg>';

let tab: FerroTab = 'build';
const selected: Partial<Record<TreeKind, NodeId>> = {};
let pickedSpell: SpellId | null = null;
let pickedSlot: number | null = null;
let pendingFocus: string[] = [];
let linkObserver: ResizeObserver | null = null;

export function setFerroTab(next: FerroTab): void {
  tab = next;
}

export function ferroPanelView(state: GameState): string {
  const tabs = TABS.map(([id, label]) =>
    `<button role="tab" class="${tab === id ? 'active' : ''}" aria-selected="${tab === id}" data-act="f-tab:${id}">${esc(label)}</button>`).join('');
  const views: Record<FerroTab, (s: GameState) => string> = { build: (s) => treeTab(s, 'build'), skill: (s) => treeTab(s, 'skill'), grimoire: grimoireTab, party: partyTab };
  scheduleLayout();
  return `<div class="ferro" data-tab="${tab}"><div class="fe-tabs" role="tablist">${tabs}</div>${views[tab](state)}</div>`;
}

function goTo(id: NodeId): void {
  const kind: TreeKind = isBuildNode(id) ? 'build' : 'skill';
  tab = kind;
  selected[kind] = id;
  pendingFocus = [`[data-node="${id}"]`];
}

export function handleFerroAction(action: string, value: string): boolean {
  const [a, b] = value.split(':');
  pendingFocus = [`[data-act="${action}:${value}"]`];
  switch (action) {
    case 'f-tab':
      if (!TABS.some(([id]) => id === value)) return false;
      tab = value as FerroTab;
      return true;
    case 'f-select': selected[isBuildNode(value as NodeId) ? 'build' : 'skill'] = value as NodeId; return true;
    case 'f-goto': goTo(value as NodeId); return true;
    case 'f-build': pendingFocus.push(`[data-node="${value}"]`); session.run((s) => buildNode(s, value as BuildNodeId)); return true;
    case 'f-learn': pendingFocus.push(`[data-node="${value}"]`); session.run((s) => learnNode(s, value as SkillNodeId)); return true;
    case 'f-transmute': session.run((s) => transmute(s, value as TransmuteId)); return true;
    case 'f-pick': pickedSpell = pickedSpell === value ? null : value as SpellId; pickedSlot = null; return true;
    case 'f-slot': pickedSlot = pickedSlot === Number(value) ? null : Number(value); return true;
    case 'f-equip':
      pickedSpell = null; pickedSlot = null;
      pendingFocus.push(`[data-act="f-slot:${b}"]`);
      session.run((s) => equipSpell(s, Number(b), a as SpellId)); return true;
    case 'f-unequip':
      pickedSlot = null; pendingFocus = [`[data-act="f-slot:${value}"]`];
      session.run((s) => equipSpell(s, Number(value), null)); return true;
    case 'f-recruit': session.run((s) => recruit(s, value as AllyId)); return true;
    case 'f-form': session.run((s) => setFormation(s, a as FormationSlot, b === 'none' ? null : b as MemberId)); return true;
    default: return false;
  }
}

// ---------------- layout pass (connectors + focus) ----------------

function scheduleLayout(): void {
  requestAnimationFrame(() => {
    linkObserver?.disconnect();
    const trees = document.querySelectorAll<HTMLElement>('#panel .fe-tree');
    if (trees.length && typeof ResizeObserver !== 'undefined') {
      linkObserver = new ResizeObserver((entries) => entries.forEach((e) => drawLinks(e.target as HTMLElement)));
      trees.forEach((t) => linkObserver!.observe(t));
    }
    trees.forEach(drawLinks);
    const target = pendingFocus.map((sel) => document.querySelector<HTMLElement>(`#panel ${sel}`)).find((el) => el && !(el as HTMLButtonElement).disabled);
    pendingFocus = [];
    target?.focus({ preventScroll: true });
  });
}

interface Box { col: number; row: number; cx: number; top: number; bottom: number; owned: boolean }

/** Orthogonal elbows routed only through the grid gaps, measured from the rendered tiles. */
function drawLinks(tree: HTMLElement): void {
  const svg = tree.querySelector<SVGSVGElement>('svg.fe-links');
  if (!svg || !tree.isConnected) return;
  const base = tree.getBoundingClientRect();
  const boxes = new Map<string, Box>();
  const colL: number[] = [], colR: number[] = [], rowT: number[] = [], rowB: number[] = [];
  const tiles = [...tree.querySelectorAll<HTMLElement>('.fe-tile')];
  for (const t of tiles) {
    const rc = t.getBoundingClientRect();
    const col = Number(t.dataset.col), row = Number(t.dataset.row);
    const x = rc.left - base.left, y = rc.top - base.top;
    colL[col] = Math.min(colL[col] ?? x, x); colR[col] = Math.max(colR[col] ?? 0, x + rc.width);
    rowT[row] = Math.min(rowT[row] ?? y, y); rowB[row] = Math.max(rowB[row] ?? 0, y + rc.height);
    boxes.set(t.dataset.node!, { col, row, cx: Math.round(x + rc.width / 2), top: Math.round(y), bottom: Math.round(y + rc.height), owned: t.dataset.status === 'owned' });
  }
  const gapBelow = (row: number) => Math.round(((rowB[row] ?? 0) + (rowT[row + 1] ?? (rowB[row] ?? 0) + 40)) / 2);
  const paths = tiles.flatMap((t) => (t.dataset.req ?? '').split(' ').filter(Boolean).map((req) => {
    const from = boxes.get(req), to = boxes.get(t.dataset.node!);
    if (!from || !to) return '';
    let d: string;
    if (to.row === from.row + 1) {
      d = `M${from.cx} ${from.bottom}V${gapBelow(from.row)}H${to.cx}V${to.top}`;
    } else {
      const left = to.col < from.col ? from.col - 1 : from.col;
      const xm = colR[left] !== undefined && colL[left + 1] !== undefined ? Math.round((colR[left] + colL[left + 1]) / 2) : (colR[from.col] ?? from.cx) + 18;
      d = `M${from.cx} ${from.bottom}V${gapBelow(from.row)}H${xm}V${gapBelow(to.row - 1)}H${to.cx}V${to.top}`;
    }
    return `<path class="fe-link${from.owned && to.owned ? ' met' : ''}" d="${d}"/>`;
  })).join('');
  svg.setAttribute('width', String(Math.round(base.width)));
  svg.setAttribute('height', String(Math.round(base.height)));
  svg.setAttribute('viewBox', `0 0 ${Math.round(base.width)} ${Math.round(base.height)}`);
  svg.innerHTML = paths;
}

// ---------------- trees ----------------

const STATUS_LABEL: Record<Exclude<NodeStatus, 'owned'>, string> = { available: 'Disponível', unaffordable: 'Sem recursos', locked: 'Bloqueado' };

function statusLabel(status: NodeStatus, kind: TreeKind): string {
  return status === 'owned' ? (kind === 'build' ? 'Construído' : 'Aprendido') : STATUS_LABEL[status];
}

function nodeIcon(id: NodeId, cls = 'fe-nico'): string {
  const url = nodeIconUrls[id];
  return url ? `<img class="${cls}" src="${url}" alt="">` : `<span class="${cls} is-blank" aria-hidden="true">✦</span>`;
}

function chip(state: GameState, id: ItemId, need: number, named = false): string {
  const have = countOf(state, id);
  const name = ITEMS[id].name;
  return `<span class="fe-chip${have < need ? ' is-short' : ''}" title="${esc(name)}: tem ${have}, precisa ${need}">${icon(id)}<b>${have}/${need}</b>${named ? `<small>${esc(name)}</small>` : ''}</span>`;
}

function pointChip(state: GameState, need: number, named = false): string {
  const free = skillPoints(state).free;
  return `<span class="fe-chip is-pt${free < need ? ' is-short' : ''}" title="Pontos de ofício: tem ${free}, precisa ${need}"><i aria-hidden="true">✦</i><b>${free}/${need}</b>${named ? '<small>pontos</small>' : ''}</span>`;
}

function costChips(state: GameState, cost: NodeDef<NodeId>['cost'], named = false): string {
  const items = (Object.entries(cost.items ?? {}) as [ItemId, number][]).map(([id, qty]) => chip(state, id, qty, named));
  if (cost.points) items.unshift(pointChip(state, cost.points, named));
  return items.join('') || '<span class="fe-chip">grátis</span>';
}

function stockStrip(state: GameState, nodes: NodeDef<NodeId>[], kind: TreeKind): string {
  const ids = [...new Set(nodes.flatMap((n) => Object.keys(n.cost.items ?? {}) as ItemId[]))];
  const tiles = ids.map((id) => {
    const n = countOf(state, id);
    return `<span class="fe-rtile${n ? '' : ' is-zero'}" title="${esc(ITEMS[id].name)}">${icon(id, 'fe-ri')}<b>${n}</b></span>`;
  });
  if (kind === 'skill') {
    const pts = skillPoints(state);
    tiles.unshift(`<span class="fe-rtile is-pt${pts.free ? '' : ' is-zero'}" title="Pontos de ofício livres (${pts.earned} ganhos: abates, buscas, extrações e construções)"><i class="fe-ri" aria-hidden="true">✦</i><b>${pts.free}</b></span>`);
  }
  return `<div class="fe-stock" aria-label="Estoque"><span class="fe-stock-label">Estoque</span>${tiles.join('')}</div>`;
}

function pickSelected(state: GameState, nodes: NodeDef<NodeId>[], kind: TreeKind): NodeDef<NodeId> {
  const current = nodes.find((n) => n.id === selected[kind]);
  if (current) return current;
  const order: NodeStatus[] = ['available', 'unaffordable', 'locked', 'owned'];
  for (const status of order) {
    const hit = nodes.find((n) => nodeStatus(state, n.id) === status);
    if (hit) return hit;
  }
  return nodes[0];
}

function treeTab(state: GameState, kind: TreeKind): string {
  const nodes: NodeDef<NodeId>[] = Object.values(kind === 'build' ? BUILD_NODES : SKILL_NODES);
  const sel = pickSelected(state, nodes, kind);
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const tiles = nodes.map((node) => tile(state, node, kind, node.id === sel.id)).join('');
  return `${stockStrip(state, nodes, kind)}<div class="fe-treewrap">`
    + `<div class="fe-tree-scroll"><div class="fe-tree" style="--cols:${cols}"><svg class="fe-links" aria-hidden="true"></svg>${tiles}</div></div>`
    + `${detailPane(state, sel, kind)}</div>`;
}

function tile(state: GameState, node: NodeDef<NodeId>, kind: TreeKind, isSel: boolean): string {
  const status = nodeStatus(state, node.id);
  const inTree = node.requires.filter((id) => isBuildNode(id) === (kind === 'build')).join(' ');
  const badge = status === 'owned' ? '<span class="fe-tb is-ok" aria-hidden="true">✓</span>'
    : status === 'locked' ? `<span class="fe-tb is-lock" aria-hidden="true">${LOCK_SVG}</span>` : '';
  return `<button type="button" class="fe-tile is-${status}${isSel ? ' is-sel' : ''}" data-node="${node.id}" data-status="${status}" data-col="${node.col}" data-row="${node.row}" data-req="${inTree}" data-act="f-select:${node.id}"`
    + ` aria-pressed="${isSel}" aria-label="${esc(`${node.name}: ${statusLabel(status, kind)}`)}" title="${esc(node.name)}" style="grid-column:${node.col + 1};grid-row:${node.row + 1}">`
    + `<span class="fe-frame">${nodeIcon(node.id)}${badge}</span><span class="fe-name">${esc(node.name)}</span>`
    + `<span class="fe-chips">${status === 'owned' ? '' : costChips(state, node.cost)}</span></button>`;
}

function detailPane(state: GameState, node: NodeDef<NodeId>, kind: TreeKind): string {
  const status = nodeStatus(state, node.id);
  const reqs = node.requires.map((id) => {
    const met = owns(state, id);
    const cross = isBuildNode(id) === (kind === 'build') ? '' : ` <small>${isBuildNode(id) ? 'Construção' : 'Habilidades'}</small>`;
    return `<li class="${met ? 'met' : 'unmet'}"><button type="button" class="fe-req" data-act="f-goto:${id}">${nodeIcon(id, 'fe-rico')}<span>${met ? '✓' : '✗'} ${esc(nodeDef(id).name)}${cross}</span></button></li>`;
  });
  if (node.requiresDiscovery) {
    const met = state.ferro.discovered.includes(node.requiresDiscovery);
    reqs.push(`<li class="${met ? 'met' : 'unmet'}"><span class="fe-req">${icon('ether_shard', 'fe-rico')}<span>${met ? '✓' : '✗'} Veio de Éter descoberto</span></span></li>`);
  }
  const verb = kind === 'build' ? 'Construir' : 'Aprender';
  const action = status === 'owned'
    ? `<p class="fe-done">✓ ${statusLabel(status, kind)}</p>`
    : `<button class="fe-act${status === 'available' ? ' primary' : ''}" data-act="f-${kind === 'build' ? 'build' : 'learn'}:${node.id}" ${status === 'available' ? '' : 'disabled'}>${verb}</button>`;
  return `<aside class="fe-detail is-${status}" data-detail="${node.id}" aria-label="${esc(node.name)}">
    <div class="fe-dhead"><span class="fe-frame big">${nodeIcon(node.id)}</span><div><b>${esc(node.name)}</b><span class="fe-status">${statusLabel(status, kind)}</span></div></div>
    <p class="fe-effect">${esc(node.effect)}</p>
    ${reqs.length ? `<ul class="fe-reqs">${reqs.join('')}</ul>` : ''}
    <div class="fe-dcost">${costChips(state, node.cost, true)}</div>${action}
  </aside>`;
}

// ---------------- grimoire ----------------

function spellIcon(id: SpellId, cls = 'fe-spell-ico'): string {
  const url = spellIconUrls[id];
  return url ? `<img class="${cls}" src="${url}" alt="">` : `<span class="${cls} is-blank" aria-hidden="true">✦</span>`;
}

function unlocker(id: SpellId): NodeDef<SkillNodeId> | undefined {
  return Object.values(SKILL_NODES).find((n) => n.unlocksSpell === id);
}

function grimoireTab(state: GameState): string {
  const learned = unlockedSpells(state);
  const reagents = REAGENTS.map((id) => {
    const n = countOf(state, id);
    return `<span class="fe-rtile${n ? '' : ' is-zero'}" title="${esc(ITEMS[id].name)}">${icon(id, 'fe-ri')}<b>${n}</b></span>`;
  }).join('');
  return `${loadoutBar(state, learned)}${learned.length ? '' : guide(state)}
    <section class="fe-block"><div class="fe-spells">${SPELL_IDS.map((id) => spellCard(state, id, learned.includes(id))).join('')}</div></section>
    <section class="fe-block"><h3>Reagentes</h3><div class="fe-stock">${reagents}</div></section>
    <section class="fe-block"><h3>Transmutação</h3>${transmutes(state)}</section>`;
}

function guide(state: GameState): string {
  const steps: Array<[string, string, boolean, string]> = [
    [nodeIcon('b_alchemy', 'fe-gico'), 'Construir Estação Alquímica', owns(state, 'b_alchemy'), 'f-goto:b_alchemy'],
    [nodeIcon('s_mag_init', 'fe-gico'), 'Aprender Iniciação Ferromante', owns(state, 's_mag_init'), 'f-goto:s_mag_init'],
    ['<span class="fe-gico fe-gkeys"><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd></span>', 'Equipar em Z/X/C', false, ''],
  ];
  return `<ol class="fe-guide">${steps.map(([ico, label, done, act], i) => {
    const body = `${ico}<span><b>${i + 1}</b> ${esc(label)}</span>${done ? '<i class="fe-gok" aria-label="feito">✓</i>' : ''}`;
    return `<li class="${done ? 'is-done' : ''}">${act ? `<button type="button" data-act="${act}">${body}</button>` : `<div>${body}</div>`}</li>`;
  }).join('<li class="fe-garrow" aria-hidden="true">→</li>')}</ol>`;
}

function loadoutBar(state: GameState, learned: SpellId[]): string {
  const picking = pickedSpell && learned.includes(pickedSpell) ? pickedSpell : null;
  const slots = SPELL_KEYS.map((key, slot) => {
    const id = state.ferro.loadout[slot];
    const act = picking ? `f-equip:${picking}:${slot}` : `f-slot:${slot}`;
    const label = id ? `${key}: ${SPELLS[id].name}` : `${key}: vazio`;
    const clear = id && pickedSlot === slot ? `<button class="fe-sclear" data-act="f-unequip:${slot}" aria-label="Liberar atalho ${key}">✕</button>` : '';
    return `<div class="fe-bslot${id ? ' is-full' : ''}${picking ? ' is-target' : ''}${pickedSlot === slot ? ' is-sel' : ''}">`
      + `<button type="button" data-act="${act}" aria-label="${esc(picking ? `Equipar ${SPELLS[picking].name} em ${key}` : label)}" title="${esc(label)}">`
      + `<kbd>${key}</kbd>${id ? spellIcon(id, 'fe-bico') : '<span class="fe-bico is-empty" aria-hidden="true"></span>'}</button>${clear}</div>`;
  }).join('');
  const hint = picking ? `Escolha um atalho para ${SPELLS[picking].name}` : learned.length ? 'Clique num feitiço e depois num atalho' : '';
  return `<section class="fe-loadbar" aria-label="Atalhos"><div class="fe-bslots">${slots}</div>${hint ? `<p class="fe-lhint">${esc(hint)}</p>` : ''}</section>`;
}

function transmutes(state: GameState): string {
  const unlocked = alchemyUnlocked(state);
  const bonus = ferroMods(state).transmuteBonus;
  const rows = Object.values(TRANSMUTES).map((t) => {
    const can = unlocked && hasItems(state, t.inputs);
    const inputs = (Object.entries(t.inputs) as [ItemId, number][]).map(([id, qty]) => chip(state, id, qty)).join('<span class="fe-plus" aria-hidden="true">+</span>');
    return `<div class="fe-recipe${can ? ' is-ready' : ''}" title="${esc(t.name)}">
      <span class="fe-rin">${inputs}</span><span class="fe-arrow" aria-hidden="true">→</span>
      <span class="fe-rout" title="${esc(ITEMS[t.output].name)}">${icon(t.output, 'fe-ri')}<b>×${t.qty + bonus}</b></span>
      <button data-act="f-transmute:${t.id}" ${can ? '' : 'disabled'}>Transmutar</button>
    </div>`;
  }).join('');
  const hint = unlocked ? '' : `<button type="button" class="fe-hintbtn" data-act="f-goto:b_alchemy">${nodeIcon('b_alchemy', 'fe-rico')} Construa a Estação Alquímica</button>`;
  return `${hint}<div class="fe-recipes">${rows}</div>`;
}

function reforco(state: GameState, bag: ItemBag): string {
  return (Object.entries(bag) as [ItemId, number][]).map(([id, qty]) =>
    `<span class="fe-sstat fe-reforco${countOf(state, id) < qty ? ' is-short' : ''}" title="Reforço opcional: ${qty}× ${esc(ITEMS[id].name)} para +50% (tem ${countOf(state, id)})">${icon(id)}×${qty} <small>+50%</small></span>`).join('');
}

function spellCard(state: GameState, id: SpellId, learned: boolean): string {
  const spell = SPELLS[id];
  const slot = state.ferro.loadout.indexOf(id);
  const keys = SPELL_KEYS.map((key, i) =>
    `<button class="fe-key${slot === i ? ' active' : ''}" aria-pressed="${slot === i}" data-act="f-equip:${id}:${i}" ${learned ? '' : 'disabled'} aria-label="Equipar ${esc(spell.name)} em ${key}">${key}</button>`).join('');
  const cd = (spellCooldownMs(state, id) / 1000).toFixed(1).replace('.', ',');
  const stats = `<span class="fe-sstat fe-mana" title="Custo: ${spell.mana} de mana">◆ ${spell.mana}</span>${reforco(state, spell.cost)}<span class="fe-sstat" title="Recarga">⏱ ${cd} s</span>`
    + `<span class="fe-sstat" title="${TARGET_LABEL[spell.target]}">${TARGET_GLYPH[spell.target]}</span><span class="fe-sstat" title="Poder (${SCHOOL_LABEL[spell.school]})">✹ ${spellPower(state, id)}</span>`;
  const node = unlocker(id);
  const head = learned
    ? `<button type="button" class="fe-shead" data-act="f-pick:${id}" aria-pressed="${pickedSpell === id}">${spellIcon(id)}<b>${esc(spell.name)}</b></button>`
    : `<div class="fe-shead">${spellIcon(id)}<span class="fe-tb is-lock" aria-hidden="true">${LOCK_SVG}</span><b>${esc(spell.name)}</b></div>`;
  const foot = learned
    ? `<p class="fe-oneline">${esc(spell.effect)}</p>`
    : `<p class="fe-oneline is-lockhint">Aprenda em Habilidades → Magia</p>${node ? `<button type="button" class="fe-mini" data-act="f-goto:${node.id}">${nodeIcon(node.id, 'fe-rico')} ${esc(node.name)}</button>` : ''}`;
  return `<article class="fe-spell ${learned ? 'is-learned' : 'is-locked'}${pickedSpell === id ? ' is-picked' : ''}${slot >= 0 ? ' is-equipped' : ''}" data-spell="${id}" title="${esc(spell.effect)}">
    ${head}<div class="fe-sstats">${stats}</div>${foot}<div class="fe-keys">${keys}</div>
  </article>`;
}

// ---------------- party ----------------

function available(state: GameState): MemberId[] {
  return MEMBERS.filter((m) => m === 'ferrugem' || state.ferro.recruited.includes(m));
}

function partyTab(state: GameState): string {
  return `<section class="fe-block"><h3>Membros</h3><div class="fe-members">${heroCard()}${ferrugemCard(state)}${cobaltoCard(state)}</div></section>
    <section class="fe-block"><h3>Formação</h3><div class="fe-formation">${SLOTS.map((slot) => formationSlot(state, slot)).join('')}</div></section>
    <section class="fe-block"><h3>Sinergias</h3><div class="fe-synergies">${synergies(state)}</div></section>`;
}

function heroCard(): string {
  return `<article class="fe-member is-recruited" data-member-card="hero"><b>Herói</b><small>Sucateiro ferromante</small><p>Sempre em campo. Conjura os feitiços dos atalhos Z X C.</p></article>`;
}

function ferrugemCard(state: GameState): string {
  const slot = slotOf(state, 'ferrugem');
  return `<article class="fe-member is-recruited" data-member-card="ferrugem"><b>Ferrugem</b><small>Cão de sucata</small>
    <p>${slot ? `${SLOT_LABEL[slot]}: ${esc(ROLES.ferrugem[slot].name)}` : 'Fora da formação.'}</p></article>`;
}

function cobaltoCard(state: GameState): string {
  const ally = ALLIES.cobalto;
  if (state.ferro.recruited.includes('cobalto')) {
    const slot = slotOf(state, 'cobalto');
    return `<article class="fe-member is-recruited" data-member-card="cobalto"><b>${esc(ally.name)}</b><small>${esc(ally.title)} · recrutado</small>
      <p>${slot ? `${SLOT_LABEL[slot]}: ${esc(ROLES.cobalto[slot].name)}` : 'Fora da formação.'}</p></article>`;
  }
  if (!state.ferro.discovered.includes(ally.discovery)) {
    return `<article class="fe-member is-unknown" data-member-card="cobalto"><b>???</b><small>Não descoberto</small><p>Explore o ferro-velho.</p></article>`;
  }
  const problem = recruitProblem(state, 'cobalto');
  const affordable = hasItems(state, ally.recruitCost);
  const note = problem ?? (affordable ? 'Pronto para consertar.' : 'Faltam peças para o conserto.');
  return `<article class="fe-member is-found" data-member-card="cobalto"><b>${esc(ally.name)}</b><small>${esc(ally.title)} · descoberto</small>
    <p>${esc(ally.desc)}</p><p class="fe-cost">Conserto: ${esc(costText({ items: ally.recruitCost }))}</p>
    <p class="fe-hint">${esc(note)}</p>
    <button class="primary" data-act="f-recruit:cobalto" ${!problem && affordable ? '' : 'disabled'}>Recrutar</button></article>`;
}

function formationSlot(state: GameState, slot: FormationSlot): string {
  const member = state.ferro.formation[slot];
  const role = member ? ROLES[member][slot] : null;
  const picks = available(state).map((m) =>
    `<button class="${member === m ? 'active' : ''}" aria-pressed="${member === m}" data-act="f-form:${slot}:${m}">${esc(MEMBER_NAME[m])}</button>`).join('');
  const none = `<button class="${member ? '' : 'active'}" aria-pressed="${!member}" data-act="f-form:${slot}:none">Vazio</button>`;
  return `<div class="fe-fslot" data-slot="${slot}" data-member="${member ?? 'none'}">
    <h4>${SLOT_LABEL[slot]}</h4>
    <p class="fe-role">${role ? `<b>${esc(MEMBER_NAME[member!])} · ${esc(role.name)}</b><span>${esc(role.desc)}</span>` : '<span class="fe-muted">Ninguém neste posto.</span>'}</p>
    <div class="fe-picks">${picks}${none}</div>
  </div>`;
}

function synergies(state: GameState): string {
  const on = activeSynergies(state).map((syn) => syn.id);
  return Object.values(SYNERGIES).map((syn) => {
    const active = on.includes(syn.id);
    return `<article class="fe-synergy${active ? ' is-active' : ''}" data-synergy="${syn.id}" data-active="${active}">
      <header><b>${esc(syn.name)}</b><span class="fe-badge">${active ? 'Ativa' : 'Inativa'}</span></header>
      <p class="fe-effect">${esc(syn.effect)}</p>
      <small>Frente: ${esc(MEMBER_NAME[syn.front])} · Retaguarda: ${esc(MEMBER_NAME[syn.back])}</small>
    </article>`;
  }).join('');
}
