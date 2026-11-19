import { TILE_COUNT, TILE_SIZE, TILES, TILESET_COLUMNS } from '../art/tileArt';
import { BIOMES, type HuntArea, type Region } from '../data/hunt';
import type { Cell, HuntGrid } from './huntGen';

type Prop = { name: string; type: 'string' | 'int'; value: string | number };

const str = (name: string, value: string): Prop => ({ name, type: 'string', value });

/** Tiled JSON in the same shape as public/maps/*.json, so WorldScene loads a hunt area like any hand-made map. */
export function huntTiledMap(area: HuntArea, region: Region, grid: HuntGrid) {
  const { width, height } = grid;
  let nextId = 1;
  const obj = (type: string, c: Cell, name: string, properties: Prop[]) => ({
    id: nextId++, name, type, x: c.x * TILE_SIZE, y: c.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, rotation: 0, visible: true, properties,
  });
  const layer = (id: number, name: string, data: number[]) => ({ id, name, type: 'tilelayer', x: 0, y: 0, width, height, opacity: 1, visible: true, data });
  const objects = [
    obj('spawn', grid.playerSpawn, 'default', []),
    obj('exit', grid.exit, '', [str('target', 'patio'), str('entry', 'default'), str('label', 'Pátio Zero')]),
    ...grid.enemies.map((e) => obj('enemy', e, '', [str('kind', e.kind), { name: 'level', type: 'int', value: area.level }])),
    ...grid.piles.map((p, i) => obj('pile', p, `hunt:${area.id}:pile:${i}`, [str('loot', p.table)])),
  ];
  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width, height, tilewidth: TILE_SIZE, tileheight: TILE_SIZE, compressionlevel: -1, nextlayerid: 5, nextobjectid: nextId,
    properties: [
      str('displayName', area.name),
      str('subtitle', `${region.name} · Nv ${area.level}`),
      str('areaId', `hunt:${area.id}`),
      str('dropTable', area.loot),
      { name: 'ambient', type: 'int', value: BIOMES[region.biome].ambient },
    ],
    layers: [
      layer(1, 'terrain', grid.terrain),
      layer(2, 'objects', grid.objects),
      layer(3, 'collision', Array.from(grid.walls, (wall) => (wall ? TILES.solid : 0))),
      { id: 4, name: 'interact', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
    ],
    tilesets: [{
      firstgid: 1, name: 'scrapo', tilewidth: TILE_SIZE, tileheight: TILE_SIZE, tilecount: TILE_COUNT, columns: TILESET_COLUMNS,
      image: '../tiles/scrapo-tiles.png', imagewidth: TILESET_COLUMNS * TILE_SIZE, imageheight: Math.ceil(TILE_COUNT / TILESET_COLUMNS) * TILE_SIZE, margin: 0, spacing: 0,
    }],
  };
}
