import { REGIONS, regionOf, type HuntArea, type Region } from '../data/hunt';

/** Id of the world view in the map window's region tabs. */
export const WORLD_ID = 'mundo';

/** Rectangle in 0..1 world-map units. */
export interface Rect { x: number; y: number; w: number; h: number }

export interface WorldZone { region: Region; rect: Rect }

/** Where the Pátio (home base) sits on the world map; the regions spread away from it by level. */
export const PATIO_POS = { x: 0.045, y: 0.5 } as const;

const ZONE_RECTS: Record<string, Rect> = {
  varzea: { x: 0.08, y: 0.18, w: 0.24, h: 0.64 },
  fundicoes: { x: 0.33, y: 0.03, w: 0.25, h: 0.46 },
  docas: { x: 0.33, y: 0.51, w: 0.25, h: 0.46 },
  cinturao: { x: 0.59, y: 0.12, w: 0.2, h: 0.6 },
  coracao: { x: 0.8, y: 0.2, w: 0.18, h: 0.6 },
};

/** Inner padding of a zone, in 0..1 of the zone; the top keeps room for the zone's name plate. */
const PAD = { x: 0.1, top: 0.24, bottom: 0.08 } as const;

export const WORLD_ZONES: readonly WorldZone[] = REGIONS.map((region) => {
  const rect = ZONE_RECTS[region.id];
  if (!rect) throw new Error(`Região ${region.id} sem zona no mapa-múndi`);
  return { region, rect };
});

export function zoneOf(regionId: string): WorldZone {
  const zone = WORLD_ZONES.find((z) => z.region.id === regionId);
  if (!zone) throw new Error(`Região ${regionId} sem zona no mapa-múndi`);
  return zone;
}

export const zoneCenter = ({ rect }: WorldZone) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

/** Area marker position on the world map: its region-map pos squeezed into the padded zone. */
export function worldPos(area: HuntArea): { x: number; y: number } {
  const { rect } = zoneOf(regionOf(area).id);
  const ix = rect.x + rect.w * PAD.x, iw = rect.w * (1 - 2 * PAD.x);
  const iy = rect.y + rect.h * PAD.top, ih = rect.h * (1 - PAD.top - PAD.bottom);
  return { x: ix + area.pos.x * iw, y: iy + area.pos.y * ih };
}
