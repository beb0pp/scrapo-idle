import Phaser from 'phaser';
import type { ElementId } from '../data/elements';
import type { FormationSlot } from '../data/ferromancy';
import { runeBolt, stomp, type Pt } from './spellfx';

// Cobalto, the repaired automaton. Front (Guardião) stomps beside the hero; back (Conjurador) shoots rune bolts.
// Moves freely like RoboDog (no physics) and never leaves the hero far behind.

export interface AllyTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  hit(damage: number, element?: ElementId | null): void;
}

export interface AllyApi {
  /** Hero feet position. */
  hero(): Pt;
  /** Unit vector the hero faces. */
  facing(): Pt;
  /** Live enemy and crane targets. */
  targets(): AllyTarget[];
}

const RUN = 95;
const WALK = 65;
const STOMP_EVERY = 1600;
const STOMP_DAMAGE = 10;
const STOMP_RADIUS = 30;
const GUARD_RADIUS = 90;
const BOLT_EVERY = 1800;
const BOLT_DAMAGE = 9;
const BOLT_RANGE = 130;
const CAST_FRAME = 4;
const CAST_MS = 260;
const LEASH = 260;

export class Cobalto {
  readonly sprite: Phaser.GameObjects.Sprite;
  role: FormationSlot;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly scene: Phaser.Scene;
  private readonly api: AllyApi;
  private nextAttack = 0;
  private castUntil = 0;
  private lastX: number;
  private lastY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, role: FormationSlot, api: AllyApi) {
    this.scene = scene;
    this.api = api;
    this.role = role;
    this.lastX = x;
    this.lastY = y;
    this.shadow = scene.add.ellipse(x, y + 1, 14, 4, 0x000000, 0.35);
    this.sprite = scene.add.sprite(x, y, 'cobalto', 0).setOrigin(0.5, 1).play('cobalto-idle');
  }

  setRole(role: FormationSlot): void {
    this.role = role;
  }

  update(time: number, deltaMs: number): void {
    const hero = this.api.hero();
    const dt = deltaMs / 1000;
    if (Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, hero.x, hero.y) > LEASH) this.sprite.setPosition(hero.x + 14, hero.y);
    if (this.role === 'front') this.guard(time, hero, dt);
    else this.conjure(time, hero, dt);
    this.animate(time);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 1).setDepth(this.sprite.y - 2);
    this.sprite.setDepth(this.sprite.y);
  }

  /** Extra rune bolt (Resonance echo of the Ember Spear). */
  echo(target: AllyTarget): void {
    this.bolt(target);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }

  private guard(time: number, hero: Pt, dt: number): void {
    const foe = nearest(this.api.targets(), hero, GUARD_RADIUS);
    if (!foe) {
      const side = this.sprite.x >= hero.x ? 1 : -1;
      this.moveTo(hero.x + side * 18, hero.y + 2, WALK, dt, 6);
      return;
    }
    const v = new Phaser.Math.Vector2(foe.x - hero.x, foe.y - hero.y);
    const reach = Math.min(v.length() - 8, 40);
    if (v.lengthSq()) v.normalize().scale(Math.max(0, reach));
    this.moveTo(hero.x + v.x, hero.y + v.y, RUN, dt, 4);
    if (time < this.nextAttack) return;
    const inRange = this.api.targets().filter((t) => this.dist(t) < STOMP_RADIUS + t.radius - 8);
    if (!inRange.length) return;
    this.nextAttack = time + STOMP_EVERY;
    stomp(this.scene, { x: this.sprite.x, y: this.sprite.y }, STOMP_RADIUS);
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 3, duration: 80, yoyo: true });
    for (const t of inRange) t.hit(STOMP_DAMAGE);
  }

  private conjure(time: number, hero: Pt, dt: number): void {
    const f = this.api.facing();
    this.moveTo(hero.x - f.x * 22, hero.y - f.y * 22 + 2, WALK, dt, 6);
    if (time < this.nextAttack) return;
    const foe = nearest(this.api.targets(), { x: this.sprite.x, y: this.sprite.y }, BOLT_RANGE);
    if (!foe) return;
    this.nextAttack = time + BOLT_EVERY;
    this.bolt(foe);
  }

  private bolt(target: AllyTarget): void {
    this.castUntil = this.scene.time.now + CAST_MS;
    this.sprite.setFlipX(target.x < this.sprite.x);
    const from = { x: this.sprite.x, y: this.sprite.y - 14 };
    runeBolt(this.scene, from, { x: target.x, y: target.y - 4 }, () => target.hit(BOLT_DAMAGE));
  }

  private dist(p: Pt): number {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.x, p.y);
  }

  /** Steps toward a point; returns true once within `arrive` px. */
  private moveTo(x: number, y: number, speed: number, dt: number, arrive: number): boolean {
    const v = new Phaser.Math.Vector2(x - this.sprite.x, y - this.sprite.y);
    const d = v.length();
    if (d <= arrive) return true;
    v.scale(Math.min(d, speed * dt) / d);
    this.sprite.x += v.x;
    this.sprite.y += v.y;
    return false;
  }

  private animate(time: number): void {
    const dx = this.sprite.x - this.lastX;
    const moved = Math.hypot(dx, this.sprite.y - this.lastY) > 0.05;
    this.lastX = this.sprite.x;
    this.lastY = this.sprite.y;
    if (time < this.castUntil) {
      this.sprite.stop();
      this.sprite.setFrame(CAST_FRAME);
      return;
    }
    if (Math.abs(dx) > 0.05) this.sprite.setFlipX(dx < 0);
    this.sprite.play(moved ? 'cobalto-walk' : 'cobalto-idle', true);
  }
}

function nearest<T extends Pt>(list: T[], from: Pt, radius: number): T | null {
  let best: T | null = null;
  let bestD = radius;
  for (const item of list) {
    const d = Phaser.Math.Distance.Between(from.x, from.y, item.x, item.y);
    if (d < bestD) (best = item), (bestD = d);
  }
  return best;
}
