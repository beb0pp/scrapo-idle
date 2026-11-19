import { spellIconUrls } from '../art/ferroArt';
import { SPELL_KEYS, SPELLS } from '../data/ferromancy';
import { ITEMS, type ItemId } from '../data/items';
import type { LevelInfo } from '../core/mana';
import { canEmpower } from '../core/spells';
import { countOf } from '../core/state';
import { session } from '../session';
import { $, esc, icon } from './shared';
import { setFerroTab } from './ferroPanel';
import './ferro.css';

let spellClick: (slot: number) => void = () => {};
let fractions = [0, 0, 0];
let manaNow = Infinity;
let levelKey = '';

export function onSpellClick(fn: (slot: number) => void): void {
  spellClick = fn;
}

function openFerro(): void {
  window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: 'ferro' }));
}

export function initFerroHud(): void {
  if (document.getElementById('spellbar')) return;
  const bar = document.createElement('div');
  bar.id = 'spellbar';
  bar.className = 'spellbar';
  $('hud').appendChild(bar);
  injectVitals();
  bar.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button) return;
    if (button.id === 'ferro-btn') openFerro();
    else if (button.classList.contains('is-empty')) { setFerroTab('grimoire'); openFerro(); }
    else if (button.dataset.spellSlot) spellClick(Number(button.dataset.spellSlot));
  });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.key.toLowerCase() !== 'k') return;
    if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;
    if ($('hud').hidden || !$('modal').hidden) return;
    openFerro();
  });
  session.onChange(renderSpellbar);
  renderSpellbar();
}

/** Mana under the HP bar plus the level badge, inside the existing .hud-top. */
function injectVitals(): void {
  const hp = document.querySelector('.hud-top .hp');
  if (!hp || document.getElementById('mana-fill')) return;
  const vitals = document.createElement('div');
  vitals.className = 'vitals';
  hp.replaceWith(vitals);
  const mana = document.createElement('div');
  mana.className = 'mana';
  mana.innerHTML = '<span class="mana-gem" aria-hidden="true">◆</span><div class="bar mana-bar" role="meter" aria-label="Mana" aria-valuemin="0"><i id="mana-fill"></i></div><span id="mana-num"></span>'
    + '<span class="lvl" id="lvl-badge" title="Nível">Nv 1</span><div class="bar xp-bar" role="meter" aria-label="Experiência" aria-valuemin="0"><i id="xp-fill"></i></div>';
  vitals.append(hp, mana);
}

export function setMana(value: number, max: number): void {
  manaNow = value;
  const fill = document.getElementById('mana-fill');
  if (fill) {
    fill.style.width = `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`;
    const meter = fill.parentElement!;
    meter.setAttribute('aria-valuemax', String(max));
    meter.setAttribute('aria-valuenow', String(Math.floor(value)));
  }
  const num = document.getElementById('mana-num');
  if (num) num.textContent = `${Math.floor(value)}/${max}`;
  const bar = document.getElementById('spellbar');
  if (bar) applyMana(bar);
}

export function setLevel(info: LevelInfo): void {
  const key = `${info.level}:${info.into}`;
  if (key === levelKey) return;
  levelKey = key;
  const badge = document.getElementById('lvl-badge');
  if (badge) badge.textContent = `Nv ${info.level}`;
  const fill = document.getElementById('xp-fill');
  if (!fill) return;
  fill.style.width = `${info.need > 0 ? Math.min(100, (info.into / info.need) * 100) : 100}%`;
  const meter = fill.parentElement!;
  meter.setAttribute('aria-valuenow', String(info.into));
  meter.setAttribute('aria-valuemax', String(info.need));
  meter.title = info.need > 0 ? `XP ${info.into}/${info.need}` : 'Nível máximo';
}

function applyMana(bar: HTMLElement): void {
  bar.querySelectorAll<HTMLElement>('[data-spell-id]').forEach((button) => {
    button.classList.toggle('is-low', manaNow < SPELLS[button.dataset.spellId as keyof typeof SPELLS].mana);
  });
}

function renderSpellbar(): void {
  const bar = document.getElementById('spellbar');
  if (!bar) return;
  const state = session.state;
  const slots = SPELL_KEYS.map((key, slot) => {
    const id = state.ferro.loadout[slot];
    if (!id) return `<button class="spell-slot is-empty" data-spell-slot="${slot}" title="Vazio — clique para equipar um feitiço"><b>${key}</b><span>vazio</span><i class="cd"></i></button>`;
    const spell = SPELLS[id];
    const reagent = Object.keys(spell.cost)[0] as ItemId;
    const have = countOf(state, reagent);
    const boosted = canEmpower(state, id);
    const url = spellIconUrls[id];
    const art = url ? `<img class="spell-ico" src="${url}" alt="">` : '<span class="spell-ico" aria-hidden="true">✦</span>';
    const boost = boosted ? `<em class="spell-boost" title="Reforçado: +50% (${have}× ${esc(ITEMS[reagent].name)})">${icon(reagent, 'spell-reagent')}✦</em>` : '';
    const label = `${esc(spell.name)}, atalho ${key}, ${spell.mana} de mana${boosted ? `, reforçado (${have} reagentes)` : ''}`;
    return `<button class="spell-slot${boosted ? ' is-boosted' : ''}" data-spell-slot="${slot}" data-spell-id="${id}" title="${esc(spell.name)} (${key})" aria-label="${label}">`
      + `<b>${key}</b>${art}<span>${esc(spell.name)}</span><em class="spell-mana">◆${spell.mana}</em>${boost}<i class="cd"></i></button>`;
  }).join('');
  bar.innerHTML = `${slots}<button id="ferro-btn" class="spell-slot ferro-btn" title="Abrir Ferromancia (K)"><b>K</b><span>Ferromancia</span></button>`;
  applyCooldowns(bar);
  applyMana(bar);
}

function applyCooldowns(bar: HTMLElement): void {
  bar.querySelectorAll<HTMLElement>('[data-spell-slot]').forEach((button) => {
    const fraction = fractions[Number(button.dataset.spellSlot)] ?? 0;
    const cd = button.querySelector<HTMLElement>('.cd');
    if (cd) cd.style.height = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
    button.classList.toggle('is-cooling', fraction > 0);
  });
}

export function setSpellCooldowns(next: number[]): void {
  fractions = [0, 1, 2].map((i) => next[i] ?? 0);
  const bar = document.getElementById('spellbar');
  if (bar) applyCooldowns(bar);
}

export function flashSpellSlot(slot: number): void {
  const button = document.querySelector<HTMLElement>(`#spellbar [data-spell-slot="${slot}"]`);
  if (!button) return;
  button.classList.remove('is-flash');
  void button.offsetWidth;
  button.classList.add('is-flash');
  window.setTimeout(() => button.classList.remove('is-flash'), 360);
}
