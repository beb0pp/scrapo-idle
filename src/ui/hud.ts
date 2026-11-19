import { ITEMS } from '../data/items';
import { computeProgress } from '../core/afk';
import { AFK_AREAS } from '../data/areas';
import { session } from '../session';
import { $, esc, icon } from './shared';
import { closeMapView, openMapView } from './minimap';

export interface HudFrame {
  area: string;
  cooldowns: number[];
  prompt: string | null;
  boss: { hp: number; max: number } | null;
}

let skillHandler: (index: number) => void = () => {};

export function onSkillClick(handler: (index: number) => void): void {
  skillHandler = handler;
}

export function initHud(): void {
  $('hud').innerHTML = `
    <div class="hud-top">
      <div id="area" class="area"></div>
      <div class="hp" aria-label="Vida"><span class="hp-medallion" aria-hidden="true"><span class="hp-heart">♥</span></span><div class="bar hp-bar"><i id="hp-fill"></i></div><span id="hp-num"></span></div>
      <div class="money"><span id="money"></span> cr</div>
      <button id="settings" aria-label="Configurações">⚙</button>
    </div>
    <div id="objective" class="objective"></div>
    <aside id="world-side" class="world-side">
      <section class="world-card minimap-card"><h3>Minimapa</h3><canvas id="minimap" width="216" height="144"></canvas></section>
      <section id="extraction-card" class="world-card"></section>
      <section id="recent-finds" class="world-card"></section>
    </aside>
    <div id="map-view" hidden><div id="map-view-card"><div id="map-view-head"><h2>Mapa regional</h2><button id="map-close">Esc ✕</button></div><canvas id="map-view-canvas" width="720" height="480"></canvas><div class="map-legend"><span>Entrada</span><span>Extração</span><span>NPC</span><span>Chefe</span><span>Pilha</span></div></div></div>
    <div class="hud-bottom">
      <button class="skill inv" data-open="inventory"><b>I</b><span>Mochila</span></button>
      <button class="skill auto-btn" id="auto-btn" title="Modo automático: luta, desmonta sucata e recolhe sozinho (T)"><b>T</b><span>Auto</span></button>
      ${['Pulso', 'Arco', 'Investida', 'Drone'].map((name, index) => `<button class="skill" data-skill="${index}"><b>${'QWER'[index]}</b><span>${name}</span><i class="cd" id="cd${index}"></i></button>`).join('')}
      <div id="tool-hotbar" class="tool-hotbar"></div>
      <button class="skill" data-open="vendor"><b>$</b><span>Mercado</span></button>
    </div>
    <div id="drone-badge" class="drone-badge"></div>`;
  $('hud').addEventListener('click', handleHudClick);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMapView(); });
  session.onChange(refreshHud);
  session.onAutoChange((on) => $('auto-btn').classList.toggle('is-on', on));
  refreshHud();
}

export function showHud(visible: boolean): void {
  $('hud').hidden = !visible;
  if (!visible) { $('prompt').hidden = true; $('boss').hidden = true; }
}

function handleHudClick(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('.minimap-card')) {
    openMapView();
    return;
  }
  const button = (event.target as HTMLElement).closest('button');
  if (!button) return;
  if (button.dataset.skill) skillHandler(Number(button.dataset.skill));
  if (button.dataset.open) window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: button.dataset.open }));
  if (button.dataset.tool) window.dispatchEvent(new CustomEvent('scrapo:tool', { detail: button.dataset.tool }));
  if (button.id === 'settings') window.dispatchEvent(new CustomEvent('scrapo:panel', { detail: 'settings' }));
  if (button.id === 'map-close') closeMapView();
  if (button.id === 'auto-btn') session.toggleAuto();
}

export function refreshHud(): void {
  const state = session.state;
  $('hp-fill').style.width = `${(session.hp / session.maxHp) * 100}%`;
  $('hp-num').textContent = String(Math.ceil(session.hp));
  $('money').textContent = String(state.currency);
  $('objective').textContent = objective(state);
  const badge = $('drone-badge');
  const module = state.equipped.module;
  badge.hidden = !state.equipped.drone;
  badge.innerHTML = state.equipped.drone ? `${icon('drone_spark')}<span>Drone · ${esc(module ? ITEMS[module].name : 'sem módulo')}</span>` : '';
  renderToolHotbar();
  renderExtractionCard();
  renderRecentFinds();
}

function renderExtractionCard(): void {
  const card = $('extraction-card');
  const afk = session.state.afk;
  if (!afk) {
    card.innerHTML = session.state.equipped.drone
      ? '<b>Extração</b><p>Nenhuma extração ativa</p><small>Use o terminal no Pátio Zero.</small>'
      : '<b>Extração bloqueada</b><p>Monte o drone na oficina.</p>';
    return;
  }
  const progress = computeProgress(afk, Date.now());
  const left = Math.ceil((1 - progress.cycleProgress) * afk.cycleMs / 1000);
  card.innerHTML = `<b>${AFK_AREAS[afk.areaId].name}</b><p>Em andamento · ${left}s</p><div class="bar thin"><i style="width:${progress.cycleProgress * 100}%"></i></div><small>Carga ${progress.load}/${progress.capacity}</small>`;
}

function renderRecentFinds(): void {
  const rows = session.recentFinds.slice(0, 6).flatMap((find) => Object.entries(find.bag)).slice(0, 6);
  $('recent-finds').innerHTML = `<b>Achados recentes</b>${rows.map(([id, qty]) => {
    const item = ITEMS[id as keyof typeof ITEMS];
    const rare = item.rarity && item.rarity !== 'comum';
    return `<div class="${rare ? 'rare-find' : ''}">${icon(id as keyof typeof ITEMS)} ${esc(item.name)} ×${qty}${rare ? ` · ${item.rarity}` : ''}</div>`;
  }).join('')}`;
}

export function hudFrame(frame: HudFrame): void {
  $('area').textContent = frame.area;
  frame.cooldowns.forEach((value, index) => { const overlay = $<HTMLElement>(`cd${index}`); overlay.style.height = `${value * 100}%`; });
  const prompt = $('prompt');
  prompt.hidden = !frame.prompt;
  if (frame.prompt) prompt.textContent = frame.prompt;
  const boss = $('boss');
  boss.hidden = !frame.boss;
  if (frame.boss) $<HTMLElement>('boss-fill').style.width = `${(frame.boss.hp / frame.boss.max) * 100}%`;
  $('hp-fill').style.width = `${(session.hp / session.maxHp) * 100}%`;
  $('hp-num').textContent = String(Math.ceil(session.hp));
}

export function objective(s: typeof session.state): string {
  const has = (id: keyof typeof ITEMS) => (s.inventory[id] ?? 0) > 0;
  if (!s.flags.first_wagon_looted) return 'Vá ao Pátio Ferroviário (leste) e vasculhe o primeiro vagão.';
  if (!s.equipped.drone && !has('mod_claw')) return 'Junte 2 engrenagens, 1 cabo e 4 sucatas e monte o Módulo de Garra na oficina.';
  if (!s.equipped.drone) return 'Monte o Drone Faísca na oficina (chassi + núcleo + módulo).';
  if (s.stats.extractions === 0) return 'Use o terminal do Pátio Zero para iniciar uma extração.';
  if (!s.flags.boss_defeated) return 'Desça à Estação de Triagem (nordeste do ferro-velho) e derrote o Guindaste de Arrasto.';
  if (s.equipped.module !== 'mod_magnet' && !has('mod_magnet')) return 'Monte o Módulo Magnético com a Bobina e leve o drone para lutar.';
  return 'Extraia na Estação de Triagem, venda excedentes e compre o projeto de carga.';
}

function renderToolHotbar(): void {
  const tools = (['tool_wrench_old', 'tool_wrench_reinforced', 'tool_hydraulic_pry'] as const).filter((id) => session.state.equipped.tool === id || (session.state.inventory[id] ?? 0) > 0);
  const slots = Array.from({ length: 5 }, (_, index) => {
    const id = tools[index];
    const image = id ? icon(id) : '';
    const active = id && session.state.equipped.tool === id ? 'active' : '';
    return `<button class="tool-slot ${active}" ${id ? `data-tool="${id}"` : 'disabled'}><b>${index + 1}</b>${image}</button>`;
  });
  $('tool-hotbar').innerHTML = slots.join('');
}
