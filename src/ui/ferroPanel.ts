import { spellIconUrls } from '../art/ferroArt';
import {
  ALLIES, BUILD_NODES, ROLES, SKILL_NODES, SPELL_IDS, SPELL_KEYS, SPELLS, SYNERGIES, TRANSMUTES,
  type AllyId, type BuildNodeId, type FormationSlot, type MemberId, type NodeDef, type NodeId,
  type SkillNodeId, type SpellId, type SpellSchool, type SpellTarget, type TransmuteId,
} from '../data/ferromancy';
import { ITEMS, type ItemId } from '../data/items';
import {
  activeSynergies, alchemyUnlocked, buildNode, costText, isBuildNode, learnNode, ferroMods, missingRequirements, nodeDef, nodeStatus,
  owns, skillPoints, unlockedSpells, type NodeStatus,
} from '../core/progression';
import { equipSpell, recruit, recruitProblem, setFormation, slotOf, spellCooldownMs, spellPower, transmute } from '../core/spells';
import { countOf, hasItems, type GameState } from '../core/state';
import { session } from '../session';
import { esc, icon } from './shared';
import './ferro.css';

type FerroTab = 'build' | 'skill' | 'grimoire' | 'party';

const TABS: Array<[FerroTab, string]> = [['build', 'Construção'], ['skill', 'Habilidades'], ['grimoire', 'Grimório'], ['party', 'Equipe']];
const REAGENTS: ItemId[] = ['ether_shard', 'reagent_ember', 'reagent_ward', 'reagent_lodestone'];
const SCHOOL_LABEL: Record<SpellSchool, string> = { ataque: 'Ataque', defesa: 'Defesa', extracao: 'Extração' };
const TARGET_LABEL: Record<SpellTarget, string> = { enemy: 'Inimigo', self: 'Si mesmo', area: 'Área' };
const SLOT_LABEL: Record<FormationSlot, string> = { front: 'Frente', back: 'Retaguarda' };
const MEMBER_NAME: Record<MemberId, string> = { ferrugem: 'Ferrugem', cobalto: ALLIES.cobalto.name };
const MEMBERS: MemberId[] = ['ferrugem', 'cobalto'];
const SLOTS: FormationSlot[] = ['front', 'back'];

let tab: FerroTab = 'build';

export function ferroPanelView(state: GameState): string {
  const tabs = TABS.map(([id, label]) =>
    `<button role="tab" class="${tab === id ? 'active' : ''}" aria-selected="${tab === id}" data-act="f-tab:${id}">${esc(label)}</button>`).join('');
  const views: Record<FerroTab, (s: GameState) => string> = { build: buildTab, skill: skillTab, grimoire: grimoireTab, party: partyTab };
  return `<div class="ferro" data-tab="${tab}"><div class="fe-tabs" role="tablist">${tabs}</div>${views[tab](state)}</div>`;
}

export function handleFerroAction(action: string, value: string): boolean {
  const [a, b] = value.split(':');
  switch (action) {
    case 'f-tab':
      if (!TABS.some(([id]) => id === value)) return false;
      tab = value as FerroTab;
      return true;
    case 'f-build': session.run((s) => buildNode(s, value as BuildNodeId)); return true;
    case 'f-learn': session.run((s) => learnNode(s, value as SkillNodeId)); return true;
    case 'f-transmute': session.run((s) => transmute(s, value as TransmuteId)); return true;
    case 'f-equip': session.run((s) => equipSpell(s, Number(b), a as SpellId)); return true;
    case 'f-unequip': session.run((s) => equipSpell(s, Number(value), null)); return true;
    case 'f-recruit': session.run((s) => recruit(s, value as AllyId)); return true;
    case 'f-form': session.run((s) => setFormation(s, a as FormationSlot, b === 'none' ? null : b as MemberId)); return true;
    default: return false;
  }
}

// ---------------- trees ----------------

const STATUS_LABEL: Record<Exclude<NodeStatus, 'owned'>, string> = { available: 'Disponível', unaffordable: 'Sem recursos', locked: 'Bloqueado' };

function buildTab(state: GameState): string {
  return `<p class="fe-lead">Restaure a oficina e destrave estações. Construir também rende pontos de ofício.</p>${tree(state, Object.values(BUILD_NODES), 'build')}`;
}

function skillTab(state: GameState): string {
  const pts = skillPoints(state);
  return `<p class="fe-lead"><span class="fe-points"><b>${pts.free}</b> ponto${pts.free === 1 ? '' : 's'} livre${pts.free === 1 ? '' : 's'}</span>`
    + ` <span class="fe-muted">${pts.earned} ganhos jogando: abates, buscas, extrações e construções.</span></p>${tree(state, Object.values(SKILL_NODES), 'skill')}`;
}

function tree(state: GameState, nodes: NodeDef<NodeId>[], kind: 'build' | 'skill'): string {
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const inTree = (id: NodeId): boolean => isBuildNode(id) === (kind === 'build');
  const lines = nodes.flatMap((node) => node.requires.filter(inTree).map((req) => {
    const from = nodeDef(req);
    const met = owns(state, req) ? ' met' : '';
    return `<line class="fe-link${met}" x1="${from.col + 0.5}" y1="${from.row + 0.5}" x2="${node.col + 0.5}" y2="${node.row + 0.5}" vector-effect="non-scaling-stroke"/>`;
  })).join('');
  const cards = nodes.map((node) => nodeCard(state, node, kind, inTree)).join('');
  return `<div class="fe-tree-scroll"><div class="fe-tree" style="--cols:${cols};--rows:${rows}">`
    + `<svg class="fe-links" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${cards}</div></div>`;
}

function nodeCard(state: GameState, node: NodeDef<NodeId>, kind: 'build' | 'skill', inTree: (id: NodeId) => boolean): string {
  const status = nodeStatus(state, node.id);
  const verb = kind === 'build' ? 'Construir' : 'Aprender';
  const badge = status === 'owned' ? (kind === 'build' ? 'Construído' : 'Aprendido') : STATUS_LABEL[status];
  const reqs = node.requires.map((id) => {
    const met = owns(state, id);
    const cross = inTree(id) ? '' : ` <small>(${isBuildNode(id) ? 'Construção' : 'Habilidades'})</small>`;
    return `<li class="${met ? 'met' : 'unmet'}">${met ? '✓' : '·'} ${esc(nodeDef(id).name)}${cross}</li>`;
  });
  if (node.requiresDiscovery) {
    const met = state.ferro.discovered.includes(node.requiresDiscovery);
    reqs.push(`<li class="${met ? 'met' : 'unmet'}">${met ? '✓' : '·'} Veio de Éter descoberto</li>`);
  }
  const missing = status === 'locked' ? `<p class="fe-missing">Falta: ${esc(missingRequirements(state, node).join(', '))}</p>` : '';
  const action = status === 'owned' ? '' : `<button class="fe-act${status === 'available' ? ' primary' : ''}" data-act="f-${kind === 'build' ? 'build' : 'learn'}:${node.id}" ${status === 'available' ? '' : 'disabled'}>${verb}</button>`;
  return `<article class="fe-node is-${status}" data-node="${node.id}" data-status="${status}" style="grid-column:${node.col + 1};grid-row:${node.row + 1}">
    <header><b>${esc(node.name)}</b><span class="fe-badge">${esc(badge)}</span></header>
    <p class="fe-cost">${esc(costText(node.cost))}</p>
    ${reqs.length ? `<ul class="fe-reqs">${reqs.join('')}</ul>` : ''}
    <p class="fe-effect">${esc(node.effect)}</p>${missing}${action}
  </article>`;
}

// ---------------- grimoire ----------------

function spellIcon(id: SpellId, cls = 'fe-spell-ico'): string {
  const url = spellIconUrls[id];
  return url ? `<img class="${cls}" src="${url}" alt="">` : `<span class="${cls} is-blank" aria-hidden="true">✦</span>`;
}

function grimoireTab(state: GameState): string {
  const reagents = REAGENTS.map((id) => `<span class="fe-reagent" title="${esc(ITEMS[id].name)}">${icon(id)}<b>${countOf(state, id)}</b> ${esc(ITEMS[id].name)}</span>`).join('');
  return `<section class="fe-block"><h3>Reagentes</h3><div class="fe-reagents">${reagents}</div></section>
    <section class="fe-block"><h3>Transmutação</h3>${transmutes(state)}</section>
    <section class="fe-block"><h3>Atalhos</h3>${loadoutRow(state)}</section>
    <section class="fe-block"><h3>Feitiços</h3><div class="fe-spells">${SPELL_IDS.map((id) => spellCard(state, id)).join('')}</div></section>`;
}

function transmutes(state: GameState): string {
  const unlocked = alchemyUnlocked(state);
  const bonus = ferroMods(state).transmuteBonus;
  const rows = Object.values(TRANSMUTES).map((t) => {
    const can = unlocked && hasItems(state, t.inputs);
    return `<div class="fe-transmute">
      <span class="fe-tin">${esc(costText({ items: t.inputs }))}</span><span class="fe-arrow" aria-hidden="true">→</span>
      <span class="fe-tout">${icon(t.output)}${t.qty + bonus}× ${esc(ITEMS[t.output].name)}</span>
      <button data-act="f-transmute:${t.id}" ${can ? '' : 'disabled'}>Transmutar</button>
    </div>`;
  }).join('');
  const hint = unlocked ? '' : '<p class="fe-hint">Construa a Estação Alquímica.</p>';
  return `${hint}<div class="fe-transmutes">${rows}</div>`;
}

function loadoutRow(state: GameState): string {
  return `<div class="fe-loadout">${SPELL_KEYS.map((key, slot) => {
    const id = state.ferro.loadout[slot];
    const body = id ? `${spellIcon(id)}<span>${esc(SPELLS[id].name)}</span>` : '<span class="fe-muted">vazio</span>';
    const clear = id ? `<button class="fe-mini" data-act="f-unequip:${slot}" aria-label="Liberar atalho ${key}">✕</button>` : '';
    return `<div class="fe-lslot${id ? ' is-full' : ''}"><kbd>${key}</kbd>${body}${clear}</div>`;
  }).join('')}</div>`;
}

function unlockerName(id: SpellId): string {
  return Object.values(SKILL_NODES).find((n) => n.unlocksSpell === id)?.name ?? '';
}

function spellCard(state: GameState, id: SpellId): string {
  const spell = SPELLS[id];
  const learned = unlockedSpells(state).includes(id);
  const slot = state.ferro.loadout.indexOf(id);
  const keys = SPELL_KEYS.map((key, i) =>
    `<button class="fe-key${slot === i ? ' active' : ''}" aria-pressed="${slot === i}" data-act="f-equip:${id}:${i}" ${learned ? '' : 'disabled'} aria-label="Equipar ${esc(spell.name)} em ${key}">${key}</button>`).join('');
  const stateText = learned ? (slot >= 0 ? `Equipado em ${SPELL_KEYS[slot]}` : 'Aprendido') : `Bloqueado: aprenda ${unlockerName(id)}`;
  return `<article class="fe-spell ${learned ? 'is-learned' : 'is-locked'}" data-spell="${id}">
    <div class="fe-spell-head">${spellIcon(id)}<div><b>${esc(spell.name)}</b><small>${SCHOOL_LABEL[spell.school]} · ${TARGET_LABEL[spell.target]}</small></div></div>
    <dl class="fe-stats">
      <div><dt>Custo</dt><dd>${esc(costText({ items: spell.cost }))}</dd></div>
      <div><dt>Recarga</dt><dd>${(spellCooldownMs(state, id) / 1000).toFixed(1).replace('.', ',')} s</dd></div>
      <div><dt>Poder</dt><dd>${spellPower(state, id)}</dd></div>
    </dl>
    <p class="fe-effect">${esc(spell.effect)}</p>
    <p class="fe-state">${esc(stateText)}</p>
    <div class="fe-keys">${keys}</div>
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
