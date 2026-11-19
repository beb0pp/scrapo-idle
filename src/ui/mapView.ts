import { MAP_H, MAP_W } from './mapCanvas';

const MAX_ZOOM = 3;
const DRAG_SLOP = 4;

export interface MapView {
  /** Zooms by a factor around the viewport centre (buttons, keyboard). */
  zoomBy(factor: number): void;
  /** Scrolls so a 0..1 map point is in view. */
  reveal(x: number, y: number): void;
  /** True right after a drag, so the click that ends it is ignored. */
  consumeDrag(): boolean;
}

/** Wheel zoom around the cursor and drag pan; fits the whole map at minimum zoom, centred on the short axis. */
export function attachMapView(viewport: HTMLElement, world: HTMLElement): MapView {
  let k = 1, x = 0, y = 0, rel = 1, lastFit = 0;
  let dragged = false;
  const fit = () => Math.min(viewport.clientWidth / MAP_W, viewport.clientHeight / MAP_H) || 1;
  const clamp = (v: number, view: number, size: number) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, v)));

  const apply = () => {
    const min = fit();
    // Viewport resized (detail card shown, dock moved): keep the zoom relative to the fit, not absolute.
    if (lastFit && min !== lastFit) k = rel * min;
    lastFit = min;
    k = Math.min(Math.max(k, min), min * MAX_ZOOM);
    rel = k / min;
    x = clamp(x, viewport.clientWidth, MAP_W * k);
    y = clamp(y, viewport.clientHeight, MAP_H * k);
    world.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    world.style.setProperty('--k', String(k));
    viewport.dataset.scale = rel.toFixed(2);
  };

  const zoomAt = (factor: number, cx: number, cy: number) => {
    const next = Math.min(Math.max(k * factor, fit()), fit() * MAX_ZOOM);
    x = cx - ((cx - x) * next) / k;
    y = cy - ((cy - y) * next) / k;
    k = next;
    apply();
  };

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.clientX - box.left, event.clientY - box.top);
  }, { passive: false });

  viewport.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    const sx = down.clientX, sy = down.clientY, ox = x, oy = y;
    let moving = false;
    dragged = false;
    const move = (e: PointerEvent) => {
      if (!moving && Math.hypot(e.clientX - sx, e.clientY - sy) < DRAG_SLOP) return;
      if (!moving) { moving = true; viewport.setPointerCapture(down.pointerId); viewport.classList.add('is-panning'); }
      x = ox + e.clientX - sx;
      y = oy + e.clientY - sy;
      apply();
    };
    const up = () => {
      dragged = moving;
      viewport.classList.remove('is-panning');
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', up);
      viewport.removeEventListener('pointercancel', up);
    };
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
  });

  new ResizeObserver(apply).observe(viewport);
  k = fit();
  apply();

  return {
    zoomBy: (factor) => zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2),
    reveal(px, py) {
      const mx = px * MAP_W * k + x, my = py * MAP_H * k + y;
      const margin = 40;
      if (mx < margin || mx > viewport.clientWidth - margin) x = viewport.clientWidth / 2 - px * MAP_W * k;
      if (my < margin || my > viewport.clientHeight - margin) y = viewport.clientHeight / 2 - py * MAP_H * k;
      apply();
    },
    consumeDrag() {
      const was = dragged;
      dragged = false;
      return was;
    },
  };
}
