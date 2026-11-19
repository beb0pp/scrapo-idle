import Phaser from 'phaser';
import { generateArea } from './core/huntGen';
import { huntTiledMap } from './core/huntMap';
import { areaById, regionOf, regionUnlocked } from './data/hunt';
import { session } from './session';
import { closePanel, toast } from './ui/ui';

/** Tilemap cache key WorldScene loads for whichever hunt area is current. */
export const HUNT_MAP_KEY = 'hunt';

let game: Phaser.Game | null = null;

export function bindTravel(g: Phaser.Game): void {
  game = g;
}

/** Enters a hunt area. Refuses (with a toast) when the region is above the hero's level or an extraction is running. */
export function travelToArea(areaId: string): boolean {
  const area = areaById(areaId);
  if (!game || !area) return false;
  const region = regionOf(area);
  if (!regionUnlocked(session.state, region)) {
    toast(`${region.name} exige Nv ${region.minLevel}.`, 'warn');
    return false;
  }
  if (session.state.afk) {
    toast('Encerre a extração antes de viajar.', 'warn');
    return false;
  }
  const maps = game.cache.tilemap;
  if (maps.exists(HUNT_MAP_KEY)) maps.remove(HUNT_MAP_KEY);
  maps.add(HUNT_MAP_KEY, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: huntTiledMap(area, region, generateArea(area)) });
  closePanel();
  game.scene.stop('Title');
  game.scene.stop('Extraction');
  game.scene.start('World', { mapId: HUNT_MAP_KEY, entry: 'default' });
  return true;
}
