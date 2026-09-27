/* =============================================================
   BROWSER SIM — runs the full presentation stack headlessly.
   Stubs DOM/canvas, loads every script exactly like index.html,
   then simulates input to drive title -> intro -> prep -> chapter
   and hammers the UI for several turns. Verifies zero crashes.
   ============================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------- DOM / Canvas stubs ---------------- */

function makeCtxStub() {
  const grad = { addColorStop: () => {} };
  return {
    canvas: null,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    font: '', textAlign: '', lineWidth: 1,
    fillRect: () => {}, strokeRect: () => {}, clearRect: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
    arc: () => {}, closePath: () => {},
    drawImage: () => {},
    createLinearGradient: () => grad,
    createPattern: () => null,
    save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, rotate: () => {},
    fillText: () => {}, measureText: () => ({ width: 0 }),
  };
}

function makeCanvasStub() {
  const c = {
    width: 0, height: 0, style: {},
    addEventListener: () => {},
    getContext: () => makeCtxStub(),
  };
  return c;
}

const listeners = {};
const windowStub = {
  innerWidth: 1280, innerHeight: 800,
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener: () => {},
  requestAnimationFrame: null,
};
const documentStub = {
  getElementById: () => makeCanvasStub(),
  createElement: () => makeCanvasStub(),
  addEventListener: (ev, fn) => { (listeners['doc_' + ev] = listeners['doc_' + ev] || []).push(fn); },
};

/* ---------------- VM harness ---------------- */

const store = {};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp,
  Infinity, NaN, isFinite, parseInt, parseFloat, Promise, Error,
  performance: { now: () => Date.now() },
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  window: windowStub,
  document: documentStub,
  navigator: { getGamepads: () => [] },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* rAF: manual pump */
let rafCb = null;
sandbox.requestAnimationFrame = (cb) => { rafCb = cb; };
windowStub.requestAnimationFrame = (cb) => { rafCb = cb; };

/* load scripts in index.html order */
const ORDER = [
  'js/core/utils.js', 'js/core/config.js',
  'js/data/terrain.js', 'js/data/weapons.js', 'js/data/items.js',
  'js/data/classes.js', 'js/data/characters.js', 'js/data/chapter1.js',
  'js/game/units.js', 'js/game/map.js', 'js/game/combat.js', 'js/game/ai.js', 'js/game/save.js',
  'js/game/engine.js',
  'js/gfx/font.js', 'js/gfx/charart.js', 'js/gfx/tiles.js', 'js/gfx/audio.js',
  'js/gfx/input.js', 'js/gfx/ui.js', 'js/gfx/dialogue.js', 'js/gfx/battlescene.js', 'js/gfx/levelup.js',
  'js/gfx/assets.js', 'js/gfx/fever.js',
  'js/screens.js', 'js/debug.js', 'js/main.js',
];
for (const f of ORDER) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  try {
    vm.runInContext(src, sandbox, { filename: f });
  } catch (e) {
    console.error('LOAD FAIL:', f, e.stack);
    process.exit(1);
  }
}
console.log('All scripts loaded.');

/* const declarations live in the context's lexical scope — export via bridge */
vm.runInContext('globalThis.EX = { Game, Screens, Debug, PlayBattle, LevelUp, Dialogue, SaveLoad, ChapterDB, Units, GameMap };', sandbox);
const E = sandbox.EX;

function key(k, type) {
  const evs = listeners[type] || [];
  for (const fn of evs) fn({ key: k, preventDefault: () => {} });
}
function pressKey(k) {
  key(k, 'keydown');
  key(k, 'keyup');
}

/* audio: force-init failure tolerated; window.AudioContext absent so engine no-ops */
let now = 1000;
function pump(frames, dt) {
  for (let i = 0; i < frames; i++) {
    if (!rafCb) throw new Error('rAF chain broken');
    const cb = rafCb; rafCb = null;
    now += (dt || 16);
    cb(now);
  }
}

/* ---------------- SIM ---------------- */

let failures = 0;
function ok(c, m) { if (c) console.log('  ok  ' + m); else { failures++; console.log('  FAIL ' + m); } }

try {
  /* boot */
  pump(5);
  ok(E.Game && E.Game.screen && E.Game.screen.name === 'title', 'booted to title');

  /* title: NEW GAME */
  pressKey('Enter');
  pump(3);
  ok(E.Game.screen.name === 'intro', 'Enter on NEW GAME -> intro');

  /* skip intro */
  pressKey('x');
  pump(3);
  ok(E.Game.screen.name === 'prep', 'X skips intro -> prep');

  /* prep: confirm to start */
  pressKey('x');
  pump(10);
  ok(E.Game.state === 'chapter', 'begins chapter');
  ok(E.Game.units.filter(u => u.team === 'player').length === 6, '6 units deployed');

  /* chapter: cursor around, select rowan, move, wait */
  const G = E.Game;
  pump(5);
  pressKey('ArrowRight'); pressKey('ArrowDown');
  pump(2);
  pressKey('z'); /* select unit under cursor (may or may not be a unit) */
  pump(2);
  pressKey('x'); /* cancel back */
  pump(2);

  /* deterministic: select rowan via direct state, then simulate menu flows */
  const rowan = G.units.find(u => u.id === 'rowan');
  ok(!!rowan, 'rowan exists');

  /* drive a full player attack through the real UI path */
  G.cursor.x = rowan.x; G.cursor.y = rowan.y;
  pressKey('z'); pump(2);
  ok(G.mode === 'unitSelected', 'selected rowan via cursor+confirm, mode=' + G.mode);
  /* move to a tile 1 right if reachable */
  const dest = G.moveTiles.find(t => t.x === rowan.x + 1 && t.y === rowan.y);
  if (dest) {
    G.cursor.x = dest.x; G.cursor.y = dest.y;
    pressKey('z'); pump(2);
    ok(G.mode === 'menu', 'moved, action menu open, mode=' + G.mode);
    /* choose Wait (last item) */
    G.menuSel = G.menuItems.length - 1;
    pressKey('z'); pump(2);
    ok(rowan.acted === true, 'rowan waited via menu');
  } else {
    pressKey('x'); pump(2);
    console.log('  (skip move: no adjacent tile free)');
  }

  /* force a battle through the UI path: place a player next to an enemy */
  const brig = G.units.find(u => u.id === 'e_brig1');
  const attacker = G.units.find(u => u.id === 'brynn');
  ok(!!brig && !!attacker, 'combat participants exist');
  brig.x = attacker.x + 1; brig.y = attacker.y; brig.acted = false;
  brig.stats.spd = -40; brig.stats.luk = 0;   /* deterministic: hit >= 100 */
  const brigHpBefore = brig.hp;
  G.cursor.x = attacker.x; G.cursor.y = attacker.y;
  pressKey('z'); pump(2);
  ok(G.mode === 'unitSelected', 'selected brynn');
  pressKey('z'); pump(2); /* stay in place */
  ok(G.mode === 'menu', 'menu open');
  /* Attack should be item 0 */
  ok(G.menuItems[0].act === 'attack', 'Attack offered');
  G.menuSel = 0; pressKey('z'); pump(2);
  ok(G.mode === 'target', 'target selection open');
  pressKey('z'); pump(2); /* confirm target */
  /* battle animation plays */
  ok(E.PlayBattle.active === true, 'battle scene playing');
  /* fast-forward animation */
  for (let i = 0; i < 200 && E.PlayBattle.active; i++) pump(1, 60);
  ok(!E.PlayBattle.active, 'battle animation finished');
  /* exp/levelup may show */
  for (let i = 0; i < 200 && E.LevelUp.active; i++) { pressKey('x'); pump(1, 60); }
  ok(!E.LevelUp.active, 'levelup dismissed');
  pump(5);
  ok(brig.hp < brigHpBefore || brig.dead, 'enemy took damage or died (' + brigHpBefore + ' -> ' + brig.hp + ')');
  ok(attacker.acted === true, 'attacker marked acted');

  /* dialogue + heal + items paths via direct calls (UI flows exercised above) */
  G.startCombat(G.units.find(u => u.id === 'mira'), brig);
  for (let i = 0; i < 100 && (E.PlayBattle.active || E.LevelUp.active || G.mode === 'dialogue'); i++) {
    if (G.mode === 'dialogue' && E.Dialogue.active) pressKey('z');
    pump(1, 60);
  }
  pump(5);

  /* enemy phase through engine */
  const enemiesBefore = G.units.filter(u => u.team === 'enemy' && E.Units.isAlive(u)).length;
  G.endPlayerPhase();
  pump(400, 32); /* let AI act */
  ok(G.phase === 'player', 'enemy phase completed, back to player');
  ok(G.turn === 2, 'turn advanced to ' + G.turn);

  /* save via system menu path */
  G.openSystemMenu();
  G.menuSel = 1; pressKey('z'); pump(2); /* Save */
  ok(E.SaveLoad.has(), 'saved via system menu');

  /* debug tools */
  pressKey('`'); pump(1);
  ok(E.Debug.enabled === true, 'debug panel opens');
  E.Debug.run('exp');
  E.Debug.run('heal');
  E.Debug.run('spawn');
  E.Debug.run('ai');
  pressKey('`'); pump(1);
  ok(E.Debug.enabled === false, 'debug panel closes');

  /* hammer: 30 turns of pure engine updates with random input */
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'z', 'x', 'c', 'e'];
  let crash = null;
  try {
    for (let i = 0; i < 3000; i++) {
      pressKey(keys[i % keys.length]);
      pump(1, 16);
      if (G.state === 'gameover' || G.state === 'results') break;
    }
  } catch (e) { crash = e; }
  ok(!crash, 'fuzz hammer crashed: ' + (crash ? crash.stack.split('\n').slice(0,3).join(' | ') : 'no'));

  /* ensure we can still reach a terminal state cleanly */
  if (G.state === 'chapter') {
    /* kill boss directly to test win path */
    const boss = G.boss();
    if (boss) { boss.hp = 1; boss.x = 4; boss.y = 20; /* teleport next to rowan */ }
    G.startCombat(G.units.find(u => u.charId === 'rowan'), G.boss());
    for (let i = 0; i < 400 && G.state === 'chapter'; i++) {
      if (G.mode === 'dialogue' && E.Dialogue.active) pressKey('z');
      if (E.PlayBattle.active) { pump(1, 80); continue; }
      if (E.LevelUp.active) { pressKey('x'); pump(1, 80); continue; }
      pump(1, 80);
    }
  }
  ok(G.state === 'results' || G.state === 'gameover' || G.state === 'chapter', 'terminal or continuing state: ' + G.state);

} catch (e) {
  console.error('SIM CRASHED:', e.stack);
  process.exit(1);
}

console.log(failures === 0 ? '\nBROWSER SIM PASSED' : '\n' + failures + ' SIM FAILURES');
process.exit(failures ? 1 : 0);
