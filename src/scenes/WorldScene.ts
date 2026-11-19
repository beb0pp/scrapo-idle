import Phaser from 'phaser';
import { arcJumps, droneReady, playerStats, pulseRadius } from '../core/derived';
import { rollTable } from '../core/rng';
import { addItems } from '../core/state';
import { DECALS, TILES } from '../art/tileArt';
import { PILE_TABLES } from '../data/areas';
import { ITEMS, RARITY, rarityOf, type ItemBag, type ItemId } from '../data/items';
import { Crane, Enemy, type EnemyKind, type Target } from '../game/enemies';
import { findPath, nearestFree, simplify } from '../game/pathfind';
import * as vfx from '../game/vfx';
import { RoboDog } from '../game/dog';
import { FerroController, ferroApi } from '../game/ferroController';
import { PILE_RESPAWN_MS, session } from '../session';
import { closePanel, hudFrame, modal, onSkillClick, openPanel, panelOpen, showHud, toast } from '../ui/ui';
import { showAreaBanner } from '../ui/banner';
import { setMinimap, setMinimapEnemies, setMinimapPlayer, setMinimapView, TERRAIN_CLASS, type MinimapData } from '../ui/minimap';

type MinimapMarker = MinimapData['markers'][number];

/** Ground-drop halo by rarity tier (same colours as the UI rarity tokens). */
const RARITY_ORDER = ['comum', 'incomum', 'raro', 'epico', 'reliquia'];

function dropColor(id: ItemId): number {
  return parseInt(RARITY[rarityOf(id)].color.slice(1), 16);
}
import { applyZoom } from './zoom';

const AREA_SUBTITLE: Record<string, string> = {
  patio: 'Oficina · Comércio · Terminal',
  yard: 'Ferro-velho ferroviário',
  dungeon: 'Mini-dungeon',
};

export type MapId = 'patio' | 'yard' | 'dungeon';

const SPEED = 82;
/** Hero sprite is 24×32 with a centered origin; feet sit 9px below. */
const FEET = 9;
const ATTACK_REACH = 20;

type Order =
  | { kind: 'move'; path: Phaser.Math.Vector2[] }
  | { kind: 'enemy'; enemy: Enemy | null; path: Phaser.Math.Vector2[]; repathAt: number }
  | { kind: 'use'; it: Interactable; path: Phaser.Math.Vector2[] };
const DASH_SPEED = 400;
const DASH_MS = 170;
const COOLDOWN = { attack: 340, pulse: 5000, arc: 3000, dash: 2400, overdrive: 9000 };

interface Interactable {
  x: number;
  y: number;
  r: number;
  label: () => string | null;
  act: () => void;
  sprite?: Phaser.GameObjects.Image;
  /** Auto mode may pick this as a job (piles and salvageable junk). */
  auto?: boolean;
  /** Click area in world space, when it is not the sprite bounds or a small circle. */
  rect?: Phaser.Geom.Rectangle;
}

interface Prop {
  key: string;
  sprite: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  x: number;
  y: number;
  ready?: () => boolean;
}

interface Pile {
  id: string;
  x: number;
  y: number;
  loot: string;
  special: string | null;
  sprite: Phaser.GameObjects.Sprite;
}

interface Exit {
  rect: Phaser.Geom.Rectangle;
  target: MapId;
  entry: string;
}

interface TiledProp {
  name: string;
  value: unknown;
}

function prop(o: Phaser.Types.Tilemaps.TiledObject, name: string): string | null {
  const p = (o.properties as TiledProp[] | undefined)?.find((x) => x.name === name);
  return p ? String(p.value) : null;
}

export class WorldScene extends Phaser.Scene {
  private mapId: MapId = 'patio';
  private entry = 'default';
  private areaName = '';
  private player!: Phaser.Physics.Arcade.Sprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private enemies: Enemy[] = [];
  private crane: Crane | null = null;
  private piles: Pile[] = [];
  private interactables: Interactable[] = [];
  private exits: Exit[] = [];
  private pickups: { sprite: Phaser.GameObjects.Image; item: ItemId; qty: number; born: number; halo: Phaser.GameObjects.Image }[] = [];
  private relic: Phaser.GameObjects.Sprite | null = null;
  private relicDrop: ItemBag = {};
  private drone: Phaser.GameObjects.Sprite | null = null;
  private dog!: RoboDog;
  ferro!: FerroController;
  private droneAura: Phaser.GameObjects.Arc | null = null;
  private droneNext = 0;
  private facing = new Phaser.Math.Vector2(0, 1);
  private ready = { attack: 0, pulse: 0, arc: 0, dash: 0, overdrive: 0 };
  private dashUntil = 0;
  private dashDir = new Phaser.Math.Vector2();
  private dashHit = new Set<Enemy>();
  private invulnUntil = 0;
  private knock = { x: 0, y: 0, until: 0 };
  private pull: Phaser.Math.Vector2 | null = null;
  private searching: {
    until: number;
    total: number;
    finish: () => void;
    at?: { x: number; y: number };
    sprite?: Phaser.GameObjects.Image;
    nextHit?: number;
  } | null = null;
  private props: Prop[] = [];
  private glints!: Phaser.GameObjects.Graphics;
  private hovered: Phaser.GameObjects.Image | null = null;
  private fx!: Phaser.GameObjects.Graphics;
  private arrivedAt = 0;
  private transitioning = false;
  private hudAt = 0;
  private collision!: Phaser.Tilemaps.TilemapLayer;
  private craneIntroShown = false;
  private order: Order | null = null;
  private wrench!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private heroRing!: Phaser.GameObjects.Ellipse;
  private lastHurt = 0;
  private lastManual = -10_000;
  private autoNext = 0;
  private evadeUntil = 0;
  private autoTarget: Interactable | null = null;
  private autoSkip = new Map<Interactable, number>();
  private swingUntil = 0;
  private holdMoveAt = 0;

  constructor() {
    super('World');
  }

  init(data: { mapId?: MapId; entry?: string }): void {
    this.mapId = data.mapId ?? 'patio';
    this.entry = data.entry ?? 'default';
    this.enemies = [];
    this.crane = null;
    this.piles = [];
    this.interactables = [];
    this.exits = [];
    this.pickups = [];
    this.relic = null;
    this.drone = null;
    this.droneAura = null;
    this.pull = null;
    this.searching = null;
    this.transitioning = false;
    this.craneIntroShown = false;
    this.order = null;
    this.props = [];
  }

  create(): void {
    const map = this.make.tilemap({ key: this.mapId });
    const ts = map.addTilesetImage('scrapo', 'tiles')!;
    map.createLayer('terrain', ts, 0, 0)!.setDepth(-20);
    const objLayer = map.createLayer('objects', ts, 0, 0)!.setDepth(-10);
    this.propify(objLayer);
    this.castShadows(map, ts, objLayer);
    this.collision = map.createLayer('collision', ts, 0, 0)!.setVisible(false);
    this.collision.setCollisionByExclusion([-1]);
    this.areaName = String((map.properties as TiledProp[] | undefined)?.find((p) => p.name === 'displayName')?.value ?? this.mapId);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const objects = map.getObjectLayer('interact')?.objects ?? [];
    const center = (o: Phaser.Types.Tilemaps.TiledObject) => ({ x: (o.x ?? 0) + (o.width ?? 16) / 2, y: (o.y ?? 0) + (o.height ?? 16) / 2 });
    const spawn = objects.find((o) => o.type === 'spawn' && o.name === this.entry) ?? objects.find((o) => o.type === 'spawn' && o.name === 'default') ?? objects.find((o) => o.type === 'spawn');
    const sp = spawn ? center(spawn) : { x: 64, y: 64 };

    this.player = this.physics.add.sprite(sp.x, sp.y - FEET, 'hero', 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(10, 6).setOffset(7, 22).setCollideWorldBounds(true);
    this.shadow = this.add.ellipse(sp.x, sp.y, 14, 5, 0x000000, 0.35);
    // Keep the hero readable in a busy yard: a pulsing ground ring and a soft rim glow.
    this.heroRing = this.add.ellipse(sp.x, sp.y, 22, 9).setStrokeStyle(2, 0xf6c84a, 0.95).setFillStyle(0xf6c84a, 0.14);
    this.tweens.add({ targets: this.heroRing, scaleX: 1.18, scaleY: 1.18, alpha: 0.65, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.wrench = this.add.image(sp.x, sp.y, 'wrench').setOrigin(0.2, 0.85);
    this.physics.add.collider(this.player, this.collision);
    this.player.preFX?.addGlow(0xfff2b0, 3, 0, false, 0.1, 6);
    this.lastManual = -10_000;
    this.autoSkip = new Map();
    this.autoTarget = null;

    for (const o of objects) this.spawnObject(o, center(o));
    this.addSalvage();
    this.glints = this.add.graphics().setDepth(7002);
    this.hovered = null;
    if (this.mapId !== 'patio') this.scatterGroundScrap(this.mapId === 'yard' ? 60 : 14);
    this.publishMinimap(map, objects);
    if (this.crane) this.physics.add.collider(this.player, this.crane.sprite);
    for (const e of this.enemies) this.physics.add.collider(e.sprite, this.collision);
    this.spawnDrone();
    this.dog = new RoboDog(this, sp.x - 16, sp.y, {
      hero: () => ({ x: this.feetX, y: this.feetY }),
      enemies: () => (this.ferro?.dogFights() ?? true ? this.enemies : []),
      drops: () =>
        this.pickups.map((p) => ({
          x: p.sprite.x,
          y: p.sprite.y,
          take: () => {
            if (!p.sprite.active) return;
            this.pickups = this.pickups.filter((q) => q !== p);
            this.collectPickup(p, 'Ferrugem');
          },
        })),
      bite: (target, dmg) => this.damageEnemy(target as Enemy, dmg),
    });
    this.ferro = new FerroController(ferroApi(this));

    this.fx = this.add.graphics().setDepth(6000);
    this.addLighting(map, objLayer);
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.setRoundPixels(true);
    applyZoom(this, map.widthInPixels, map.heightInPixels);
    cam.fadeIn(200);

    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,SPACE,Q,W,E,R,F,ONE,TWO,THREE,FOUR') as Record<string, Phaser.Input.Keyboard.Key>;
    onSkillClick((i) => [() => this.pulse(), () => this.arc(), () => this.dash(), () => this.overdrive()][i]());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.arrivedAt = this.time.now;
    if (this.mapId === 'patio') session.hp = session.maxHp;
    showHud(true);
    showAreaBanner(this.areaName, AREA_SUBTITLE[this.mapId]);
    this.events.once('shutdown', () => {
      onSkillClick(() => {});
      closePanel();
    });
  }

  // ---------------- minimap ----------------

  private publishMinimap(map: Phaser.Tilemaps.Tilemap, objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    const blocked = new Uint8Array(map.width * map.height);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) blocked[y * map.width + x] = this.tileBlocked(x, y) ? 1 : 0;
    const tile = (v: number | undefined) => Math.floor((v ?? 0) / 16);
    const kindOf: Record<string, MinimapMarker['kind'] | undefined> = { exit: 'entrance', terminal: 'extraction', workbench: 'npc', vendor: 'npc', boss: 'boss', pile: 'pile' };
    const labelOf: Record<string, string> = { terminal: 'Terminal de extração', workbench: 'Oficina', vendor: 'Comerciante', boss: 'Guindaste de Arrasto', pile: 'Pilha de sucata' };
    const markers: MinimapMarker[] = [];
    for (const o of objects) {
      const kind = kindOf[o.type];
      if (!kind) continue;
      const label = o.type === 'exit' ? `Saída: ${prop(o, 'label') ?? prop(o, 'target')}` : labelOf[o.type];
      markers.push({ kind, x: tile((o.x ?? 0) + (o.width ?? 16) / 2), y: tile((o.y ?? 0) + (o.height ?? 16) / 2), label });
    }
    for (const p of this.props) {
      const kind: MinimapMarker['kind'] | null = p.key.startsWith('tree') ? 'tree' : p.key.startsWith('tuft') || p.key === 'bush' || p.key === 'lamp' ? null : 'junk';
      if (kind) markers.push({ kind, x: p.tx, y: p.ty, label: kind === 'tree' ? 'Árvore' : 'Sucata' });
    }
    const terrain = this.terrainClasses(map);
    setMinimap({ mapId: this.mapId, name: this.areaName, widthTiles: map.width, heightTiles: map.height, blocked, terrain, markers });
  }

  private terrainClasses(map: Phaser.Tilemaps.Tilemap): Uint8Array {
    const T = TERRAIN_CLASS;
    const byTile: Record<number, number> = {
      [TILES.dirt]: T.dirt, [TILES.dirtDark]: T.dirt, [TILES.grass]: T.grass, [TILES.tallGrass]: T.grass,
      [TILES.gravel]: T.gravel, [TILES.concrete]: T.concrete, [TILES.railH]: T.rail, [TILES.railV]: T.rail,
      [TILES.railX]: T.rail, [TILES.floor]: T.floor, [TILES.path]: T.path, [TILES.conveyor]: T.floor, [TILES.wall]: T.wall,
    };
    const objClass: Record<number, number> = { [TILES.fence]: T.fence, [TILES.bwall]: T.building, [TILES.roof]: T.building };
    const out = new Uint8Array(map.width * map.height);
    const terrainLayer = map.getLayer('terrain')?.data;
    const objectLayer = map.getLayer('objects')?.data;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const obj = objectLayer?.[y]?.[x]?.index ?? -1;
        out[y * map.width + x] = objClass[obj] ?? byTile[terrainLayer?.[y]?.[x]?.index ?? -1] ?? T.dirt;
      }
    return out;
  }

  // ---------------- light and shadow ----------------

  /** A black copy of every standing object, offset down-right, under the objects layer. */
  private castShadows(map: Phaser.Tilemaps.Tilemap, ts: Phaser.Tilemaps.Tileset, objLayer: Phaser.Tilemaps.TilemapLayer): void {
    const shadow = map.createBlankLayer('shadow', ts, 3, 3)!.setDepth(-15).setAlpha(0.32);
    objLayer.forEachTile((t) => {
      if (t.index < 1 || DECALS.includes(t.index)) return;
      const s = shadow.putTileAt(t.index, t.x, t.y);
      if (s) s.tint = 0x000000;
    });
  }

  private addLighting(map: Phaser.Tilemaps.Tilemap, objLayer: Phaser.Tilemaps.TilemapLayer): void {
    const ambient = { patio: 0xfff0d8, yard: 0xf2d6b0, dungeon: 0x5d6584 }[this.mapId];
    this.add.rectangle(0, 0, map.widthInPixels, map.heightInPixels, ambient).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(7000);
    const glow = (x: number, y: number, color: number, scale: number, alpha: number) => {
      const g = this.add.image(x, y, 'glow').setTint(color).setScale(scale).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(7001);
      this.tweens.add({ targets: g, alpha: alpha * 0.75, duration: Phaser.Math.Between(700, 1300), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return g;
    };
    objLayer.forEachTile((t) => {
      const x = t.pixelX + 8, y = t.pixelY + 8;
      if (t.index === TILES.hatch) glow(x, y, 0x5fd0d8, 1.2, 0.6);
    });
    for (const p of this.props) {
      if (p.key === 'lamp') glow(p.sprite.x, p.sprite.y - 37, 0xf6c870, 1.6, 0.55);
      if (p.key === 'loco') glow(p.sprite.x - 14, p.sprite.y - 17, 0xf6e7a1, 0.5, 0.45);
    }
    for (const p of this.piles) glow(p.x, p.y, 0xfff2b0, 0.5, 0.25);
    if (this.mapId === 'dungeon') {
      const lantern = this.add.image(0, 0, 'glow').setTint(0xffd9a0).setScale(3.2).setAlpha(0.42).setBlendMode(Phaser.BlendModes.ADD).setDepth(7001);
      const follow = () => lantern.setPosition(this.player.x, this.player.y);
      this.events.on('update', follow);
      this.events.once('shutdown', () => this.events.off('update', follow));
      if (this.crane) glow(this.crane.sprite.x + 6, this.crane.sprite.y - 16, 0xe8433a, 0.8, 0.5);
    }
  }

  // ---------------- map objects ----------------

  private spawnObject(o: Phaser.Types.Tilemaps.TiledObject, c: { x: number; y: number }): void {
    switch (o.type) {
      case 'exit': {
        const rect = new Phaser.Geom.Rectangle(o.x ?? 0, o.y ?? 0, o.width ?? 16, o.height ?? 16);
        this.exits.push({ rect, target: prop(o, 'target') as MapId, entry: prop(o, 'entry') ?? 'default' });
        // A generous click target around the exit arrows: clicking it walks there and changes map.
        const hit = new Phaser.Geom.Rectangle(rect.x - 16, rect.y - 8, rect.width + 32, rect.height + 16);
        const label = prop(o, 'label') ?? 'próxima área';
        this.interactables.push({
          x: rect.centerX, y: rect.centerY, r: 30, rect: hit,
          label: () => `F — Ir para ${label}`,
          act: () => this.moveTo(new Phaser.Math.Vector2(rect.centerX, rect.centerY), false),
        });
        break;
      }
      case 'pile':
        this.addPile(o.name || `pile_${c.x}_${c.y}`, c.x, c.y, prop(o, 'loot') ?? 'yard_pile', prop(o, 'special'));
        break;
      case 'enemy':
        this.enemies.push(new Enemy(this, c.x, c.y, (prop(o, 'kind') ?? 'sorter') as EnemyKind));
        break;
      case 'boss':
        this.crane = new Crane(this, c.x, c.y, {
          target: this.target(),
          setPull: (v) => (this.pull = v),
          summon: (x, y) => this.summon(x, y),
          onIntro: () => this.craneIntro(),
        });
        break;
      case 'workbench':
        this.add.ellipse(c.x + 1, c.y + 7, 24, 5, 0x000000, 0.3).setDepth(c.y - 1);
        this.add.image(c.x, c.y, 'bench').setDepth(c.y);
        this.interactables.push({ x: c.x, y: c.y, r: 26, label: () => 'F —Oficina', act: () => openPanel('workshop') });
        break;
      case 'vendor':
        this.add.ellipse(c.x, c.y + 4, 14, 5, 0x000000, 0.35).setDepth(c.y - 1);
        this.add.sprite(c.x, c.y - 5, 'vendor', 0).play('vendor-idle').setDepth(c.y + 4);
        this.interactables.push({ x: c.x, y: c.y, r: 26, label: () => 'F —Comerciante', act: () => openPanel('vendor') });
        break;
      case 'terminal':
        this.add.sprite(c.x, c.y - 4, 'terminal', 0).play('terminal-blink').setDepth(c.y);
        this.interactables.push({ x: c.x, y: c.y, r: 26, label: () => 'F —Terminal de extração', act: () => openPanel('terminal') });
        break;
      case 'note': {
        const text = prop(o, 'text') ?? '';
        this.interactables.push({ x: c.x, y: c.y, r: 22, label: () => 'F —Ler placa', act: () => toast(text) });
        break;
      }
    }
  }

  private addPile(id: string, x: number, y: number, loot: string, special: string | null): void {
    const sprite = this.add.sprite(x, y, 'pile', 0).setDepth(y);
    const pile: Pile = { id, x, y, loot, special, sprite };
    this.refreshPile(pile);
    this.piles.push(pile);
    this.interactables.push({
      x, y, r: 22, auto: true,
      label: () => (this.pileReady(pile) ? (special === 'first_wagon' && !session.state.flags.first_wagon_looted ? 'F — Vasculhar o primeiro vagão' : 'F — Vasculhar pilha') : null),
      act: () => this.startSearch(pile),
    });
  }

  private pileReady(p: Pile): boolean {
    const t = session.searchedPiles.get(p.id);
    return t === undefined || Date.now() - t > PILE_RESPAWN_MS;
  }

  private refreshPile(p: Pile): void {
    if (this.pileReady(p)) {
      if (!p.sprite.anims.isPlaying) p.sprite.play('pile-glint');
    } else {
      p.sprite.stop();
      p.sprite.setFrame(2);
    }
  }

  private spawnDrone(): void {
    if (!droneReady(session.state)) return;
    this.drone = this.add.sprite(this.player.x - 14, this.player.y - 14, 'drone', 0).play('drone-fly').setDepth(5500);
    if (session.state.equipped.module === 'mod_magnet') {
      this.droneAura = this.add.circle(this.drone.x, this.drone.y, 9, 0x5fd0d8, 0.18).setStrokeStyle(1, 0x5fd0d8, 0.6).setDepth(5499);
    }
  }

  private target(): Target {
    const self = this;
    return {
      get x() { return self.feetX; },
      get y() { return self.feetY - 3; },
      hurt: (dmg, fx, fy) => self.hurt(dmg, fx, fy),
    };
  }

  // ---------------- loop ----------------

  update(time: number): void {
    const world = this.physics.world;
    if (panelOpen() || this.transitioning) {
      if (!world.isPaused) world.pause();
      this.anims.pauseAll();
      hudFrame({ area: this.areaName, cooldowns: [0, 0, 0, 0], prompt: null, boss: null });
      return;
    }
    if (world.isPaused) {
      world.resume();
      this.anims.resumeAll();
    }
    this.regenerate(time, this.game.loop.delta);
    this.autoPlay(time);
    this.handleMovement(time);
    this.handleActions(time);
    const t = this.target();
    for (const e of this.enemies) e.update(time, t);
    this.crane?.update(time);
    this.updateDrone(time);
    this.dog.update(time, this.game.loop.delta);
    this.ferro.update(time, this.game.loop.delta);
    this.updatePickups(time);
    this.updateSearch(time);
    this.updateRelic();
    this.checkExits(time);
    this.updateBodyParts(time);
    this.drawGlints(time);
    if (time - this.hudAt > 100) {
      this.pushHud(time);
      const v = this.cameras.main.worldView;
      setMinimapView(v.x / 16, v.y / 16, v.width / 16, v.height / 16);
      setMinimapEnemies(this.enemies.filter((e) => e.alive).map((e) => ({ x: Math.floor(e.x / 16), y: Math.floor(e.y / 16) })));
      setMinimapPlayer(Math.floor(this.feetX / 16), Math.floor(this.feetY / 16));
    }
  }

  private get feetX(): number {
    return this.player.x;
  }

  private get feetY(): number {
    return this.player.y + FEET;
  }

  private updateBodyParts(time: number): void {
    const p = this.player;
    p.setDepth(this.feetY);
    this.shadow.setPosition(this.feetX, this.feetY + 1).setDepth(this.feetY - 1);
    this.heroRing.setPosition(this.feetX, this.feetY + 1).setDepth(this.feetY - 1.5);
    const f = this.facing;
    const side = Math.abs(f.x) > Math.abs(f.y);
    const right = side ? f.x > 0 : true;
    const back = !side && f.y < 0;
    const hx = p.x + (side ? (right ? 5 : -5) : back ? -7 : 7);
    const hy = p.y + 3;
    const swinging = time < this.swingUntil;
    const base = right ? -20 : 20;
    const swing = swinging ? (1 - (this.swingUntil - time) / 160) * 110 : 0;
    this.wrench.setPosition(hx, hy).setFlipX(!right).setAngle(right ? base + swing : base - swing);
    this.wrench.setDepth(back ? this.feetY - 0.5 : this.feetY + 0.5);
  }

  // ---------------- mouse control ----------------

  private tileBlocked = (x: number, y: number): boolean => {
    const t = this.collision.getTileAt(x, y, true);
    return !t || t.index !== -1;
  };

  private worldPoint(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  private enemyAt(w: Phaser.Math.Vector2): Enemy | 'crane' | null {
    const e = this.enemies.find((en) => en.alive && Phaser.Math.Distance.Between(w.x, w.y, en.x, en.y) < 12);
    if (e) return e;
    const c = this.crane;
    if (c?.alive && Phaser.Math.Distance.Between(w.x, w.y, c.sprite.x, c.sprite.y + 6) < 22) return 'crane';
    return null;
  }

  private interactableAt(w: Phaser.Math.Vector2): Interactable | null {
    const hit = (it: Interactable) =>
      it.rect ? it.rect.contains(w.x, w.y)
        : it.sprite ? it.sprite.getBounds().contains(w.x, w.y)
          : Phaser.Math.Distance.Between(w.x, w.y, it.x, it.y) < 14;
    return this.interactables.find((it) => hit(it) && it.label()) ?? null;
  }

  private setHovered(sprite: Phaser.GameObjects.Image | null): void {
    const HOVER = 0xfff0b0;
    if (this.hovered === sprite) return;
    if (this.hovered?.active && this.hovered.tintTopLeft === HOVER) this.hovered.clearTint();
    this.hovered = sprite;
    if (sprite && !sprite.isTinted) sprite.setTint(HOVER);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (panelOpen() || this.transitioning) return;
    this.lastManual = this.time.now;
    const w = this.worldPoint(p);
    if (p.rightButtonDown()) {
      this.dash(w);
      return;
    }
    this.cancelSearch();
    const hit = this.enemyAt(w);
    if (hit) {
      this.order = { kind: 'enemy', enemy: hit === 'crane' ? null : hit, path: [], repathAt: 0 };
      return;
    }
    const it = this.interactableAt(w);
    if (it) {
      this.order = { kind: 'use', it, path: this.pathTo(it.x, it.y) };
      return;
    }
    this.moveTo(w);
    this.holdMoveAt = this.time.now;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const w = this.worldPoint(p);
    const canvas = this.game.canvas;
    const it = this.enemyAt(w) ? null : this.interactableAt(w);
    canvas.style.cursor = this.enemyAt(w) ? 'crosshair' : it ? 'pointer' : 'default';
    this.setHovered(it?.sprite ?? null);
    if (p.leftButtonDown() && this.order?.kind === 'move' && this.time.now - this.holdMoveAt > 160 && !panelOpen()) {
      this.holdMoveAt = this.time.now;
      this.moveTo(w, false);
    }
  }

  private moveTo(w: Phaser.Math.Vector2, marker = true): void {
    // A click in the margin outside the map walks to the closest point inside it.
    const bounds = this.physics.world.bounds;
    w = new Phaser.Math.Vector2(Phaser.Math.Clamp(w.x, bounds.x + 4, bounds.right - 4), Phaser.Math.Clamp(w.y, bounds.y + 4, bounds.bottom - 4));
    const path = this.pathTo(w.x, w.y);
    if (!path.length) return;
    this.order = { kind: 'move', path };
    if (!marker) return;
    const end = path[path.length - 1];
    const m = this.add.image(end.x, end.y, 'marker').setDepth(1).setAlpha(0.9);
    this.tweens.add({ targets: m, scale: 1.6, alpha: 0, duration: 450, onComplete: () => m.destroy() });
  }

  /** World-space waypoints from the hero's feet to (x, y); empty when unreachable. */
  private pathTo(x: number, y: number): Phaser.Math.Vector2[] {
    const from = { x: Math.floor(this.feetX / 16), y: Math.floor(this.feetY / 16) };
    const goal = nearestFree(this.tileBlocked, { x: Math.floor(x / 16), y: Math.floor(y / 16) });
    if (!goal) return [];
    const cells = findPath(this.tileBlocked, from, goal);
    if (!cells) return [];
    const pts = simplify(cells).slice(1).map((c) => new Phaser.Math.Vector2(c.x * 16 + 8, c.y * 16 + 8));
    const exact = !this.tileBlocked(Math.floor(x / 16), Math.floor(y / 16));
    if (exact) pts.length ? pts[pts.length - 1].set(x, y) : pts.push(new Phaser.Math.Vector2(x, y));
    return pts;
  }

  /** Velocity toward the next waypoint; null when the order has nowhere left to walk. */
  private followOrder(time: number): Phaser.Math.Vector2 | null {
    const o = this.order;
    if (!o) return null;
    if (o.kind === 'enemy') {
      const c = this.crane;
      const tx = o.enemy ? o.enemy.x : c?.sprite.x ?? 0;
      const ty = o.enemy ? o.enemy.y + 4 : (c?.sprite.y ?? 0) + 22;
      const alive = o.enemy ? o.enemy.alive : !!c?.alive;
      if (!alive) {
        this.order = null;
        return null;
      }
      const d = Phaser.Math.Distance.Between(this.feetX, this.feetY, tx, ty);
      if (d < ATTACK_REACH + (o.enemy ? 0 : 10)) {
        this.facing.set(tx - this.feetX, ty - this.feetY).normalize();
        this.attack(time);
        return null;
      }
      if (time > o.repathAt) {
        o.path = this.pathTo(tx, ty);
        o.repathAt = time + 300;
      }
    }
    const next = o.path[0];
    if (!next) {
      if (o.kind === 'use') {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, o.it.x, o.it.y) < o.it.r + 6) o.it.act();
        this.order = null;
      } else if (o.kind === 'move') this.order = null;
      return null;
    }
    const v = new Phaser.Math.Vector2(next.x - this.feetX, next.y - this.feetY);
    if (v.length() < 3) {
      o.path.shift();
      return this.followOrder(time);
    }
    if (o.kind === 'use' && Phaser.Math.Distance.Between(this.player.x, this.player.y, o.it.x, o.it.y) < o.it.r - 4) {
      this.order = null;
      o.it.act();
      return null;
    }
    return v.normalize();
  }

  private handleMovement(time: number): void {
    const k = this.keys;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const dir = new Phaser.Math.Vector2(
      (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0),
      (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0),
    );
    if (time < this.dashUntil) {
      body.setVelocity(this.dashDir.x * DASH_SPEED, this.dashDir.y * DASH_SPEED);
      this.dashContacts();
      return;
    }
    if (this.searching) {
      if (dir.lengthSq() > 0) this.cancelSearch();
      else {
        body.setVelocity(0, 0);
        return;
      }
    }
    if (dir.lengthSq() > 0) this.order = null;
    else dir.copy(this.followOrder(time) ?? dir);
    const v = dir.lengthSq() > 0 ? dir.clone().normalize().scale(SPEED) : new Phaser.Math.Vector2();
    if (this.pull) v.add(this.pull);
    if (time < this.knock.until) v.set(this.knock.x, this.knock.y);
    body.setVelocity(v.x, v.y);
    if (dir.lengthSq() > 0) {
      this.facing.copy(dir).normalize();
      const anim = Math.abs(dir.x) > Math.abs(dir.y) ? 'hero-side' : dir.y < 0 ? 'hero-up' : 'hero-down';
      this.player.setFlipX(anim === 'hero-side' && dir.x < 0);
      this.player.play(anim, true);
    } else {
      this.player.stop();
      const f = this.facing;
      this.player.setFrame(Math.abs(f.x) > Math.abs(f.y) ? 4 : f.y < 0 ? 2 : 0);
    }
    if (this.pull) this.player.setTint(0x9fe8ee);
    else if (time > this.invulnUntil) this.player.clearTint();
  }

  // ---------------- idle / auto mode ----------------

  /** Out of combat for 4 s: slow regeneration, so the hero can keep working on auto. */
  private regenerate(time: number, deltaMs: number): void {
    if (time - this.lastHurt < 4000 || session.hp >= session.maxHp) return;
    session.hp = Math.min(session.maxHp, session.hp + (deltaMs / 1000) * 3);
  }

  /** Picks the next job when auto mode is on: fight nearby enemies, otherwise salvage the closest ready junk. */
  private autoPlay(time: number): void {
    if (!session.autoMode || this.transitioning || time - this.lastManual < 3000) return;
    this.ferro.autoCast(time);
    const fx = this.feetX, fy = this.feetY;
    const dist = (x: number, y: number) => Phaser.Math.Distance.Between(fx, fy, x, y);
    const near = (r: number) => this.enemies.filter((e) => e.alive && dist(e.x, e.y) < r);
    const crane = this.crane?.active ? this.crane : null;

    if (this.pull && crane && time >= this.ready.dash) {
      this.dash(new Phaser.Math.Vector2(fx * 2 - crane.sprite.x, fy * 2 - crane.sprite.y));
      return;
    }
    if (this.autoEvade(time, near)) return;
    if (time >= this.ready.pulse && near(pulseRadius(session.state) * 0.8).length >= 2) this.pulse();
    if (time >= this.ready.arc && (near(110).length > 0 || (crane && dist(crane.sprite.x, crane.sprite.y) < 120))) this.arc();
    if (this.drone && time >= this.ready.overdrive && near(130).length >= 2) this.overdrive();

    if (time < this.autoNext || this.searching) return;
    this.autoNext = time + 400;
    const lowHp = session.hp < session.maxHp * 0.35;

    if (this.order?.kind === 'enemy') {
      if (!lowHp) return;
      this.order = null;
    }
    if (!lowHp) {
      const foe = near(150).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y))[0];
      if (foe || (crane && dist(crane.sprite.x, crane.sprite.y) < 200)) {
        this.order = { kind: 'enemy', enemy: foe ?? null, path: [], repathAt: 0 };
        return;
      }
    }
    if (this.order) return;

    // the last target was not reached (blocked or unreachable): leave it alone for a while
    if (this.autoTarget?.label()) this.autoSkip.set(this.autoTarget, time + 20_000);
    this.autoTarget = null;

    const drop = this.pickups.find((p) => dist(p.sprite.x, p.sprite.y) < 120);
    if (drop) {
      this.moveTo(new Phaser.Math.Vector2(drop.sprite.x, drop.sprite.y), false);
      return;
    }
    const threats = this.enemies.filter((e) => e.alive);
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.auto || !it.label() || (this.autoSkip.get(it) ?? 0) > time) continue;
      if (lowHp && threats.some((e) => Phaser.Math.Distance.Between(e.x, e.y, it.x, it.y) < 100)) continue;
      const d = dist(it.x, it.y);
      if (d < bestD) (best = it), (bestD = d);
    }
    if (!best) return;
    const path = this.pathTo(best.x, best.y);
    if (!path.length) {
      this.autoSkip.set(best, time + 20_000);
      return;
    }
    this.autoTarget = best;
    this.order = { kind: 'use', it: best, path };
  }

  /** Auto survival: dodge telegraphed blows, and kite away while hurt. Returns true when it took over this frame. */
  private autoEvade(time: number, near: (r: number) => Enemy[]): boolean {
    if (time < this.dashUntil) return true;
    const fx = this.feetX, fy = this.feetY;
    const away = (from: Enemy[], len: number) => {
      const v = new Phaser.Math.Vector2();
      for (const e of from) v.add(new Phaser.Math.Vector2(fx - e.x, fy - e.y).normalize());
      if (!v.lengthSq()) v.copy(this.facing).negate();
      return v.normalize().scale(len).add(new Phaser.Math.Vector2(fx, fy));
    };
    const blows = this.enemies.filter(
      (e) => e.alive && e.windingUp && Phaser.Math.Distance.Between(fx, fy, e.x, e.y) <= e.radius + 8,
    );
    if (blows.length) {
      if (time >= this.ready.dash) this.dash(away(blows, 60));
      else if (time < this.evadeUntil) return true;
      else {
        this.evadeUntil = time + 350;
        this.moveTo(away(blows, 48), false);
      }
      return true;
    }
    if (session.hp >= session.maxHp * 0.35) return false;
    const threats = near(90);
    if (!threats.length) return false;
    if (time >= this.ready.pulse && near(pulseRadius(session.state) * 0.8).length) this.pulse();
    if (time < this.evadeUntil) return true;
    this.evadeUntil = time + 500;
    this.moveTo(away(threats, 80), false);
    return true;
  }

  private handleActions(time: number): void {
    const k = this.keys;
    const down = (key: Phaser.Input.Keyboard.Key) => {
      const pressed = Phaser.Input.Keyboard.JustDown(key);
      if (pressed) this.lastManual = time;
      return pressed;
    };
    if (k.UP.isDown || k.DOWN.isDown || k.LEFT.isDown || k.RIGHT.isDown) this.lastManual = time;
    if (down(k.SPACE)) this.attack(time);
    if (down(k.Q) || down(k.ONE)) this.pulse();
    if (down(k.W) || down(k.TWO)) this.arc();
    if (down(k.E) || down(k.THREE)) this.dash();
    if (down(k.R) || down(k.FOUR)) this.overdrive();
    if (down(k.F)) this.nearestInteractable()?.act();
  }

  private nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.feetX, this.feetY, it.x, it.y);
      if (d < it.r && d < bestD && it.label()) (best = it), (bestD = d);
    }
    return best;
  }

  private pushHud(time: number): void {
    this.hudAt = time;
    const frac = (key: keyof typeof COOLDOWN) => Math.max(0, (this.ready[key] - time) / COOLDOWN[key]);
    const crane = this.crane;
    hudFrame({
      area: this.areaName,
      cooldowns: [frac('pulse'), frac('arc'), frac('dash'), this.drone ? frac('overdrive') : 1],
      prompt: this.searching ? 'Vasculhando…' : (this.nearestInteractable()?.label() ?? null),
      boss: crane && crane.active ? { hp: crane.hp, max: crane.maxHp } : null,
    });
  }

  // ---------------- combat ----------------

  private hurt(dmg: number, fx: number, fy: number): void {
    const now = this.time.now;
    if (now < this.invulnUntil || this.transitioning) return;
    session.hp = Math.max(0, session.hp - this.ferro.absorb(Math.max(1, dmg - playerStats(session.state).defesa)));
    this.lastHurt = now;
    this.invulnUntil = now + 600;
    const away = new Phaser.Math.Vector2(this.player.x - fx, this.player.y - fy).normalize().scale(150);
    this.knock = { x: away.x, y: away.y, until: now + 120 };
    this.player.setTint(0xff6a5a);
    this.cameras.main.shake(90, 0.003);
    if (session.hp <= 0) this.die();
  }

  private die(): void {
    this.transitioning = true;
    this.pull = null;
    toast('Seu traje travou. Um guindaste-reboque arrastou você de volta ao Pátio Zero.', 'warn');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      session.hp = session.maxHp;
      this.scene.restart({ mapId: 'patio', entry: 'default' });
    });
  }

  private hitTargets(): { x: number; y: number; hit: (n: number) => void; radius: number }[] {
    const list = this.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y, radius: 8, hit: (n: number) => this.damageEnemy(e, n) }));
    const c = this.crane;
    if (c?.alive) list.push({ x: c.sprite.x, y: c.sprite.y + 10, radius: 20, hit: (n: number) => this.damageCrane(n) });
    return list;
  }

  private damageEnemy(e: Enemy, n: number): void {
    if (!e.alive) return;
    vfx.damageNumber(this, { x: e.x, y: e.y - 6 }, n, n >= 14);
    if (e.damage(n, this.player.x, this.player.y)) {
      session.state.stats.kills++;
      this.dropLoot(e.x, e.y, rollTable(Math.random, PILE_TABLES.enemy_drop.loot, 1));
    }
  }

  private damageCrane(n: number): void {
    const c = this.crane!;
    if (c.alive) vfx.damageNumber(this, { x: c.sprite.x, y: c.sprite.y - 22 }, n, n >= 14);
    if (!c.damage(n)) return;
    this.pull = null;
    const first = !session.state.flags.boss_defeated;
    this.relicDrop = first || Math.random() < 0.35 ? { relic_crane_coil: 1 } : { servo: 1, cable: 2, gear: 2 };
    this.relic = this.add.sprite(c.sprite.x, c.sprite.y + 28, 'relic', 0).play('relic-pulse').setDepth(c.sprite.y + 30);
    if (!this.relicDrop.relic_crane_coil) this.relic.setTint(0xb8bcc4);
    toast('O Guindaste de Arrasto parou. Algo brilha entre os destroços.', 'loot');
  }

  private updateRelic(): void {
    if (!this.relic) return;
    if (Phaser.Math.Distance.Between(this.feetX, this.feetY, this.relic.x, this.relic.y) > 16) return;
    this.relic.destroy();
    this.relic = null;
    const first = !session.state.flags.boss_defeated;
    session.recordFinds(this.relicDrop, 'Guindaste de Arrasto');
    session.mutate((s) => {
      addItems(s, this.relicDrop);
      s.flags.boss_defeated = true;
    });
    if (this.relicDrop.relic_crane_coil) {
      modal(
        `<h1>Bobina do Guindaste</h1><p>Uma bobina ainda quente, arrancada do ímã do guindaste.</p>
         <p><b>Equipe</b> como relíquia: Pulso Magnético com +50% de alcance.<br><b>Ou monte</b> o Módulo Magnético na oficina: o drone passa a puxar e atordoar inimigos leves, e dobra a chance de raros na extração.</p>
         ${first ? '<p>Nova área de extração liberada: <b>Estação de Triagem Soterrada</b>.</p>' : ''}`,
        [{ label: 'Continuar', primary: true, onClick: () => {} }],
      );
    } else toast('Componentes recuperados do guindaste.', 'loot');
  }

  private attack(time: number): void {
    if (time < this.ready.attack || time < this.dashUntil) return;
    this.ready.attack = time + COOLDOWN.attack;
    this.swingUntil = time + 160;
    const cx = this.feetX, cy = this.feetY - 5;
    const hx = cx + this.facing.x * 12;
    const hy = cy + this.facing.y * 12;
    vfx.slash(this, { x: cx, y: cy }, Math.atan2(this.facing.y, this.facing.x));
    const dmg = Math.max(1, playerStats(session.state).combate);
    for (const t of this.hitTargets()) if (Phaser.Math.Distance.Between(hx, hy, t.x, t.y) < 12 + t.radius) t.hit(dmg);
  }

  pulse(): void {
    const time = this.time.now;
    if (time < this.ready.pulse || panelOpen()) return;
    this.ready.pulse = time + COOLDOWN.pulse;
    const r = pulseRadius(session.state);
    vfx.castPose(this, this.player);
    vfx.pulse(this, { x: this.feetX, y: this.feetY - 6 }, r);
    for (const e of this.enemies) {
      if (!e.alive || Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) > r) continue;
      this.damageEnemy(e, 6);
      e.pull(this.player.x, this.player.y, 900);
    }
    const c = this.crane;
    if (c?.alive && Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y) < r + 20) this.damageCrane(6);
    this.attractPickups(this.player.x, this.player.y, r);
  }

  arc(): void {
    const time = this.time.now;
    if (time < this.ready.arc || panelOpen()) return;
    const targets = this.hitTargets();
    const chain: typeof targets = [];
    let from = { x: this.player.x, y: this.player.y };
    let range = 120;
    for (let i = 0; i < arcJumps(session.state); i++) {
      let best: (typeof targets)[number] | null = null;
      let bestD = range;
      for (const t of targets) {
        const d = Phaser.Math.Distance.Between(from.x, from.y, t.x, t.y);
        if (!chain.includes(t) && d < bestD) (best = t), (bestD = d);
      }
      if (!best) break;
      chain.push(best);
      from = best;
      range = 80;
    }
    if (!chain.length) {
      toast('Nenhum alvo ao alcance do arco.', 'warn');
      return;
    }
    this.ready.arc = time + COOLDOWN.arc;
    vfx.castPose(this, this.player);
    vfx.arc(this, [{ x: this.player.x + this.facing.x * 6, y: this.player.y + 2 }, ...chain.map((t) => ({ x: t.x, y: t.y }))]);
    for (const t of chain) t.hit(14);
  }

  /** Sobrecarga (R): the drone's module fires at full power. */
  overdrive(): void {
    const time = this.time.now;
    const d = this.drone;
    if (panelOpen() || time < this.ready.overdrive) return;
    if (!d) {
      toast('Monte o drone na oficina para usar a Sobrecarga (R).', 'warn');
      return;
    }
    if (session.state.equipped.module === 'mod_magnet') {
      this.ready.overdrive = time + COOLDOWN.overdrive;
      vfx.overdrive(this, d, [], 110);
      for (const e of this.enemies) {
        if (!e.alive || Phaser.Math.Distance.Between(d.x, d.y, e.x, e.y) > 110) continue;
        this.damageEnemy(e, 8);
        e.pull(d.x, d.y + 14, 1300);
      }
      this.attractPickups(this.feetX, this.feetY, 400);
      return;
    }
    const near = (t: { x: number; y: number }) => Phaser.Math.Distance.Between(d.x, d.y, t.x, t.y);
    const targets = this.hitTargets().filter((t) => near(t) < 150).sort((a, b) => near(a) - near(b)).slice(0, 3);
    if (!targets.length) {
      toast('Nenhum alvo perto do drone.', 'warn');
      return;
    }
    this.ready.overdrive = time + COOLDOWN.overdrive;
    vfx.overdrive(this, d, targets, 0);
    for (const t of targets) t.hit(12);
  }

  /** Dashes toward `toward`, else the held keys, else the mouse cursor. */
  dash(toward?: Phaser.Math.Vector2): void {
    const time = this.time.now;
    if (time < this.ready.dash || panelOpen()) return;
    this.ready.dash = time + COOLDOWN.dash * this.ferro.mods.dashCooldownMul;
    const k = this.keys;
    const dir = new Phaser.Math.Vector2(
      (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0),
      (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0),
    );
    if (!dir.lengthSq()) {
      const aim = toward ?? this.worldPoint(this.input.activePointer);
      dir.set(aim.x - this.feetX, aim.y - this.feetY);
    }
    this.dashDir.copy(dir.lengthSq() > 4 ? dir.normalize() : this.facing);
    this.facing.copy(this.dashDir);
    this.order = null;
    this.dashUntil = time + DASH_MS;
    this.invulnUntil = Math.max(this.invulnUntil, time + DASH_MS + 120);
    this.dashHit.clear();
    this.cancelSearch();
    if (this.crane?.breakPull()) vfx.callout(this, { x: this.player.x, y: this.player.y - 18 }, 'ROMPIDA!');
    this.pull = null;
    vfx.dash(this, this.player, this.dashDir.clone(), DASH_MS);
  }

  private dashContacts(): void {
    for (const e of this.enemies) {
      if (!e.alive || this.dashHit.has(e)) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) > 16) continue;
      this.dashHit.add(e);
      if (e.interrupt()) vfx.callout(this, { x: e.x, y: e.y - 12 }, 'INTERROMPIDO!');
      this.damageEnemy(e, 8);
    }
  }

  private summon(x: number, y: number): void {
    if (this.enemies.filter((e) => e.alive).length >= 4) return;
    const e = new Enemy(this, x, y, 'sorter');
    this.physics.add.collider(e.sprite, this.collision);
    this.enemies.push(e);
  }

  private craneIntro(): void {
    if (this.craneIntroShown) return;
    this.craneIntroShown = true;
    toast('Guindaste de Arrasto! Linha amarela piscando = ímã vai puxar. Use a Investida (E ou clique direito).', 'warn');
  }

  // ---------------- drone ----------------

  private updateDrone(time: number): void {
    const d = this.drone;
    if (!d) return;
    const tx = this.player.x - 16 * (this.player.flipX ? -1 : 1);
    const ty = this.player.y - 16 + Math.sin(time / 260) * 2;
    d.x += (tx - d.x) * 0.08;
    d.y += (ty - d.y) * 0.08;
    this.droneAura?.setPosition(d.x, d.y);
    if (time < this.droneNext) return;
    const mod = session.state.equipped.module;
    if (mod === 'mod_magnet') {
      this.droneNext = time + 3500;
      const near = this.enemies.filter((e) => e.alive && Phaser.Math.Distance.Between(d.x, d.y, e.x, e.y) < 70);
      vfx.droneField(this, d, 70);
      for (const e of near) {
        this.damageEnemy(e, Math.round(3 * this.ferro.mods.droneDamageMul));
        e.pull(d.x, d.y + 12, 700);
      }
      this.attractPickups(this.player.x, this.player.y, 110);
    } else {
      this.droneNext = time + 1100;
      let best: Enemy | null = null;
      let bestD = 100;
      for (const e of this.enemies) {
        const dist = Phaser.Math.Distance.Between(d.x, d.y, e.x, e.y);
        if (e.alive && dist < bestD) (best = e), (bestD = dist);
      }
      const c = this.crane;
      if (best) {
        vfx.droneZap(this, d, best);
        this.damageEnemy(best, Math.round(5 * this.ferro.mods.droneDamageMul));
      } else if (c?.active && Phaser.Math.Distance.Between(d.x, d.y, c.sprite.x, c.sprite.y) < 110) {
        vfx.droneZap(this, d, c.sprite);
        this.damageCrane(Math.round(5 * this.ferro.mods.droneDamageMul));
      }
    }
  }

  // ---------------- loot ----------------

  private dropLoot(x: number, y: number, bag: ItemBag): void {
    for (const [id, qty] of Object.entries(bag) as [ItemId, number][]) {
      const px = x + Phaser.Math.Between(-6, 6), py = y + Phaser.Math.Between(-4, 4);
      const color = dropColor(id);
      const halo = this.add.image(px, py, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.7).setDepth(7002);
      const s = this.add.image(px, py, `icon_${id}`).setDepth(py);
      s.once('destroy', () => halo.destroy());
      this.tweens.add({ targets: s, y: s.y - 8, yoyo: true, duration: 180, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: halo, alpha: 0.35, scale: 0.45, duration: 700, yoyo: true, repeat: -1 });
      this.pickups.push({ sprite: s, item: id, qty, born: this.time.now, halo });
    }
  }

  private attractPickups(x: number, y: number, r: number): void {
    for (const p of this.pickups) if (Phaser.Math.Distance.Between(x, y, p.sprite.x, p.sprite.y) < r) p.born = -1;
  }

  /** Puts a ground drop in the bag (picked by the hero or fetched by the robot dog). */
  private collectPickup(p: WorldScene['pickups'][number], source: string): void {
    const r = RARITY[rarityOf(p.item)];
    session.recordFinds({ [p.item]: p.qty }, source);
    session.mutate((s) => addItems(s, { [p.item]: p.qty }));
    toast(`+${p.qty} ${ITEMS[p.item].name} · ${r.label}`, 'loot', r.color);
    p.sprite.destroy();
  }

  private updatePickups(time: number): void {
    const px = this.feetX, py = this.feetY - 4;
    this.pickups = this.pickups.filter((p) => {
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (d < 10) {
        this.collectPickup(p, 'Chão');
        return false;
      }
      if ((p.born < 0 || d < 28 + this.ferro.mods.pickupRadius) && time - Math.max(0, p.born) > 250) {
        p.sprite.x += (px - p.sprite.x) * 0.15;
        p.sprite.y += (py - p.sprite.y) * 0.15;
        p.halo.setPosition(p.sprite.x, p.sprite.y);
      }
      return true;
    });
  }

  private startSearch(pile: Pile): void {
    if (!this.pileReady(pile) || this.searching) return;
    this.searching = { until: this.time.now + 750 * this.ferro.mods.searchTimeMul, total: 750 * this.ferro.mods.searchTimeMul, finish: () => this.finishSearch(pile) };
  }

  // ---------------- salvageable wrecks and loose scrap ----------------

  /**
   * Standing junk on the objects layer becomes 3/4-view sprites with height (collision stays on the tile layer).
   * Must run before castShadows so these tiles don't also get a flat shadow.
   */
  private propify(objLayer: Phaser.Tilemaps.TilemapLayer): void {
    this.props = [];
    const pick = (keys: string[], t: Phaser.Tilemaps.Tile) => keys[(t.x * 7 + t.y * 13) % keys.length];
    const spec: Record<number, { key: (t: Phaser.Tilemaps.Tile) => string; fw?: number; fh?: number; drop?: [number, number][] }> = {
      [TILES.mound]: { key: (t) => pick(['heap0', 'heap1', 'heap2'], t) },
      [TILES.moundSmall]: { key: () => 'heapSmall' },
      [TILES.moundRust]: { key: (t) => pick(['heapRust0', 'heapRust1'], t) },
      [TILES.crate]: { key: () => 'crate' },
      [TILES.barrel]: { key: () => 'barrel' },
      [TILES.drums]: { key: () => 'drums' },
      [TILES.tires]: { key: () => 'tires' },
      [TILES.fridge]: { key: () => 'fridge' },
      [TILES.engine]: { key: () => 'engine' },
      [TILES.robotHusk]: { key: () => 'robotHusk' },
      [TILES.forklift]: { key: () => 'forklift' },
      [TILES.container]: { key: () => 'cargoBox' },
      [TILES.lamp]: { key: () => 'lamp' },
      [TILES.pipe]: { key: () => 'pipe' },
      [TILES.girders]: { key: () => 'girders' },
      [TILES.craneArm]: { key: () => 'craneArm' },
      [TILES.carTL]: { key: () => 'car', fw: 2, fh: 2, drop: [[1, 0], [0, 1], [1, 1]] },
      [TILES.wagonL]: { key: (t) => pick(['wagon0', 'wagon1'], t), fw: 3, drop: [[1, 0], [2, 0]] },
      [TILES.locoL]: { key: () => 'loco', fw: 3, drop: [[1, 0], [2, 0]] },
      [TILES.wagonT]: { key: () => 'wagonEnd', fh: 3, drop: [[0, 1], [0, 2]] },
      // Existing collision/decoration tiles also select the environmental variants; map semantics stay unchanged.
      [TILES.tree]: { key: (t) => pick(['treeLeafy', 'treeLeafy', 'treePine', 'treeDead', 'boulderMoss', 'rockPile', 'logPlain', 'logMoss', 'stoneWallShort'], t) },
      [TILES.bush]: { key: (t) => pick(['bush', 'bush', 'hedgeShort', 'mushroomCluster', 'stonesDaisy', 'flowerPatch'], t) },
      [TILES.weeds]: { key: (t) => pick(['tuft0', 'tuft1', 'tuft2', 'flowerPatch'], t) },
    };
    const tiles: Phaser.Tilemaps.Tile[] = [];
    objLayer.forEachTile((t) => {
      if (spec[t.index]) tiles.push(t);
    });
    for (const t of tiles) {
      const s = spec[t.index];
      if (!s || objLayer.getTileAt(t.x, t.y)?.index !== t.index) continue;
      const fw = s.fw ?? 1, fh = s.fh ?? 1;
      const key = s.key(t);
      // Heaps overlap and jitter so neighbouring tiles read as one scrap mountain, not a grid of lumps.
      const jitter = key.startsWith('heap') ? ((t.x * 13 + t.y * 7) % 7) - 3 : 0;
      const x = t.pixelX + fw * 8 + jitter, bottom = t.pixelY + fh * 16 + (key.startsWith('heap') ? ((t.x * 5 + t.y * 11) % 5) - 2 : 0);
      const sprite = this.add.image(x, bottom, `prop_${key}`).setOrigin(0.5, 1).setDepth(bottom - 1);
      const flat = key.startsWith('heap') || key.startsWith('tuft');
      if (!flat) this.add.ellipse(x + 2, bottom - 1, key.startsWith('tree') ? 22 : fw * 14, 5, 0x000000, 0.3).setDepth(bottom - 3);
      if (key.startsWith('tree') || key === 'bush' || key.startsWith('tuft')) {
        this.tweens.add({ targets: sprite, angle: { from: -1.2, to: 1.2 }, duration: 1600 + ((t.x * 37 + t.y * 11) % 900), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this.props.push({ key, sprite, tx: t.x, ty: t.y, x, y: bottom - fh * 8 });
      objLayer.removeTileAt(t.x, t.y);
      for (const [dx, dy] of s.drop ?? []) objLayer.removeTileAt(t.x + dx, t.y + dy);
    }
  }

  /** Every junk prop can be taken apart once per respawn window; a glint marks the ready ones. */
  private addSalvage(): void {
    const kinds: Record<string, { name: string; loot: string; ms: number }> = {
      car: { name: 'carro', loot: 'wreck_car', ms: 1400 },
      loco: { name: 'locomotiva', loot: 'wreck_loco', ms: 1600 },
      wagon: { name: 'vagão', loot: 'wreck_loco', ms: 1300 },
      fridge: { name: 'geladeira', loot: 'wreck_appliance', ms: 1000 },
      cargoBox: { name: 'caixa de carga', loot: 'wreck_appliance', ms: 1000 },
      robotHusk: { name: 'carcaça de robô', loot: 'wreck_robot', ms: 1200 },
      engine: { name: 'motor', loot: 'wreck_engine', ms: 1200 },
      forklift: { name: 'empilhadeira', loot: 'wreck_engine', ms: 1400 },
      tires: { name: 'pneus', loot: 'wreck_small', ms: 800 },
      drums: { name: 'tambores', loot: 'wreck_small', ms: 800 },
      barrel: { name: 'tambor', loot: 'wreck_small', ms: 700 },
      crate: { name: 'caixote', loot: 'wreck_small', ms: 700 },
      pipe: { name: 'cano', loot: 'wreck_small', ms: 900 },
      girders: { name: 'vigas', loot: 'wreck_small', ms: 900 },
      craneArm: { name: 'braço de guindaste', loot: 'wreck_engine', ms: 1300 },
      heap: { name: 'monte de sucata', loot: 'wreck_small', ms: 800 },
    };
    for (const p of this.props) {
      const kind = kinds[p.key.replace(/\d+$/, '').replace(/^heap.*/, 'heap').replace(/^wagon.*/, 'wagon')];
      if (!kind) continue;
      const id = `${this.mapId}:prop:${p.tx},${p.ty}`;
      const ready = () => {
        const s = session.searchedPiles.get(id);
        return s === undefined || Date.now() - s > PILE_RESPAWN_MS * 1.5;
      };
      p.ready = ready;
      const wide = p.sprite.width > 20;
      this.interactables.push({
        x: p.x,
        y: p.y,
        r: wide ? 30 : 24,
        auto: true,
        sprite: p.sprite,
        label: () => (ready() ? `F — Desmontar ${kind.name}` : null),
        act: () => {
          if (!ready() || this.searching) return;
          this.searching = {
            until: this.time.now + kind.ms,
            total: kind.ms,
            at: { x: p.x, y: p.sprite.y - p.sprite.height / 2 },
            sprite: p.sprite,
            finish: () => {
              session.searchedPiles.set(id, Date.now());
              p.sprite.setTint(0x8a8690);
              this.time.delayedCall(PILE_RESPAWN_MS * 1.5 + 50, () => p.sprite.active && p.sprite.clearTint());
              const table = PILE_TABLES[kind.loot];
              this.awardLoot(p.x, p.sprite.y - p.sprite.height, rollTable(Math.random, table.loot, table.rolls));
            },
          };
        },
      });
    }
  }

  /** One graphics object draws the sparkles of ready props that are on screen. */
  private drawGlints(time: number): void {
    const g = this.glints;
    g.clear();
    const view = this.cameras.main.worldView;
    for (const p of this.props) {
      if (!p.ready?.() || !view.contains(p.x, p.y)) continue;
      const phase = (time / 90 + p.tx * 31 + p.ty * 17) % 40;
      if (phase > 6) continue;
      const sx = p.x + ((p.tx * 5) % 9) - 4, sy = p.sprite.y - p.sprite.height + 4 + ((p.ty * 3) % 6);
      const size = phase < 3 ? phase : 6 - phase;
      g.fillStyle(0xfffbe0, 0.95).fillRect(sx - size, sy, size * 2 + 1, 1).fillRect(sx, sy - size, 1, size * 2 + 1);
    }
  }

  /** Small scrap bits lying around: walk over them to collect. Fresh on every visit. */
  private scatterGroundScrap(count: number): void {
    const layer = this.collision;
    for (let placed = 0, tries = 0; placed < count && tries < count * 20; tries++) {
      const tx = Phaser.Math.Between(1, layer.layer.width - 2), ty = Phaser.Math.Between(1, layer.layer.height - 2);
      if (this.tileBlocked(tx, ty)) continue;
      this.dropLoot(tx * 16 + 8, ty * 16 + 8, rollTable(Math.random, PILE_TABLES.ground_scrap.loot, 1));
      placed++;
    }
  }

  /** Each found item floats up from where it was found, with name and rarity in the rarity colour; rare ones flash. */
  private showLoot(x: number, y: number, bag: ItemBag): void {
    const entries = (Object.entries(bag) as [ItemId, number][]).sort(([a], [b]) => RARITY_ORDER.indexOf(rarityOf(b)) - RARITY_ORDER.indexOf(rarityOf(a)));
    entries.forEach(([id, n], i) => {
      const r = RARITY[rarityOf(id)];
      vfx.lootPopup(this, { x, y: y - 6 - i * 12 }, `icon_${id}`, `+${n} ${ITEMS[id].name} · ${r.label}`, r.color, i * 140);
      toast(`+${n} ${ITEMS[id].name} · ${r.label}`, 'loot', r.color);
    });
  }

  private awardLoot(x: number, y: number, bag: ItemBag): void {
    session.recordFinds(bag, 'Destroço');
    session.mutate((s) => {
      addItems(s, bag);
      s.stats.searches++;
    });
    this.showLoot(x, y, bag);
  }

  private cancelSearch(): void {
    this.searching = null;
    this.fx?.clear();
  }

  private updateSearch(time: number): void {
    this.fx.clear();
    for (const p of this.piles) this.refreshPile(p);
    const s = this.searching;
    if (!s) return;
    if (s.at) {
      this.facing.set(s.at.x - this.feetX, s.at.y - this.feetY + 8).normalize();
      if (time >= (s.nextHit ?? 0)) {
        s.nextHit = time + 240;
        this.swingUntil = time + 160;
        vfx.salvageHit(this, s.at);
        if (s.sprite?.active) this.tweens.add({ targets: s.sprite, x: s.sprite.x + 1, duration: 40, yoyo: true, repeat: 1 });
      }
    }
    const k = 1 - (s.until - time) / s.total;
    this.fx.fillStyle(0x1b1a24).fillRect(this.player.x - 10, this.player.y - 21, 20, 4);
    this.fx.fillStyle(0xe0b33a).fillRect(this.player.x - 9, this.player.y - 20, 18 * Math.min(1, k), 2);
    if (time < s.until) return;
    this.searching = null;
    s.finish();
  }

  private finishSearch(pile: Pile): void {
    session.searchedPiles.set(pile.id, Date.now());
    const firstWagon = pile.special === 'first_wagon' && !session.state.flags.first_wagon_looted;
    const table = PILE_TABLES[pile.loot] ?? PILE_TABLES.yard_pile;
    const bag: ItemBag = firstWagon ? { pulse_core: 1, gear: 1, cable: 1, scrap: 3 } : rollTable(Math.random, table.loot, table.rolls);
    if (!firstWagon && this.ferro.consumeSearchBonus()) for (const [id, n] of Object.entries(rollTable(Math.random, table.loot, 1)) as [ItemId, number][]) bag[id] = (bag[id] ?? 0) + n;
    session.recordFinds(bag, firstWagon ? 'Primeiro vagão' : 'Pilha de sucata');
    session.mutate((s) => {
      addItems(s, bag);
      s.stats.searches++;
      if (firstWagon) s.flags.first_wagon_looted = true;
    });
    this.refreshPile(pile);
    this.showLoot(pile.x, pile.y - 6, bag);
    if (firstWagon) {
      modal(
        '<h1>Núcleo Pulsante</h1><p>Sob as chapas do primeiro vagão, um núcleo de drone ainda bate como um coração.</p><p>Leve-o à <b>oficina do Pátio Zero</b>. Com um Módulo de Garra (2 engrenagens, 1 cabo, 4 sucatas) o seu drone volta a voar.</p>',
        [{ label: 'Entendi', primary: true, onClick: () => {} }],
      );
    }
  }

  // ---------------- exits ----------------

  private checkExits(time: number): void {
    if (time - this.arrivedAt < 600) return;
    const ex = this.exits.find((e) => e.rect.contains(this.feetX, this.feetY));
    if (!ex) return;
    this.transitioning = true;
    this.pull = null;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ mapId: ex.target, entry: ex.entry }));
  }

  /** Debug/test hook: jump straight to a map. */
  warp(mapId: MapId, entry = 'default'): void {
    this.scene.restart({ mapId, entry });
  }
}
