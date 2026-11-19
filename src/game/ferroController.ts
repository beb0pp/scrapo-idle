import Phaser from 'phaser';
import { activeSynergies, costText, ferroMods } from '../core/progression';
import { grantXp, levelOf } from '../core/level';
import { XP } from '../data/xp';
import { manaRegen, maxMana, OUT_OF_COMBAT_MS, useItem } from '../core/mana';
import { buffedMods, castProblem, castSpell, discover, recruit, recruitProblem, slotOf, spellCooldownMs, spellPower, EMPOWER_MUL, type ManaHolder, type SpellBuffs, type SpellCooldowns } from '../core/spells';
import { addItems, hasItems } from '../core/state';
import type { ElementId } from '../data/elements';
import { ALLIES, SPELLS, type FerroMods, type SpellId } from '../data/ferromancy';
import { ITEMS, RARITY, rarityOf, type ItemBag, type ItemId } from '../data/items';
import { PILE_RESPAWN_MS, session } from '../session';
import { flashSpellSlot, onSpellClick, setLevel, setMana, setSpellCooldowns } from '../ui/ferroHud';
import { modal, toast } from '../ui/ui';
import { Cobalto, type AllyTarget } from './ally';
import type { Crane, Enemy } from './enemies';
import { reachableCells, spotNear } from './placement';
import { levelUpBurst } from './vfx';
import { discoveryBurst, playAcid, playArc, playCrush, playEmber, playHarvest, playHaste, playLodestone, playNet, playWard, spellAura, wardBreak, wardHit, type Pt, type WardShield } from './spellfx';
import { acidSplashTargets, acidTickCount, acidTickDamage, ACID_PUDDLE_MS, ACID_RADIUS, ACID_TICK_MS, chainDamage, chainTargets, crushDamage, crushTargets, CRUSH_RADIUS } from '../core/attackSpells';

// Ferromancy runtime in the world: spells (Z X C), Auto casting, Ether veins, the sleeping automaton and Cobalto.

export interface FerroInteractable {
  x: number;
  y: number;
  r: number;
  label: () => string | null;
  act: () => void;
  auto?: boolean;
}

export interface FerroApi {
  scene: Phaser.Scene;
  mapId: string;
  caster: Phaser.GameObjects.Sprite;
  hero(): Pt;
  facing(): Pt;
  aim(): Pt;
  enemies(): Enemy[];
  targets(): FerroTarget[];
  pickups(): Pt[];
  attractPickups(x: number, y: number, r: number): void;
  addInteractable(it: FerroInteractable): void;
  /** Piles ready to search; `search()` runs the scene's normal finished search. */
  readyPiles(): (Pt & { search(): void })[];
  /** Ready jobs Auto may take (piles, junk, veins). */
  jobs(): Pt[];
  /** Starts the scene's timed search bar; false while another one runs. */
  startTimedAction(ms: number, finish: () => void): boolean;
  tileFree(tx: number, ty: number): boolean;
  mapSize: { w: number; h: number };
  markManual(): void;
  /** Scene ms since the hero last took damage. */
  sinceHurt(): number;
}

/** Ally target that a spell can also drag; the crane cannot be pulled. */
export interface FerroTarget extends AllyTarget {
  pull?(x: number, y: number, stunMs: number): void;
}

interface HostPile { x: number; y: number }

/** WorldScene members the adapter reads. Kept in one place so an upstream rename breaks here only. */
interface FerroHost extends Phaser.Scene {
  mapId: string;
  player: Phaser.Physics.Arcade.Sprite;
  feetX: number;
  feetY: number;
  facing: Phaser.Math.Vector2;
  enemies: Enemy[];
  crane: Crane | null;
  pickups: { sprite: Phaser.GameObjects.Image }[];
  piles: HostPile[];
  pileReady(p: HostPile): boolean;
  finishSearch(p: HostPile): void;
  interactables: FerroInteractable[];
  searching: { until: number; total: number; finish: () => void } | null;
  lastManual: number;
  lastHurt: number;
  collision: Phaser.Tilemaps.TilemapLayer;
  tileBlocked(x: number, y: number): boolean;
  attractPickups(x: number, y: number, r: number): void;
  damageEnemy(e: Enemy, n: number, el?: ElementId | null): void;
  damageCrane(n: number): void;
}

export function ferroApi(scene: Phaser.Scene): FerroApi {
  const h = scene as FerroHost;
  return {
    scene,
    mapId: h.mapId,
    caster: h.player,
    hero: () => ({ x: h.feetX, y: h.feetY }),
    facing: () => ({ x: h.facing.x, y: h.facing.y }),
    aim: () => h.cameras.main.getWorldPoint(h.input.activePointer.x, h.input.activePointer.y),
    enemies: () => h.enemies,
    targets: () => {
      const list: FerroTarget[] = h.enemies.filter((e) => e.alive).map((e) => ({
        get x() { return e.x; },
        get y() { return e.y; },
        radius: 8,
        hit: (n: number, el?: ElementId | null) => h.damageEnemy(e, n, el),
        pull: (x: number, y: number, ms: number) => e.pull(x, y, ms),
      }));
      const c = h.crane;
      if (c?.alive) list.push({ get x() { return c.sprite.x; }, get y() { return c.sprite.y + 10; }, radius: 20, hit: (n) => h.damageCrane(n) });
      return list;
    },
    pickups: () => h.pickups.map((p) => ({ x: p.sprite.x, y: p.sprite.y })),
    attractPickups: (x, y, r) => h.attractPickups(x, y, r),
    addInteractable: (it) => h.interactables.push(it),
    readyPiles: () => h.piles.filter((p) => h.pileReady(p)).map((p) => ({ x: p.x, y: p.y, search: () => { if (h.pileReady(p)) h.finishSearch(p); } })),
    jobs: () => h.interactables.filter((it) => it.auto && it.label()),
    startTimedAction: (ms, finish) => {
      if (h.searching) return false;
      h.searching = { until: h.time.now + ms, total: ms, finish };
      return true;
    },
    tileFree: (tx, ty) => !h.tileBlocked(tx, ty),
    mapSize: { w: h.collision.layer.width, h: h.collision.layer.height },
    markManual: () => { h.lastManual = h.time.now; },
    sinceHurt: () => h.time.now - h.lastHurt,
  };
}

const VEIN_SPOTS: Record<string, Pt[]> = {
  yard: [{ x: 0.25, y: 0.8 }, { x: 0.6, y: 0.15 }, { x: 0.9, y: 0.5 }],
  dungeon: [{ x: 0.3, y: 0.3 }, { x: 0.75, y: 0.7 }],
};
const AUTOMATON_SPOT: Pt = { x: 0.82, y: 0.82 };
const SEARCH_RADIUS = 12;
const EMBER_SPLASH = 26;
const CRUSH_STUN_MS = 700;
const CURSOR_PICK = 24;
const AUTO_EVERY = 300;
const HUD_EVERY = 100;
const VEIN_MS = 1000;
const CRYSTAL_CHANCE = 0.12;

interface Vein { key: string; x: number; y: number; sprite: Phaser.GameObjects.Sprite; ready: boolean }

const dist = (a: Pt, b: Pt) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

/** Cooldowns survive map changes and respawns: they run on the wall clock, not the scene clock. */
const sharedCooldowns: SpellCooldowns = {};
/** Runtime mana (never saved): survives map changes like the cooldowns, starts full. */
const sharedMana: ManaHolder = { value: -1 };
/** Auxílio buffs survive map changes too (wall clock). */
const sharedBuffs: SpellBuffs = {};
const HASTE_JOB_RANGE = 60;
const NET_LOOT_RANGE = 200;
const AUTO_MIN_TARGETS = 2;

function fillManaOnce(): void {
  if (sharedMana.value < 0) sharedMana.value = maxMana(session.state);
}

/** Inventory "Usar": Cristal de Éter and Frasco de Éter. */
export function useManaItem(id: 'ether_crystal' | 'mana_flask'): void {
  fillManaOnce();
  const res = session.run((s) => useItem(s, id, sharedMana));
  toast(res.msg, res.ok ? 'loot' : 'warn');
}

export class FerroController {
  readonly cds: SpellCooldowns = sharedCooldowns;
  readonly mana: ManaHolder = sharedMana;
  ally: Cobalto | null = null;
  shield = 0;
  searchBonus = false;
  private readonly api: FerroApi;
  private readonly scene: Phaser.Scene;
  private readonly keys: Record<'Z' | 'X' | 'C', Phaser.Input.Keyboard.Key>;
  private readonly veins: Vein[] = [];
  private sleeper: Phaser.GameObjects.Sprite | null = null;
  private bubble: WardShield | null = null;
  private shieldUntil = 0;
  private cachedMods: FerroMods;
  private autoAt = 0;
  private hudAt = 0;
  /** Regen runs on the wall clock, like the cooldowns: frame deltas are capped and under-count. */
  private manaAt = Date.now();

  constructor(api: FerroApi) {
    this.api = api;
    this.scene = api.scene;
    this.cachedMods = ferroMods(session.state);
    fillManaOnce();
    this.keys = this.scene.input.keyboard!.addKeys('Z,X,C') as FerroController['keys'];
    onSpellClick((slot) => {
      this.api.markManual();
      this.cast(slot);
    });
    const off = session.onChange(() => {
      this.cachedMods = ferroMods(session.state);
      this.syncParty();
    });
    const offLevel = session.onLevelUp(() => {
      const hero = this.api.hero();
      levelUpBurst(this.scene, { x: hero.x, y: hero.y });
    });
    this.scene.events.once('shutdown', () => {
      off();
      offLevel();
      onSpellClick(() => {});
      this.ally?.destroy();
      this.ally = null;
    });
    this.placeDiscoveries();
    this.syncParty();
    this.resumeAuras();
  }

  get mods(): FerroMods {
    return buffedMods(this.cachedMods, sharedBuffs, Date.now());
  }

  /** Ferrugem only fights when it is not the Coletor (back slot). */
  dogFights(): boolean {
    return slotOf(session.state, 'ferrugem') !== 'back';
  }

  consumeSearchBonus(): boolean {
    const had = this.searchBonus;
    this.searchBonus = false;
    return had;
  }

  update(time: number, delta: number): void {
    (['Z', 'X', 'C'] as const).forEach((k, slot) => {
      if (!Phaser.Input.Keyboard.JustDown(this.keys[k])) return;
      this.api.markManual();
      this.cast(slot);
    });
    this.ally?.update(time, delta);
    if (this.bubble?.active) {
      const hero = this.api.hero();
      this.bubble.setPosition(hero.x, hero.y - 8);
    }
    if (this.shield > 0 && time >= this.shieldUntil) this.breakShield();
    for (const v of this.veins) this.refreshVein(v);
    const max = maxMana(session.state);
    const now = Date.now();
    const regen = manaRegen(this.api.sinceHurt() >= OUT_OF_COMBAT_MS);
    sharedMana.value = Math.min(max, sharedMana.value + (regen * (now - this.manaAt)) / 1000);
    this.manaAt = now;
    if (time - this.hudAt >= HUD_EVERY) {
      this.hudAt = time;
      setMana(sharedMana.value, max);
      setLevel(levelOf(session.state));
      setSpellCooldowns(session.state.ferro.loadout.map((id) => (id ? Math.max(0, ((this.cds[id] ?? 0) - Date.now()) / spellCooldownMs(session.state, id)) : 0)));
    }
  }

  // ---------------- spells ----------------

  cast(slot: number, auto = false): boolean {
    const id = session.state.ferro.loadout[slot];
    if (!id) {
      if (!auto) toast(`Nenhum feitiço no atalho ${'ZXC'[slot]}.`, 'warn');
      return false;
    }
    const attack = SPELLS[id].school === 'ataque';
    const target = attack ? this.attackTarget(id, auto) : null;
    if (attack && !target) {
      if (!auto) toast('Nenhum alvo ao alcance.', 'warn');
      return false;
    }
    if (id === 'spell_harvest' && !this.harvestPiles().length) {
      if (!auto) toast('Nenhuma pilha pronta por perto.', 'warn');
      return false;
    }
    const res = castSpell(session.state, this.cds, id, Date.now(), sharedMana);
    if (!res.ok) {
      if (!auto) toast(res.msg, 'warn');
      return false;
    }
    session.commit();
    flashSpellSlot(slot);
    this.playSpell(id, target, res.empowered);
    return true;
  }

  /** Shield soaks damage first; returns what is left for the hero. */
  absorb(dmg: number): number {
    if (this.shield <= 0 || !this.bubble) return dmg;
    if (this.scene.time.now >= this.shieldUntil) {
      this.breakShield();
      return dmg;
    }
    const soaked = Math.min(this.shield, dmg);
    this.shield -= soaked;
    wardHit(this.scene, this.bubble);
    if (this.shield <= 0) this.breakShield();
    return dmg - soaked;
  }

  autoCast(time: number): void {
    if (time - this.autoAt < AUTO_EVERY) return;
    this.autoAt = time;
    const s = session.state;
    const hero = this.api.hero();
    s.ferro.loadout.forEach((id, slot) => {
      if (!id || castProblem(s, this.cds, id, Date.now(), sharedMana)) return;
      if (this.wants(id, hero)) this.cast(slot, true);
    });
  }

  private wants(id: SpellId, hero: Pt): boolean {
    if (id === 'spell_ward') {
      if (session.hp >= session.maxHp * 0.5 || this.shield > 0) return false;
      return this.api.enemies().some((e) => e.alive && (dist(hero, e) < 80 || (e.windingUp && dist(hero, e) <= e.radius + 8)));
    }
    if (SPELLS[id].school === 'ataque') return this.attackTarget(id, true) !== null;
    if (id === 'spell_haste') return !buffActive('haste') && this.api.jobs().some((j) => dist(hero, j) < HASTE_JOB_RANGE);
    if (id === 'spell_net') return !buffActive('net') && this.api.pickups().filter((p) => dist(hero, p) < NET_LOOT_RANGE).length >= AUTO_MIN_TARGETS;
    if (id === 'spell_harvest') return this.harvestPiles().length >= AUTO_MIN_TARGETS;
    const loot = this.api.pickups().filter((p) => dist(hero, p) < SPELLS.spell_lodestone.range).length;
    return loot >= 3 || (!this.searchBonus && this.api.jobs().some((j) => dist(hero, j) < 40));
  }

  /** Ready piles inside the harvest radius, nearest first. */
  private harvestPiles(): (Pt & { search(): void })[] {
    const hero = this.api.hero();
    return this.api.readyPiles()
      .filter((p) => dist(hero, p) <= SPELLS.spell_harvest.range)
      .sort((a, b) => dist(hero, a) - dist(hero, b));
  }

  /** Attack spells aim at the enemy under the cursor (manual) or the nearest one in range. */
  private attackTarget(id: SpellId, auto: boolean): FerroTarget | null {
    const hero = this.api.hero();
    const range = SPELLS[id].range;
    const inRange = this.api.targets().filter((t) => dist(hero, t) <= range);
    if (!inRange.length) return null;
    const byDist = (from: Pt) => (a: FerroTarget, b: FerroTarget) => dist(from, a) - dist(from, b);
    if (!auto) {
      const aim = this.api.aim();
      const picked = [...inRange].sort(byDist(aim))[0];
      if (dist(aim, picked) < CURSOR_PICK + picked.radius) return picked;
    }
    return inRange.sort(byDist(hero))[0];
  }

  private playSpell(id: SpellId, target: FerroTarget | null, empowered: boolean): void {
    const scene = this.scene;
    const hero = this.api.hero();
    const caster = this.api.caster;
    const power = spellPower(session.state, id, empowered);
    if (id === 'spell_ember' && target) {
      const to = { x: target.x, y: target.y - 4 };
      playEmber(scene, caster, { x: hero.x, y: hero.y - 14 }, to, () => {
        const el = SPELLS.spell_ember.element;
        target.hit(power, el);
        const splash = Math.round(power * 0.5);
        for (const t of this.api.targets()) if (dist(t, to) < EMBER_SPLASH && !sameSpot(t, target)) t.hit(splash, el);
        if (this.ally && activeSynergies(session.state).some((s) => s.id === 'resonance')) this.ally.echo(target);
      });
    } else if ((id === 'spell_arc' || id === 'spell_crush' || id === 'spell_acid') && target) {
      this.playAttack(id, target, power);
    } else if (id === 'spell_ward') {
      const duration = SPELLS.spell_ward.durationMs ?? 6000;
      if (this.bubble) wardBreak(scene, this.bubble);
      const bubble = playWard(scene, caster, hero, duration, () => {
        this.shield = power;
        this.shieldUntil = scene.time.now + duration;
      });
      this.bubble = bubble;
    } else if (id === 'spell_lodestone') {
      const radius = (SPELLS.spell_lodestone.range + this.mods.pickupRadius) * (empowered ? EMPOWER_MUL : 1);
      playLodestone(scene, caster, hero, radius, () => {
        const at = this.api.hero();
        this.api.attractPickups(at.x, at.y, radius);
        this.searchBonus = true;
      });
    } else if (id === 'spell_haste' || id === 'spell_net') {
      const duration = SPELLS[id].durationMs ?? 0;
      const key = id === 'spell_haste' ? 'haste' : 'net';
      const play = id === 'spell_haste' ? playHaste : playNet;
      play(scene, caster, () => this.api.hero(), duration, () => {
        sharedBuffs[key] = { until: Date.now() + duration, power };
      });
      toast(`${SPELLS[id].name}: ${Math.round(duration / 1000)} s.`, 'loot');
    } else if (id === 'spell_harvest') {
      const piles = this.harvestPiles().slice(0, power);
      playHarvest(scene, caster, hero, SPELLS.spell_harvest.range, piles, () => {
        for (const p of piles) p.search();
      });
      toast(`${SPELLS.spell_harvest.name}: ${piles.length} ${piles.length === 1 ? 'pilha' : 'pilhas'}.`, 'loot');
    }
  }

  private playAttack(id: 'spell_arc' | 'spell_crush' | 'spell_acid', target: FerroTarget, power: number): void {
    const scene = this.scene;
    const hero = this.api.hero();
    const hand = { x: hero.x, y: hero.y - 14 };
    const el = SPELLS[id].element;
    if (id === 'spell_arc') {
      const chain = chainTargets(target, [target, ...this.api.targets().filter((t) => !sameSpot(t, target))]);
      playArc(scene, this.api.caster, hand, chain, (hop) => chain[hop].hit(chainDamage(power, hop), el));
    } else if (id === 'spell_crush') {
      const at = { x: target.x, y: target.y };
      playCrush(scene, this.api.caster, hand, at, CRUSH_RADIUS,
        () => { for (const t of crushTargets(at, this.api.targets())) t.pull?.(at.x, at.y, CRUSH_STUN_MS); },
        () => {
          const caught = crushTargets(at, this.api.targets());
          const dmg = crushDamage(power, caught.length);
          for (const t of caught) t.hit(dmg, el);
        });
    } else {
      const to = { x: target.x, y: target.y };
      playAcid(scene, this.api.caster, hand, to, ACID_RADIUS, ACID_PUDDLE_MS, () => {
        for (const t of acidSplashTargets(to, this.api.targets())) t.hit(power, el);
        const tick = acidTickDamage(power);
        scene.time.addEvent({
          delay: ACID_TICK_MS, repeat: acidTickCount() - 1,
          callback: () => { for (const t of acidSplashTargets(to, this.api.targets())) t.hit(tick, el); },
        });
      });
    }
  }

  /** A buff cast on another map keeps its aura here for the time left. */
  private resumeAuras(): void {
    const now = Date.now();
    for (const [key, id] of [['haste', 'spell_haste'], ['net', 'spell_net']] as const) {
      const left = (sharedBuffs[key]?.until ?? 0) - now;
      if (left > 0) spellAura(this.scene, id, () => this.api.hero(), left);
    }
  }

  private breakShield(): void {
    this.shield = 0;
    if (this.bubble) wardBreak(this.scene, this.bubble);
    this.bubble = null;
  }

  // ---------------- discoveries ----------------

  private placeDiscoveries(): void {
    const spots = VEIN_SPOTS[this.api.mapId];
    const wantsSleeper = this.api.mapId === 'yard' && !session.state.ferro.recruited.includes('cobalto');
    if (!spots && !wantsSleeper) return;
    const { w, h } = this.api.mapSize;
    const hero = this.api.hero();
    const reach = reachableCells((x, y) => !this.api.tileFree(x, y), w, h, { x: Math.floor(hero.x / 16), y: Math.floor(hero.y / 16) });
    const place = (f: Pt): Pt | null => {
      const c = spotNear(reach, { x: Math.floor(f.x * w), y: Math.floor(f.y * h) }, SEARCH_RADIUS);
      return c ? { x: c.x * 16 + 8, y: c.y * 16 + 8 } : null;
    };
    spots?.forEach((f, i) => {
      const at = place(f);
      if (at) this.addVein(`vein_${this.api.mapId}_${i}`, at);
    });
    if (wantsSleeper) {
      const at = place(AUTOMATON_SPOT);
      if (at) this.addSleeper(at);
    }
  }

  private veinReady(key: string): boolean {
    const t = session.searchedPiles.get(key);
    return t === undefined || Date.now() - t > PILE_RESPAWN_MS;
  }

  private addVein(key: string, at: Pt): void {
    const sprite = this.scene.add.sprite(at.x, at.y + 4, 'ether_vein', 0).setOrigin(0.5, 1).setDepth(at.y + 4);
    const vein: Vein = { key, x: at.x, y: at.y, sprite, ready: !this.veinReady(key) };
    this.veins.push(vein);
    this.refreshVein(vein);
    this.api.addInteractable({
      x: at.x, y: at.y, r: 22, auto: true,
      label: () => (this.veinReady(key) ? 'F — Extrair Éter' : null),
      act: () => {
        if (this.veinReady(key)) this.api.startTimedAction(VEIN_MS * this.mods.searchTimeMul, () => this.finishVein(vein));
      },
    });
  }

  private refreshVein(v: Vein): void {
    const ready = this.veinReady(v.key);
    if (ready === v.ready) return;
    v.ready = ready;
    if (ready) v.sprite.clearTint().setAlpha(1).play('ether-shimmer');
    else v.sprite.stop().setFrame(0).setTint(0x5a5868).setAlpha(0.7);
  }

  private finishVein(v: Vein): void {
    if (!this.veinReady(v.key)) return;
    session.searchedPiles.set(v.key, Date.now());
    const bag: ItemBag = { ether_shard: Math.random() < 0.3 ? 2 : 1, scrap: Phaser.Math.Between(1, 2) };
    if (Math.random() < CRYSTAL_CHANCE) bag.ether_crystal = 1;
    let first = false;
    session.recordFinds(bag, 'Veio de Éter');
    session.mutate((s) => {
      addItems(s, bag);
      s.stats.searches++;
      grantXp(s, XP.search);
      first = discover(s, 'ether_vein');
    });
    this.refreshVein(v);
    for (const [id, n] of Object.entries(bag) as [ItemId, number][]) {
      const r = RARITY[rarityOf(id)];
      toast(`+${n} ${ITEMS[id].name} · ${r.label}`, 'loot', r.color);
    }
    if (!first) return;
    discoveryBurst(this.scene, { x: v.x, y: v.y - 8 });
    modal(
      '<h1>Veio de Éter</h1><p>Cristais de <b>Éter</b> crescem entre a sucata: energia da antiga colônia, base da Ferromancia.</p><p>Com um Fragmento de Éter, a <b>Estação Alquímica</b> já pode ser construída na árvore de Construção (tecla <b>K</b>).</p>',
      [{ label: 'Entendi', primary: true, onClick: () => {} }],
    );
  }

  private addSleeper(at: Pt): void {
    this.sleeper = this.scene.add.sprite(at.x, at.y + 4, 'cobalto', 5).setOrigin(0.5, 1).setDepth(at.y + 4);
    this.api.addInteractable({
      x: at.x, y: at.y, r: 24,
      label: () => (this.sleeper && !session.state.ferro.recruited.includes('cobalto') ? 'F — Examinar autômato' : null),
      act: () => this.examineSleeper(),
    });
  }

  private examineSleeper(): void {
    let first = false;
    session.mutate((s) => { first = discover(s, 'automaton'); });
    if (first && this.sleeper) discoveryBurst(this.scene, { x: this.sleeper.x, y: this.sleeper.y - 12 });
    const ally = ALLIES.cobalto;
    const problem = recruitProblem(session.state, 'cobalto');
    const stock = hasItems(session.state, ally.recruitCost) ? 'Você tem as peças.' : 'Ainda faltam peças.';
    const status = problem ?? `Pronto para o conserto. ${stock}`;
    const buttons = [{ label: 'Mais tarde', primary: !!problem, onClick: () => {} }];
    if (!problem) buttons.unshift({ label: 'Consertar', primary: true, onClick: () => this.repair() });
    modal(
      `<h1>${ally.name}, ${ally.title}</h1><p>${ally.desc}</p><p><b>Conserto:</b> ${costText({ items: ally.recruitCost })}</p><p>${status}</p>`,
      buttons,
    );
  }

  private repair(): void {
    if (!session.run((s) => recruit(s, 'cobalto')).ok) return;
    this.sleeper?.destroy();
    this.sleeper = null;
    this.syncParty();
  }

  // ---------------- party ----------------

  private syncParty(): void {
    const s = session.state;
    const slot = s.ferro.recruited.includes('cobalto') ? slotOf(s, 'cobalto') : null;
    if (!slot) {
      this.ally?.destroy();
      this.ally = null;
      return;
    }
    if (this.ally) {
      this.ally.setRole(slot);
      return;
    }
    if (this.sleeper) return;
    const hero = this.api.hero();
    this.ally = new Cobalto(this.scene, hero.x + 16, hero.y, slot, {
      hero: () => this.api.hero(),
      facing: () => this.api.facing(),
      targets: () => this.api.targets(),
    });
  }
}

function sameSpot(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function buffActive(key: keyof SpellBuffs): boolean {
  return (sharedBuffs[key]?.until ?? 0) > Date.now();
}
