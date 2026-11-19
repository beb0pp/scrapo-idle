import { ELEMENTS, type ElementId } from '../data/elements';
import { esc } from './shared';
import './elements.css';

/** Colour comes from data so the chip never drifts from the Phaser tint; data-el is the hook for selectors. */
export function elementChip(el: ElementId): string {
  const def = ELEMENTS[el];
  return `<span class="el-chip" data-el="${el}" style="--el:${def.color}" title="${esc(`${def.name}: ${def.desc}`)}">${esc(def.name)}</span>`;
}
