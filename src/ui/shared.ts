import { iconUrls } from '../art/sprites';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';

export const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export function esc(value: string): string {
  return value.replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[char]!);
}

export function icon(id: ItemId, className = 'ico'): string {
  return `<img class="${className}" src="${iconUrls[id] ?? ''}" alt="">`;
}

export function bagHtml(bag: ItemBag): string {
  const entries = Object.entries(bag) as [ItemId, number][];
  if (!entries.length) return '<span class="muted">nada ainda</span>';
  return entries.map(([id, qty]) => `<span class="chip ${ITEMS[id].kind}">${icon(id)}${qty}× ${esc(ITEMS[id].name)}</span>`).join('');
}
