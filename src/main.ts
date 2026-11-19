import '@fontsource/pixelify-sans/400.css';
import './ui/styles.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ExtractionScene } from './scenes/ExtractionScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { grantXp, levelOf } from './core/level';
import { MANA_LEVEL_CAP, MANA_PER_LEVEL } from './core/mana';
import { session } from './session';
import { bindTravel, travelToArea } from './travel';
import { closePanel, onAfkStart, panelOpen, toast, togglePanel } from './ui/ui';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1a24',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: 'arcade', arcade: { debug: false } },
  // Keep the loop alive as long as the browser allows; AFK math never depends on it.
  fps: { forceSetTimeOut: false },
  disableContextMenu: true,
  scene: [BootScene, TitleScene, WorldScene, ExtractionScene],
});

bindTravel(game);

session.onLevelUp((level) => toast(level <= MANA_LEVEL_CAP ? `Nível ${level}! +${MANA_PER_LEVEL} de mana máxima.` : `Nível ${level}!`, 'loot'));

onAfkStart((areaId) => {
  if (session.startAfk(areaId)) return;
  closePanel();
  game.scene.stop('World');
  game.scene.start('Extraction');
});

window.addEventListener('keydown', (e) => {
  const inWorld = game.scene.isActive('World');
  if (e.key === 'Escape') closePanel();
  if ((e.key === 't' || e.key === 'T') && inWorld && !e.repeat) session.toggleAuto();
  if ((e.key === 'i' || e.key === 'I') && inWorld && document.getElementById('modal')!.hidden) togglePanel('inventory');
  if ((e.key === 'm' || e.key === 'M') && inWorld && !e.repeat && document.getElementById('modal')!.hidden) togglePanel('map');
  if ((e.key === 'o' || e.key === 'O') && inWorld && !e.repeat && document.getElementById('modal')!.hidden) togglePanel('workshop');
  const toolIds = ['tool_wrench_old', 'tool_wrench_reinforced', 'tool_hydraulic_pry'] as const;
  const key = Number(e.key);
  if (inWorld && !panelOpen() && key >= 1 && key <= toolIds.length) window.dispatchEvent(new CustomEvent('scrapo:tool', { detail: toolIds[key - 1] }));
});

if (import.meta.env.DEV) {
  Object.assign(window, {
    __scrapo: {
      session,
      game,
      warp: (mapId: 'patio' | 'yard' | 'dungeon', entry = 'default') => {
        game.scene.stop('Title');
        game.scene.stop('Extraction');
        game.scene.start('World', { mapId, entry });
      },
      travel: travelToArea,
      world: () => game.scene.getScene('World'),
      ferro: () => (game.scene.getScene('World') as unknown as { ferro: unknown }).ferro,
      level: () => levelOf(session.state),
      grantXp: (amount: number) => {
        let gained = 0;
        session.mutate((s) => { gained = grantXp(s, amount); });
        return gained;
      },
    },
  });
}
