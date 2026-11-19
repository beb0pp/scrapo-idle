import Phaser from 'phaser';
import { XP } from '../data/xp';

export type EnemyKind = 'sorter' | 'press' | 'sparkbot' | 'magnetron' | 'scrapgolem';

export interface Target {
  x: number;
  y: number;
  hurt: (dmg: number, fromX: number, fromY: number) => void;
}

interface Cfg {
  hp: number;
  patrol: number;
  chase: number;
  aggro: number;
  reach: number;
  windup: number;
  recover: number;
  dmg: number;
  radius: number;
  light: boolean;
  tex: string;
  anim: string;
  size: number;
  ranged?: boolean;
  lunge?: boolean;
  slam?: boolean;
}

const CFG: Record<EnemyKind, Cfg> = {
  sorter: { hp: 30, patrol: 22, chase: 50, aggro: 96, reach: 18, windup: 600, recover: 650, dmg: 10, radius: 22, light: true, tex: 'sorter', anim: 'sorter-walk', size: 16 },
  press: { hp: 80, patrol: 16, chase: 34, aggro: 88, reach: 22, windup: 950, recover: 950, dmg: 22, radius: 32, light: false, tex: 'press', anim: 'press-walk', size: 24 },
  sparkbot: { hp: 20, patrol: 38, chase: 82, aggro: 112, reach: 44, windup: 360, recover: 520, dmg: 12, radius: 52, light: true, tex: 'sparkbot', anim: 'sparkbot-walk', size: 16, lunge: true },
  magnetron: { hp: 48, patrol: 20, chase: 34, aggro: 150, reach: 76, windup: 700, recover: 900, dmg: 14, radius: 150, light: false, tex: 'magnetron', anim: 'magnetron-walk', size: 24, ranged: true },
  scrapgolem: { hp: 130, patrol: 12, chase: 27, aggro: 100, reach: 30, windup: 1100, recover: 1050, dmg: 28, radius: 42, light: false, tex: 'scrapgolem', anim: 'scrapgolem-walk', size: 32, slam: true },
};

export const killXp = (kind: EnemyKind): number => Math.round(CFG[kind].hp / XP.hpPerKillXp);

const LEASH = 240;
const TELEGRAPH = 0xe8433a;

export class Enemy {
  readonly kind: EnemyKind;
  readonly cfg: Cfg;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  private state: 'patrol' | 'chase' | 'windup' | 'attack' | 'recover' | 'stunned' = 'patrol';
  private until = 0;
  private home: Phaser.Math.Vector2;
  private wander: Phaser.Math.Vector2 | null = null;
  private wanderUntil = 0;
  private knock = { vx: 0, vy: 0, until: 0 };
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private attackTarget = new Phaser.Math.Vector2();
  private attackHit = false;
  private projectile: Phaser.Physics.Arcade.Sprite | null = null;
  private projectileStart = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    this.scene = scene;
    this.kind = kind;
    this.cfg = CFG[kind];
    this.hp = this.cfg.hp;
    this.home = new Phaser.Math.Vector2(x, y);
    this.sprite = scene.physics.add.sprite(x, y, this.cfg.tex, 0);
    this.sprite.play(this.cfg.anim);
    const bodySize = Math.max(10, Math.floor(this.cfg.size * 0.58));
    (this.sprite.body as Phaser.Physics.Arcade.Body).setSize(bodySize, Math.max(7, Math.floor(this.cfg.size * 0.32))).setOffset(Math.floor((this.cfg.size - bodySize) / 2), this.cfg.size - Math.max(7, Math.floor(this.cfg.size * 0.32)));
    this.gfx = scene.add.graphics();
    this.shadow = scene.add.ellipse(x, y + this.cfg.size * 0.35, Math.max(12, this.cfg.size * 0.72), 4, 0x000000, 0.35);
  }

  private readonly shadow: Phaser.GameObjects.Ellipse;

  get alive(): boolean {
    return this.hp > 0;
  }

  get light(): boolean {
    return this.cfg.light;
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get radius(): number {
    return this.cfg.radius;
  }

  get windingUp(): boolean {
    return this.state === 'windup';
  }

  update(time: number, target: Target): void {
    if (!this.alive) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    this.gfx.clear();
    this.updateProjectile(target);
    switch (this.state) {
      case 'stunned':
        if (time < this.knock.until) body.setVelocity(this.knock.vx, this.knock.vy);
        else body.setVelocity(0, 0);
        this.sprite.setAngle(Math.sin(time / 40) * 8);
        if (time >= this.until) this.setState('chase', time);
        break;
      case 'windup': {
        body.setVelocity(0, 0);
        const t = 1 - (this.until - time) / this.cfg.windup;
        if (this.cfg.ranged) {
          this.gfx.lineStyle(2, TELEGRAPH, 0.25 + t * 0.7).lineBetween(this.x, this.y - 3, this.attackTarget.x, this.attackTarget.y);
          this.gfx.fillStyle(TELEGRAPH, 0.1 + t * 0.25).fillCircle(this.attackTarget.x, this.attackTarget.y, 8);
        } else {
          this.gfx.fillStyle(TELEGRAPH, 0.12 + 0.3 * t).fillCircle(this.x, this.y + 2, this.cfg.radius * t);
          this.gfx.lineStyle(1, TELEGRAPH, 0.9).strokeCircle(this.x, this.y + 2, this.cfg.radius);
        }
        this.sprite.setTint(Math.floor(time / 80) % 2 ? 0xff8a6a : 0xffffff);
        if (time >= this.until) {
          this.sprite.clearTint();
          this.sprite.play(`${this.kind}-attack`, true);
          this.attackHit = false;
          if (this.cfg.ranged) this.fireBolt();
          this.setState('attack', time + (this.cfg.lunge ? 220 : 120));
        }
        break;
      }
      case 'attack': {
        if (this.cfg.lunge) {
          const lunge = new Phaser.Math.Vector2(this.attackTarget.x - this.x, this.attackTarget.y - this.y).normalize().scale(176);
          body.setVelocity(lunge.x, lunge.y);
          if (!this.attackHit && Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) <= this.cfg.radius + 8) {
            target.hurt(this.cfg.dmg, this.x, this.y);
            this.attackHit = true;
          }
        } else {
          body.setVelocity(0, 0);
          if (!this.attackHit && !this.cfg.ranged && dist <= this.cfg.radius + 3) {
            target.hurt(this.cfg.dmg, this.x, this.y);
            this.attackHit = true;
          }
        }
        if (time >= this.until) {
          if (!this.cfg.ranged && !this.cfg.lunge) this.flash(this.cfg.radius);
          this.setState('recover', time + this.cfg.recover);
        }
        break;
      }
      case 'recover':
        body.setVelocity(0, 0);
        if (time >= this.until) this.setState('chase', time);
        break;
      case 'patrol': {
        if (dist < this.cfg.aggro) {
          this.setState('chase', time);
          break;
        }
        if (!this.wander || time > this.wanderUntil) {
          this.wander = new Phaser.Math.Vector2(this.home.x + Phaser.Math.Between(-40, 40), this.home.y + Phaser.Math.Between(-40, 40));
          this.wanderUntil = time + Phaser.Math.Between(1800, 3400);
        }
        this.moveTo(this.wander.x, this.wander.y, this.cfg.patrol);
        break;
      }
      case 'chase': {
        const fromHome = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y);
        if (fromHome > LEASH || dist > this.cfg.aggro * 2.2) {
          this.wander = this.home.clone();
          this.setState('patrol', time);
          break;
        }
        if (this.cfg.ranged && dist < this.cfg.reach * 0.62) {
          this.moveTo(this.x - (target.x - this.x), this.y - (target.y - this.y), this.cfg.chase);
          break;
        }
        if (dist <= this.cfg.reach || (this.cfg.ranged && dist <= this.cfg.aggro)) {
          this.attackTarget.set(target.x, target.y);
          this.setState('windup', time + this.cfg.windup);
          this.sprite.play(`${this.kind}-windup`, true);
          break;
        }
        this.moveTo(target.x, target.y, this.cfg.chase);
        break;
      }
    }
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 6).setDepth(this.y - 2);
    if (this.hp < this.cfg.hp) {
      this.gfx.fillStyle(0x1b1a24).fillRect(this.x - 7, this.y - 12, 14, 3);
      this.gfx.fillStyle(0xe8433a).fillRect(this.x - 6, this.y - 11, 12 * (this.hp / this.cfg.hp), 1);
    }
    this.gfx.setDepth(this.y - 1);
  }

  private moveTo(x: number, y: number, speed: number): void {
    const v = new Phaser.Math.Vector2(x - this.x, y - this.y);
    if (v.length() < 2) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }
    v.normalize().scale(speed);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(v.x, v.y);
    this.sprite.setFlipX(v.x < 0);
    if (this.state === 'patrol' || this.state === 'chase') this.sprite.play(this.cfg.anim);
  }

  private setState(s: Enemy['state'], until: number): void {
    this.state = s;
    this.until = until;
    if (s !== 'stunned') this.sprite.setAngle(0);
    if (s !== 'windup') this.sprite.clearTint();
    if (s === 'stunned') this.sprite.play(`${this.kind}-hurt`, true);
  }

  private flash(r: number): void {
    const ring = this.scene.add.circle(this.x, this.y + 2, r, TELEGRAPH, 0.5).setDepth(this.y + 1);
    this.scene.tweens.add({ targets: ring, alpha: 0, duration: 160, onComplete: () => ring.destroy() });
  }

  private fireBolt(): void {
    this.projectile?.destroy();
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.attackTarget.x, this.attackTarget.y);
    const bolt = this.scene.physics.add.sprite(this.x, this.y - 2, 'dot');
    bolt.setTint(0x5fd0d8).setScale(3).setDepth(this.y + 2);
    (bolt.body as Phaser.Physics.Arcade.Body).setCircle(1).setVelocity(Math.cos(angle) * 86, Math.sin(angle) * 86);
    this.projectile = bolt;
    this.projectileStart.set(this.x, this.y);
  }

  private updateProjectile(target: Target): void {
    const bolt = this.projectile;
    if (!bolt || !bolt.active) return;
    bolt.setDepth(bolt.y + 2);
    if (Phaser.Math.Distance.Between(bolt.x, bolt.y, this.projectileStart.x, this.projectileStart.y) > 150 || this.hitsWall(bolt.x, bolt.y)) {
      bolt.destroy(); this.projectile = null; return;
    }
    if (Phaser.Math.Distance.Between(bolt.x, bolt.y, target.x, target.y) <= 8) {
      target.hurt(this.cfg.dmg, this.x, this.y);
      this.flash(10);
      bolt.destroy(); this.projectile = null;
    }
  }

  private hitsWall(x: number, y: number): boolean {
    return this.scene.children.list.some((child) => {
      if (!(child instanceof Phaser.Tilemaps.TilemapLayer)) return false;
      return Boolean(child.getTileAtWorldXY(x, y)?.collides);
    });
  }

  /** Returns true when this hit killed it. */
  damage(n: number, fromX: number, fromY: number): boolean {
    if (!this.alive) return false;
    this.hp -= n;
    this.sprite.setTintFill(0xffffff);
    this.sprite.play(`${this.kind}-hurt`, true);
    this.scene.time.delayedCall(70, () => this.sprite.active && this.sprite.clearTint());
    const away = new Phaser.Math.Vector2(this.x - fromX, this.y - fromY).normalize().scale(this.light ? 90 : 30);
    this.knock = { vx: away.x, vy: away.y, until: this.scene.time.now + 90 };
    if (this.state !== 'windup' && this.state !== 'stunned') this.setState('stunned', this.scene.time.now + 120);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  stun(ms: number): void {
    if (!this.alive) return;
    this.setState('stunned', this.scene.time.now + ms);
    this.gfx.clear();
  }

  /** Pulls toward a point by velocity so walls still block it. Heavy enemies only flinch. */
  pull(x: number, y: number, stunMs: number): void {
    if (!this.alive) return;
    const d = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    if (this.light && d > 14) {
      const v = new Phaser.Math.Vector2(x - this.x, y - this.y).normalize().scale(Math.min(260, d * 3.2));
      this.knock = { vx: v.x, vy: v.y, until: this.scene.time.now + 260 };
      this.stun(stunMs);
    } else this.stun(this.light ? stunMs : 250);
  }

  /** Dash through a winding-up enemy cancels the blow. */
  interrupt(): boolean {
    if (this.state !== 'windup') return false;
    this.stun(1200);
    return true;
  }

  private die(): void {
    this.gfx.destroy();
    this.shadow.destroy();
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.sprite.stop();
    this.projectile?.destroy();
    for (let i = 0; i < 4; i++) {
      const piece = this.scene.add.rectangle(this.x, this.y, 3, 3, i % 2 ? 0xd7833b : 0x7b8aa3).setDepth(this.y + 2);
      this.scene.tweens.add({ targets: piece, x: this.x + Phaser.Math.Between(-18, 18), y: this.y + Phaser.Math.Between(-13, 8), angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 280, onComplete: () => piece.destroy() });
    }
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, angle: 90, duration: 300, onComplete: () => this.sprite.destroy() });
  }
}

// ---------------- Guindaste de Arrasto ----------------

export interface CraneApi {
  target: Target;
  /** Velocity added to the player this frame; null stops pulling. */
  setPull: (v: Phaser.Math.Vector2 | null) => void;
  summon: (x: number, y: number) => void;
  onIntro: () => void;
}

type CranePhase = 'dormant' | 'rest' | 'magnetTele' | 'pull' | 'hookTele' | 'dead';

export class Crane {
  readonly maxHp = 320;
  hp = this.maxHp;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private phase: CranePhase = 'dormant';
  private until = 0;
  private cycle = 0;
  private hook = new Phaser.Math.Vector2();
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly api: CraneApi;

  constructor(scene: Phaser.Scene, x: number, y: number, api: CraneApi) {
    this.scene = scene;
    this.api = api;
    this.sprite = scene.physics.add.staticSprite(x, y, 'crane', 0);
    this.sprite.play('crane-idle');
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(30, 18).setOffset(5, 20);
    this.sprite.setDepth(y + 10);
    scene.add.ellipse(x + 2, y + 18, 38, 9, 0x000000, 0.35).setDepth(y - 5);
    this.gfx = scene.add.graphics().setDepth(5000);
  }

  get active(): boolean {
    return this.phase !== 'dormant' && this.phase !== 'dead';
  }

  get alive(): boolean {
    return this.phase !== 'dead';
  }

  private get magnet(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sprite.x + 6, this.sprite.y - 16);
  }

  update(time: number): void {
    const t = this.api.target;
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, t.x, t.y);
    this.gfx.clear();
    switch (this.phase) {
      case 'dormant':
        if (dist < 150) {
          this.api.onIntro();
          this.go('rest', time + 900);
        }
        break;
      case 'rest':
        if (time >= this.until) this.nextAttack(time);
        break;
      case 'magnetTele': {
        const m = this.magnet;
        if (Math.floor(time / 110) % 2) {
          this.gfx.lineStyle(2, 0xf6e7a1, 0.95);
          this.dashed(m.x, m.y, t.x, t.y);
        }
        this.gfx.fillStyle(0xf6e7a1).fillRect(this.sprite.x - 1, this.sprite.y - 30, 3, 7).fillRect(this.sprite.x - 1, this.sprite.y - 21, 3, 2);
        if (time >= this.until) this.go('pull', time + 1900);
        break;
      }
      case 'pull': {
        const m = this.magnet;
        this.gfx.lineStyle(3, 0x5fd0d8, 0.85).lineBetween(m.x, m.y, t.x, t.y);
        this.gfx.lineStyle(1, 0xffffff, 0.9).lineBetween(m.x, m.y, t.x, t.y);
        this.api.setPull(new Phaser.Math.Vector2(this.sprite.x - t.x, this.sprite.y + 14 - t.y).normalize().scale(108));
        if (dist < 34) {
          t.hurt(25, this.sprite.x, this.sprite.y);
          this.endPull(time);
        } else if (time >= this.until) this.endPull(time);
        break;
      }
      case 'hookTele': {
        const k = 1 - (this.until - time) / 900;
        this.gfx.fillStyle(0xe8433a, 0.12 + 0.3 * k).fillCircle(this.hook.x, this.hook.y, 30 * k);
        this.gfx.lineStyle(1, 0xe8433a, 0.9).strokeCircle(this.hook.x, this.hook.y, 30);
        this.gfx.lineStyle(1, 0xb8bcc4, 0.8).lineBetween(this.magnet.x, this.magnet.y, this.hook.x, this.hook.y);
        if (time >= this.until) {
          if (Phaser.Math.Distance.Between(this.hook.x, this.hook.y, t.x, t.y) < 31) t.hurt(20, this.hook.x, this.hook.y);
          const ring = this.scene.add.circle(this.hook.x, this.hook.y, 30, 0xe8433a, 0.5).setDepth(4999);
          this.scene.tweens.add({ targets: ring, alpha: 0, duration: 200, onComplete: () => ring.destroy() });
          this.scene.cameras.main.shake(120, 0.004);
          this.go('rest', time + 1100);
        }
        break;
      }
      case 'dead':
        break;
    }
  }

  private nextAttack(time: number): void {
    this.cycle++;
    if (this.cycle % 3 === 0) {
      this.api.summon(this.sprite.x - 34, this.sprite.y + 34);
      this.api.summon(this.sprite.x + 34, this.sprite.y + 34);
    }
    if (this.cycle % 2 === 1) this.go('magnetTele', time + 1100);
    else {
      this.hook.set(this.api.target.x, this.api.target.y);
      this.go('hookTele', time + 900);
    }
  }

  private endPull(time: number): void {
    this.api.setPull(null);
    this.go('rest', time + 1300);
  }

  /** The hydraulic dash snaps the magnet line. */
  breakPull(): boolean {
    if (this.phase !== 'pull') return false;
    this.endPull(this.scene.time.now);
    return true;
  }

  private go(p: CranePhase, until: number): void {
    this.phase = p;
    this.until = until;
  }

  private dashed(x0: number, y0: number, x1: number, y1: number): void {
    const len = Phaser.Math.Distance.Between(x0, y0, x1, y1);
    const steps = Math.floor(len / 6);
    for (let i = 0; i < steps; i += 2) {
      const a = i / steps, b = Math.min(1, (i + 1) / steps);
      this.gfx.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
  }

  /** Returns true when this hit killed it. */
  damage(n: number): boolean {
    if (!this.alive) return false;
    if (this.phase === 'dormant') this.go('rest', this.scene.time.now + 600);
    this.hp = Math.max(0, this.hp - n);
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.active && this.sprite.clearTint());
    if (this.hp > 0) return false;
    this.phase = 'dead';
    this.api.setPull(null);
    this.gfx.clear();
    this.sprite.stop();
    this.sprite.setTint(0x55505a);
    this.scene.cameras.main.shake(300, 0.008);
    return true;
  }
}
