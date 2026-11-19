import Phaser from 'phaser';
import { session } from '../session';
import { modal, showHud } from '../ui/ui';

const INTRO = [
  'Quando a colônia foi evacuada, as máquinas receberam uma última ordem: manter o pátio funcionando.',
  'Décadas depois, os guindastes ainda trabalham — e tratam visitantes como sucata fora do lugar.',
  'Você chega ao Pátio Zero com uma chave inglesa e um drone quebrado.',
  'Sob os destroços do primeiro vagão, alguma coisa ainda pulsa.',
];

const CONTROLS = `
  <div class="control-card">
    <div class="control-group"><h2>Mouse</h2><p><b class="mouse-key left">◐</b><span>Clique no chão: caminhe. Segure e arraste para continuar.</span></p><p><b class="mouse-key left">◐</b><span>Inimigo: persiga e ataque. Pilha, NPC, oficina ou terminal: vá e use.</span></p><p><b class="mouse-key right">◑</b><span>Botão direito: investida em direção ao cursor.</span></p><p><b class="mouse-key wheel">↕</b><span>Roda: zoom.</span></p></div>
    <div class="control-group"><h2>Movimento</h2><p><b class="key-cap">← ↑ ↓ →</b><span>Setas também movem.</span></p><p><b class="key-cap">F</b><span>Interagir</span></p><p><b class="key-cap">I</b><span>Inventário</span></p><p><b class="key-cap">Esc</b><span>Fechar painel</span></p></div>
    <div class="control-group abilities"><h2>Combate</h2><p><b class="key-cap">Q</b><span>Pulso Magnético — puxa inimigos leves.</span></p><p><b class="key-cap">W</b><span>Arco Elétrico — salta entre alvos.</span></p><p><b class="key-cap">E</b><span>Investida Hidráulica — rompe o ímã e interrompe golpes.</span></p><p><b class="key-cap">R</b><span>Sobrecarga do drone — requer o drone.</span></p><p><b class="key-cap wide">Espaço</b><span>Ataque com a chave inglesa.</span></p></div>
  </div>`;

export class TitleScene extends Phaser.Scene {
  private titleRoot: HTMLElement | null = null;
  private titleKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super('Title');
  }

  create(): void {
    showHud(false);
    const map = this.make.tilemap({ key: 'yard' });
    const ts = map.addTilesetImage('scrapo', 'tiles')!;
    map.createLayer('terrain', ts, 0, 0);
    map.createLayer('objects', ts, 0, 0);
    const cam = this.cameras.main;
    cam.setZoom(Math.max(1, Math.floor(Math.min(this.scale.width / 640, this.scale.height / 360))));
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.centerOn(200, 300);
    this.tweens.add({ targets: cam, scrollX: '+=500', scrollY: '-=120', duration: 60000, yoyo: true, repeat: -1 });
    this.add.rectangle(0, 0, map.widthInPixels, map.heightInPixels, 0x1b1a24, 0.45).setOrigin(0).setDepth(10);
    this.showMenu();
  }

  private showMenu(): void {
    this.clearTitleScreen();
    const s = session.state;
    const hasProgress = s.stats.searches > 0 || !!s.flags.intro_seen;
    const root = this.createTitleScreen('title-menu');
    root.innerHTML = `
      <main class="title-menu-card">
        <p class="title-kicker">FERRO-VELHO DA COLÔNIA</p>
        <h1 class="scrapo-logo" aria-label="Scrapo">SCRAPO</h1>
        <p class="title-tagline">Explore, lute e reconstrua sob as máquinas que nunca receberam ordem para parar.</p>
        ${s.afk ? '<p class="title-pending">Extração encerrada esperando recolhimento.</p>' : ''}
        <div class="title-actions">
          <button class="primary title-play" type="button">${hasProgress ? 'Continuar' : 'Jogar'}</button>
          ${hasProgress ? '<button class="title-reset" type="button">Apagar progresso</button>' : ''}
        </div>
        <p class="title-save">Progresso salvo neste navegador</p>
      </main>`;
    root.querySelector('.title-play')?.addEventListener('click', () => this.enter());
    root.querySelector('.title-reset')?.addEventListener('click', () => this.confirmReset());
    this.bindTitleKeys(() => this.enter());
    (root.querySelector('.title-play') as HTMLButtonElement | null)?.focus();
  }

  private confirmReset(): void {
    this.clearTitleScreen();
    modal('<h1>Apagar progresso?</h1><p>Inventário, drone, créditos e extração em andamento serão perdidos.</p>', [
      { label: 'Cancelar', onClick: () => this.showMenu() },
      { label: 'Apagar', primary: true, onClick: () => (session.reset(), this.showMenu()) },
    ]);
  }

  private enter(): void {
    this.clearTitleScreen();
    if (session.state.afk) {
      this.scene.start('Extraction');
      return;
    }
    if (session.state.flags.intro_seen) {
      this.scene.start('World', { mapId: 'patio', entry: 'default' });
      return;
    }
    this.showIntroCard(0);
  }

  private showIntroCard(index: number): void {
    this.clearTitleScreen();
    const isControls = index === INTRO.length;
    const root = this.createTitleScreen('title-intro');
    const total = INTRO.length + 1;
    const advance = () => isControls ? this.startWorld() : this.showIntroCard(index + 1);
    root.innerHTML = `
      <main class="story-card ${isControls ? 'story-controls' : ''}">
        <div class="story-progress" aria-label="Parte ${index + 1} de ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i <= index ? 'active' : ''}"></i>`).join('')}</div>
        <p class="story-label">${isControls ? 'SOBREVIVA AO PÁTIO' : 'TRANSMISSÃO RECUPERADA'}</p>
        ${isControls ? CONTROLS : `<p class="story-line">${INTRO[index]}</p>`}
        <div class="story-actions"><button class="story-skip" type="button">Pular</button><button class="primary story-next" type="button">${isControls ? 'Começar' : 'Avançar'} <span aria-hidden="true">›</span></button></div>
        <p class="story-hint">Clique ou pressione Enter / Espaço para avançar</p>
      </main>`;
    root.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).closest('button')) advance();
    });
    root.querySelector('.story-next')?.addEventListener('click', advance);
    root.querySelector('.story-skip')?.addEventListener('click', () => this.startWorld());
    this.bindTitleKeys(advance);
    (root.querySelector('.story-next') as HTMLButtonElement | null)?.focus();
  }

  private startWorld(): void {
    this.clearTitleScreen();
    session.mutate((st) => (st.flags.intro_seen = true));
    this.scene.start('World', { mapId: 'patio', entry: 'default' });
  }

  private createTitleScreen(kind: string): HTMLElement {
    const root = document.createElement('section');
    root.className = `title-screen ${kind}`;
    root.setAttribute('aria-label', kind === 'title-menu' ? 'Menu principal' : 'Introdução');
    document.getElementById('app')?.append(root);
    this.titleRoot = root;
    return root;
  }

  private bindTitleKeys(onAdvance: () => void): void {
    this.titleKeyHandler = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onAdvance();
    };
    document.addEventListener('keydown', this.titleKeyHandler);
  }

  private clearTitleScreen(): void {
    if (this.titleKeyHandler) document.removeEventListener('keydown', this.titleKeyHandler);
    this.titleKeyHandler = null;
    this.titleRoot?.remove();
    this.titleRoot = null;
  }
}
