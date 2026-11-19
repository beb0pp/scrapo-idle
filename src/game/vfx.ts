import Phaser from 'phaser';

// Visual-only effects. Gameplay (damage, cooldowns, targets) stays in WorldScene; these only draw.
// Every object created here destroys itself when its tween ends.
export interface Pt {
  x: number;
  y: number;
}

const FX = 7003;
const CYAN = 0x5fd0d8;
const AMBER = 0xe0b33a;
const PALE = 0xfffbe0;
const WHITE = 0xffffff;
const DUST = 0xb8a88a;

function vanish(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject, ms: number, extra: object = {}): void {
  scene.tweens.add({ targets: obj, alpha: 0, duration: ms, ...extra, onComplete: () => obj.destroy() });
}

/** Additive light blob (uses the 'glow' radial texture). */
function flash(scene: Phaser.Scene, at: Pt, scale: number, tint: number, ms: number, alpha = 0.8): void {
  const g = scene.add.image(at.x, at.y, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha).setDepth(FX);
  vanish(scene, g, ms, { scale: scale * 1.6, ease: 'Quad.easeOut' });
}

/** Square pixel sparks flying out, slowing down and fading. */
function sparks(scene: Phaser.Scene, at: Pt, n: number, tint: number, speed = 40, ms = 260): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = speed * (0.5 + Math.random() * 0.6), size = Math.random() < 0.4 ? 2 : 1;
    const s = scene.add.rectangle(at.x, at.y, size, size, i % 3 ? tint : WHITE).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX + 1);
    scene.tweens.add({
      targets: s, x: at.x + Math.cos(a) * d * (ms / 1000) * 3, y: at.y + Math.sin(a) * d * (ms / 1000) * 3 + 4,
      alpha: 0, duration: ms * (0.7 + Math.random() * 0.5), ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
    });
  }
}

/** Grey dust/steam puffs that grow and fade. */
function puffs(scene: Phaser.Scene, at: Pt, n: number, tint = DUST): void {
  for (let i = 0; i < n; i++) {
    const p = scene.add.circle(at.x + Phaser.Math.Between(-5, 5), at.y + Phaser.Math.Between(-2, 3), Phaser.Math.Between(2, 4), tint, 0.75).setDepth(FX - 1);
    vanish(scene, p, Phaser.Math.Between(280, 420), { scale: 2.4, y: p.y - Phaser.Math.Between(3, 9), ease: 'Quad.easeOut' });
  }
}

/** Expanding (or contracting) pixel ring. */
function ring(scene: Phaser.Scene, at: Pt, from: number, to: number, tint: number, width: number, ms: number): void {
  const c = scene.add.circle(at.x, at.y, Math.max(from, to)).setStrokeStyle(width, tint, 1).setFillStyle(tint, 0.06).setDepth(FX);
  c.setScale(from / Math.max(from, to)).setBlendMode(Phaser.BlendModes.ADD);
  vanish(scene, c, ms, { scale: to / Math.max(from, to), ease: from < to ? 'Cubic.easeOut' : 'Cubic.easeIn' });
}

function jagged(a: Pt, b: Pt, segments: number, amp: number): Phaser.Math.Vector2[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy)), nx = -dy / len, ny = dx / len;
  const pts = [new Phaser.Math.Vector2(a.x, a.y)];
  for (let i = 1; i < segments; i++) {
    const j = (Math.random() * 2 - 1) * amp;
    pts.push(new Phaser.Math.Vector2(a.x + (dx * i) / segments + nx * j, a.y + (dy * i) / segments + ny * j));
  }
  pts.push(new Phaser.Math.Vector2(b.x, b.y));
  return pts;
}

/** Lightning: wide cyan halo, amber body, white core, plus a short fork. */
function bolt(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, width: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const pts = jagged(a, b, Math.max(4, Math.round(len / 9)), Math.min(7, len / 6));
  g.lineStyle(width + 4, CYAN, 0.25).strokePoints(pts);
  g.lineStyle(width, AMBER, 0.95).strokePoints(pts);
  g.lineStyle(1, WHITE, 1).strokePoints(pts);
  const mid = pts[Math.floor(pts.length / 2)];
  const fork = jagged(mid, { x: mid.x + (Math.random() * 2 - 1) * 12, y: mid.y + (Math.random() * 2 - 1) * 12 }, 3, 3);
  g.lineStyle(1, PALE, 0.9).strokePoints(fork);
}

/** Squash-and-stretch on the caster so a cast reads in the body, not only in the effect. */
export function castPose(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite): void {
  scene.tweens.add({ targets: hero, scaleX: 1.15, scaleY: 0.88, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
}

/** Wrench swing: a thick crescent in front of the hero with a spark at the tip. */
export function slash(scene: Phaser.Scene, center: Pt, ang: number): void {
  const g = scene.add.graphics().setDepth(FX);
  g.lineStyle(6, PALE, 0.25).beginPath().arc(center.x, center.y, 14, ang - 1.1, ang + 1.1).strokePath();
  g.lineStyle(3, WHITE, 0.95).beginPath().arc(center.x, center.y, 14, ang - 0.9, ang + 0.9).strokePath();
  g.lineStyle(1, AMBER, 1).beginPath().arc(center.x, center.y, 11, ang - 0.6, ang + 0.6).strokePath();
  vanish(scene, g, 140);
  sparks(scene, { x: center.x + Math.cos(ang) * 15, y: center.y + Math.sin(ang) * 15 }, 4, AMBER, 30, 180);
}

/** Pulso Magnético (Q): field lines collapse inward onto the hero, then a shock flash. */
export function pulse(scene: Phaser.Scene, at: Pt, r: number): void {
  ring(scene, at, r, 6, CYAN, 2, 260);
  ring(scene, at, r * 0.75, 4, PALE, 1, 220);
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.2, d = r * (0.85 + Math.random() * 0.2);
    const len = 4 + Math.random() * 5;
    const line = scene.add.rectangle(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, len, 1, i % 2 ? CYAN : PALE).setRotation(a).setDepth(FX).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: line, x: at.x, y: at.y, scaleX: 0.3, alpha: 0.2, duration: 240, ease: 'Cubic.easeIn', onComplete: () => line.destroy() });
  }
  scene.time.delayedCall(230, () => {
    flash(scene, at, 0.9, CYAN, 220, 0.9);
    ring(scene, at, 4, 22, WHITE, 2, 200);
    sparks(scene, at, 10, CYAN, 50, 260);
  });
}

/** Arco Elétrico (W): chained lightning that flickers three times, with an impact at every target. */
export function arc(scene: Phaser.Scene, chain: Pt[]): void {
  if (chain.length < 2) return;
  const g = scene.add.graphics().setDepth(FX);
  const redraw = () => {
    g.clear();
    for (let i = 1; i < chain.length; i++) bolt(g, chain[i - 1], chain[i], 3);
  };
  redraw();
  scene.time.delayedCall(60, redraw);
  scene.time.delayedCall(120, redraw);
  scene.time.delayedCall(170, () => vanish(scene, g, 120));
  flash(scene, chain[0], 0.35, AMBER, 160);
  for (let i = 1; i < chain.length; i++) {
    flash(scene, chain[i], 0.45, PALE, 200);
    ring(scene, chain[i], 2, 10, AMBER, 1, 180);
    sparks(scene, chain[i], 6, PALE, 45, 220);
  }
  scene.cameras.main.shake(70, 0.002);
}

/** Investida Hidráulica (E): steam burst, cyan afterimages and speed streaks, dust on landing. */
export function dash(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite, dir: Phaser.Math.Vector2, ms: number): void {
  const d = dir.clone().normalize();
  const feet = () => ({ x: hero.x, y: hero.y + 9 });
  puffs(scene, feet(), 5, 0xd8e4e6);
  flash(scene, { x: hero.x - d.x * 6, y: hero.y - d.y * 6 }, 0.45, CYAN, 180);
  scene.tweens.add({ targets: hero, scaleX: 1 + Math.abs(d.x) * 0.25, scaleY: 1 + Math.abs(d.y) * 0.25 - Math.abs(d.x) * 0.1, duration: ms / 2, yoyo: true });
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    scene.time.delayedCall((i * ms) / steps, () => {
      const ghost = scene.add.image(hero.x, hero.y, 'hero', hero.frame.name).setFlipX(hero.flipX).setTintFill(i % 2 ? CYAN : PALE).setAlpha(0.55).setDepth(hero.depth - 1);
      vanish(scene, ghost, 180, { scaleX: 0.9, scaleY: 1.05 });
      for (let k = -1; k <= 1; k++) {
        const ox = -d.y * k * 6, oy = d.x * k * 6;
        const streak = scene.add.rectangle(hero.x + ox - d.x * 10, hero.y + oy - d.y * 10, 12 + Math.random() * 8, 1, CYAN).setRotation(Math.atan2(d.y, d.x)).setDepth(FX).setBlendMode(Phaser.BlendModes.ADD);
        vanish(scene, streak, 140, { x: streak.x - d.x * 10, y: streak.y - d.y * 10 });
      }
    });
  }
  scene.time.delayedCall(ms, () => {
    puffs(scene, feet(), 4);
    sparks(scene, feet(), 5, DUST, 30, 220);
  });
  scene.cameras.main.shake(90, 0.003);
}

/** Drone with Garra module: small zap from drone to target. */
export function droneZap(scene: Phaser.Scene, from: Pt, to: Pt): void {
  const g = scene.add.graphics().setDepth(FX);
  bolt(g, from, to, 2);
  vanish(scene, g, 150);
  flash(scene, to, 0.25, CYAN, 140);
  sparks(scene, to, 4, CYAN, 35, 180);
}

/** Drone with Magnético module: periodic pull field of radius `r` around the drone. */
export function droneField(scene: Phaser.Scene, at: Pt, r: number): void {
  ring(scene, at, r, 4, CYAN, 1, 320);
  flash(scene, at, 0.4, CYAN, 200, 0.6);
  sparks(scene, at, 6, CYAN, 30, 240);
}

/** Sobrecarga do drone (R). `targets` empty with the magnet module (it is an area burst of radius `r`). */
export function overdrive(scene: Phaser.Scene, drone: Pt, targets: Pt[], r: number): void {
  flash(scene, drone, 0.8, AMBER, 260, 1);
  if (targets.length) {
    const g = scene.add.graphics().setDepth(FX);
    const redraw = () => {
      g.clear();
      for (const t of targets) bolt(g, drone, t, 4);
    };
    redraw();
    scene.time.delayedCall(70, redraw);
    scene.time.delayedCall(140, () => vanish(scene, g, 160));
    for (const t of targets) {
      flash(scene, t, 0.6, PALE, 240);
      ring(scene, t, 3, 16, AMBER, 2, 220);
      sparks(scene, t, 8, AMBER, 55, 260);
    }
  } else {
    ring(scene, drone, r, 6, CYAN, 3, 360);
    ring(scene, drone, 6, r, WHITE, 2, 300);
    flash(scene, drone, 1.4, CYAN, 320, 0.9);
    sparks(scene, drone, 14, CYAN, 60, 320);
  }
  scene.cameras.main.shake(140, 0.004);
}

/** Wrench hitting junk while salvaging: sparks and a bit of dust. */
export function salvageHit(scene: Phaser.Scene, at: Pt): void {
  const p = { x: at.x + Phaser.Math.Between(-4, 4), y: at.y + Phaser.Math.Between(-3, 3) };
  sparks(scene, p, 5, AMBER, 35, 200);
  puffs(scene, p, 1);
}

function floatingText(scene: Phaser.Scene, at: Pt, text: string, color: string, size: number, rise: number): void {
  const t = scene.add
    .text(at.x, at.y, text, { fontFamily: 'Pixelify Sans', fontSize: `${size}px`, color, stroke: '#1b1a24', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(4)
    .setDepth(FX + 2)
    .setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 90, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, y: at.y - rise, alpha: 0, delay: 250, duration: 500, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
}

/** Text flourish when something is interrupted or broken (e.g. the crane's magnet line). */
export function callout(scene: Phaser.Scene, at: Pt, text: string): void {
  floatingText(scene, at, text, '#fffbe0', 8, 14);
}

/**
 * Found item: a small label (icon + "+2 Servomotor · Incomum") rising from the junk in the rarity colour.
 * Anything above common gets a coloured burst so a good find is noticed from across the screen.
 */
export function lootPopup(scene: Phaser.Scene, at: Pt, iconKey: string, text: string, color: string, delay: number): void {
  const tint = parseInt(color.slice(1), 16);
  const rare = color.toLowerCase() !== '#b8bcc4';
  scene.time.delayedCall(delay, () => {
    const label = scene.add
      .text(8, 0, text, { fontFamily: 'Pixelify Sans', fontSize: '8px', color, stroke: '#1b1a24', strokeThickness: 3 })
      .setOrigin(0, 0.5)
      .setResolution(4);
    const icon = scene.add.image(0, 0, iconKey).setScale(0.75);
    const box = scene.add.container(at.x - (label.width + 12) / 2, at.y, [icon, label]).setDepth(FX + 3).setAlpha(0);
    scene.tweens.add({ targets: box, alpha: 1, y: at.y - 10, duration: 180, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: box, alpha: 0, y: at.y - 26, delay: 1300, duration: 500, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
    if (rare) {
      flash(scene, at, 0.6, tint, 360, 0.9);
      sparks(scene, at, 8, tint, 45, 320);
    }
  });
}

/** Damage number popping out of a hit target. */
export function damageNumber(scene: Phaser.Scene, at: Pt, amount: number, crit = false): void {
  floatingText(scene, { x: at.x + Phaser.Math.Between(-3, 3), y: at.y - 6 }, String(Math.round(amount)), crit ? '#e0b33a' : '#ffffff', crit ? 10 : 8, 12);
}
