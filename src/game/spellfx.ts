import Phaser from 'phaser';
import type { SpellId } from '../data/ferromancy';

// Five-phase spell animation: preparation → rune circle → conjuration → impact → dissipation.
// Visual only: the caller passes `onImpact`, fired on the exact impact frame, so damage lands with the flash.

export interface Pt { x: number; y: number }

const FX = 7004;
export const PREP_MS = 180;
export const CIRCLE_MS = 220;
const TRAVEL_MS = 140;
/** Arco Encadeado: time between one jump of the arc and the next. */
export const ARC_HOP_MS = 90;
/** Prensa Magnética: the pull runs this long before the crush lands. */
export const CRUSH_MS = 260;
export const IMPACT_DELAY: Record<SpellId, number> = {
  spell_ember: PREP_MS + CIRCLE_MS + TRAVEL_MS,
  spell_ward: PREP_MS + CIRCLE_MS,
  spell_lodestone: PREP_MS + CIRCLE_MS,
  spell_haste: PREP_MS + CIRCLE_MS,
  spell_net: PREP_MS + CIRCLE_MS,
  spell_harvest: PREP_MS + CIRCLE_MS,
  spell_arc: PREP_MS + CIRCLE_MS + TRAVEL_MS,
  spell_crush: PREP_MS + CIRCLE_MS + CRUSH_MS,
  spell_acid: PREP_MS + CIRCLE_MS + TRAVEL_MS,
};

const COLORS: Record<SpellId, { main: number; hi: number; rune: string; anim: string; tint?: number }> = {
  spell_ember: { main: 0xf08a3a, hi: 0xffd27a, rune: 'rune_ember', anim: 'rune-ember-spin' },
  spell_ward: { main: 0x5fd0d8, hi: 0xb8f4f6, rune: 'rune_ward', anim: 'rune-ward-spin' },
  spell_lodestone: { main: 0xb48ae6, hi: 0xe8d8ff, rune: 'rune_lode', anim: 'rune-lode-spin' },
  spell_haste: { main: 0xe0b33a, hi: 0xfff2b0, rune: 'rune_ward_w', anim: 'rune-ward-w-spin', tint: 0xffd25a },
  spell_net: { main: 0x9a6ae0, hi: 0xdcc8ff, rune: 'rune_lode_w', anim: 'rune-lode-w-spin', tint: 0xe08ae8 },
  spell_harvest: { main: 0x9fd86a, hi: 0xe8ffc8, rune: 'rune_ember_w', anim: 'rune-ember-w-spin', tint: 0xa8f070 },
  spell_arc: { main: 0x6f9cff, hi: 0xcfe0ff, rune: 'rune_arc', anim: 'rune-arc-spin' },
  spell_crush: { main: 0xe8506a, hi: 0xffc0cc, rune: 'rune_crush', anim: 'rune-crush-spin' },
  spell_acid: { main: 0x3fd49a, hi: 0xc4ffe4, rune: 'rune_acid', anim: 'rune-acid-spin' },
};
/** Rune circles are painted round at 96 px and squashed onto the 3/4 ground plane. */
const RUNE_PX = 96;
const GROUND_FLAT = 0.5;
const SCALE_EMBER = 0.55;
const SCALE_WARD = 0.6;
const SCALE_LODE = 0.7;
const SCALE_BUFF = 0.6;
const SCALE_HARVEST = 0.68;
const SCALE_ARC = 0.5;
const SCALE_ACID = 0.6;
const AURA_FADE_MS = 400;
const HARVEST_STAGGER_MS = 70;
const WHITE = 0xffffff;
const SMOKE = 0x5a5560;
const ADD = Phaser.BlendModes.ADD;
const SCORCH_FADE_MS = 1300;
const LODE_DEEP = 0x7a3fd0;
const EMBER_CORE = 0xffb868;
const WARD_CORE = 0xb8f4f6;
const LODE_CORE = 0xc8a0ff;
const PULL_ARROW_R = 28;
const ARC_FLICKERS = 3;
const ARC_FADE_MS = 140;
const ACID_INK = 0x1e7a56;
const ACID_LOB = 18;
const ACID_BUBBLE_MS = 180;

export type WardShield = Phaser.GameObjects.Sprite;

function glow(scene: Phaser.Scene, at: Pt, scale: number, tint: number, ms: number, alpha = 0.85, flat = 1): void {
  const g = scene.add.image(at.x, at.y, 'glow').setTint(tint).setBlendMode(ADD).setScale(scale, scale * flat).setAlpha(alpha).setDepth(FX);
  scene.tweens.add({ targets: g, alpha: 0, scaleX: scale * 1.7, scaleY: scale * flat * 1.7, duration: ms, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}

function dot(scene: Phaser.Scene, x: number, y: number, size: number, color: number, depth = FX + 1): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(Math.round(x), Math.round(y), size, size, color).setBlendMode(ADD).setDepth(depth);
}

/** Pixel motes: inward (gather) or outward (burst / dissipate). */
function motes(scene: Phaser.Scene, at: Pt, n: number, tint: number, radius: number, inward: boolean, ms: number, rise = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const far = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius * 0.6 };
    const from = inward ? far : at;
    const to = inward ? at : { x: far.x, y: far.y - rise };
    const m = dot(scene, from.x, from.y, i % 3 ? 1 : 2, i % 3 ? tint : WHITE);
    scene.tweens.add({ targets: m, x: to.x, y: to.y, alpha: inward ? 1 : 0, duration: ms * (0.75 + Math.random() * 0.4), ease: inward ? 'Quad.easeIn' : 'Cubic.easeOut', onComplete: () => m.destroy() });
  }
}

/** Stroked ring that expands (or contracts) and fades; `flat` squashes it onto the ground plane. */
function ring(scene: Phaser.Scene, at: Pt, from: number, to: number, color: number, ms: number, flat = 0.5, width = 2, depth = FX): void {
  const big = Math.max(from, to);
  const e = scene.add.ellipse(at.x, at.y, big * 2, big * 2 * flat).setStrokeStyle(width, color, 1).setBlendMode(ADD).setDepth(depth).setScale(from / big);
  scene.tweens.add({ targets: e, scale: to / big, alpha: 0, duration: ms, ease: to > from ? 'Cubic.easeOut' : 'Cubic.easeIn', onComplete: () => e.destroy() });
}

/** Brief white flash over an area: the hit frame. */
function flash(scene: Phaser.Scene, at: Pt, w: number, h: number, ms: number, depth = FX + 3, color = WHITE): void {
  const f = scene.add.ellipse(at.x, at.y, w, h, color).setBlendMode(ADD).setDepth(depth).setAlpha(0.9);
  scene.tweens.add({ targets: f, alpha: 0, scale: 1.3, duration: ms, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
}

/** One-shot sprite animation (impact burst, spike burst) that destroys itself on its last frame. */
function burst(scene: Phaser.Scene, at: Pt, tex: string, anim: string, tint: number, scale: number, rotation = 0, depth = FX + 3): void {
  const s = scene.add.sprite(at.x, at.y, tex, 0).setBlendMode(ADD).setTint(tint).setScale(scale).setRotation(rotation).setDepth(depth);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  s.play(anim);
}

/** Crescent swirl that spins in place for `ms`, then fades out; `flat` squashes it onto the ground. */
function swirl(scene: Phaser.Scene, at: Pt, tint: number, scale: number, ms: number, flat = 1, depth = FX + 1): void {
  const s = scene.add.sprite(at.x, at.y, 'swirl', 0).play('swirl-spin').setBlendMode(ADD).setTint(tint).setScale(scale * 0.5, scale * flat * 0.5).setDepth(depth);
  scene.tweens.add({ targets: s, scaleX: scale, scaleY: scale * flat, duration: ms * 0.4, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: s, alpha: 0, scaleX: scale * 1.25, scaleY: scale * flat * 1.25, delay: ms * 0.5, duration: ms * 0.5, ease: 'Quad.easeIn', onComplete: () => s.destroy() });
}

/** Sparks that rise and flicker out: embers, rune dust. */
function rising(scene: Phaser.Scene, at: Pt, n: number, colors: number[], spread: number, rise: number, ms: number, stagger = 40): void {
  for (let i = 0; i < n; i++) {
    const x = at.x + (Math.random() - 0.5) * spread * 2, y = at.y + (Math.random() - 0.5) * spread * 0.6;
    const s = dot(scene, x, y, i % 3 ? 1 : 2, colors[i % colors.length]).setAlpha(0);
    scene.tweens.add({
      targets: s, y: y - rise * (0.7 + Math.random() * 0.6), x: x + (Math.random() - 0.5) * 6, alpha: { from: 1, to: 0 },
      delay: i * stagger, duration: ms * (0.8 + Math.random() * 0.4), ease: 'Sine.easeOut', onComplete: () => s.destroy(),
    });
  }
}

/** Ground rune circle with its light pool: grows in, flashes as it lands, spins, then shrinks and leaves sparks. `scale` sizes the 96-px texture. */
function runeCircle(scene: Phaser.Scene, spell: SpellId, at: Pt, scale: number, holdMs: number): void {
  const c = COLORS[spell];
  const light = c.tint ?? c.main;
  const w = RUNE_PX * scale;
  const pool = scene.add.ellipse(at.x, at.y, w * 1.05, w * GROUND_FLAT * 1.05, light).setBlendMode(ADD).setDepth(at.y - 2).setAlpha(0);
  const circle = scene.add.sprite(at.x, at.y, c.rune, 0).play(c.anim).setDepth(at.y - 1).setScale(scale * 0.1, scale * 0.1 * GROUND_FLAT).setAlpha(0);
  if (c.tint !== undefined) circle.setTint(c.tint);
  scene.tweens.add({ targets: pool, alpha: 0.18, duration: CIRCLE_MS });
  scene.tweens.add({ targets: circle, scaleX: scale, scaleY: scale * GROUND_FLAT, alpha: 1, duration: CIRCLE_MS, ease: 'Back.easeOut' });
  scene.time.delayedCall(CIRCLE_MS, () => {
    glow(scene, at, scale * 1.8, WHITE, 160, 0.9, GROUND_FLAT);
    ring(scene, at, w * 0.42, w * 0.62, c.hi, 200, GROUND_FLAT, 1, at.y);
  });
  scene.tweens.add({ targets: pool, alpha: 0, delay: CIRCLE_MS + holdMs, duration: 380, onComplete: () => pool.destroy() });
  scene.tweens.add({
    targets: circle, scaleX: scale * 0.6, scaleY: scale * 0.6 * GROUND_FLAT, alpha: 0, delay: CIRCLE_MS + holdMs, duration: 380, ease: 'Quad.easeIn',
    onComplete: () => circle.destroy(),
  });
  scene.time.delayedCall(CIRCLE_MS + holdMs + 120, () => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      rising(scene, { x: at.x + Math.cos(a) * w * 0.45, y: at.y + Math.sin(a) * w * 0.45 * GROUND_FLAT }, 1, [i % 2 ? c.hi : WHITE], 1, 12, 800, 0);
    }
  });
}

/** Phase 1, preparation: squash-and-raise pose, a pulsing hand spark, motes converging on the hand. */
function prepare(scene: Phaser.Scene, spell: SpellId, caster: Phaser.GameObjects.Sprite, hand: Pt): void {
  const c = COLORS[spell];
  const base = (caster.getData('baseScale') as number | undefined) ?? 1;
  scene.tweens.add({
    targets: caster, scaleX: base * 1.12, scaleY: base * 0.88, duration: 60, ease: 'Quad.easeOut',
    onComplete: () => scene.tweens.add({
      targets: caster, scaleX: base * 0.92, scaleY: base * 1.1, duration: PREP_MS - 60, yoyo: true, ease: 'Sine.easeInOut',
      onComplete: () => caster.setScale(base),
    }),
  });
  const spark = scene.add.container(hand.x, hand.y, [
    scene.add.rectangle(0, 0, 7, 1, c.hi), scene.add.rectangle(0, 0, 1, 7, c.hi), scene.add.rectangle(0, 0, 3, 3, WHITE),
  ]).setDepth(FX + 3);
  spark.each((o: Phaser.GameObjects.Rectangle) => o.setBlendMode(ADD));
  scene.tweens.add({ targets: spark, scale: 1.5, duration: 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    scene.tweens.killTweensOf(spark);
    scene.tweens.add({ targets: spark, alpha: 0, scale: 2, duration: 90, onComplete: () => spark.destroy() });
  });
  motes(scene, hand, 18, c.main, 24, true, PREP_MS);
  scene.time.delayedCall(60, () => motes(scene, hand, 8, c.hi, 14, true, PREP_MS - 40));
  glow(scene, hand, 0.3, c.hi, PREP_MS + 120, 0.7);
}

/** A fading copy of the lance left behind on its path. */
function afterimage(scene: Phaser.Scene, src: Phaser.GameObjects.Sprite, tint: number): void {
  const a = scene.add.image(src.x, src.y, 'ember_lance', src.frame.name).setRotation(src.rotation).setBlendMode(ADD).setTint(tint).setAlpha(0.6).setDepth(FX + 1);
  scene.tweens.add({ targets: a, alpha: 0, scaleX: 0.6, duration: 120, onComplete: () => a.destroy() });
}

function emberImpact(scene: Phaser.Scene, to: Pt, heading: number): void {
  const c = COLORS.spell_ember;
  const fire = scene.add.sprite(to.x, to.y - 2, 'fire_burst', 0).setBlendMode(ADD).setDepth(FX + 2);
  fire.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fire.destroy());
  fire.play('fire-burst');
  burst(scene, { x: to.x, y: to.y - 2 }, 'impact_burst', 'impact-burst', EMBER_CORE, 1, heading);
  flash(scene, to, 30, 22, 110);
  glow(scene, to, 0.9, c.main, 340);
  ring(scene, { x: to.x, y: to.y + 4 }, 6, 34, c.hi, 300, 0.5, 2);
  motes(scene, to, 22, c.main, 30, false, 340);
  scene.cameras.main.shake(110, 0.005);
  // Phase 5, dissipation: scorch decal on the ground, embers and smoke rising.
  const ground = { x: to.x, y: to.y + 4 };
  const mark = scene.add.image(ground.x, ground.y, 'scorch').setDepth(ground.y - 3).setAlpha(0);
  scene.tweens.add({ targets: mark, alpha: 0.85, duration: 120 });
  scene.tweens.add({ targets: mark, alpha: 0, delay: 300, duration: SCORCH_FADE_MS, onComplete: () => mark.destroy() });
  rising(scene, ground, 10, [c.hi, c.main, WHITE], 9, 22, 900, 45);
  for (let i = 0; i < 5; i++) {
    const s = scene.add.rectangle(ground.x + (Math.random() - 0.5) * 12, ground.y - 2, 3, 3, SMOKE).setDepth(FX).setAlpha(0);
    scene.tweens.add({
      targets: s, y: s.y - 18, x: s.x + (Math.random() - 0.5) * 8, scale: 1.8, alpha: { from: 0.5, to: 0 },
      delay: 140 + i * 70, duration: 1000, ease: 'Sine.easeOut', onComplete: () => s.destroy(),
    });
  }
}

export function playEmber(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, from: Pt, to: Pt, onImpact: () => void): void {
  const c = COLORS.spell_ember;
  prepare(scene, 'spell_ember', caster, from);
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_ember', { x: to.x, y: to.y + 4 }, SCALE_EMBER, TRAVEL_MS + 120));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    // Phase 3, conjuration: the lance launches from the hand, shedding sparks and afterimages.
    const spear = scene.add.sprite(from.x, from.y, 'ember_lance', 0).play('lance-flicker').setBlendMode(ADD).setDepth(FX + 2);
    spear.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    glow(scene, from, 0.4, c.hi, 180);
    motes(scene, from, 6, c.hi, 8, false, 160);
    let frame = 0;
    scene.tweens.add({
      targets: spear, x: to.x, y: to.y, duration: TRAVEL_MS, ease: 'Quad.easeIn',
      onUpdate: () => {
        if (frame++ % 2 === 0) afterimage(scene, spear, c.main);
        const s = dot(scene, spear.x, spear.y, Math.random() < 0.4 ? 2 : 1, Math.random() < 0.5 ? c.hi : c.main);
        scene.tweens.add({ targets: s, y: s.y + 4 + Math.random() * 5, x: s.x + (Math.random() - 0.5) * 5, alpha: 0, duration: 220 + Math.random() * 120, onComplete: () => s.destroy() });
      },
      onComplete: () => {
        const heading = spear.rotation;
        spear.destroy();
        // Phase 4, impact.
        onImpact();
        emberImpact(scene, to, heading);
      },
    });
  });
}

export function playWard(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: Pt, durationMs: number, onImpact: () => void): WardShield {
  const c = COLORS.spell_ward;
  const center = { x: at.x, y: at.y - 8 };
  prepare(scene, 'spell_ward', caster, { x: at.x, y: at.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_ward', { x: at.x, y: at.y + 2 }, SCALE_WARD, 200));
  const shield = scene.add.sprite(center.x, center.y, 'ward_shield', 0).setBlendMode(ADD).setDepth(FX).setScale(0).setVisible(false);
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onImpact();
    if (!shield.active) return;
    shield.setVisible(true).play('ward-shimmer');
    scene.tweens.add({ targets: shield, scale: 1, duration: 180, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: shield, alpha: 0.7, duration: 500, yoyo: true, repeat: -1, delay: 180, ease: 'Sine.easeInOut' });
    flash(scene, center, 26, 26, 120);
    burst(scene, center, 'impact_burst', 'impact-burst', WARD_CORE, 0.8);
    swirl(scene, center, c.hi, 1, 340);
    glow(scene, center, 0.7, c.hi, 300);
    ring(scene, center, 8, 24, c.hi, 280, 1, 2);
    motes(scene, center, 14, c.main, 18, false, 300);
  });
  scene.time.delayedCall(PREP_MS + CIRCLE_MS + durationMs, () => wardBreak(scene, shield));
  return shield;
}

/** Dissipation of the shield: flash, then hex shards fly out and fall. Safe to call twice. */
export function wardBreak(scene: Phaser.Scene, shield: WardShield): void {
  if (!shield.active) return;
  scene.tweens.killTweensOf(shield);
  if (!shield.visible) {
    shield.destroy();
    return;
  }
  const c = COLORS.spell_ward;
  flash(scene, shield, 30, 30, 120);
  burst(scene, shield, 'impact_burst', 'impact-burst', WARD_CORE, 1);
  ring(scene, shield, 12, 30, c.hi, 240, 1, 2);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const x0 = shield.x + Math.cos(a) * 12, y0 = shield.y + Math.sin(a) * 12;
    const speed = 22 + Math.random() * 18;
    const vx = Math.cos(a) * speed, vy = Math.sin(a) * speed - 16;
    const s = scene.add.rectangle(x0, y0, i % 2 ? 3 : 2, 2, i % 3 ? c.main : c.hi).setBlendMode(ADD).setDepth(FX + 1);
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 420 + Math.random() * 160,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        s.setPosition(Math.round(x0 + vx * t), Math.round(y0 + vy * t + 44 * t * t)).setAlpha(1 - t * t);
      },
      onComplete: () => s.destroy(),
    });
  }
  scene.tweens.add({ targets: shield, scale: 1.3, alpha: 0, duration: 140, onComplete: () => shield.destroy() });
}

export function wardHit(scene: Phaser.Scene, shield: WardShield): void {
  if (!shield.active || !shield.visible) return;
  const c = COLORS.spell_ward;
  ring(scene, shield, 10, 22, c.hi, 220, 1, 1);
  shield.setTintFill(WHITE);
  scene.time.delayedCall(70, () => { if (shield.active) shield.clearTint(); });
  const a = Math.random() * Math.PI * 2;
  for (let i = -2; i <= 2; i++) {
    const t = a + i * 0.12;
    const s = dot(scene, shield.x + Math.cos(t) * 14, shield.y + Math.sin(t) * 14, 2, i ? c.hi : WHITE, FX + 2);
    scene.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
  }
  scene.tweens.add({ targets: shield, scaleX: 1.2, scaleY: 0.85, duration: 60, yoyo: true, onComplete: () => { if (shield.active) shield.setScale(1); } });
}

/** Magnetic field lines: streaks of 3 pixels spiralling inward onto `at`. */
function fieldStreaks(scene: Phaser.Scene, at: Pt, radius: number, head: number, tail: number, n: number, ms: number): void {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r0 = radius * (0.8 + Math.random() * 0.3);
    const parts = [dot(scene, at.x, at.y, 2, head, FX + 2), dot(scene, at.x, at.y, 1, tail), dot(scene, at.x, at.y, 1, tail)].map((p) => p.setAlpha(0));
    scene.tweens.addCounter({
      from: 0, to: 1, duration: ms * (0.85 + Math.random() * 0.3), ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        parts.forEach((p, k) => {
          const tk = Math.max(0, t - k * 0.07);
          const rad = r0 * (1 - tk), ang = a0 + 1.8 * tk;
          p.setPosition(Math.round(at.x + Math.cos(ang) * rad), Math.round(at.y + Math.sin(ang) * rad * 0.7)).setAlpha(Math.min(1, t * 4));
        });
      },
      onComplete: () => parts.forEach((p) => p.destroy()),
    });
  }
}

/** Ring of inward arrows closing on `at`: the frames step the arrows in while the sprite shrinks. */
function pullArrows(scene: Phaser.Scene, at: Pt, radius: number, tint: number, ms: number, delay: number): void {
  const s0 = radius / PULL_ARROW_R;
  const s = scene.add.sprite(at.x, at.y, 'pull_arrows', 0).play('pull-arrows').setBlendMode(ADD).setTint(tint).setScale(s0, s0 * 0.6).setDepth(FX + 1).setAlpha(0);
  scene.tweens.add({ targets: s, alpha: 1, delay, duration: 80 });
  scene.tweens.add({ targets: s, scaleX: s0 * 0.12, scaleY: s0 * 0.12 * 0.6, delay, duration: ms, ease: 'Cubic.easeIn', onComplete: () => s.destroy() });
}

function contractRing(scene: Phaser.Scene, at: Pt, radius: number, color: number, ms: number): void {
  const r = scene.add.circle(at.x, at.y, radius).setStrokeStyle(3, color, 0.95).setFillStyle(color, 0.05).setBlendMode(ADD).setDepth(FX);
  scene.tweens.add({ targets: r, scale: 0.08, alpha: 0.3, duration: ms, ease: 'Cubic.easeIn', onComplete: () => r.destroy() });
}

export function playLodestone(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: Pt, radius: number, onImpact: () => void): void {
  const c = COLORS.spell_lodestone;
  const core = { x: at.x, y: at.y - 8 };
  prepare(scene, 'spell_lodestone', caster, { x: at.x, y: at.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_lodestone', { x: at.x, y: at.y + 2 }, SCALE_LODE, 320));
  // Conjuration: field lines and staggered rings close in; the first ring lands just after the pull.
  scene.time.delayedCall(PREP_MS + 40, () => fieldStreaks(scene, core, radius, c.hi, c.main, 10, CIRCLE_MS + 120));
  scene.time.delayedCall(PREP_MS, () => {
    pullArrows(scene, { x: at.x, y: at.y - 4 }, radius, c.hi, CIRCLE_MS, 0);
    pullArrows(scene, { x: at.x, y: at.y - 4 }, radius * 0.8, c.main, CIRCLE_MS - 60, 60);
  });
  for (let i = 0; i < 3; i++) scene.time.delayedCall(PREP_MS + i * 120, () => contractRing(scene, at, radius * (1 - i * 0.12), i === 1 ? c.hi : c.main, 300));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onImpact();
    // Impact: violet core pulse at the hero.
    flash(scene, core, 20, 20, 140, FX + 3, LODE_DEEP);
    burst(scene, core, 'impact_burst', 'impact-burst', LODE_CORE, 0.85);
    glow(scene, core, 0.8, LODE_DEEP, 420);
    const pulse = scene.add.container(core.x, core.y, [scene.add.rectangle(0, 0, 8, 8, LODE_DEEP), scene.add.rectangle(0, 0, 4, 4, c.main), scene.add.rectangle(0, 0, 2, 2, c.hi)]).setDepth(FX + 3);
    pulse.each((o: Phaser.GameObjects.Rectangle) => o.setBlendMode(ADD));
    scene.tweens.add({ targets: pulse, scale: 1.8, duration: 80, yoyo: true, repeat: 1, onComplete: () => scene.tweens.add({ targets: pulse, alpha: 0, duration: 120, onComplete: () => pulse.destroy() }) });
    fieldStreaks(scene, core, radius * 0.7, c.hi, c.main, 8, 300);
    // Dissipation: a small outward burst along the ground.
    scene.time.delayedCall(200, () => {
      ring(scene, { x: at.x, y: at.y + 2 }, 4, 36, c.main, 380, 0.55, 3);
      motes(scene, core, 14, c.hi, 20, false, 480, 10);
    });
  });
}

/** Buff aura at the caster's feet: follows `at()` for `durationMs`, then fades. */
export function spellAura(scene: Phaser.Scene, spell: 'spell_haste' | 'spell_net', at: () => Pt, durationMs: number): void {
  const c = COLORS[spell];
  const p = at();
  const ring = scene.add.ellipse(p.x, p.y, 26, 12).setStrokeStyle(1, c.main, 0.7).setFillStyle(c.main, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y - 1).setAlpha(0);
  scene.tweens.add({ targets: ring, alpha: 1, duration: 200 });
  scene.tweens.add({ targets: ring, scaleX: 1.15, scaleY: 1.15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  let sparkAt = 0;
  const follow = (time: number) => {
    const q = at();
    ring.setPosition(q.x, q.y).setDepth(q.y - 1);
    if (time - sparkAt < 220) return;
    sparkAt = time;
    motes(scene, { x: q.x, y: q.y - 4 }, 2, spell === 'spell_haste' ? c.hi : c.main, 10, false, 500, 10);
  };
  scene.events.on('update', follow);
  ring.once('destroy', () => scene.events.off('update', follow));
  scene.time.delayedCall(Math.max(0, durationMs - AURA_FADE_MS), () => {
    if (!ring.active) return;
    scene.tweens.killTweensOf(ring);
    scene.tweens.add({ targets: ring, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: AURA_FADE_MS, onComplete: () => ring.destroy() });
  });
}

function playBuff(scene: Phaser.Scene, spell: 'spell_haste' | 'spell_net', caster: Phaser.GameObjects.Sprite, at: () => Pt, durationMs: number, onImpact: () => void): void {
  const c = COLORS[spell];
  const p = at();
  prepare(scene, spell, caster, { x: p.x, y: p.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, spell, { x: p.x, y: p.y + 2 }, SCALE_BUFF, 200));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    const q = at();
    onImpact();
    glow(scene, { x: q.x, y: q.y - 8 }, 0.55, c.hi, 280);
    motes(scene, { x: q.x, y: q.y - 8 }, 14, c.main, 18, false, 320, 6);
    spellAura(scene, spell, at, durationMs);
    if (spell === 'spell_haste') {
      swirl(scene, { x: q.x, y: q.y - 8 }, c.main, 1.15, 460, 0.7);
      swirl(scene, { x: q.x, y: q.y - 2 }, c.hi, 0.8, 380, 0.5, FX);
    }
    scene.time.delayedCall(320, () => motes(scene, { x: q.x, y: q.y - 8 }, 8, c.hi, 10, false, 520, 12));
  });
}

export function playHaste(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: () => Pt, durationMs: number, onImpact: () => void): void {
  playBuff(scene, 'spell_haste', caster, at, durationMs, onImpact);
}

export function playNet(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: () => Pt, durationMs: number, onImpact: () => void): void {
  playBuff(scene, 'spell_net', caster, at, durationMs, onImpact);
}

export function playHarvest(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: Pt, radius: number, piles: Pt[], onImpact: () => void): void {
  const c = COLORS.spell_harvest;
  prepare(scene, 'spell_harvest', caster, { x: at.x, y: at.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_harvest', { x: at.x, y: at.y + 2 }, SCALE_HARVEST, 260));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onImpact();
    const ring = scene.add.circle(at.x, at.y, radius).setStrokeStyle(2, c.main, 0.9).setFillStyle(c.main, 0.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX).setScale(0.08);
    scene.tweens.add({ targets: ring, scale: 1, alpha: 0.15, duration: 360, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    glow(scene, at, 0.5, c.hi, 260);
    piles.forEach((p, i) => scene.time.delayedCall(120 + i * HARVEST_STAGGER_MS, () => {
      glow(scene, { x: p.x, y: p.y - 6 }, 0.45, c.main, 300);
      burst(scene, { x: p.x, y: p.y - 6 }, 'spike_burst', 'spike-burst', c.main, 1);
      motes(scene, { x: p.x, y: p.y - 6 }, 10, c.hi, 14, false, 420, 10);
    }));
  });
}

// ---------------- attack spells: Arco Encadeado, Prensa Magnética, Respingo Ácido ----------------

/** Jagged lightning between two points: a wide main-hue stroke under a 1-px bright core, fading out. */
function lightning(scene: Phaser.Scene, a: Pt, b: Pt, main: number, hi: number, ms = ARC_FADE_MS): void {
  const n = Math.max(3, Math.round(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 9));
  const nx = -(b.y - a.y), ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  const pts: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n, off = (Math.random() - 0.5) * 9;
    pts.push({ x: Math.round(a.x + (b.x - a.x) * t + (nx / len) * off), y: Math.round(a.y + (b.y - a.y) * t + (ny / len) * off) });
  }
  pts.push(b);
  const g = scene.add.graphics().setBlendMode(ADD).setDepth(FX + 2);
  for (const [w, color, alpha] of [[3, main, 0.7], [1, hi, 1]] as const) {
    g.lineStyle(w, color, alpha).beginPath().moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.strokePath();
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
}

function arcImpact(scene: Phaser.Scene, at: Pt, hop: number): void {
  const c = COLORS.spell_arc;
  const k = 1 - hop * 0.15;
  burst(scene, at, 'spike_burst', 'spike-burst', c.main, 0.8 * k);
  burst(scene, at, 'impact_burst', 'impact-burst', c.hi, 0.6 * k);
  flash(scene, at, 18 * k, 18 * k, 90);
  glow(scene, at, 0.5 * k, c.main, 240);
  motes(scene, at, 8, c.hi, 14, false, 260);
}

/** Bolt from the hand to `chain[0]`, then one jump every `ARC_HOP_MS`; `onHop(i)` lands with each hit. */
export function playArc(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, from: Pt, chain: Pt[], onHop: (hop: number) => void): void {
  const c = COLORS.spell_arc;
  const aim = (p: Pt): Pt => ({ x: p.x, y: p.y - 4 });
  prepare(scene, 'spell_arc', caster, from);
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_arc', { x: chain[0].x, y: chain[0].y + 4 }, SCALE_ARC, TRAVEL_MS + chain.length * ARC_HOP_MS));
  for (let f = 0; f < ARC_FLICKERS; f++) {
    scene.time.delayedCall(PREP_MS + CIRCLE_MS + (f * TRAVEL_MS) / ARC_FLICKERS, () => lightning(scene, from, aim(chain[0]), c.main, c.hi, TRAVEL_MS / ARC_FLICKERS + 40));
  }
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => glow(scene, from, 0.4, c.hi, 180));
  chain.forEach((t, hop) => scene.time.delayedCall(PREP_MS + CIRCLE_MS + TRAVEL_MS + hop * ARC_HOP_MS, () => {
    lightning(scene, hop > 0 ? aim(chain[hop - 1]) : from, aim(t), c.main, c.hi);
    onHop(hop);
    arcImpact(scene, aim(t), hop);
    if (hop === 0) scene.cameras.main.shake(80, 0.003);
  }));
}

/** Rune circle at `at`; the field drags enemies in (`onPull`), then the jaws slam shut (`onImpact`). */
export function playCrush(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, hand: Pt, at: Pt, radius: number, onPull: () => void, onImpact: () => void): void {
  const c = COLORS.spell_crush;
  const core = { x: at.x, y: at.y - 6 };
  prepare(scene, 'spell_crush', caster, hand);
  scene.time.delayedCall(PREP_MS, () => {
    runeCircle(scene, 'spell_crush', { x: at.x, y: at.y + 2 }, (radius * 2) / RUNE_PX, CRUSH_MS + 120);
    pullArrows(scene, core, radius, c.hi, CIRCLE_MS + CRUSH_MS, 0);
    contractRing(scene, at, radius, c.main, CIRCLE_MS + CRUSH_MS);
  });
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onPull();
    fieldStreaks(scene, core, radius, c.hi, c.main, 12, CRUSH_MS);
    contractRing(scene, at, radius * 0.8, c.hi, CRUSH_MS);
  });
  scene.time.delayedCall(PREP_MS + CIRCLE_MS + CRUSH_MS, () => {
    onImpact();
    flash(scene, core, 34, 24, 120);
    burst(scene, core, 'spike_burst', 'spike-burst', c.main, 1.5);
    burst(scene, core, 'impact_burst', 'impact-burst', c.hi, 1.1);
    glow(scene, core, 1, c.main, 380);
    ring(scene, { x: at.x, y: at.y + 2 }, 6, radius * 0.7, c.hi, 320, 0.5, 3);
    motes(scene, core, 18, c.main, 26, false, 380, 6);
    scene.cameras.main.shake(140, 0.007);
  });
}

/** Acid glob lobbed from the hand; on landing it splashes (`onImpact`) and leaves a bubbling puddle for `puddleMs`. */
export function playAcid(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, from: Pt, to: Pt, radius: number, puddleMs: number, onImpact: () => void): void {
  const c = COLORS.spell_acid;
  const ground = { x: to.x, y: to.y + 4 };
  prepare(scene, 'spell_acid', caster, from);
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_acid', ground, SCALE_ACID, TRAVEL_MS + 120));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    const glob = scene.add.container(from.x, from.y, [
      scene.add.rectangle(0, 0, 6, 6, c.main), scene.add.rectangle(-1, -1, 3, 3, c.hi), scene.add.rectangle(-1, -1, 1, 1, WHITE),
    ]).setDepth(FX + 2);
    glob.each((o: Phaser.GameObjects.Rectangle) => o.setBlendMode(ADD));
    glow(scene, from, 0.35, c.hi, 160);
    scene.tweens.addCounter({
      from: 0, to: 1, duration: TRAVEL_MS, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        glob.setPosition(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * ACID_LOB));
        const d = dot(scene, glob.x, glob.y, 1, Math.random() < 0.5 ? c.main : c.hi);
        scene.tweens.add({ targets: d, y: d.y + 6, alpha: 0, duration: 200, onComplete: () => d.destroy() });
      },
      onComplete: () => {
        glob.destroy();
        onImpact();
        acidSplash(scene, to, radius);
        acidPuddle(scene, ground, radius, puddleMs);
      },
    });
  });
}

function acidSplash(scene: Phaser.Scene, at: Pt, radius: number): void {
  const c = COLORS.spell_acid;
  flash(scene, at, 26, 18, 110);
  burst(scene, at, 'impact_burst', 'impact-burst', c.main, 0.9);
  glow(scene, at, 0.8, c.main, 320);
  ring(scene, { x: at.x, y: at.y + 4 }, 4, radius, c.hi, 300, 0.5, 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 20 + Math.random() * 16;
    const x0 = at.x, y0 = at.y, vx = Math.cos(a) * speed, vy = Math.sin(a) * speed * 0.6 - 22;
    const s = scene.add.rectangle(x0, y0, 2, 2, i % 3 ? c.main : c.hi).setBlendMode(ADD).setDepth(FX + 1);
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 380 + Math.random() * 120,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        s.setPosition(Math.round(x0 + vx * t), Math.round(y0 + vy * t + 50 * t * t)).setAlpha(1 - t * t);
      },
      onComplete: () => s.destroy(),
    });
  }
}

/** Corrosive puddle: normal blend so the green stays readable, bubbles popping until it dries. */
function acidPuddle(scene: Phaser.Scene, at: Pt, radius: number, ms: number): void {
  const c = COLORS.spell_acid;
  const pool = scene.add.ellipse(at.x, at.y, radius * 2, radius * 2 * GROUND_FLAT, c.main, 0.42).setStrokeStyle(1, ACID_INK, 0.9).setDepth(at.y - 3).setScale(0.2);
  const sheen = scene.add.ellipse(at.x - radius * 0.2, at.y - 2, radius * 0.8, radius * 0.25, c.hi, 0.35).setDepth(at.y - 2).setAlpha(0);
  scene.tweens.add({ targets: pool, scale: 1, duration: 160, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: sheen, alpha: 0.5, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const bubbles = scene.time.addEvent({
    delay: ACID_BUBBLE_MS, loop: true,
    callback: () => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius * 0.8;
      rising(scene, { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r * GROUND_FLAT }, 1, [Math.random() < 0.5 ? c.hi : WHITE], 1, 8, 400, 0);
    },
  });
  scene.time.delayedCall(ms, () => {
    bubbles.remove();
    scene.tweens.killTweensOf(sheen);
    scene.tweens.add({ targets: [pool, sheen], alpha: 0, scaleX: 1.1, duration: 360, onComplete: () => { pool.destroy(); sheen.destroy(); } });
  });
}

/** Cobalto's rune bolt (its own attack and the Resonance echo). */
export function runeBolt(scene: Phaser.Scene, from: Pt, to: Pt, onImpact: () => void): void {
  const b = scene.add.sprite(from.x, from.y, 'rune_bolt', 0).play('bolt-flicker').setBlendMode(Phaser.BlendModes.ADD).setDepth(FX + 2);
  const ms = Math.max(90, Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) * 1.6);
  scene.tweens.add({
    targets: b, x: to.x, y: to.y, duration: ms, ease: 'Linear',
    onComplete: () => {
      b.destroy();
      onImpact();
      burst(scene, to, 'impact_burst', 'impact-burst', COLORS.spell_lodestone.hi, 0.4, Math.atan2(to.y - from.y, to.x - from.x));
      glow(scene, to, 0.35, COLORS.spell_lodestone.main, 200);
      motes(scene, to, 6, COLORS.spell_lodestone.hi, 10, false, 240);
    },
  });
}

/** Guardian stomp: a short flat shockwave. */
export function stomp(scene: Phaser.Scene, at: Pt, radius: number): void {
  const ring = scene.add.ellipse(at.x, at.y, radius * 2, radius).setStrokeStyle(2, 0x4a74b8, 0.9).setDepth(at.y - 1).setScale(0.2);
  scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  motes(scene, at, 8, 0xb8a88a, radius * 0.6, false, 260);
}

/** A discovery sparkle above a found object. */
export function discoveryBurst(scene: Phaser.Scene, at: Pt): void {
  glow(scene, at, 0.8, 0xe8d8ff, 500);
  motes(scene, at, 20, 0xb48ae6, 26, false, 600, 10);
}
