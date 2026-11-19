import Phaser from 'phaser';
import { buildSprites } from '../art/sprites';
import { initHud, initPanels } from '../ui/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('tiles', 'tiles/scrapo-tiles.png');
    for (const id of ['patio', 'yard', 'dungeon']) this.load.tilemapTiledJSON(id, `maps/${id}.json`);
  }

  create(): void {
    buildSprites(this);
    initHud();
    initPanels();
    this.scene.start('Title');
  }
}
