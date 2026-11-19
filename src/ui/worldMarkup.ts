import { WORLD_ZONES, worldPos } from '../core/worldLayout';
import type { HuntArea } from '../data/hunt';
import { LOCK, marker } from './mapMarkup';
import { esc } from './shared';

/** Region zones as buttons; a locked one stays visible, dimmed, and does not open. */
export function worldZones(heroLevel: number): string {
  return WORLD_ZONES.map(({ region: r, rect }) => {
    const locked = heroLevel < r.minLevel;
    const state = locked
      ? ` aria-disabled="true" title="Exige Nv ${r.minLevel}" aria-label="${esc(r.name)}, exige Nv ${r.minLevel}"`
      : ` title="${esc(r.desc)}" aria-label="Abrir ${esc(r.name)}, Nv ${r.minLevel}"`;
    return `<button class="mapw-zone${locked ? ' is-locked' : ''}" data-zone="${r.id}" data-fk="zone:${r.id}" data-biome="${r.biome}"`
      + ` style="left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.w * 100}%;height:${rect.h * 100}%"${state}>`
      + `<span class="mapw-zone-plate"><b>${esc(r.name)}</b><small>${locked ? `${LOCK} ` : ''}Nv ${r.minLevel}</small></span></button>`;
  }).join('');
}

/** Area markers placed on the world map instead of their region map. */
export function worldMarkers(areas: readonly HuntArea[], heroLevel: number, selected: string | null, hunting: string | null): string {
  return areas.map((a) => marker({ ...a, pos: worldPos(a) }, heroLevel, a.id === selected, a.id === hunting)).join('');
}

export function worldFooter(shown: number, total: number, view: 'map' | 'list'): string {
  return `${shown} de ${total} áreas no Mundo${view === 'map' ? ' · roda do mouse para zoom, arraste para mover' : ''}`;
}
