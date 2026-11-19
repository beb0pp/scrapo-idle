import Phaser from 'phaser';
import { TILES } from '../art/tileArt';
import { attachDroneParts } from '../art/droneParts';
import { computeProgress } from '../core/afk';
import type { ItemBag, ItemId } from '../data/items';
import { levelUpBurst } from '../game/vfx';
import { session } from '../session';
import { bagHtml, hideExtraction, modal, renderExtraction, showHud } from '../ui/ui';

const W = 32;
const H = 18;
const T = 16;

type PropSpot = [key: string, x: number, bottom: number];

/** Ground tiles plus 3/4-view props (same art as the world maps), each anchored at its bottom centre. */
function layout(areaId: string): { ground: number[][]; props: PropSpot[]; piles: [number, number][]; bin: [number, number] } {
  const sorting = areaId === 'afk_sorting';
  const ground = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (sorting) return y < 2 ? TILES.wall : y === 6 || y === 12 ? TILES.conveyor : TILES.floor;
    if (y === 4) return TILES.railH;
    if (y === 3 || y === 5) return TILES.gravel;
    return (x * 7 + y * 13) % 11 < 3 ? TILES.grass : TILES.dirt;
  }));
  const at = (key: string, tx: number, ty: number): PropSpot => [key, tx * T + 8, ty * T + T];
  const props: PropSpot[] = [];
  if (sorting) {
    for (const [x, y] of [[3, 3], [28, 3], [4, 15], [27, 15], [15, 3]]) props.push(at('crate', x, y));
    for (const [x, y] of [[10, 9], [22, 9], [8, 15], [24, 4]]) props.push(at('girders', x, y));
    for (const x of [6, 25]) props.push(at('pipe', x, 9));
    props.push(at('drums', 18, 15), at('robotHusk', 12, 15));
  } else {
    // one coupled train on the rail (locomotive + four wagons, 48 px each), wheels on the rail line
    const rail = 4 * T + 13;
    ['loco', 'wagon0', 'wagon1', 'wagon0', 'wagon1'].forEach((key, i) => props.push([key, 3 * T + i * 48 + 24, rail]));
    props.push(at('heap0', 20, 10), at('heap2', 27, 13), at('heapSmall', 12, 14), at('heapRust0', 3, 15));
    for (const [x, y] of [[9, 8], [16, 12], [24, 7], [6, 14], [29, 10], [14, 7]]) props.push(at(`tuft${(x + y) % 3}`, x, y));
    props.push(at('forklift', 18, 15), at('tires', 28, 16), at('lamp', 1, 6), at('lamp', 30, 6));
  }
  return { ground, props, piles: [[10, 8], [18, 7], [25, 10], [22, 14], [13, 13]], bin: [5, 10] };
}

export class ExtractionScene extends Phaser.Scene {
  private drone!: Phaser.GameObjects.Sprite;
  private carry!: Phaser.GameObjects.Image;
  private piles: Phaser.GameObjects.Sprite[] = [];
  private bin = new Phaser.Math.Vector2();
  private sparks!: Phaser.GameObjects.Graphics;
  private lastLoot: ItemBag = {};
  private leaving = false;
  private unsub: (() => void) | null = null;

  constructor() {
    super('Extraction');
  }

  create(): void {
    const afk = session.state.afk;
    if (!afk) {
      this.scene.start('World', { mapId: 'patio', entry: 'from_terminal' });
      return;
    }
    this.leaving = false;
    showHud(false);
    const L = layout(afk.areaId);
    const mk = (data: number[][]) => {
      const map = this.make.tilemap({ data: data.map((row) => row.map((g) => g - 1)), tileWidth: T, tileHeight: T });
      const ts = map.addTilesetImage('tiles', 'tiles', T, T, 0, 0)!;
      return map.createLayer(0, ts, 0, 0)!;
    };
    mk(L.ground).setDepth(-20);
    for (const [key, x, bottom] of L.props) this.add.image(x, bottom, `prop_${key}`).setOrigin(0.5, 1).setDepth(bottom);
    this.bin.set(L.bin[0] * T + 8, L.bin[1] * T + 8);
    this.add.image(this.bin.x, this.bin.y, 'bin').setDepth(this.bin.y);
    this.add.sprite(this.bin.x - 22, this.bin.y + 2, 'terminal', 0).play('terminal-blink').setDepth(this.bin.y);
    this.piles = L.piles.map(([x, y]) => this.add.sprite(x * T + 8, y * T + 8, 'pile', 0).play('pile-glint').setDepth(y * T));
    this.drone = this.add.sprite(this.bin.x, this.bin.y - 14, 'drone', 0).play('drone-fly').setDepth(5000);
    attachDroneParts(this, this.drone, session.state);
    this.carry = this.add.image(0, 0, 'icon_scrap').setScale(0.5).setDepth(4999).setVisible(false);
    this.sparks = this.add.graphics().setDepth(5001);
    this.lastLoot = computeProgress(afk, Date.now()).loot;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W * T, H * T);
    cam.centerOn((W * T) / 2, (H * T) / 2);
    const fit = () => cam.setZoom(Math.max(1, Math.floor(Math.min(this.scale.width / (W * T), this.scale.height / (H * T)))));
    fit();
    this.scale.on('resize', fit);
    cam.fadeIn(200);

    const handlers = { onStop: () => this.stop(), onResume: () => this.resume(), onClaim: () => this.claim() };
    this.unsub = session.onChange(() => renderExtraction(handlers));
    // AFK XP lands on claim, while this scene is still up: celebrate on the drone, the hero stand-in here
    const offLevel = session.onLevelUp(() => levelUpBurst(this, { x: this.drone.x, y: this.drone.y }));
    this.events.once('shutdown', offLevel);
    renderExtraction(handlers);
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) this.resume();
    });
    this.events.once('shutdown', () => {
      this.unsub?.();
      this.scale.off('resize', fit);
      hideExtraction();
    });
    this.time.addEvent({ delay: 500, loop: true, callback: () => renderExtraction(handlers) });
  }

  update(time: number): void {
    const afk = session.state.afk;
    if (!afk || this.leaving) return;
    const p = computeProgress(afk, Date.now());
    this.sparks.clear();
    this.popNewLoot(p.loot);
    if (p.ended) {
      this.drone.setPosition(this.bin.x, this.bin.y - 12 + Math.sin(time / 300) * 1.5);
      this.carry.setVisible(false);
      return;
    }
    const pile = this.piles[p.cycles % this.piles.length];
    const k = p.cycleProgress;
    const hover = new Phaser.Math.Vector2(pile.x, pile.y - 12);
    const home = new Phaser.Math.Vector2(this.bin.x, this.bin.y - 12);
    if (k < 0.3) this.drone.setPosition(...this.lerp(home, hover, k / 0.3));
    else if (k < 0.75) {
      this.drone.setPosition(hover.x + Math.sin(time / 90) * 2, hover.y + Math.cos(time / 120));
      if (Math.floor(time / 70) % 2) {
        this.sparks.fillStyle(0xfffbe0).fillRect(pile.x + Phaser.Math.Between(-5, 5), pile.y + Phaser.Math.Between(-4, 2), 1, 1);
        this.sparks.lineStyle(1, 0x5fd0d8, 0.7).lineBetween(this.drone.x, this.drone.y + 4, pile.x, pile.y - 2);
      }
    } else this.drone.setPosition(...this.lerp(hover, home, (k - 0.75) / 0.25));
    this.carry.setVisible(k >= 0.75).setPosition(this.drone.x, this.drone.y + 7);
  }

  private lerp(a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, t: number): [number, number] {
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return [a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e];
  }

  private popNewLoot(loot: ItemBag): void {
    for (const [id, n] of Object.entries(loot) as [ItemId, number][]) {
      if (n <= (this.lastLoot[id] ?? 0)) continue;
      const icon = this.add.image(this.bin.x, this.bin.y - 10, `icon_${id}`).setDepth(6000);
      this.tweens.add({ targets: icon, y: icon.y - 18, alpha: 0, duration: 1100, onComplete: () => icon.destroy() });
    }
    this.lastLoot = { ...loot };
  }

  private stop(): void {
    session.stopAfk('stopped');
  }

  private claim(): void {
    if (this.leaving) return;
    this.leaving = true;
    const loot = session.claimAfk();
    hideExtraction();
    modal(`<h1>Achados recolhidos</h1><div class="chips">${loot ? bagHtml(loot) : '<span class="muted">Este resultado já tinha sido recolhido.</span>'}</div><p class="hint">Tudo foi para o inventário e já está salvo.</p>`, [
      { label: 'Voltar ao Pátio Zero', primary: true, onClick: () => this.scene.start('World', { mapId: 'patio', entry: 'from_terminal' }) },
    ]);
  }

  private resume(): void {
    if (this.leaving || !session.state.afk) return;
    session.stopAfk('manual_control');
    this.claim();
  }
}
