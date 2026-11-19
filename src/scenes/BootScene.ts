import Phaser from 'phaser';
import { buildFerroArt } from '../art/ferroArt';
import { buildSprites } from '../art/sprites';
import { initFerroHud } from '../ui/ferroHud';
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
    buildFerroArt(this);
    initHud();
    initFerroHud();
    initPanels();
    this.scene.start('Title');
  }
}
