/* Trace one playtest-style run turn by turn to find the stall. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtxStub() {
  return {
    canvas: null, fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect: () => {}, drawImage: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, strokeRect: () => {}, clearRect: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
    arc: () => {}, closePath: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }),
    rotate: () => {}, fillText: () => {}, measureText: () => ({ width: 0 }), lineWidth: 1, strokeStyle: '',
  };
}
const canvasStub = { width: 0, height: 0, style: {}, addEventListener: () => {}, getContext: () => makeCtxStub() };
const listeners = {};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp,
  Infinity, NaN, isFinite, parseInt, parseFloat, Promise, Error,
  performance: { now: () => Date.now() },
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  window: { innerWidth: 1280, innerHeight: 800, addEventListener: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, removeEventListener: () => {} },
  document: { getElementById: () => canvasStub, createElement: () => ({ width: 0, height: 0, getContext: () => makeCtxStub() }), addEventListener: () => {} },
  navigator: { getGamepads: () => [] },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
let rafCb = null;
sandbox.requestAnimationFrame = cb => { rafCb = cb; };

const ORDER = [
  'js/core/utils.js', 'js/core/config.js',
  'js/data/terrain.js', 'js/data/weapons.js', 'js/data/items.js',
  'js/data/classes.js', 'js/data/characters.js', 'js/data/chapter1.js',
  'js/game/units.js', 'js/game/map.js', 'js/game/combat.js', 'js/game/ai.js', 'js/game/save.js',
  'js/game/engine.js',
  'js/gfx/font.js', 'js/gfx/charart.js', 'js/gfx/tiles.js', 'js/gfx/audio.js',
  'js/gfx/input.js', 'js/gfx/ui.js', 'js/gfx/dialogue.js', 'js/gfx/battlescene.js', 'js/gfx/levelup.js',
  'js/screens.js', 'js/debug.js', 'js/main.js',
];
for (const f of ORDER) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
vm.runInContext('globalThis.EX = { Game, Screens, Debug, PlayBattle, LevelUp, Dialogue, SaveLoad, ChapterDB, Units, GameMap, Config, Utils, Combat, AI, Items };', sandbox);
const E = sandbox.EX;

function pressKey(k) {
  for (const fn of listeners.keydown || []) fn({ key: k, preventDefault: () => {} });
  for (const fn of listeners.keyup || []) fn({ key: k, preventDefault: () => {} });
}
let now = 1000;
function pump(frames, dt = 16) {
  for (let i = 0; i < frames; i++) {
    if (!rafCb) throw new Error('rAF chain broken');
    const cb = rafCb; rafCb = null;
    now += dt; cb(now);
  }
}
function settle(maxFrames = 800) {
  const G = E.Game;
  for (let i = 0; i < maxFrames; i++) {
    if (G.state !== 'chapter') return;
    if (E.Dialogue.active) { pressKey('z'); pump(1, 50); continue; }
    if (E.PlayBattle.active) { pump(1, 70); continue; }
    if (E.LevelUp.active) { pressKey('x'); pump(1, 50); continue; }
    if (G.mode === 'dialogue' || G.mode === 'battleAnim') { pump(1, 50); continue; }
    return;
  }
}

E.Game.startChapter('ch1', null);
settle(50);

/* minimal versions of the playtest helpers, with tracing */
function trace(label) {
  const G = E.Game;
  console.log(`[${label}] state=${G.state} mode=${G.mode} phase=${G.phase} turn=${G.turn}`);
}
const UNIT_ORDER = ['rowan', 'brynn', 'garrick', 'sela', 'lia', 'mira'];
function tryAttack(G, eid) {
  const foe = G.units.find(u => u.id === eid && E.Units.isAlive(u) && !u.dead);
  if (!foe) return false;
  for (const pid of UNIT_ORDER) {
    const p = G.units.find(u => u.id === pid && E.Units.isAlive(u) && !u.acted && !u.dead);
    if (!p) continue;
    G.deselect(); G.selectUnit(p);
    const dNow = Math.abs(foe.x - p.x) + Math.abs(foe.y - p.y);
    let dest = null;
    if (E.Units.attackRange(p).includes(dNow)) dest = { x: p.x, y: p.y };
    else {
      let bestC = 1e9;
      for (const t of G.moveTiles) {
        const d = Math.abs(foe.x - t.x) + Math.abs(foe.y - t.y);
        if (E.Units.attackRange(p).includes(d)) {
          const c = t.cost + Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
          if (c < bestC) { bestC = c; dest = t; }
        }
      }
    }
    if (!dest) { pressKey('x'); pump(2); continue; }
    G.cursor.x = dest.x; G.cursor.y = dest.y;
    pressKey('z'); pump(2);
    if (G.mode !== 'menu') { pressKey('x'); pump(2); continue; }
    const atkIdx = G.menuItems.findIndex(m => m.act === 'attack');
    if (atkIdx < 0) { pressKey('x'); pump(2); continue; }
    G.menuSel = atkIdx; pressKey('z'); pump(2);
    if (G.mode !== 'target') { pressKey('x'); pump(2); continue; }
    const ti = G.targetSel.list.findIndex(t => t.id === eid);
    if (ti < 0) { pressKey('x'); pump(2); continue; }
    G.targetSel.idx = ti;
    pressKey('z'); pump(2);
    settle();
    return true;
  }
  G.deselect();
  return false;
}
function endPhase(G) {
  G.deselect();
  pressKey('e');
  pump(1, 60);   /* let the engine process the endturn press */
  let pumps = 0;
  while (G.state === 'chapter' && G.phase === 'enemy' && pumps < 800) { pump(1, 60); pumps++; }
  settle(100);
}

/* direct heal-tick check: no input, no AI — just endEnemyPhase() */
{
  const G = E.Game;
  const mira = G.units.find(u => u.id === 'mira');
  mira.x = 21; mira.y = 8;
  console.log('direct: mira tile=', E.GameMap.tileAt(21, 8), 'heal=', G.terrainAt(21, 8).heal);
  mira.hp = 8;
  G.endEnemyPhase();
  console.log('direct: after endEnemyPhase mira hp=', mira.hp, '(started 8)');
}

/* P2-style probe: throne heal on phase tick */
{
  const G = E.Game;
  const origEE = G.endEnemyPhase.bind(G);
  G.endEnemyPhase = function () {
    const boss = this.units.find(u => u.bossKey);
    console.log('  [endEnemyPhase] boss hp=', boss && boss.hp, '/', boss && boss.maxhp,
      'terrain=', JSON.stringify(boss && this.terrainAt(boss.x, boss.y)));
    origEE();
    console.log('  [endEnemyPhase done] boss hp=', boss && boss.hp);
  };
  const boss = G.units.find(u => u.bossKey);
  console.log('P2 boss tile:', E.GameMap.tileAt(boss.x, boss.y), 'terrain heal:', G.terrainAt(boss.x, boss.y).heal);
  const before = Math.floor(boss.maxhp / 2);
  boss.hp = before;
  endPhase(G);
  console.log('P2 after phase: boss hp=', boss.hp, 'expected >', before, 'phase=', G.phase, 'turn=', G.turn);
}

/* fresh run for the turn trace */
E.Game.startChapter('ch1', null);
settle(50);

for (let turn = 1; turn <= 12; turn++) {
  const G = E.Game;
  trace('before T' + turn);
  let attacked = false;
  for (const eid of ['e_brig1', 'e_brig2', 'e_brig3', 'e_brig4', 'e_brig5', 'e_lancer1', 'e_lancer2', 'e_arch1', 'e_arch2', 'e_arch3', 'e_armor1', 'e_armor2', 'e_hex1', 'e_priest1']) {
    if (tryAttack(G, eid)) { attacked = true; break; }
  }
  console.log('  attacks executed:', attacked, ' players alive:', G.units.filter(u => u.team === 'player' && E.Units.isAlive(u)).length, ' enemies alive:', G.units.filter(u => u.team === 'enemy' && E.Units.isAlive(u)).length);
  trace('after actions');
  endPhase(G);
  trace('after enemy phase');
  if (G.state !== 'chapter') { console.log('END STATE:', G.state); break; }
}
console.log('final:', E.Game.state);
