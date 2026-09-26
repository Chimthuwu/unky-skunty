/* Node smoke test for the pure game logic (no browser needed). */
'use strict';
const fs = require('fs');
const vm = require('vm');

const ctx = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp, Infinity, NaN,
  isFinite, parseInt, parseFloat,
};
vm.createContext(ctx);

/* localStorage stub */
const store = {};
ctx.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const FILES = [
  'js/core/utils.js',
  'js/core/config.js',
  'js/data/terrain.js',
  'js/data/weapons.js',
  'js/data/items.js',
  'js/data/classes.js',
  'js/data/characters.js',
  'js/data/chapter1.js',
  'js/game/units.js',
  'js/game/map.js',
  'js/game/combat.js',
  'js/game/ai.js',
  'js/game/save.js',
];
for (const f of FILES) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });

const code = `
/* ---------------- test harness ---------------- */
let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { failures++; console.log('  FAIL ' + msg); }
}

/* stub Game hooks the logic expects from the engine */
const Game = {
  units: [],
  chapterId: 'ch1',
  turn: 1,
  phase: 'player',
  gold: 1500,
  visited: new Set(),
  opened: new Set(),
  mapOverrides: {},
  terrainAt(x, y) { return GameMap.terrainAt(x, y); },
  aiAttack(u, target, x, y) {
    u.x = x; u.y = y;
    Combat.run(u, target, () => {});
    u.acted = true;
    return 'attack';
  },
  aiMove(u, path) {
    const last = path[path.length - 1];
    u.x = last[0]; u.y = last[1];
    u.acted = true;
    return 'move';
  },
  aiHeal(u, target) {
    const exp = Combat.heal(u, target, () => {});
    u.acted = true;
    return 'heal';
  },
  aiWait(u) { u.acted = true; return 'wait'; },
};

/* ---------------- setup ---------------- */
GameMap.load(ChapterDB.ch1);
ok(GameMap.w === 32 && GameMap.h === 24, 'map is 32x24 (' + GameMap.w + 'x' + GameMap.h + ')');

const deploySpots = [[4,21],[5,21],[4,22],[5,22],[6,21],[6,22]];
const chars = ChapterDB.ch1.playerDeploy.map(p => p.charId);
chars.forEach((cid, i) => {
  const u = Units.makePlayerUnit(cid);
  u.x = deploySpots[i][0]; u.y = deploySpots[i][1];
  Game.units.push(u);
});
for (const spawn of ChapterDB.ch1.units) Game.units.push(Units.makeNPCUnit(spawn));
const players = Game.units.filter(u => u.team === 'player');
const enemies = Game.units.filter(u => u.team === 'enemy');
ok(players.length === 6, '6 players spawned');
ok(enemies.length === 13, '13 enemies spawned (incl. boss)');

const rowan = players.find(u => u.id === 'rowan');
const brynn = players.find(u => u.id === 'brynn');
const mira  = players.find(u => u.id === 'mira');
const brig  = enemies.find(u => u.id === 'e_brig1');
const boss  = enemies.find(u => u.id === 'boss');
ok(!!brig && !!boss, 'expected enemies present');
ok(boss.maxhp >= 20, 'boss has chunky HP (' + boss.maxhp + ')');

/* stats sanity */
for (const u of Game.units) {
  if (!(u.maxhp >= 10 && u.stats.str >= 0 && u.stats.def >= 0 && u.weapon !== undefined)) {
    ok(false, 'stat sanity for ' + u.name);
  }
}
ok(true, 'all units have sane stats and weapons');

/* terrain */
ok(GameMap.terrainAt(28, 11).name === 'Throne', 'boss tile is Throne');
ok(GameMap.moveCost(28, 11, 'flyer') === 1, 'flyer crosses anything at cost 1 (no flyer in ch1)');
ok(GameMap.moveCost(28, 11, 'infantry') === 1, 'throne walkable');
ok(GameMap.terrainAt(10, 12).name === 'Bridge', 'bridge tile present');
ok(GameMap.terrainAt(28, 9).name === 'Wall', 'wall impassable');
ok(GameMap.moveCost(28, 9, 'infantry') === 99, 'wall cost 99');

/* movement */
const mr = GameMap.moveRange(rowan);
ok(mr.length > 5, 'rowan has movement options (' + mr.length + ')');
ok(mr.some(t => t.x === 4 && t.y === 21), 'includes current tile');
ok(!mr.some(t => t.x === 28 && t.y === 4), 'walls excluded from range');
const reach = GameMap.reachable(rowan.x, rowan.y, rowan.move, rowan.moveType, rowan.team);
const path = GameMap.pathTo(reach, rowan.x, rowan.y, 3, 23);
ok(Array.isArray(path) && path[0][0] === rowan.x && path[path.length-1][0] === 3 && path[path.length-1][1] === 23, 'path reconstructs to target');

/* occupied tiles excluded */
const occ = GameMap.unitAt(brynn.x, brynn.y);
ok(occ === brynn, 'unitAt finds brynn');
ok(!mr.some(t => t.x === brynn.x && t.y === brynn.y && !(t.x === rowan.x && t.y === rowan.y)) || brynn.x !== 5, 'cannot land on ally tile');

/* forecast */
const fc = Units.forecast(rowan, brig);
ok(fc.a.hit >= 0 && fc.a.hit <= 100, 'forecast hit in [0,100]');
ok(fc.a.mt >= 0 && fc.d.mt >= 0, 'forecast damage non-negative');
ok(fc.aHp === rowan.hp && fc.dHp === brig.hp, 'forecast HP correct');

/* full combat: brigand vs rowan at adjacent tiles */
brig.x = rowan.x + 1; brig.y = rowan.y;
const hpBefore = brig.hp;
const events = [];
Combat.run(rowan, brig, (e) => events.push(e.type));
ok(events.includes('hit') || events.includes('crit') || events.includes('miss'), 'combat produced strikes');
ok(brig.hp < hpBefore || events.includes('miss'), 'damage applied (or miss)');
ok(brig.weapon === null || brig.weapon.uses >= 0, 'durability did not go negative');

/* heal */
mira.weapon = mira.items.find(i => i.type === 'staff');
rowan.hp = 5;
const healed = Combat.heal(mira, rowan, () => {});
ok(healed > 0, 'staff heals (+' + healed + ')');
ok(rowan.hp === Math.min(rowan.maxhp, 5 + healed), 'heal math correct');
ok(mira.items.find(i => i.type === 'staff').uses === 29, 'staff durability decreased');

/* exp + level up */
const lv0 = rowan.level;
const res = Units.gainExp(rowan, 100, null);
ok(res.levels.length >= 1 && rowan.level > lv0, '100 exp -> level up');
ok(Object.keys(res.levels[0]).length >= 1, 'level-up grants at least 1 stat (GBA rule)');

/* kill exp */
const kexp = Units.expForKill(rowan, brig);
ok(kexp >= 10 && kexp <= 100, 'kill exp sane (' + kexp + ')');

/* promotion */
rowan.level = 10;
rowan.exp = 0;
ok(Units.canPromote(rowan), 'promotion eligible at lv10');
const oldClass = rowan.classId;
ok(Units.promote(rowan) && rowan.classId === 'vanguard', 'rowan promotes Commander->Vanguard');
ok(rowan.promoted === true && rowan.level === 1, 'promotion resets level to 1');
ok(rowan.stats.str > 6, 'promotion boosts stats');

/* enemy scaling */
const bossFc = Units.forecast(rowan, boss);
ok(bossFc.dHp >= 20, 'boss HP in forecast (' + bossFc.dHp + ')');
ok(bossFc.a.hit <= 100, 'boss forecast valid');

/* AI: aggro enemy attacks nearest player */
brig.x = 6; brig.y = 12; brig.hp = Math.max(1, brig.hp); brig.acted = false;
const before = { x: brig.x, y: brig.y };
const action = AI.act(brig);
ok(action === 'attack' || action === 'move' || action === 'wait', 'AI.act returned action (' + action + ')');
if (action === 'attack') {
  const anyPlayerHurt = players.some(p => p.hp < p.maxhp) || brig.hp < brig.maxhp;
  ok(anyPlayerHurt, 'AI attack landed somewhere');
}

/* AI healer heals wounded ally */
const cantor = enemies.find(u => u.id === 'e_priest1');
const hexer = enemies.find(u => u.id === 'e_hex1');
hexer.hp = 4;
cantor.x = 26; cantor.y = 12;
const hAct = AI.act(cantor);
ok(hAct === 'heal', 'healer AI heals (got ' + hAct + ')');
ok(hexer.hp > 4, 'hexer was healed to ' + hexer.hp);

/* boss AI holds post */
boss.x = 28; boss.y = 11; boss.acted = false;
Game.units.filter(u => u.team === 'player').forEach(p => { p.x = 4; p.y = 21; });
const bAct = AI.act(boss);
ok(bAct === 'wait' || bAct === 'move', 'boss waits/holds until provoked');

/* guard AI does not chase across map */
const guard = enemies.find(u => u.id === 'e_arch1');
guard.x = 13; guard.y = 11; guard.acted = false;
Game.units.filter(u => u.team === 'player').forEach(p => { p.x = 4; p.y = 21; });
AI.act(guard);
ok(Utils.dist(guard.x, guard.y, 13, 11) <= guard.move + 1, 'guard stayed near post');

/* save/load roundtrip */
const saveOk = SaveLoad.save({ test: true });
ok(saveOk, 'save wrote to storage');
const snap = SaveLoad.load();
ok(snap && snap.units.length === Game.units.length, 'snapshot has all units');
const restored = SaveLoad.restoreUnits(snap);
ok(restored.length === Game.units.length, 'restoreUnits rebuilds units');
const rRowan = restored.find(u => u.id === 'rowan');
ok(rRowan.classId === 'vanguard' && rRowan.level === 1, 'restored rowan keeps promotion');
ok(rRowan.items.length >= 1, 'restored rowan has items');

/* item db integrity */
const pot = Items.make('potion');
ok(pot.uses === 3 && pot.kind === 'heal', 'item factory works');
const ke = Items.make('killer_sword');
ok(ke.crit === 30 && ke.type === 'sword', 'weapon factory works');

/* ranks */
ok(Units.canWield(rowan, Items.make('iron_sword')), 'vanguard wields iron sword (rank C)');
ok(!Units.canWield(rowan, Items.make('silver_axe')), 'vanguard cannot wield axes');

console.log(failures === 0 ? '\\nALL SMOKE TESTS PASSED' : '\\n' + failures + ' FAILURES');
if (failures > 0) throw new Error(failures + ' smoke test failures');
`;

try {
  vm.runInContext(code, ctx, { filename: 'smoke-inline' });
} catch (e) {
  console.error('SMOKE TEST CRASHED:', e.stack);
  process.exit(1);
}
