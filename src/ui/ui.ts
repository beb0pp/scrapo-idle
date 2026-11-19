export { bagHtml } from './shared';
export { hideExtraction, renderExtraction, type ExtractionHandlers } from './extraction';
export { hudFrame, initHud, objective, onActionClick, onSkillClick, refreshHud, showHud, type HudFrame } from './hud';
export { closePanel, initPanels, onAfkStart, onPanelChange, openPanel, panelOpen, togglePanel, type PanelKind } from './panels';
export { setMinimap, setMinimapPlayer, type MinimapData } from './minimap';

import { $ , esc } from './shared';

export function toast(message: string, kind: 'ok' | 'warn' | 'loot' = 'ok', color?: string): void {
  const element = document.createElement('div');
  element.className = `toast ${kind}`;
  element.textContent = message;
  if (color) {
    element.style.borderLeftColor = color;
    element.style.color = color;
  }
  $('toasts').appendChild(element);
  setTimeout(() => element.classList.add('out'), 2600);
  setTimeout(() => element.remove(), 3200);
}

export function modal(
  html: string,
  buttons: { label: string; primary?: boolean; onClick: () => void }[],
): void {
  const modalElement = $('modal');
  modalElement.innerHTML = `<div class="modal-card">${html}<div class="modal-acts">${buttons.map((button, index) => `<button data-index="${index}" class="${button.primary ? 'primary' : ''}">${esc(button.label)}</button>`).join('')}</div></div>`;
  modalElement.hidden = false;
  modalElement.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    modalElement.hidden = true;
    buttons[Number((button as HTMLElement).dataset.index)]?.onClick();
  }));
  (modalElement.querySelector('button.primary') as HTMLElement | null)?.focus();
}
