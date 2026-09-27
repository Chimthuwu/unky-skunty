/* =============================================================
   TACTICS BOARD — the old 2D game's ghost, on death.

   This is not the tactics RPG that used to live here. That game was
   deleted on purpose and nobody is asking for it back. This is a
   single-map skirmish: a grid, terrain, a cursor, one unit you can
   move and a few you can hit, and an enemy phase. It exists so that
   dying can put the screen back on the thing you were playing before
   this was a first-person horror game, looking for exactly long
   enough to be recognisable and wrong.

   The whole thing is a cutscene you get one input into: the moment
   you commit to a move, the sequence takes over. So it is built for
   looking right first and playing second.
   ============================================================= */
'use strict';

const Tactics = (() => {

  const MAP_W = 15, MAP_H = 9;
  const TS = 16;                          /* tile size, the engine's own */

  /* A small map with a road through it, woods either side and a fort
     at the top. Hand-authored, because the point is that it looks
     deliberate rather than hashed. */
  const LAYOUT = [
    '.....f...ff.....',
    '..ff.......ff...',
    '.....r..........',
    '.ff...rrr...ff..',
    '.....r.....f....',
    '..ff...r...ff...',
    '.....r.........F',
    '....rrr.....ff..',
    '.....r....ff....',
  ];

  const BLOCKING = { mountain: 1, peak: 1, water: 1, river: 1, wall: 1, house: 1, village: 1 };
  /* woods you can walk into but not through quickly — kept as a
     movement cost rather than a wall so the cursor can still reach
     everywhere it needs to */
  const COST = { forest: 2, thicket: 2, mountain: 99, peak: 99, water: 99, river: 99, wall: 99 };

  function tileId(ch) {
    switch (ch) {
      case 'f': return 'forest';
      case 'r': return 'road';
      case 'F': return 'fort';
      case 'w': return 'water';
      default: return 'plain';
    }
  }

  function create() {
    const tiles = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = [];
      for (let x = 0; x < MAP_W; x++) row.push(tileId(LAYOUT[y][x]));
      tiles.push(row);
    }
    const costOf = (x, y) => COST[tiles[y][x]] || 1;
    const passable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && costOf(x, y) < 99;

    /* One of you, three of them. Kinds come from the old roster so the
       sprites are the ones the game used to draw. */
    const units = [
      { kind: 'pvanguard', team: 'blue', x: 2, y: 7, hp: 20, max: 20, atk: 7, frame: 0 },
      { kind: 'earcher', team: 'red', x: 9, y: 4, hp: 14, max: 14, atk: 5, frame: 0 },
      { kind: 'ebrigand', team: 'red', x: 11, y: 5, hp: 18, max: 18, atk: 8, frame: 0 },
      { kind: 'eshaman', team: 'red', x: 6, y: 2, hp: 12, max: 12, atk: 6, frame: 0 },
    ];

    const hero = units[0];
    const foes = units.slice(1);

    let cx = hero.x, cy = hero.y;          /* cursor */
    let selected = false;
    let phase = 'player';                  /* player | enemy | done */
    let t = 0;
    let movesMade = 0;
    let log = '';
    let logT = 0;

    /* reachable squares from the hero, by cost — a real move range, not
       an unlimited walk, so the cursor means something */
    function reach(maxCost) {
      const seen = new Set();
      const d = new Map();
      const start = hero.y * MAP_W + hero.x;
      d.set(start, 0); seen.add(start);
      const queue = [[hero.x, hero.y, 0]];
      while (queue.length) {
        const [x, y, c] = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!passable(nx, ny)) continue;
          const nc = c + costOf(nx, ny);
          if (nc > maxCost) continue;
          const k = ny * MAP_W + nx;
          if (seen.has(k)) continue;
          seen.add(k); d.set(k, nc);
          queue.push([nx, ny, nc]);
        }
      }
      return seen;
    }

    function unitAt(x, y) {
      for (const u of units) if (!u.dead && u.x === x && u.y === y) return u;
      return null;
    }

    /* a step-by-step walk along the cheapest path, so the unit visibly
       crosses the map instead of teleporting to the cursor */
    function pathTo(tx, ty) {
      const prev = new Map();
      const start = hero.y * MAP_W + hero.x;
      const goal = ty * MAP_W + tx;
      const seen = new Set([start]);
      const q = [[hero.x, hero.y]];
      while (q.length) {
        const [x, y] = q.shift();
        if (y * MAP_W + x === goal) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!passable(nx, ny)) continue;
          const k = ny * MAP_W + nx;
          if (seen.has(k)) continue;
          seen.add(k); prev.set(k, y * MAP_W + x);
          q.push([nx, ny]);
        }
      }
      if (!seen.has(goal)) return null;
      const path = [];
      let cur = goal;
      while (cur !== start) {
        path.unshift([cur % MAP_W, (cur / MAP_W) | 0]);
        cur = prev.get(cur);
      }
      return path;
    }

    function say(s) { log = s; logT = 2200; }

    function resolvePlayerMove(tx, ty) {
      const target = unitAt(tx, ty);
      if (target && target.team === 'red') {
        target.hp -= hero.atk;
        hero.frame = 1; say('you hit for ' + hero.atk);
        if (target.hp <= 0) { target.dead = true; say('one down'); }
      } else {
        const p = pathTo(tx, ty);
        /* no route, or the cursor is still on your own square — neither
           is a move, so neither trips the sequence */
        if (!p || !p.length) return false;
        const [nx, ny] = p[p.length - 1];
        hero.x = nx; hero.y = ny;
        say('you move');
      }
      movesMade++;
      phase = 'enemy';
      return true;
    }

    /* Enemies walk one square at you and swing if they end up next to
       you. Crude, but it reads as a battle at this size. */
    function enemyPhase() {
      for (const f of foes) {
        if (f.dead) continue;
        let best = null, bestD = 1e9;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = f.x + dx, ny = f.y + dy;
          if (!passable(nx, ny)) continue;
          const d = Math.abs(nx - hero.x) + Math.abs(ny - hero.y);
          if (d < bestD) { bestD = d; best = [nx, ny]; }
        }
        if (!best) continue;
        const occupant = unitAt(best[0], best[1]);
        if (occupant === hero) {
          hero.hp -= f.atk;
          say(f.kind + ' hits you for ' + f.atk);
          if (hero.hp <= 0) { say('you are dead again'); phase = 'done'; }
          continue;
        }
        if (occupant) continue;
        f.x = best[0]; f.y = best[1];
        if (Math.abs(f.x - hero.x) + Math.abs(f.y - hero.y) === 1) {
          hero.hp -= f.atk;
          say(f.kind + ' hits you for ' + f.atk);
          if (hero.hp <= 0) { say('you are dead again'); phase = 'done'; }
        }
      }
      if (phase !== 'done') { phase = 'player'; hero.frame = 0; }
    }

    let enemyTimer = 0;

    function update(dt, input) {
      t += dt;
      if (logT > 0) logT -= dt;
      if (phase === 'enemy') {
        enemyTimer -= dt;
        if (enemyTimer <= 0) { enemyTimer = 420; enemyPhase(); }
        return;
      }
      if (phase !== 'player') return;

      /* cursor */
      if (input.down('left')) cx = Math.max(0, cx - 1);
      if (input.down('right')) cx = Math.min(MAP_W - 1, cx + 1);
      if (input.down('up')) cy = Math.max(0, cy - 1);
      if (input.down('down')) cy = Math.min(MAP_H - 1, cy + 1);

      if (input.pressed('confirm') || input.pressed('cancel')) {
        if (selected) {
          if (resolvePlayerMove(cx, cy)) { selected = false; enemyTimer = 300; return true; }
        } else if (cx === hero.x && cy === hero.y) {
          selected = true;
          say('choose a square');
        }
      }
      return false;
    }

    function draw(g, ox, oy) {
      /* terrain */
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const tile = typeof TileArt !== 'undefined' ? TileArt.tile(tiles[y][x], 0) : null;
          if (tile) g.drawImage(tile, ox + x * TS, oy + y * TS, TS, TS);
        }
      }

      /* move range, only while a unit is selected */
      if (selected && phase === 'player') {
        const r = reach(6);
        g.globalAlpha = 0.35;
        g.fillStyle = '#8ad0ff';
        for (const k of r) g.fillRect(ox + (k % MAP_W) * TS + 6, oy + ((k / MAP_W) | 0) * TS + 6, 4, 4);
        g.globalAlpha = 1;
      }

      /* units, painted in row order so the ones in front overlap */
      for (const u of units) {
        if (u.dead) continue;
        /* no side flip: the board is a flat front-on view, and guessing
           which way the default sprite faces is not worth it */
        const img = CharArt.unit(u.kind, u.frame, false);
        if (img) g.drawImage(img, ox + u.x * TS, oy + u.y * TS, TS, TS);
      }

      /* cursor: a bracket that breathes rather than blinks */
      const pulse = 0.55 + 0.45 * Math.sin(t / 260);
      g.globalAlpha = pulse;
      g.strokeStyle = '#f8f8d0';
      g.lineWidth = 1;
      g.strokeRect(ox + cx * TS + 0.5, oy + cy * TS + 0.5, TS - 1, TS - 1);
      g.globalAlpha = 1;

      /* health bars */
      for (const u of units) {
        if (u.dead) continue;
        const w = Math.max(1, Math.round((u.hp / u.max) * (TS - 2)));
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(ox + u.x * TS + 1, oy + u.y * TS - 3, TS - 2, 2);
        g.fillStyle = u.team === 'red' ? '#d04040' : '#68c078';
        g.fillRect(ox + u.x * TS + 1, oy + u.y * TS - 3, w, 2);
      }
    }

    return {
      update, draw,
      get w() { return MAP_W * TS; },
      get h() { return MAP_H * TS; },
      get movesMade() { return movesMade; },
      get log() { return logT > 0 ? log : ''; },
      get phase() { return phase; },
    };
  }

  return { create };
})();
