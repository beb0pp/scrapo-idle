import Phaser from 'phaser';

const BIAS_KEY = 'scrapo.zoomBias';
/** Width of the HUD side column (minimap, extraction, finds) on wide screens; the map must never sit under it. */
const SIDE_COLUMN_PX = 328;

function readBias(): number {
  try {
    return Math.max(-2, Math.min(2, Number(localStorage.getItem(BIAS_KEY)) || 0));
  } catch {
    return 0;
  }
}

/**
 * Integer zoom so ~560×300 world pixels stay visible: crisp pixels and a wide view.
 * Mouse wheel nudges it one integer step at a time (remembered per browser).
 * The playable area is the screen minus the HUD side column: small maps are centred in it,
 * big maps can scroll far enough that their right edge clears the column.
 */
export function applyZoom(scene: Phaser.Scene, mapW: number, mapH: number): void {
  let bias = readBias();
  const fit = () => {
    const { width, height } = scene.scale.gameSize;
    const reserve = width > 700 ? SIDE_COLUMN_PX : 0;
    // ~480×280 world px of usable view: zoom 2 at 1366×768, zoom 3 at 1920×1080.
    const base = Math.max(1, Math.floor(Math.min((width - reserve) / 480, height / 280)));
    const z = Math.max(1, Math.min(6, base + bias));
    const cam = scene.cameras.main;
    cam.setZoom(z);
    const vw = width / z, vh = height / z, usable = (width - reserve) / z;
    const bx = mapW < usable ? (mapW - usable) / 2 : 0;
    const by = mapH < vh ? (mapH - vh) / 2 : 0;
    const boundsW = mapW < usable ? vw : mapW + reserve / z;
    cam.setBounds(bx, by, Math.max(boundsW, vw), Math.max(mapH, vh));
    // Keep the hero centred in the usable area (left of the side column), not under it.
    cam.setFollowOffset(mapW < usable ? 0 : -reserve / z / 2, 0);
  };
  const wheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => {
    bias = Math.max(-2, Math.min(2, bias + (dy > 0 ? -1 : 1)));
    try {
      localStorage.setItem(BIAS_KEY, String(bias));
    } catch {
      /* per-viewer convenience only */
    }
    fit();
  };
  fit();
  scene.scale.on('resize', fit);
  scene.input.on('wheel', wheel);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', fit);
    scene.input.off('wheel', wheel);
  });
}
