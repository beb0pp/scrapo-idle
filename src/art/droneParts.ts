import Phaser from 'phaser';
import { owns } from '../core/progression';
import type { GameState } from '../core/state';

/** Attachment overlays baked by tools/bake-drone.py (public/sprites/drone-<part>.png, 4 frames like the hull). */
export const DRONE_PARTS = ['claw', 'magnet', 'cargo', 'servos', 'bay'] as const;
export type DronePart = (typeof DRONE_PARTS)[number];

export const dronePartTexture = (part: DronePart) => `drone_${part}`;

/** Which attachments the saved state shows: module, cargo upgrade and the Ferromancia drone nodes. */
export function dronePartsFor(state: GameState): DronePart[] {
  const parts: DronePart[] = [];
  if (state.equipped.module === 'mod_claw') parts.push('claw');
  if (state.equipped.module === 'mod_magnet') parts.push('magnet');
  if (state.equipped.upgrade === 'mod_cargo') parts.push('cargo');
  if (owns(state, 'b_drone_servos')) parts.push('servos');
  if (owns(state, 'b_drone_bay')) parts.push('bay');
  return parts;
}

/** Adds the attachments on top of a drone sprite; they follow its position and frame until it is destroyed. */
export function attachDroneParts(scene: Phaser.Scene, drone: Phaser.GameObjects.Sprite, state: GameState): Phaser.GameObjects.Sprite[] {
  const parts = dronePartsFor(state).map((part) => scene.add.sprite(drone.x, drone.y, dronePartTexture(part), 0));
  const follow = () => {
    if (!drone.active) return;
    parts.forEach((p, i) => p.setPosition(drone.x, drone.y).setFrame(drone.frame.name).setFlipX(drone.flipX).setDepth(drone.depth + 0.01 * (i + 1)));
  };
  follow();
  scene.events.on('postupdate', follow);
  drone.once('destroy', () => {
    scene.events.off('postupdate', follow);
    parts.forEach((p) => p.destroy());
  });
  return parts;
}
