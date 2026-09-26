/* Reproduce the enemy-phase wedge outside main.js's error catcher. */
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
sandbox.window.requestAnimationFrame = cb => { rafCb = cb; };

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
vm.runInContext('globalThis.EX = { Game, Screens, Debug, PlayBattle, LevelUp, Dialogue, SaveLoad, ChapterDB, Units, GameMap, Config, Utils, Combat, AI };', sandbox);
const E = sandbox.EX;

/* pump that lets exceptions PROPAGATE (no main.js catch) */
let now = 1000;
function rawPump(frames, dt = 16) {
  for (let i = 0; i < frames; i++) {
    const cb = rafCb; rafCb = null;
    now += dt;
    Input_beginFrame(dt);
    try {
      if (E.Game.state === 'chapter') { E.Game.update(dt); }
      else if (E.Game.screen) { E.Game.screen.update(dt); E.Game.screen.draw(makeCtxStub()); }
    } catch (e) {
      console.error('CAUGHT DURING UPDATE:', e.stack);
      process.exit(2);
    }
    if (cb) cb(now); /* invoke rAF registration but skip its body double-run */
  }
}
/* we bypass main.js loop; emulate Input via its own beginFrame? Input is in-context; drive keys via window listeners */
function pressKey(k) {
  for (const fn of listeners.keydown || []) fn({ key: k, preventDefault: () => {} });
  for (const fn of listeners.keyup || []) fn({ key: k, preventDefault: () => {} });
}
/* Input.beginFrame lives in context; call via a shim exposed on EX? Use window dispatch only; Input updates on its own via main? No...
   Simplest: run updates through main's rAF body but catch. Instead: monkey-patch console.error won't help.
   We'll call Game.update + Input manually by evaluating a helper in-context. */
vm.runInContext('globalThis.EX2 = { beginFrame: (dt) => Input.beginFrame(dt), endFrame: () => Input.endFrame() };', sandbox);
function Input_beginFrame(dt) { sandbox.EX2.beginFrame(dt); sandbox.EX2.endFrame(); }

/* boot: skip main loop usage; start chapter directly */
E.Game.startChapter('ch1', null);
console.log('chapter started, mode=', E.Game.mode);

/* force a fight so battle-anim path runs during enemy phase later */
const brig = E.Game.units.find(u => u.id === 'e_brig1');
const brynn = E.Game.units.find(u => u.id === 'brynn');
brig.x = brynn.x + 1; brig.y = brynn.y;

/* player attacks via direct engine call (bypasses UI) */
E.Game.startCombat(brynn, brig);
/* fast-forward battle anim with raw pumps */
for (let i = 0; i < 300 && (E.PlayBattle.active || E.LevelUp.active); i++) {
  rawPump(1, 60);
  if (E.LevelUp.active) pressKey('x');
}
console.log('fight done. brynn.hp=', brynn.hp, 'brig.hp=', brig.hp, 'brig.dead=', !!brig.dead, 'mode=', E.Game.mode);

/* now run the enemy phase with raw pumps to catch the crash */
E.Game.endPlayerPhase();
console.log('enemy phase begins. queue=', E.Game.enemyQueue.length);
for (let i = 0; i < 800 && E.Game.phase === 'enemy' && E.Game.state === 'chapter'; i++) {
  rawPump(1, 60);
}
console.log('phase=', E.Game.phase, 'turn=', E.Game.turn, 'state=', E.Game.state, 'mode=', E.Game.mode);
console.log('DONE — no crash');
