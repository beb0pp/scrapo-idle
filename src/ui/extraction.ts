import { computeProgress } from '../core/afk';
import { AFK_AREAS } from '../data/areas';
import { session } from '../session';
import { bagHtml, $, esc } from './shared';

export interface ExtractionHandlers {
  onStop: () => void;
  onResume: () => void;
  onClaim: () => void;
}

const reasons: Record<string, string> = {
  full: 'Carga cheia. O drone voltou.',
  stopped: 'Extração encerrada por você.',
  manual_control: 'Você retomou o controle.',
  tab_closed: 'A aba foi fechada. Os ciclos concluídos até ali foram guardados.',
};

export function renderExtraction(handlers: ExtractionHandlers): void {
  const state = session.state;
  const element = $('extraction');
  if (!state.afk) { element.hidden = true; return; }
  const progress = computeProgress(state.afk, Date.now());
  const area = AFK_AREAS[state.afk.areaId];
  const status = progress.ended ? reasons[state.afk.endReason ?? 'full'] : 'Drone em campo, vasculhando…';
  element.innerHTML = `<h2>${esc(area.name)}</h2><div class="state ${progress.ended ? 'done' : 'run'}">${progress.ended ? '■ Encerrada' : '● Em andamento'}</div><div class="desc">${esc(status)}</div><label>Carga ${progress.load}/${progress.capacity}</label><div class="bar"><i style="width:${(progress.load / progress.capacity) * 100}%"></i></div><label>Ciclo atual</label><div class="bar thin"><i style="width:${progress.cycleProgress * 100}%"></i></div><div class="desc">${progress.cycles} ciclo(s) concluído(s) · ${area.cycleMs / 1000}s por ciclo${progress.rareFound ? ' · <b class="rare">achado raro!</b>' : ''}</div><h3>Achados</h3><div class="chips">${bagHtml(progress.loot)}</div><div class="acts">${progress.ended ? '<button class="primary" data-x="claim">Recolher achados</button>' : '<button data-x="stop">Encerrar e recolher</button><button data-x="resume">Retomar controle (WASD)</button>'}</div>`;
  element.hidden = false;
  element.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    const action = (button as HTMLElement).dataset.x;
    if (action === 'claim') handlers.onClaim();
    if (action === 'stop') handlers.onStop();
    if (action === 'resume') handlers.onResume();
  }));
}

export function hideExtraction(): void { $('extraction').hidden = true; }
