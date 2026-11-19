import Phaser from 'phaser';
import { buildEnemyArt } from '../art/enemyArt';
import { buildSprites } from '../art/sprites';
import { initHud, initPanels } from '../ui/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('tiles', 'tiles/scrapo-tiles.png');
    this.load.spritesheet('hero', 'sprites/hero.png', { frameWidth: 64, frameHeight: 72 });
    this.load.spritesheet('robodog', 'sprites/dog.png', { frameWidth: 32, frameHeight: 34 });
    for (const id of ['patio', 'yard', 'dungeon']) this.load.tilemapTiledJSON(id, `maps/${id}.json`);
  }

  create(): void {
    buildSprites(this);
    buildEnemyArt(this);
    initHud();
    initPanels();
    this.scene.start('Title');
  }
}
