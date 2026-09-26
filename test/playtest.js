/* =============================================================
   PLAYTEST — drives full Chapter 1 playthroughs through the real
   engine with a "reasonable player" policy. Collects win rate,
   turn counts, levels, deaths, combat tallies; plus soft-lock
   and balance probes (boss zone, throne heal, keys, door, AI).
   Run: node test/playtest.js
   ============================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------- DOM / Canvas stubs ---------------- */
function makeCtxStub() {
  return {
    canvas: null, fillStyle: '', strokeStyle: '', globalAlpha: 1,
    imageSmoothingEnabled: false, font: '', textAlign: '', lineWidth: 1,
    fillRect: () => {}, strokeRect: () => {}, clearRect: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
    arc: () => {}, closePath: () => {}, drawImage: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
    fillText: () => {}, measureText: () => ({ width: 0 }),
  };
}
function makeCanvasStub() {
  return { width: 0, height: 0, style: {}, addEventListener: () => {}, getContext: () => makeCtxStub() };
}
const listeners = {};
const windowStub = {
  innerWidth: 1280, innerHeight: 800,
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener: () => {},
};
const documentStub = {
  getElementById: () => makeCanvasStub(),
  createElement: () => makeCanvasStub(),
  addEventListener: () => {},
};

const store = {};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp,
  Infinity, NaN, isFinite, parseInt, parseFloat, Promise, Error,
  performance: { now: () => Date.now() },
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  window: windowStub, document: documentStub, navigator: { getGamepads: () => [] },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
let rafCb = null;
sandbox.requestAnimationFrame = cb => { rafCb = cb; };
windowStub.requestAnimationFrame = cb => { rafCb = cb; };

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

/* ---------------- input / pump ---------------- */
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

/* settle animations/dialogue/levelups until interactive again */
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

/* ---------------- combat tallies ---------------- */
const tally = { swings: 0, hits: 0, crits: 0, misses: 0, dmgByPlayers: 0, dmgToPlayers: 0, killsByPlayers: 0, deaths: {} };
const origRun = E.Combat.run.bind(E.Combat);
E.Combat.run = function (a, d, cb) {
  return origRun(a, d, e => {
    if (e.type === 'swing') tally.swings++;
    if (e.type === 'hit') tally.hits++;
    if (e.type === 'crit') { tally.crits++; tally.hits++; }
    if (e.type === 'miss') tally.misses++;
    if ((e.type === 'hit' || e.type === 'crit')) {
      if (e.atk.team === 'player') tally.dmgByPlayers += e.dmg;
      if (e.def.team === 'player') tally.dmgToPlayers += e.dmg;
    }
    if (e.type === 'death') {
      if (e.killer && e.killer.team === 'player') tally.killsByPlayers++;
      if (e.unit.team === 'player') tally.deaths[e.unit.name] = (tally.deaths[e.unit.name] || 0) + 1;
    }
    if (cb) cb(e);
  });
};

/* ---------------- fresh run ---------------- */
function newRun() {
  const G = E.Game;
  G.screen = null;
  G.startChapter('ch1', null);
  settle(50);
  return G;
}

/* ---------------- player policy ---------------- */
const UNIT_ORDER = ['rowan', 'brynn', 'garrick', 'sela', 'lia', 'mira'];
const FOE_PRIORITY = ['boss', 'e_priest1', 'e_hex1', 'e_armor2', 'e_armor1', 'e_lancer1', 'e_lancer2',
  'e_brig1', 'e_brig2', 'e_brig3', 'e_brig4', 'e_brig5', 'e_arch1', 'e_arch2', 'e_arch3',
  'e_rein1', 'e_rein2', 'e_rein3'];

function undo(G) { pressKey('x'); pump(2); }

/* try to attack enemy eid with some unacted player; returns true on success */
function tryAttack(G, eid) {
  const foe = G.units.find(u => u.id === eid && E.Units.isAlive(u) && !u.dead);
  if (!foe) return false;
  for (const pid of UNIT_ORDER) {
    const p = G.units.find(u => u.id === pid && E.Units.isAlive(u) && !u.acted && !u.dead);
    if (!p) continue;
    G.deselect();
    G.selectUnit(p);
    /* in weapon range already? stay */
    const dNow = Math.abs(foe.x - p.x) + Math.abs(foe.y - p.y);
    let dest = null;
    if (E.Units.attackRange(p).includes(dNow)) dest = { x: p.x, y: p.y };
    else {
      /* reachable tile adjacent (or in range) to foe, prefer close to current pos */
      let bestC = 1e9;
      for (const t of G.moveTiles) {
        const d = Math.abs(foe.x - t.x) + Math.abs(foe.y - t.y);
        if (E.Units.attackRange(p).includes(d)) {
          const c = t.cost + Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
          if (c < bestC) { bestC = c; dest = t; }
        }
      }
    }
    if (!dest) { undo(G); continue; }
    G.cursor.x = dest.x; G.cursor.y = dest.y;
    pressKey('z'); pump(2);
    if (G.mode !== 'menu') { undo(G); continue; }
    const atkIdx = G.menuItems.findIndex(m => m.act === 'attack');
    if (atkIdx < 0) { undo(G); continue; }
    G.menuSel = atkIdx; pressKey('z'); pump(2);
    if (G.mode !== 'target') { undo(G); continue; }
    const ti = G.targetSel.list.findIndex(t => t.id === eid);
    if (ti < 0) { undo(G); continue; }
    G.targetSel.idx = ti;
    /* suicide check: skip if the counter kills us and our hit won't kill them */
    const fc = E.Units.forecast(p, foe);
    const counterKills = fc.d.can && fc.d.mt >= p.hp;
    const weKill = fc.a.can && fc.a.mt >= foe.hp;
    if (counterKills && !weKill) { undo(G); continue; }
    G.targetSel.idx = ti;
    pressKey('z'); pump(2);
    settle();
    return true;
  }
  G.deselect();
  return false;
}

function tryHeal(G) {
  const mira = G.units.find(u => u.id === 'mira' && E.Units.isAlive(u) && !u.acted && !u.dead);
  if (!mira || !mira.weapon || mira.weapon.type !== 'staff') return false;
  G.deselect();
  G.selectUnit(mira);
  G.cursor.x = mira.x; G.cursor.y = mira.y;
  pressKey('z'); pump(2);
  if (G.mode !== 'menu') { undo(G); return false; }
  const hi = G.menuItems.findIndex(m => m.act === 'heal');
  if (hi < 0) { undo(G); return false; }
  G.menuSel = hi; pressKey('z'); pump(2);
  if (G.mode !== 'target') { undo(G); return false; }
  pressKey('z'); pump(2); /* first (most wounded) target */
  settle();
  return true;
}

function tryVisit(G, uid, x, y) {
  const p = G.units.find(u => u.id === uid && E.Units.isAlive(u) && !u.acted && !u.dead);
  if (!p) return false;
  if (G.terrainAt(x, y).visit !== true) return false;
  G.deselect();
  G.selectUnit(p);
  const t = G.moveTiles.find(t => t.x === x && t.y === y);
  if (!t) { undo(G); return false; }
  G.cursor.x = x; G.cursor.y = y;
  pressKey('z'); pump(2);
  if (G.mode !== 'menu') { undo(G); return false; }
  const vi = G.menuItems.findIndex(m => m.act === 'visit');
  if (vi < 0) { undo(G); return false; }
  G.menuSel = vi; pressKey('z'); pump(2);
  settle();
  return true;
}

function tryChest(G, uid, x, y) {
  const p = G.units.find(u => u.id === uid && E.Units.isAlive(u) && !u.acted && !u.dead);
  if (!p) return false;
  if (E.GameMap.tileAt(x, y) !== 'chest') return false;
  G.deselect();
  G.selectUnit(p);
  const t = G.moveTiles.find(t => t.x === x && t.y === y);
  if (!t) { undo(G); return false; }
  G.cursor.x = x; G.cursor.y = y;
  pressKey('z'); pump(2);
  if (G.mode !== 'menu') { undo(G); return false; }
  const ci = G.menuItems.findIndex(m => m.act === 'chest');
  if (ci < 0) { undo(G); return false; }
  G.menuSel = ci; pressKey('z'); pump(2);
  settle();
  return true;
}

function tryDoor(G, uid) {
  const p = G.units.find(u => u.id === uid && E.Units.isAlive(u) && !u.acted && !u.dead);
  if (!p) return false;
  const hasKey = p.items.find(it => it.kind === 'key' && (it.opens === 'door' || (it.opens && it.opens.includes('door'))));
  if (!hasKey && !p.lockpick) return false;
  G.deselect();
  G.selectUnit(p);
  /* find reachable tile adjacent to the door at (24,12) */
  let dest = null;
  for (const t of G.moveTiles) {
    if (Math.abs(t.x - 24) + Math.abs(t.y - 12) === 1) { dest = t; break; }
  }
  if (!dest) { undo(G); return false; }
  G.cursor.x = dest.x; G.cursor.y = dest.y;
  pressKey('z'); pump(2);
  if (G.mode !== 'menu') { undo(G); return false; }
  const di = G.menuItems.findIndex(m => m.act === 'door');
  if (di < 0) { undo(G); return false; }
  G.menuSel = di; pressKey('z'); pump(2);
  settle();
  return true;
}

/* one full player phase of reasonable actions */
function playerPhase(G) {
  for (let guard = 0; guard < 40; guard++) {
    if (G.state !== 'chapter') return;
    /* 1: heal the wounded */
    const wounded = G.units.some(u => u.team === 'player' && E.Units.isAlive(u) && u.hp < u.maxhp * 0.55);
    if (wounded && tryHeal(G)) continue;
    /* 2: map stuff (once each; they no-op after done) */
    if (tryVisit(G, 'rowan', 21, 6)) continue;      /* chest key */
    if (tryVisit(G, 'garrick', 21, 17)) continue;   /* gold */
    if (tryVisit(G, 'brynn', 21, 18)) continue;     /* door key */
    if (tryChest(G, 'rowan', 8, 3)) continue;       /* killer sword */
    if (tryDoor(G, 'brynn')) continue;              /* keep door */
    if (tryChest(G, 'rowan', 28, 13)) continue;     /* master seal */
    /* 2.5: wounded units drink potions */
    if (tryPotion(G)) continue;
    /* 3: fight — sticky focus first, then dynamic priority */
    if (stickyFoe) {
      const sf = G.units.find(u => u.id === stickyFoe && E.Units.isAlive(u));
      if (!sf) stickyFoe = null;
      else if (tryAttack(G, stickyFoe)) continue;
    }
    let fought = false;
    const dyn = G.units
      .filter(u => u.team === 'enemy' && E.Units.isAlive(u))
      .map(e => {
        const adj = G.units.some(pl => pl.team === 'player' && E.Units.isAlive(pl) &&
          Math.abs(pl.x - e.x) + Math.abs(pl.y - e.y) <= 2);
        /* rough killability: any unacted player whose mt meets e.hp */
        const killable = G.units.some(pl => pl.team === 'player' && E.Units.isAlive(pl) && !pl.acted &&
          E.Units.attackRange(pl).some(r => r >= Math.abs(pl.x - e.x) + Math.abs(pl.y - e.y) - pl.move) &&
          (pl.weapon ? pl.stats[(pl.weapon.type === 'anima' || pl.weapon.type === 'light' || pl.weapon.type === 'dark') ? 'mag' : 'str'] + pl.weapon.might - e.stats.def >= e.hp : false));
        return { id: e.id, pri: (killable ? -1000 : 0) + (adj ? 0 : 100) + e.hp };
      })
      .sort((a, b) => a.pri - b.pri)
      .map(o => o.id)
      .concat(FOE_PRIORITY);
    for (const eid of dyn) {
      if (tryAttack(G, eid)) {
        stickyFoe = eid;   /* keep hitting the same foe until it dies */
        fought = true; break;
      }
    }
    if (fought) continue;
    /* 4: advance toward near foes; otherwise rally on forest near spawn
       and let the aggro blob come (defensive play) */
    if (tryAdvance(G)) continue;
    break; /* nothing left to do */
  }
  /* end phase */
  G.deselect();
  pressKey('e');
  pump(1, 60);   /* let the engine process the endturn press */
  let pumps = 0;
  while (G.state === 'chapter' && G.phase === 'enemy' && pumps < 800) { pump(1, 60); pumps++; }
  settle(100);
}

/* advance a unit toward the nearest enemy, preferring forest/fort tiles;
   avoids ending adjacent to 2+ enemies when an alternative exists */
function tryAdvance(G) {
  for (const pid of UNIT_ORDER) {
    const p = G.units.find(u => u.id === pid && E.Units.isAlive(u) && !u.acted && !u.dead);
    if (!p) continue;
    G.deselect();
    G.selectUnit(p);            /* refresh moveTiles for THIS unit */
    /* healers keep their distance */
    const standOff = p.id === 'mira' ? 3 : (p.id === 'lia' ? 2 : 0);
    /* engage only foes within 6 tiles; otherwise hold the rally forest */
    const RALLY = { x: 6, y: 22 };
    const foes = G.units.filter(e => E.Units.isAlive(e) && e.team === 'enemy');
    /* threats = aggressive enemies or anything already close; guards don't count */
    const threats = foes.filter(e => e.ai === 'aggro' ||
      Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 8);
    const nearFoe = threats.length ? Math.min(...threats.map(e => Math.abs(e.x - p.x) + Math.abs(e.y - p.y))) : 0;
    let best = null;
    for (const t of G.moveTiles) {
      let nearest = 1e9;
      let adj = 0;
      for (const e of foes) {
        const d = Math.abs(e.x - t.x) + Math.abs(e.y - t.y);
        if (d < nearest) nearest = d;
        if (d === 1) adj++;
      }
      if (nearest === 1e9) continue;
      /* when no threats remain, push toward the keep via normal scoring */
      if (nearFoe === 0) {
        if (!best || -nearest > best.score) best = { t, score: -nearest };
        continue;
      }
      if (nearFoe > 6) {
        const rr = Math.abs(t.x - RALLY.x) + Math.abs(t.y - RALLY.y);
        if (!best || -rr > best.score) best = { t, score: -rr };
        continue;
      }
      if (standOff && nearest < standOff) continue;
      const terr = G.terrainAt(t.x, t.y);
      const defens = (terr.def || 0) + (terr.avoid || 0) / 20;
      const danger = adj >= 2 ? 3 : 0;
      const score = -nearest + defens - danger;
      if (!best || score > best.score) best = { t, score };
    }
    if (!best) {
      /* standoff unit: wait in place */
      if (standOff) {
        G.cursor.x = p.x; G.cursor.y = p.y;
        pressKey('z'); pump(2);
        if (G.mode === 'menu') {
          const wi = G.menuItems.findIndex(m => m.act === 'wait');
          G.menuSel = wi >= 0 ? wi : G.menuItems.length - 1;
          pressKey('z'); pump(2);
          return true;
        }
      }
      G.deselect();
      continue;
    }
    G.cursor.x = best.t.x; G.cursor.y = best.t.y;
    pressKey('z'); pump(2);
    if (G.mode !== 'menu') { undo(G); continue; }
    const wi = G.menuItems.findIndex(m => m.act === 'wait');
    G.menuSel = wi >= 0 ? wi : G.menuItems.length - 1;
    pressKey('z'); pump(2);
    return true;
  }
  G.deselect();
  return false;
}

/* sticky focus target: prevents enemy healing from splitting damage */
let stickyFoe = null;

/* drink a potion when badly wounded (UI path) */
function tryPotion(G) {
  for (const pid of UNIT_ORDER) {
    const p = G.units.find(u => u.id === pid && E.Units.isAlive(u) && !u.acted && !u.dead);
    if (!p || p.hp >= p.maxhp * 0.45) continue;
    const pot = p.items.find(it => it.kind === 'heal' && it.uses > 0);
    if (!pot) continue;
    G.deselect();
    G.selectUnit(p);
    G.cursor.x = p.x; G.cursor.y = p.y;
    pressKey('z'); pump(2);
    if (G.mode !== 'menu') { undo(G); continue; }
    const ii = G.menuItems.findIndex(m => m.act === 'items');
    if (ii < 0) { undo(G); continue; }
    G.menuSel = ii; pressKey('z'); pump(2);
    if (G.mode !== 'submenu') { undo(G); continue; }
    const si = G.submenu.unit.items.indexOf(pot);
    G.submenu.sel = si >= 0 ? si : 0;
    pressKey('z'); pump(2);
    if (G.mode !== 'itemaction') { undo(G); continue; }
    const ui = 1; /* Use */
    G.itemActionMenu.sel = ui;
    pressKey('z'); pump(2);
    settle(50);
    return true;
  }
  return false;
}

function runOnce(idx) {
  const G = newRun();
  stickyFoe = null;
  const startLevels = {};
  for (const u of G.units) if (u.team === 'player') startLevels[u.id] = u.level;
  let turns = 0;
  while (G.state === 'chapter' && turns < 30) {
    playerPhase(G);
    turns++;
    if (G.state !== 'chapter') break;
  }
  const out = {
    result: G.state === 'results' ? 'win' : (G.state === 'gameover' ? 'loss' : 'timeout'),
    turns,
    deaths: G.units.filter(u => u.team === 'player' && u.dead).map(u => u.name),
    levels: {},
    bossSlain: !G.units.some(u => u.bossKey && E.Units.isAlive(u)),
    endMode: G.mode, endPhase: G.phase, endTurn: G.turn,
    enemiesLeft: G.units.filter(u => u.team === 'enemy' && E.Units.isAlive(u)).length,
    playersLeft: G.units.filter(u => u.team === 'player' && E.Units.isAlive(u)).length,
  };
  for (const u of G.units) if (u.team === 'player' && startLevels[u.id] !== undefined) {
    out.levels[u.name] = u.level - startLevels[u.id];
  }
  return out;
}

/* ================= RUN THE SUITE ================= */
const RUNS = 40;
const results = [];
for (let i = 0; i < RUNS; i++) results.push(runOnce(i));

const wins = results.filter(r => r.result === 'win');
const losses = results.filter(r => r.result === 'loss');
const timeouts = results.filter(r => r.result === 'timeout');
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;

console.log('================= PLAYTEST RESULTS =================');
console.log(`runs: ${RUNS}  win: ${wins.length} (${Math.round(100 * wins.length / RUNS)}%)  loss: ${losses.length}  timeout: ${timeouts.length}`);
console.log(`avg turns (wins): ${avg(wins.map(r => r.turns)).toFixed(1)}  min/max: ${wins.length ? Math.min(...wins.map(r => r.turns)) + '/' + Math.max(...wins.map(r => r.turns)) : 'n/a'}`);
if (timeouts.length) {
  const t = timeouts[0];
  console.log(`timeout sample: turn=${t.endTurn} mode=${t.endMode} phase=${t.endPhase} enemies=${t.enemiesLeft} players=${t.playersLeft}`);
  console.log(`  bossSlain=${t.bossSlain} deaths=${JSON.stringify(t.deaths)}`);
}
const deaths2 = {};
for (const r of results) for (const d of r.deaths) deaths2[d] = (deaths2[d] || 0) + 1;
console.log('player deaths by unit:', JSON.stringify(deaths2));
const lvTotals = {};
for (const r of wins) for (const [k, v] of Object.entries(r.levels)) lvTotals[k] = (lvTotals[k] || 0) + v;
console.log('total levels gained (wins):', JSON.stringify(lvTotals));
console.log(`combat: swings=${tally.swings} hit=${tally.hits} crit=${tally.crits} miss=${tally.misses} (hit%=${Math.round(100 * tally.hits / Math.max(1, tally.swings))}, crit%=${Math.round(100 * tally.crits / Math.max(1, tally.hits))})`);
console.log(`damage: dealt by players=${tally.dmgByPlayers} taken by players=${tally.dmgToPlayers} player kills=${tally.killsByPlayers}`);

/* ================= PROBES ================= */
console.log('\n---------------- PROBES ----------------');
let probeFails = 0;
function probe(c, m) { if (c) console.log('  ok  ' + m); else { probeFails++; console.log('  FAIL ' + m); } }

/* P1: boss holds post until provoked (zone aggro) */
{
  const G = newRun();
  const boss = G.units.find(u => u.bossKey);
  const bx = boss.x, by = boss.y;
  /* park a player just outside the zone (zone x1=24) */
  const rowan = G.units.find(u => u.id === 'rowan');
  rowan.x = 21; rowan.y = 11;
  for (let t = 0; t < 3 && G.state === 'chapter'; t++) {
    pressKey('e');
    pump(1, 60);
    let pumps = 0;
    while (G.state === 'chapter' && G.phase === 'enemy' && pumps < 600) { pump(1, 60); pumps++; }
  }
  probe(boss.x === bx && boss.y === by, 'P1 boss holds throne until provoked');
}

/* P2: heal tiles restore HP on phase tick (fort/throne), using a parked unit */
{
  const G = newRun();
  const mira = G.units.find(u => u.id === 'mira');
  mira.x = 22; mira.y = 8;                    /* fort tile, heal 10% */
  probe(E.GameMap.tileAt(22, 8) === 'fort', 'P2 setup: (22,8) is a fort');
  const before = Math.floor(mira.maxhp / 2);
  mira.hp = before;
  /* park enemies away so nothing attacks or moves the subject */
  for (const u of G.units) {
    if (u.team === 'enemy' && E.Units.isAlive(u)) {
      if (u.ai === 'boss') { u.x = 28; u.y = 11; }  /* back on his throne */
      else { u.x = 1; u.y = 1 + (u.id.length % 3); }
    }
  }
  pressKey('e');
  pump(1, 60);
  let pumps = 0;
  while (G.state === 'chapter' && G.phase === 'enemy' && pumps < 800) { pump(1, 60); pumps++; }
  probe(mira.hp > before, 'P2 heal tile restores HP on phase tick (' + before + ' -> ' + mira.hp + ')');
}

/* P3: key flow — village key opens chest; door key opens door; keep path opens */
{
  const G = newRun();
  const rowan = G.units.find(u => u.id === 'rowan');
  /* simulate reaching places (teleport = admin shortcut, actions still via engine) */
  rowan.x = 21; rowan.y = 6;
  probe(tryVisit(G, 'rowan', 21, 6), 'P3a visited village');
  probe(rowan.items.some(i => i.dbId === 'chest_key'), 'P3b rowan received chest key');
  rowan.x = 8; rowan.y = 3; rowan.acted = false;
  probe(tryChest(G, 'rowan', 8, 3), 'P3c opened chest with key');
  probe(rowan.items.some(i => i.dbId === 'killer_sword'), 'P3d got killer sword');
  const brynn = G.units.find(u => u.id === 'brynn');
  brynn.x = 23; brynn.y = 12; brynn.acted = false;   /* road tile left of the door */
  brynn.items.push(E.Items.make('door_key'));
  probe(tryDoor(G, 'brynn'), 'P3e opened keep door');
  probe(E.GameMap.tileAt(24, 12) === 'doorOpen', 'P3f door tile now open');
  rowan.x = 25; rowan.y = 12; rowan.acted = false;
  const reach = E.GameMap.reachable(rowan.x, rowan.y, rowan.move, rowan.moveType, 'player');
  probe(reach.cost.has(13 * 32 + 28) || reach.cost.has(11 * 32 + 27), 'P3g keep interior reachable through door');
}

/* P4: enemies never stack / guard stays near post */
{
  const G = newRun();
  for (let t = 0; t < 5 && G.state === 'chapter'; t++) {
    pressKey('e');
    pump(1, 60);
    let pumps = 0;
    while (G.state === 'chapter' && G.phase === 'enemy' && pumps < 600) { pump(1, 60); pumps++; }
  }
  const seen = new Set();
  let stacked = false;
  for (const u of G.units) {
    if (!E.Units.isAlive(u) || u.carriedBy) continue;
    const k = u.x + ',' + u.y;
    if (seen.has(k)) stacked = true;
    seen.add(k);
  }
  probe(!stacked, 'P4 no two units share a tile after 5 enemy phases');
  const guard = G.units.find(u => u.id === 'e_arch1');
  probe(guard && Math.abs(guard.x - 13) + Math.abs(guard.y - 11) <= 6, 'P4b guard stayed near post');
}

/* P5: game over triggers when rowan dies */
{
  const G = newRun();
  const rowan = G.units.find(u => u.id === 'rowan');
  rowan.x = 13; rowan.y = 12; rowan.hp = 1;  /* bridge, in enemy territory */
  rowan.stats.spd = -40; rowan.stats.luk = 0;  /* enemy hit is guaranteed */
  G.endPlayerPhase();
  let pumps = 0;
  while (G.state === 'chapter' && pumps < 600) { pump(1, 60); pumps++; }
  probe(G.state === 'gameover', 'P5 rowan death -> game over');
}

/* P6: save mid-chapter, load, continue */
{
  const G = newRun();
  for (let t = 0; t < 3 && G.state === 'chapter'; t++) playerPhase(G);
  const turnSaved = G.turn;
  const okSave = E.SaveLoad.save({ t: 1 });
  const data = E.SaveLoad.load();
  const G2 = E.Game;
  G2.startChapter('ch1', data);
  settle(50);
  probe(okSave && G2.turn === turnSaved, 'P6a load restores turn count');
  probe(G2.units.filter(u => u.team === 'player').length >= 4, 'P6b roster restored');
  playerPhase(G2);
  probe(G2.state === 'chapter' || G2.state === 'results', 'P6c play continues after load');
}

/* P7: disarmed unit can still act (no soft-lock) */
{
  const G = newRun();
  const garrick = G.units.find(u => u.id === 'garrick');
  garrick.items = []; garrick.weapon = null;
  G.deselect(); G.selectUnit(garrick);
  G.cursor.x = garrick.x; G.cursor.y = garrick.y;
  pressKey('z'); pump(2);
  const hasWait = G.mode === 'menu' && G.menuItems.some(m => m.act === 'wait');
  G.menuSel = G.menuItems.length - 1; pressKey('z'); pump(2);
  probe(hasWait && garrick.acted, 'P7 weaponless unit can still Wait');
}

/* P8: attack menu never offered with empty durability weapons */
{
  const G = newRun();
  const sela = G.units.find(u => u.id === 'sela');
  for (const it of sela.items) it.uses = 0;
  E.Units.equipBest(sela);
  probe(sela.weapon === null || sela.weapon === undefined, 'P8 broken weapons auto-unequip');
}

console.log('\n================= PROBE SUMMARY =================');
console.log(probeFails === 0 ? 'ALL PROBES PASSED' : probeFails + ' PROBES FAILED');
process.exit(probeFails ? 1 : 0);
