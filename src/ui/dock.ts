// Where the Mochila window sits: docked right, docked left, or floating where the player dragged it.
// The choice is a per-viewer convenience kept in localStorage.

export type DockMode = 'right' | 'left' | 'free';

const KEY = 'scrapo.invDock';
const ORDER: DockMode[] = ['right', 'left', 'free'];
export const DOCK_LABEL: Record<DockMode, string> = { right: 'Direita', left: 'Esquerda', free: 'Livre' };

interface DockState {
  mode: DockMode;
  x: number;
  y: number;
}

let state: DockState = load();

function load(): DockState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && ORDER.includes(raw.mode)) return { mode: raw.mode, x: Number(raw.x) || 80, y: Number(raw.y) || 70 };
  } catch {
    /* fall back to default */
  }
  return { mode: 'right', x: 80, y: 70 };
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* per-viewer convenience only */
  }
}

export function dockMode(): DockMode {
  return state.mode;
}

export function cycleDock(): void {
  state.mode = ORDER[(ORDER.indexOf(state.mode) + 1) % ORDER.length];
  if (state.mode === 'free') state = { ...state, x: Math.round(window.innerWidth / 2 - 300), y: 70 };
  save();
}

/** Applies (inventory open) or clears (closed / other panel) the dock layout on #panel and the page. */
export function applyDock(panel: HTMLElement, inventoryOpen: boolean): void {
  document.body.classList.toggle('inv-open', inventoryOpen);
  document.body.dataset.invDock = inventoryOpen ? state.mode : '';
  if (!inventoryOpen) {
    delete panel.dataset.dock;
    panel.style.left = '';
    panel.style.top = '';
    return;
  }
  panel.dataset.dock = state.mode;
  if (state.mode === 'free') {
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
    const maxY = Math.max(0, window.innerHeight - 80);
    state.x = Math.min(Math.max(8, state.x), maxX);
    state.y = Math.min(Math.max(8, state.y), maxY);
    panel.style.left = `${state.x}px`;
    panel.style.top = `${state.y}px`;
  } else {
    panel.style.left = '';
    panel.style.top = '';
  }
}

/** Drag the window by its header; dragging switches it to floating mode. */
export function enableDockDrag(panel: HTMLElement, isInventory: () => boolean): void {
  panel.addEventListener('pointerdown', (down) => {
    const head = (down.target as HTMLElement).closest('.panel-head');
    if (!head || !isInventory() || (down.target as HTMLElement).closest('button')) return;
    const rect = panel.getBoundingClientRect();
    const dx = down.clientX - rect.left, dy = down.clientY - rect.top;
    state.mode = 'free';
    head.setPointerCapture(down.pointerId);
    const move = (e: PointerEvent) => {
      state.x = e.clientX - dx;
      state.y = e.clientY - dy;
      applyDock(panel, true);
    };
    const up = () => {
      head.removeEventListener('pointermove', move as EventListener);
      head.removeEventListener('pointerup', up);
      save();
    };
    head.addEventListener('pointermove', move as EventListener);
    head.addEventListener('pointerup', up);
    move(down);
  });
}
