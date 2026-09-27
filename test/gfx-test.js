/* =============================================================
   GFX TEST — headless rendering smoke test.
   Loads the full script stack (like browser-sim) and forces every
   tile, every unit sprite kind (both frames, both facings), every
   portrait, and every UI kit function to execute against the
   canvas stub. Any thrown error or invalid canvas size fails.
   Run: node test/gfx-test.js
   ============================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---- canvas stub: real object, no-op drawing, size checks ---- */
function makeCtxStub(canvas) {
  const grad = { addColorStop: (i, c) => { if (typeof c !== 'string') throw new Error('bad gradient color'); } };
  return {
    canvas,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    font: '', textAlign: '', lineWidth: 1,
    fillRect: () => {}, strokeRect: () => {}, clearRect: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
    arc: () => {}, closePath: () => {},
    drawImage: (img, a, b, c, d) => {
      if (img && (img.width === 0 || img.height === 0)) throw new Error('drawImage with empty canvas');
    },
    createLinearGradient: () => grad,
    createPattern: () => null,
    save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, rotate: () => {},
    fillText: () => {}, measureText: () => ({ width: 0 }),
  };
}
function makeCanvasStub() {
  const c = { width: 0, height: 0, style: {}, addEventListener: () => {} };
  c.getContext = () => makeCtxStub(c);
  return c;
}

const listeners = {};
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  window: {
    innerWidth: 240, innerHeight: 160,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: () => {},
  },
  document: {
    getElementById: () => makeCanvasStub(),
    createElement: () => makeCanvasStub(),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    hidden: false,
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: { getGamepads: () => [] },
};
sandbox.window.requestAnimationFrame = () => {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* main.js boots the title screen and starts its loop; the tests
   below do not need it, so skip loading it here. */
const scripts = [
  'js/core/utils.js', 'js/core/config.js',
  'js/data/terrain.js', 'js/data/weapons.js', 'js/data/items.js',
  'js/data/classes.js', 'js/data/characters.js', 'js/data/chapter1.js',
  'js/game/units.js', 'js/game/map.js', 'js/game/combat.js',
  'js/game/ai.js', 'js/game/save.js', 'js/game/engine.js',
  'js/gfx/font.js', 'js/gfx/charart.js', 'js/gfx/tiles.js',
  'js/gfx/audio.js', 'js/gfx/input.js', 'js/gfx/ui.js',
  'js/gfx/dialogue.js', 'js/gfx/battlescene.js', 'js/gfx/levelup.js',
  'js/screens.js', 'js/debug.js',
];
for (const s of scripts) {
  const code = fs.readFileSync(path.join(__dirname, '..', s), 'utf8');
  vm.runInContext(code, sandbox, { filename: s });
}
/* top-level consts don't attach to the sandbox; export them from inside */
vm.runInContext('globalThis.EX = { Game, Screens, Debug, PlayBattle, LevelUp, Dialogue, SaveLoad, ChapterDB, Units, GameMap, Config, Utils, Combat, AI, Items, UI, Font, TileArt, CharArt };', sandbox);
const E = sandbox.EX;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const ctx = makeCtxStub(makeCanvasStub());

/* ---- 1. every terrain tile renders, cached, multi-frame ---- */
const tileIds = new Set();
for (const row of E.ChapterDB.ch1.map) for (const ch of row) tileIds.add(ch);
const tileChars = {
  '.': 'plain', ',': 'plain', '-': 'road', 'f': 'forest', 't': 'thicket',
  'm': 'mountain', 'p': 'peak', '~': 'water', 'r': 'river', '=': 'bridge',
  '#': 'wall', '|': 'pillar', '_': 'floor', 'c': 'carpet', 'T': 'throne',
  'F': 'fort', 'G': 'gate', 'H': 'house', 'V': 'village', 'x': 'ruined',
  'C': 'chest', 'O': 'chestOpen', 'D': 'door', '%': 'rubble',
};
const terrainIds = new Set([...Object.values(tileChars), 'plain', 'road', 'forest']);
let tilesOk = true;
for (const id of terrainIds) {
  for (let fr = 0; fr < 2; fr++) {
    try {
      const cv = E.TileArt.tile(id, fr);
      if (cv.width !== 16 || cv.height !== 16) tilesOk = false;
    } catch (e) { console.log('    tile ' + id + ' frame ' + fr + ': ' + e.message); tilesOk = false; }
  }
  /* cached: same object back */
  if (E.TileArt.tile(id) !== E.TileArt.tile(id)) tilesOk = false;
}
ok(tilesOk, 'all ' + terrainIds.size + ' terrain tiles render at 16x16 (2 frames)');

/* ---- 2. every unit sprite kind, both frames, both facings ---- */
let unitsOk = true;
for (const kind of Object.keys(E.CharArt.KINDS)) {
  for (const frame of [0, 1]) {
    for (const side of [false, true]) {
      try {
        const cv = E.CharArt.unit(kind, frame, side);
        if (cv.width !== 16 || cv.height !== 16) unitsOk = false;
      } catch (e) { console.log('    unit ' + kind + ': ' + e.message); unitsOk = false; }
    }
  }
}
ok(unitsOk, 'all ' + Object.keys(E.CharArt.KINDS).length + ' unit kinds render (2 frames x 2 facings)');

/* ---- 3. every portrait ---- */
const portraitIds = ['rowan', 'brynn', 'sela', 'garrick', 'lia', 'mira', 'vosk', 'npc', 'villain'];
let portraitsOk = true;
for (const pid of portraitIds) {
  try {
    const cv = E.CharArt.portrait(pid);
    if (cv.width !== 32 || cv.height !== 32) portraitsOk = false;
  } catch (e) { console.log('    portrait ' + pid + ': ' + e.message); portraitsOk = false; }
}
ok(portraitsOk, 'all ' + portraitIds.length + ' portraits render at 32x32');

/* ---- 4. UI kit functions ---- */
const UI = E.UI, Font = E.Font, Config = E.Config, Utils = E.Utils;
let uiOk = true;
const tryCall = (name, fn) => { try { fn(); } catch (e) { console.log('    UI.' + name + ': ' + e.message); uiOk = false; } };

tryCall('window', () => UI.window(ctx, 0, 0, 60, 30));
tryCall('frame', () => UI.frame(ctx, 0, 0, 60, 30));
tryCall('hpBar', () => { UI.hpBar(ctx, 0, 0, 40, 5, 7, 10); UI.hpBar(ctx, 0, 0, 40, 5, 0, 10); UI.hpBar(ctx, 0, 0, 40, 5, 1, 10, '#ff0000'); });
tryCall('expBar', () => UI.expBar(ctx, 0, 0, 50, 0.6));
tryCall('cursor', () => { UI.cursor(ctx, 32, 32, 0); UI.cursor(ctx, 32, 32, 999); });
tryCall('hand', () => { UI.hand(ctx, 10, 10, 0); UI.hand(ctx, 10, 10, 20, true); });
tryCall('menu', () => UI.menu(ctx, 100, 10, 70, [{ label: 'Attack' }, { label: 'Wait', disabled: true, right: '12' }], 0));
tryCall('banner', () => UI.banner(ctx, 'Saved!', 120, 10, 100));
tryCall('phaseBanner', () => { UI.phaseBanner(ctx, 'PLAYER PHASE', '#70b0f8', 0, 120); UI.phaseBanner(ctx, 'ENEMY PHASE', '#f07070', 60, 120); });
tryCall('moveArrow', () => UI.moveArrow(ctx, [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }], 16, 0, 0));
tryCall('moveArrow short', () => UI.moveArrow(ctx, [{ x: 4, y: 5 }], 16, 0, 0));
tryCall('moveArrow null', () => UI.moveArrow(ctx, null, 16, 0, 0));
ok(uiOk, 'UI kit functions run clean');

/* ---- 5. unit/terrain panels and forecast with real data ---- */
let panelOk = true;
try {
  E.Game.startChapter('ch1', null);
  const u = E.Game.units[0];
  const terr = E.Game.terrainAt(u.x, u.y);
  UI.unitPanel(ctx, u, 2, 18);
  UI.terrainPanel(ctx, terr, 2, 18);
  /* forecast: find a player-enemy pair that can fight */
  const a = E.Game.units.find(x => x.team === 'player' && x.weapon && x.weapon.type !== 'staff');
  const d = E.Game.units.find(x => x.team === 'enemy');
  if (a && d) {
    const fc = E.Units.forecast(a, d);
    fc.tri = E.Units.triangleMod(a, d).dmg;
    UI.forecast(ctx, 45, 100, 150, fc, a.name, d.name, 0);
    fc.tri = -1; /* exercise the other arrow direction */
    UI.forecast(ctx, 45, 100, 150, fc, a.name, d.name, 0);
    fc.tri = 0;
    UI.forecast(ctx, 45, 100, 150, fc, a.name, d.name, 0);
  }
  /* full map draw pass (units, tiles, overlays) */
  E.Game.drawMap(ctx);
} catch (e) { console.log('    panels: ' + e.message); panelOk = false; }
ok(panelOk, 'panels + forecast + full map draw with live game data');

/* ---- 6. battle scene + levelup draws ---- */
let sceneOk = true;
try {
  const a = E.Game.units.find(x => x.team === 'player' && x.weapon);
  const d = E.Game.units.find(x => x.team === 'enemy');
  if (a && d) {
    E.Game.mode = 'idle';
    /* full event stream: exercise swing/hit/crit/miss/heal/death FX */
    E.PlayBattle.play(a, d, [
      { type: 'swing', atk: a },
      { type: 'hit', atk: a, def: d, dmg: 5, crit: false },
      { type: 'crit', atk: a, def: d, dmg: 9 },
      { type: 'miss', atk: d },
      { type: 'heal', caster: d, amount: 7 },
      { type: 'death', side: 'd' },
      { type: 'end' },
    ], false, null);
    for (let i = 0; i < 40; i++) { E.PlayBattle.update(16); E.PlayBattle.draw(ctx); }
    /* intro slide + VS flash frames */
    E.PlayBattle.play(a, d, [{ type: 'end' }], false, null);
    E.PlayBattle.timer = 250;
    E.PlayBattle.draw(ctx);
    E.PlayBattle.active = false;
    /* fx layers directly */
    E.PlayBattle.bursts.push({ x: 76, y: 96, t: 5, crit: true });
    E.PlayBattle.dmgPopups.push({ v: 7, side: 'd', t: 10, crit: false });
    E.PlayBattle.trails.push({ side: 'a', t: 3 });
    E.PlayBattle.drawBg(ctx, E.Config.SCREEN_W, E.Config.SCREEN_H);
    E.PlayBattle.drawBurst(ctx);
    E.PlayBattle.drawDmgPopups(ctx);
    E.PlayBattle.drawTrail(ctx, 'a', E.Config.SCREEN_H - 44);
    /* death fall render path */
    E.PlayBattle.deathSide = 'd'; E.PlayBattle.deathFall = 0.5;
    E.PlayBattle.draw(ctx);
    E.PlayBattle.deathSide = null; E.PlayBattle.deathFall = 0;
    /* every terrain background renders */
    for (const tid of Object.keys(E.PlayBattle.BG_DECO)) {
      E.PlayBattle.bg = tid;
      E.PlayBattle.drawBg(ctx, E.Config.SCREEN_W, E.Config.SCREEN_H);
    }
    E.PlayBattle.bg = 'notATile';
    E.PlayBattle.drawBg(ctx, E.Config.SCREEN_W, E.Config.SCREEN_H);
    E.PlayBattle.bg = 'plain';
  }
  const lu = E.Game.units.find(x => x.team === 'player');
  lu.exp = 60;
  E.LevelUp.show(lu, 40, [{ hp: 1 }, { str: 1 }], null);
  for (let i = 0; i < 12; i++) { E.LevelUp.update(16); E.LevelUp.draw(ctx); }
  E.LevelUp.active = false;
} catch (e) { console.log('    scenes: ' + e.message); sceneOk = false; }
ok(sceneOk, 'battle scene + level-up render');

/* ---- 7. font width math + glyph coverage via in-context check ---- */
const used = 'PLAYER PHASE0123456789MT HITCRTx2HPDF+AVLV→·★—…';
vm.runInContext("globalThis.FONT_MISS = (s) => s.split('').filter(c => c !== ' ' && !Font.G[c] && !Font.G[c.toUpperCase()])", sandbox, { filename: 'font-check-def' });
const missing = sandbox.FONT_MISS(used);
/* width sanity (formula: len*(5+1)*scale - gap*scale) */
const fontOk = Font.width('ABC') === 17 && Font.width('A') === 5;
ok(fontOk && !missing.length, 'font width math + glyph coverage (' + (missing.length ? 'missing: ' + missing.join('') : 'all present') + ')');

console.log('\n================= GFX SUMMARY =================');
if (fail === 0) console.log('ALL GFX TESTS PASSED');
else { console.log(fail + ' GFX TESTS FAILED'); process.exit(1); }
