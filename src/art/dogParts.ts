import Phaser from 'phaser';
import { levelOf } from '../core/level';
import { slotOf } from '../core/spells';
import type { GameState } from '../core/state';

/** Ferrugem overlays baked by tools/bake-sprites.py (public/sprites/dog-<part>.png, 9 frames like the dog). */
export const DOG_PARTS = ['hunter', 'collector', 'veteran'] as const;
export type DogPart = (typeof DOG_PARTS)[number];

export const dogPartTexture = (part: DogPart) => `dog_${part}`;
const VETERAN_LEVEL = 5;

/** Role in the party (front = Caçador, back = Coletor) plus brass plating from level 5. */
export function dogPartsFor(state: GameState): DogPart[] {
  const parts: DogPart[] = [];
  const slot = slotOf(state, 'ferrugem');
  if (slot === 'front') parts.push('hunter');
  if (slot === 'back') parts.push('collector');
  if (levelOf(state).level >= VETERAN_LEVEL) parts.push('veteran');
  return parts;
}

/** Overlays that copy the dog sprite's transform and frame every frame; returns a remover. */
export function attachDogParts(scene: Phaser.Scene, dog: Phaser.GameObjects.Sprite, parts: DogPart[]): () => void {
  const layers = parts.map((part) => scene.add.sprite(dog.x, dog.y, dogPartTexture(part), 0));
  const follow = () => {
    if (!dog.active) return;
    layers.forEach((l, i) => l.setPosition(dog.x, dog.y).setOrigin(dog.originX, dog.originY).setScale(dog.scaleX, dog.scaleY)
      .setFlipX(dog.flipX).setFrame(dog.frame.name).setDepth(dog.depth + 0.01 * (i + 1)).setAlpha(dog.alpha));
  };
  follow();
  scene.events.on('postupdate', follow);
  const remove = () => {
    scene.events.off('postupdate', follow);
    layers.forEach((l) => l.destroy());
  };
  dog.once('destroy', remove);
  return remove;
}
