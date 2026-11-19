// Where each movable window sits: docked right, docked left, or floating where the player dragged it.
// The choice is a per-viewer convenience kept in localStorage, one entry per window kind.

export type DockMode = 'right' | 'left' | 'free';
export type DockKind = 'inventory' | 'ferro' | 'workshop' | 'map';

const ORDER: DockMode[] = ['right', 'left', 'free'];
const KINDS: DockKind[] = ['inventory', 'ferro', 'workshop', 'map'];
/** 'scrapo.invDock' predates the other windows; kept so players keep their Mochila choice. */
const KEY: Record<DockKind, string> = { inventory: 'scrapo.invDock', ferro: 'scrapo.dock.ferro', workshop: 'scrapo.dock.workshop', map: 'scrapo.dock.map' };
export const DOCK_LABEL: Record<DockMode, string> = { right: 'Direita', left: 'Esquerda', free: 'Livre' };

interface DockState {
  mode: DockMode;
  x: number;
  y: number;
}

const states = new Map<DockKind, DockState>();

export function isDockKind(kind: string | null): kind is DockKind {
  return KINDS.includes(kind as DockKind);
}

function stateOf(kind: DockKind): DockState {
  let state = states.get(kind);
  if (!state) {
    state = load(kind);
    states.set(kind, state);
  }
  return state;
}

function load(kind: DockKind): DockState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY[kind]) ?? 'null');
    if (raw && ORDER.includes(raw.mode)) return { mode: raw.mode, x: Number(raw.x) || 80, y: Number(raw.y) || 70 };
  } catch {
    /* fall back to default */
  }
  return { mode: 'right', x: 80, y: 70 };
}

function save(kind: DockKind): void {
  try {
    localStorage.setItem(KEY[kind], JSON.stringify(stateOf(kind)));
  } catch {
    /* per-viewer convenience only */
  }
}

export function dockMode(kind: DockKind): DockMode {
  return stateOf(kind).mode;
}

/** Next placement; switching to floating centres the window horizontally. */
export function cycleDock(panel: HTMLElement, kind: DockKind): void {
  const state = stateOf(kind);
  state.mode = ORDER[(ORDER.indexOf(state.mode) + 1) % ORDER.length];
  if (state.mode === 'free') {
    state.x = Math.round((window.innerWidth - panel.offsetWidth) / 2);
    state.y = 70;
  }
  save(kind);
  applyDock(panel, kind);
}

/** Applies the open window's dock layout on #panel and the page, or clears it (closed / fixed panel). */
export function applyDock(panel: HTMLElement, kind: DockKind | null): void {
  const state = kind ? stateOf(kind) : null;
  document.body.dataset.panelDock = state?.mode ?? '';
  if (!kind || !state) {
    delete panel.dataset.dock;
    delete panel.dataset.dockKind;
    panel.style.left = '';
    panel.style.top = '';
    return;
  }
  panel.dataset.dock = state.mode;
  panel.dataset.dockKind = kind;
  if (state.mode !== 'free') {
    panel.style.left = '';
    panel.style.top = '';
    return;
  }
  const maxX = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
  const maxY = Math.max(8, window.innerHeight - 80);
  state.x = Math.min(Math.max(8, state.x), maxX);
  state.y = Math.min(Math.max(8, state.y), maxY);
  panel.style.left = `${state.x}px`;
  panel.style.top = `${state.y}px`;
}

/** Drag the window by its header; dragging switches it to floating mode. */
export function enableDockDrag(panel: HTMLElement, currentKind: () => DockKind | null): void {
  panel.addEventListener('pointerdown', (down) => {
    const kind = currentKind();
    const head = (down.target as HTMLElement).closest('.panel-head');
    if (!head || !kind || (down.target as HTMLElement).closest('button')) return;
    const state = stateOf(kind);
    const rect = panel.getBoundingClientRect();
    const dx = down.clientX - rect.left, dy = down.clientY - rect.top;
    state.mode = 'free';
    head.setPointerCapture(down.pointerId);
    const move = (e: PointerEvent) => {
      state.x = e.clientX - dx;
      state.y = e.clientY - dy;
      applyDock(panel, kind);
    };
    const up = () => {
      head.removeEventListener('pointermove', move as EventListener);
      head.removeEventListener('pointerup', up);
      save(kind);
      panel.querySelector<HTMLElement>('.dock-btn')?.replaceChildren(dockLabel(kind));
    };
    head.addEventListener('pointermove', move as EventListener);
    head.addEventListener('pointerup', up);
    move(down);
  });
}

export function dockLabel(kind: DockKind): string {
  return `⇆ ${DOCK_LABEL[dockMode(kind)]}`;
}
