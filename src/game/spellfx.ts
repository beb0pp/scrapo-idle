import Phaser from 'phaser';
import type { SpellId } from '../data/ferromancy';

// Five-phase spell animation: preparation → rune circle → conjuration → impact → dissipation.
// Visual only: the caller passes `onImpact`, fired on the exact impact frame, so damage lands with the flash.

export interface Pt { x: number; y: number }

const FX = 7004;
export const PREP_MS = 180;
export const CIRCLE_MS = 220;
const TRAVEL_MS = 140;
export const IMPACT_DELAY: Record<SpellId, number> = {
  spell_ember: PREP_MS + CIRCLE_MS + TRAVEL_MS,
  spell_ward: PREP_MS + CIRCLE_MS,
  spell_lodestone: PREP_MS + CIRCLE_MS,
};

const COLORS: Record<SpellId, { main: number; hi: number; rune: string; anim: string }> = {
  spell_ember: { main: 0xf08a3a, hi: 0xffd27a, rune: 'rune_ember', anim: 'rune-ember-spin' },
  spell_ward: { main: 0x5fd0d8, hi: 0xb8f4f6, rune: 'rune_ward', anim: 'rune-ward-spin' },
  spell_lodestone: { main: 0xb48ae6, hi: 0xe8d8ff, rune: 'rune_lode', anim: 'rune-lode-spin' },
};

function glow(scene: Phaser.Scene, at: Pt, scale: number, tint: number, ms: number, alpha = 0.85): void {
  const g = scene.add.image(at.x, at.y, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha).setDepth(FX);
  scene.tweens.add({ targets: g, alpha: 0, scale: scale * 1.7, duration: ms, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}

/** Pixel motes: inward (gather) or outward (burst / dissipate). */
function motes(scene: Phaser.Scene, at: Pt, n: number, tint: number, radius: number, inward: boolean, ms: number, rise = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const far = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius * 0.6 };
    const from = inward ? far : at;
    const to = inward ? at : { x: far.x, y: far.y - rise };
    const m = scene.add.rectangle(from.x, from.y, i % 4 ? 1 : 2, i % 4 ? 1 : 2, i % 3 ? tint : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX + 1);
    scene.tweens.add({ targets: m, x: to.x, y: to.y, alpha: inward ? 1 : 0, duration: ms * (0.75 + Math.random() * 0.4), ease: inward ? 'Quad.easeIn' : 'Cubic.easeOut', onComplete: () => m.destroy() });
  }
}

/** Ground rune circle: grows in, spins, then shrinks and fades during dissipation. */
function runeCircle(scene: Phaser.Scene, spell: SpellId, at: Pt, scale: number, holdMs: number): void {
  const c = COLORS[spell];
  const circle = scene.add.sprite(at.x, at.y, c.rune, 0).play(c.anim).setBlendMode(Phaser.BlendModes.ADD).setDepth(at.y - 1).setScale(0.1).setAlpha(0);
  scene.tweens.add({ targets: circle, scale, alpha: 0.95, duration: CIRCLE_MS, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: circle, scale: scale * 0.6, alpha: 0, delay: CIRCLE_MS + holdMs, duration: 380, ease: 'Quad.easeIn',
    onComplete: () => circle.destroy(),
  });
}

/** Phase 1, preparation: motes converge on the caster's hand while the body winds up. */
function prepare(scene: Phaser.Scene, spell: SpellId, caster: Phaser.GameObjects.Sprite, hand: Pt): void {
  const c = COLORS[spell];
  const base = (caster.getData('baseScale') as number | undefined) ?? 1;
  scene.tweens.add({ targets: caster, scaleX: base * 0.9, scaleY: base * 1.1, duration: PREP_MS / 2, yoyo: true, ease: 'Quad.easeOut', onComplete: () => caster.setScale(base) });
  motes(scene, hand, 10, c.main, 18, true, PREP_MS);
  glow(scene, hand, 0.25, c.hi, PREP_MS + 80, 0.6);
}

export function playEmber(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, from: Pt, to: Pt, onImpact: () => void): void {
  const c = COLORS.spell_ember;
  prepare(scene, 'spell_ember', caster, from);
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_ember', { x: to.x, y: to.y + 4 }, 0.8, TRAVEL_MS + 120));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    // Phase 3, conjuration: the spear launches from the hand.
    const spear = scene.add.sprite(from.x, from.y, 'ember_spear', 0).play('ember-flicker').setBlendMode(Phaser.BlendModes.ADD).setDepth(FX + 2);
    spear.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    glow(scene, from, 0.3, c.hi, 160);
    scene.tweens.add({
      targets: spear, x: to.x, y: to.y, duration: TRAVEL_MS, ease: 'Quad.easeIn',
      onUpdate: () => { if (Math.random() < 0.6) motes(scene, spear, 1, c.main, 3, false, 160, 4); },
      onComplete: () => {
        spear.destroy();
        // Phase 4, impact.
        onImpact();
        glow(scene, to, 0.7, c.main, 260);
        glow(scene, to, 0.35, 0xffffff, 140);
        motes(scene, to, 16, c.main, 26, false, 300);
        scene.cameras.main.shake(70, 0.003);
        // Phase 5, dissipation: embers drift up and fade.
        motes(scene, to, 8, c.hi, 12, false, 600, 14);
      },
    });
  });
}

export function playWard(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: Pt, durationMs: number, onImpact: () => void): Phaser.GameObjects.Arc {
  const c = COLORS.spell_ward;
  prepare(scene, 'spell_ward', caster, { x: at.x, y: at.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_ward', { x: at.x, y: at.y + 2 }, 0.75, 200));
  const bubble = scene.add.circle(at.x, at.y - 8, 14).setStrokeStyle(2, c.main, 0.9).setFillStyle(c.main, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX).setScale(0).setVisible(false);
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onImpact();
    bubble.setVisible(true);
    scene.tweens.add({ targets: bubble, scale: 1, duration: 160, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: bubble, alpha: 0.55, duration: 420, yoyo: true, repeat: -1, delay: 160 });
    glow(scene, { x: at.x, y: at.y - 8 }, 0.55, c.hi, 260);
    motes(scene, { x: at.x, y: at.y - 8 }, 12, c.main, 16, false, 260);
  });
  scene.time.delayedCall(PREP_MS + CIRCLE_MS + durationMs, () => wardBreak(scene, bubble));
  return bubble;
}

/** Dissipation of the shield: shatter into cyan motes. Safe to call twice. */
export function wardBreak(scene: Phaser.Scene, bubble: Phaser.GameObjects.Arc): void {
  if (!bubble.active) return;
  motes(scene, bubble, 14, COLORS.spell_ward.main, 18, false, 420, 8);
  scene.tweens.killTweensOf(bubble);
  scene.tweens.add({ targets: bubble, scale: 1.4, alpha: 0, duration: 220, onComplete: () => bubble.destroy() });
}

export function wardHit(scene: Phaser.Scene, bubble: Phaser.GameObjects.Arc): void {
  if (!bubble.active) return;
  glow(scene, bubble, 0.4, COLORS.spell_ward.hi, 160);
  scene.tweens.add({ targets: bubble, scaleX: 1.2, scaleY: 0.85, duration: 60, yoyo: true });
}

export function playLodestone(scene: Phaser.Scene, caster: Phaser.GameObjects.Sprite, at: Pt, radius: number, onImpact: () => void): void {
  const c = COLORS.spell_lodestone;
  prepare(scene, 'spell_lodestone', caster, { x: at.x, y: at.y - 10 });
  scene.time.delayedCall(PREP_MS, () => runeCircle(scene, 'spell_lodestone', { x: at.x, y: at.y + 2 }, 1.1, 260));
  scene.time.delayedCall(PREP_MS + CIRCLE_MS, () => {
    onImpact();
    // A contracting ring reads as "pull everything toward me".
    const ring = scene.add.circle(at.x, at.y, radius).setStrokeStyle(2, c.main, 0.9).setFillStyle(c.main, 0.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(FX);
    scene.tweens.add({ targets: ring, scale: 0.08, alpha: 0.2, duration: 360, ease: 'Cubic.easeIn', onComplete: () => ring.destroy() });
    motes(scene, at, 22, c.main, radius * 0.7, true, 380);
    scene.time.delayedCall(380, () => {
      glow(scene, at, 0.6, c.hi, 300);
      motes(scene, at, 10, c.hi, 14, false, 520, 12);
    });
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
