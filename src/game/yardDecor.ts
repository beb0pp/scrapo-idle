import Phaser from 'phaser';
import { BENCH_UPGRADE_ART, DECOR_ART, type DecorArt } from '../art/buildArt';
import { DECOR, benchUpgrades, decorFor, isUsable, newPlot, placeDecor, releaseDecor, tileKey, type BenchUpgradeId, type DecorId, type Plot, type PlotBuildingId, type PlotGrid, type Tile } from '../core/decor';
import { BUILD_NODES } from '../data/ferromancy';
import { session } from '../session';
import { setFerroTab, type FerroTab } from '../ui/ferroPanel';
import { openPanel, type PanelKind } from '../ui/ui';

type Glow = NonNullable<DecorArt['glow']>;

const TILE = 16;
const FLAT_DEPTH = -14;
const GLOW_DEPTH = 7001;
/** Buildings stand at least 48 px apart, so two use radii never overlap. */
const USE_RADIUS = 22;

/** Each building opens what it is for: the build tree or the grimoire's transmutation; bench upgrades open through the bench. */
const USE: Record<PlotBuildingId, { panel: PanelKind; tab?: FerroTab }> = {
  b_workshop: { panel: 'ferro', tab: 'build' },
  b_alchemy: { panel: 'ferro', tab: 'grimoire' },
  b_alembic: { panel: 'ferro', tab: 'grimoire' },
};

/** Same shape as WorldScene's Interactable: clicking walks the hero over, F calls act. */
interface HostInteractable {
  x: number;
  y: number;
  r: number;
  label: () => string | null;
  act: () => void;
  sprite?: Phaser.GameObjects.Image;
}

/** WorldScene keeps these private; the plot reaches them through a cast, like ferroApi does. */
interface DecorHost extends Phaser.Scene {
  collision: Phaser.Tilemaps.TilemapLayer;
  tileBlocked(x: number, y: number): boolean;
  interactables: HostInteractable[];
}

interface Placed {
  tile: Tile;
  parts: Phaser.GameObjects.GameObject[];
  use?: HostInteractable;
}

/** The workshop plot around the bench: props appear as builds, lamps and reagents come in. */
export class YardDecor {
  private readonly placed = new Map<DecorId, Placed>();
  private readonly upgrades = new Map<BenchUpgradeId, Phaser.GameObjects.GameObject[]>();
  private readonly plot: Plot;
  private readonly reserved: Set<string>;
  private readonly grid: PlotGrid;

  constructor(private readonly scene: Phaser.Scene, private readonly benchX: number, private readonly benchY: number) {
    const host = scene as DecorHost;
    this.plot = newPlot({ x: Math.floor(benchX / TILE), y: Math.floor(benchY / TILE) });
    this.reserved = this.reservedTiles();
    this.grid = { isFree: (x, y) => this.isFree(x, y), walkable: (x, y) => !host.tileBlocked(x, y) };
    this.sync(false);
    const off = session.onChange(() => this.sync(true));
    scene.events.once('shutdown', off);
  }

  private sync(reveal: boolean): void {
    this.syncUpgrades(reveal);
    const wanted = decorFor(session.state);
    for (const [id, p] of this.placed) if (!wanted.includes(id)) this.remove(id, p);
    const fresh = wanted.filter((id) => !this.placed.has(id));
    if (!fresh.length) return;
    for (const [id, tile] of placeDecor(fresh, this.plot, this.grid)) {
      const parts = this.spawn(id, tile, reveal);
      this.placed.set(id, { tile, parts, use: isUsable(id) ? this.makeUsable(id, parts) : undefined });
    }
  }

  /** Upgrades are part of the bench: drawn on it, never interactable, the bench's own F opens the Oficina. */
  private syncUpgrades(reveal: boolean): void {
    const wanted = benchUpgrades(session.state);
    for (const [id, parts] of this.upgrades) if (!wanted.includes(id)) {
      this.upgrades.delete(id);
      this.fadeOut(parts);
    }
    for (const id of wanted) if (!this.upgrades.has(id)) this.upgrades.set(id, this.spawnUpgrade(id, reveal));
  }

  private spawnUpgrade(id: BenchUpgradeId, reveal: boolean): Phaser.GameObjects.GameObject[] {
    const art = BENCH_UPGRADE_ART[id];
    const x = this.benchX + art.dx;
    const foot = this.benchY + art.dy;
    const depth = art.layer === 'floor' ? FLAT_DEPTH + 1 : art.layer === 'behind' ? this.benchY - 1 : this.benchY + 1;
    const sprite = this.scene.add.sprite(x, foot, art.key, 0).setOrigin(0.5, 1).setDepth(depth);
    if (art.anim) sprite.play(art.anim.key);
    const parts: Phaser.GameObjects.GameObject[] = [sprite];
    if (art.glow) parts.push(this.glow(art.glow, x + art.glow.dx, foot, reveal, x));
    if (reveal) this.reveal(sprite, [], x, foot);
    return parts;
  }

  /** Interact objects (spawns, notes, NPCs) and their neighbours stay walkable and visible. */
  private reservedTiles(): Set<string> {
    const host = this.scene as DecorHost;
    const out = new Set<string>();
    for (const o of host.collision.tilemap.getObjectLayer('interact')?.objects ?? []) {
      const x = Math.floor(((o.x ?? 0) + (o.width ?? TILE) / 2) / TILE), y = Math.floor(((o.y ?? 0) + (o.height ?? TILE) / 2) / TILE);
      if (o.type === 'workbench') continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.add(tileKey({ x: x + dx, y: y + dy }));
    }
    return out;
  }

  private isFree(x: number, y: number): boolean {
    const host = this.scene as DecorHost;
    if (host.tileBlocked(x, y) || this.reserved.has(tileKey({ x, y }))) return false;
    const decorTile = host.collision.tilemap.getTileAt(x, y, true, 'objects');
    return !decorTile || decorTile.index === -1;
  }

  private spawn(id: DecorId, tile: Tile, reveal: boolean): Phaser.GameObjects.GameObject[] {
    const art = DECOR_ART[id];
    const s = this.scene;
    const x = tile.x * TILE + TILE / 2;
    const foot = tile.y * TILE + TILE - 1;
    const depth = art.flat ? FLAT_DEPTH + (DECOR[id].floor ? 0 : 1) : foot;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (art.shadowW) parts.push(s.add.ellipse(x + 1, foot - 1, art.shadowW, 5, 0x000000, 0.3).setDepth(depth - 1));
    const sprite = s.add.sprite(x, foot + (art.flat ? 2 : 0), art.key, 0).setOrigin(0.5, 1).setDepth(depth).setFlipX(!!art.flip);
    if (art.anim) sprite.play({ key: art.anim.key, startFrame: (tile.x + tile.y) % art.frames });
    parts.push(sprite);
    if (art.glow) parts.push(this.glow(art.glow, x + (art.flip ? -art.glow.dx : art.glow.dx), foot, reveal, tile.x));
    if (reveal) this.reveal(sprite, parts.filter((p): p is Phaser.GameObjects.Ellipse => p instanceof Phaser.GameObjects.Ellipse), x, foot);
    return parts;
  }

  private glow(g: Glow, x: number, foot: number, reveal: boolean, seed: number): Phaser.GameObjects.Image {
    const s = this.scene;
    const glow = s.add.image(x, foot + g.dy, 'glow').setTint(g.color).setScale(g.scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
    const pulse = () => s.tweens.add({ targets: glow, alpha: g.alpha * 0.7, duration: 900 + ((seed * 131) % 500), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    if (reveal) s.tweens.add({ targets: glow.setAlpha(0), alpha: g.alpha, duration: 420, delay: 120, onComplete: pulse });
    else { glow.setAlpha(g.alpha); pulse(); }
    return glow;
  }

  /** Hit area is the sprite's own bounds, so hover tints only this building. */
  private makeUsable(id: PlotBuildingId, parts: Phaser.GameObjects.GameObject[]): HostInteractable {
    const sprite = parts.find((p): p is Phaser.GameObjects.Sprite => p instanceof Phaser.GameObjects.Sprite)!;
    const { panel, tab } = USE[id];
    const use: HostInteractable = {
      x: sprite.x,
      y: sprite.y - 4,
      r: USE_RADIUS,
      sprite: sprite as unknown as Phaser.GameObjects.Image,
      label: () => `F —${BUILD_NODES[id].name}`,
      act: () => {
        if (tab) setFerroTab(tab);
        openPanel(panel);
      },
    };
    (this.scene as DecorHost).interactables.push(use);
    return use;
  }

  /** Fade + scale pop, with dust puffing out at the base and a few sparks flying up. */
  private reveal(sprite: Phaser.GameObjects.Sprite, shadows: Phaser.GameObjects.Ellipse[], x: number, foot: number): void {
    const s = this.scene;
    sprite.setAlpha(0).setScale(0.3);
    s.tweens.add({ targets: sprite, alpha: 1, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.out' });
    for (const sh of shadows) s.tweens.add({ targets: sh.setAlpha(0), alpha: 1, duration: 420, delay: 120 });
    for (let i = 0; i < 10; i++) {
      const dust = i < 6;
      const a = dust ? (i / 6) * Math.PI * 2 : -Math.PI / 2 + (i - 7.5) * 0.5;
      const r = s.add.rectangle(x, foot - (dust ? 1 : 6), dust ? 3 : 1, 2, dust ? 0xc8b088 : 0xffd27a, dust ? 0.85 : 1).setDepth(foot + 1);
      s.tweens.add({
        targets: r,
        x: x + Math.cos(a) * (dust ? 14 : 8),
        y: foot - (dust ? 1 : 6) + Math.sin(a) * (dust ? 4 : 16),
        alpha: 0,
        duration: dust ? 520 : 380,
        ease: 'Quad.out',
        onComplete: () => r.destroy(),
      });
    }
  }

  private remove(id: DecorId, p: Placed): void {
    this.placed.delete(id);
    releaseDecor(this.plot, id, p.tile);
    const list = (this.scene as DecorHost).interactables;
    if (p.use && list.includes(p.use)) list.splice(list.indexOf(p.use), 1);
    this.fadeOut(p.parts);
  }

  private fadeOut(parts: Phaser.GameObjects.GameObject[]): void {
    this.scene.tweens.add({ targets: parts, alpha: 0, duration: 300, onComplete: () => parts.forEach((o) => o.destroy()) });
  }
}
