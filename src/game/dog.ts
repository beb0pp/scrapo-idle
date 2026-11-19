import Phaser from 'phaser';

// Ferrugem, the robot dog the hero starts with. It follows, bites enemies that come close
// and fetches ground drops back into the bag. It moves freely (no physics) and never leaves the hero far behind.

export interface DogTarget {
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
}

export interface DogApi {
  /** Hero feet position. */
  hero(): { x: number; y: number };
  enemies(): DogTarget[];
  /** Ground drops the dog may fetch. */
  drops(): { x: number; y: number; take: () => void }[];
  bite(target: DogTarget, damage: number): void;
}

const RUN = 105;
const WALK = 70;
const BITE_EVERY = 850;
const BITE_DAMAGE = 5;
const GUARD_RADIUS = 95;
const FETCH_RADIUS = 150;

export class RoboDog {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly scene: Phaser.Scene;
  private readonly api: DogApi;
  private nextBite = 0;
  private lastX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, api: DogApi) {
    this.scene = scene;
    this.api = api;
    this.lastX = x;
    this.shadow = scene.add.ellipse(x, y + 1, 14, 4, 0x000000, 0.35);
    this.sprite = scene.add.sprite(x, y, 'robodog', 0).setOrigin(0.5, 1);
  }

  update(time: number, deltaMs: number): void {
    const hero = this.api.hero();
    const dt = deltaMs / 1000;
    const here = new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    if (here.distance(hero) > 260) this.sprite.setPosition(hero.x - 14, hero.y);

    const foe = this.nearest(this.api.enemies().filter((e) => e.alive), hero, GUARD_RADIUS);
    if (foe) {
      if (this.moveTo(foe.x, foe.y + 4, RUN, dt, 10) && time >= this.nextBite) {
        this.nextBite = time + BITE_EVERY;
        this.api.bite(foe, BITE_DAMAGE);
        this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 3, duration: 70, yoyo: true });
      }
    } else {
      const drop = this.nearest(this.api.drops(), hero, FETCH_RADIUS);
      if (drop) {
        if (this.moveTo(drop.x, drop.y + 4, RUN, dt, 6)) drop.take();
      } else {
        const side = this.sprite.x <= hero.x ? -1 : 1;
        this.moveTo(hero.x + side * 18, hero.y + 4, WALK, dt, 6);
      }
    }
    this.animate();
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 1).setDepth(this.sprite.y - 2);
    this.sprite.setDepth(this.sprite.y);
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

  private nearest<T extends { x: number; y: number }>(list: T[], from: { x: number; y: number }, radius: number): T | null {
    let best: T | null = null;
    let bestD = radius;
    for (const item of list) {
      const d = Phaser.Math.Distance.Between(from.x, from.y, item.x, item.y);
      if (d < bestD) (best = item), (bestD = d);
    }
    return best;
  }

  private animate(): void {
    const dx = this.sprite.x - this.lastX;
    this.lastX = this.sprite.x;
    if (Math.abs(dx) > 0.05) this.sprite.setFlipX(dx < 0);
    const moving = Math.abs(dx) > 0.05 || this.sprite.anims.isPlaying;
    if (moving && Math.abs(dx) > 0.05) this.sprite.play('dog-run', true);
    else this.sprite.stop();
  }
}
