import Phaser from 'phaser';
import { combatLockMs, combatLockSeconds, type CombatTimes } from './core/combatLock';
import { generateArea } from './core/huntGen';
import { huntTiledMap } from './core/huntMap';
import { areaById, areaUnlocked, regionOf, regionUnlocked } from './data/hunt';
import { session } from './session';
import { closePanel, toast } from './ui/ui';

/** Tilemap cache key WorldScene loads for whichever hunt area is current. */
export const HUNT_MAP_KEY = 'hunt';

let game: Phaser.Game | null = null;

export function bindTravel(g: Phaser.Game): void {
  game = g;
}

interface HuntWorld { huntAreaId(): string | null; combatTimes(): CombatTimes & { now: number } }

/** Running World scene while the hero is inside a hunt area, else null. */
function huntWorld(): HuntWorld | null {
  if (!game?.scene.isActive('World')) return null;
  const w = game.scene.getScene('World') as unknown as HuntWorld;
  return w.huntAreaId() ? w : null;
}

/** Hunt area the hero is in right now ("Caçando"), or null. */
export function currentHuntArea(): string | null {
  return huntWorld()?.huntAreaId() ?? null;
}

/** Enters a hunt area. Refuses (with a toast) when the region or area is above the hero's level, an extraction is running or the hero is mid-fight in a hunt. */
export function travelToArea(areaId: string): boolean {
  const area = areaById(areaId);
  if (!game || !area) return false;
  const region = regionOf(area);
  if (!regionUnlocked(session.state, region)) {
    toast(`${region.name} exige Nv ${region.minLevel}.`, 'warn');
    return false;
  }
  if (!areaUnlocked(session.state, area)) {
    toast(`${area.name} exige Nv ${area.level}.`, 'warn');
    return false;
  }
  if (session.state.afk) {
    toast('Encerre a extração antes de viajar.', 'warn');
    return false;
  }
  const hunt = huntWorld();
  if (hunt) {
    const { now, ...times } = hunt.combatTimes();
    const wait = combatLockMs(now, times);
    if (wait > 0) {
      toast(`Espere ${combatLockSeconds(wait)}s sem tomar nem dar dano.`, 'warn');
      return false;
    }
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
