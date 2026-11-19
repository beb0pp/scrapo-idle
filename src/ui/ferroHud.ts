import { spellIconUrls } from '../art/ferroArt';
import { SPELL_KEYS, SPELLS } from '../data/ferromancy';
import type { ItemId } from '../data/items';
import { countOf } from '../core/state';
import { session } from '../session';
import { $, esc, icon } from './shared';
import './ferro.css';

let spellClick: (slot: number) => void = () => {};
let fractions = [0, 0, 0];

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
  bar.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button) return;
    if (button.id === 'ferro-btn') openFerro();
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

function renderSpellbar(): void {
  const bar = document.getElementById('spellbar');
  if (!bar) return;
  const state = session.state;
  const slots = SPELL_KEYS.map((key, slot) => {
    const id = state.ferro.loadout[slot];
    if (!id) return `<button class="spell-slot is-empty" data-spell-slot="${slot}" title="Atalho ${key} vazio: equipe um feitiço (K)"><b>${key}</b><span>vazio</span><i class="cd"></i></button>`;
    const spell = SPELLS[id];
    const [reagent, qty] = Object.entries(spell.cost)[0] as [ItemId, number];
    const have = countOf(state, reagent);
    const url = spellIconUrls[id];
    const art = url ? `<img class="spell-ico" src="${url}" alt="">` : '<span class="spell-ico" aria-hidden="true">✦</span>';
    return `<button class="spell-slot${have < qty ? ' is-dry' : ''}" data-spell-slot="${slot}" title="${esc(spell.name)} (${key})" aria-label="${esc(spell.name)}, atalho ${key}, ${have} reagentes">`
      + `<b>${key}</b>${art}<span>${esc(spell.name)}</span><em class="spell-qty">${icon(reagent, 'spell-reagent')}${have}</em><i class="cd"></i></button>`;
  }).join('');
  bar.innerHTML = `${slots}<button id="ferro-btn" class="spell-slot ferro-btn" title="Abrir Ferromancia (K)"><b>K</b><span>Ferromancia</span></button>`;
  applyCooldowns(bar);
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
