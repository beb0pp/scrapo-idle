import { HERO_GEAR, gearTexture } from '../art/heroGear';
import Phaser from 'phaser';
import { buildFerroArt } from '../art/ferroArt';
import { buildEnemyArt } from '../art/enemyArt';
import { buildSprites } from '../art/sprites';
import { initFerroHud } from '../ui/ferroHud';
import { initHud, initPanels } from '../ui/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('tiles', 'tiles/scrapo-tiles.png');
    this.load.spritesheet('hero', 'sprites/hero.png', { frameWidth: 64, frameHeight: 72 });
    this.load.spritesheet('robodog', 'sprites/dog.png', { frameWidth: 32, frameHeight: 34 });
    this.load.spritesheet('drone', 'sprites/drone.png', { frameWidth: 24, frameHeight: 22 });
    for (const id of HERO_GEAR) this.load.spritesheet(gearTexture(id), `sprites/gear/${id}.png`, { frameWidth: 64, frameHeight: 72 });
    this.load.image('drone-icon', 'sprites/drone-icon.png');
    for (const id of ['patio', 'yard', 'dungeon']) this.load.tilemapTiledJSON(id, `maps/${id}.json`);
  }

  create(): void {
    buildSprites(this);
    buildFerroArt(this);
    buildEnemyArt(this);
    initHud();
    initFerroHud();
    initPanels();
    this.scene.start('Title');
  }
}
