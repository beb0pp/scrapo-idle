import Phaser from 'phaser';
import { DECOR_ART } from '../art/buildArt';
import { DECOR, decorFor, isUsable, newPlot, placeDecor, releaseDecor, tileKey, type DecorId, type Plot, type PlotGrid, type Tile } from '../core/decor';
import { BUILD_NODES, type BuildNodeId } from '../data/ferromancy';
import { session } from '../session';
import { setFerroTab, type FerroTab } from '../ui/ferroPanel';
import { openPanel, type PanelKind } from '../ui/ui';

const TILE = 16;
const FLAT_DEPTH = -14;
const GLOW_DEPTH = 7001;
/** Buildings stand at least 48 px apart, so two use radii never overlap. */
const USE_RADIUS = 22;

/** Each building opens what it is for: the build tree, the crafting bench, or the grimoire's transmutation. */
const USE: Record<BuildNodeId, { panel: PanelKind; tab?: FerroTab }> = {
  b_workshop: { panel: 'ferro', tab: 'build' },
  b_bench_tools: { panel: 'workshop' },
  b_bench_modules: { panel: 'workshop' },
  b_drone_servos: { panel: 'workshop' },
  b_drone_bay: { panel: 'workshop' },
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
  private readonly plot: Plot;
  private readonly reserved: Set<string>;
  private readonly grid: PlotGrid;

  constructor(private readonly scene: Phaser.Scene, benchX: number, benchY: number) {
    const host = scene as DecorHost;
    this.plot = newPlot({ x: Math.floor(benchX / TILE), y: Math.floor(benchY / TILE) });
    this.reserved = this.reservedTiles();
    this.grid = { isFree: (x, y) => this.isFree(x, y), walkable: (x, y) => !host.tileBlocked(x, y) };
    this.sync(false);
    const off = session.onChange(() => this.sync(true));
    scene.events.once('shutdown', off);
  }

  private sync(reveal: boolean): void {
    const wanted = decorFor(session.state);
    for (const [id, p] of this.placed) if (!wanted.includes(id)) this.remove(id, p);
    const fresh = wanted.filter((id) => !this.placed.has(id));
    if (!fresh.length) return;
    for (const [id, tile] of placeDecor(fresh, this.plot, this.grid)) {
      const parts = this.spawn(id, tile, reveal);
      this.placed.set(id, { tile, parts, use: isUsable(id) ? this.makeUsable(id, parts) : undefined });
    }
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
    if (art.glow) {
      const g = art.glow;
      const glow = s.add.image(x + (art.flip ? -g.dx : g.dx), foot + g.dy, 'glow').setTint(g.color).setScale(g.scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
      const pulse = () => s.tweens.add({ targets: glow, alpha: g.alpha * 0.7, duration: 900 + ((tile.x * 131) % 500), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (reveal) s.tweens.add({ targets: glow.setAlpha(0), alpha: g.alpha, duration: 420, delay: 120, onComplete: pulse });
      else { glow.setAlpha(g.alpha); pulse(); }
      parts.push(glow);
    }
    if (reveal) this.reveal(sprite, parts.filter((p): p is Phaser.GameObjects.Ellipse => p instanceof Phaser.GameObjects.Ellipse), x, foot);
    return parts;
  }

  /** Hit area is the sprite's own bounds, so hover tints only this building. */
  private makeUsable(id: BuildNodeId, parts: Phaser.GameObjects.GameObject[]): HostInteractable {
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
    this.scene.tweens.add({ targets: p.parts, alpha: 0, duration: 300, onComplete: () => p.parts.forEach((o) => o.destroy()) });
  }
}
