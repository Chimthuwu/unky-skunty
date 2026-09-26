/* =============================================================
   MAP LOGIC — terrain queries, Dijkstra movement, range overlays.
   No rendering. Game state is held in the Game object (engine.js).
   ============================================================= */
'use strict';

const GameMap = {
  /* ---------- setup ---------- */
  load(chapter) {
    this.w = 0; this.h = 0;
    this.tiles = [];
    for (let y = 0; y < chapter.map.length; y++) {
      const row = chapter.map[y];
      this.tiles[y] = [];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const id = TILE_CHARS[ch] || 'plain';
        this.tiles[y][x] = id;
        if (id === 'village' || id === 'house' || id === 'chest' || id === 'door') {
          this.interactables = this.interactables || [];
        }
      }
    }
    this.h = this.tiles.length;
    this.w = this.tiles[0].length;
  },

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 'wall';
    const ov = (typeof Game !== 'undefined' && Game.mapOverrides) ? Game.mapOverrides[y * 1000 + x] : null;
    if (ov) return ov;
    return this.tiles[y][x];
  },

  terrainAt(x, y) {
    const t = this.tileAt(x, y);
    /* chest tiles revert to plain-floor behavior once opened */
    return TerrainDB[t] || TerrainDB.plain;
  },

  moveCost(x, y, moveType) {
    const t = this.tileAt(x, y);
    let base = (TerrainDB[t] || TerrainDB.plain).move;
    if (base >= 99) return 99;
    const over = MOVE_COST_OVER[t];
    if (over) {
      const v = over[moveType];
      if (v === 99) return 99;
      if (typeof v === 'number') base = v;
    }
    if (moveType === 'flyer') return 1;
    return base;
  },

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; },

  unitAt(x, y) {
    return (Game.units || []).find(u => Units.isAlive(u) && u.x === x && u.y === y) || null;
  },

  /* ---------- movement ranges ---------- */

  /* Dijkstra from (sx,sy) for a unit. Returns { cost:Map<idx,cost>, prev:{} } */
  reachable(sx, sy, move, moveType, team, opts) {
    opts = opts || {};
    const start = sy * this.w + sx;
    const cost = new Map();
    const prev = new Map();
    cost.set(start, 0);
    const pq = [[0, sx, sy]];
    while (pq.length) {
      /* tiny maps: linear scan is fine and allocation-free */
      let bi = 0;
      for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
      const [d, x, y] = pq.splice(bi, 1)[0];
      if (d > (cost.get(y * this.w + x) ?? Infinity)) continue;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const c = this.moveCost(nx, ny, moveType);
        if (c >= 99) continue;
        const nd = d + c;
        if (nd > move) continue;
        const occ = this.unitAt(nx, ny);
        if (occ && occ.team !== team) continue;
        const key = ny * this.w + nx;
        if (nd < (cost.get(key) ?? Infinity)) {
          cost.set(key, nd);
          prev.set(key, [x, y]);
          pq.push([nd, nx, ny]);
        }
      }
    }
    return { cost, prev };
  },

  /* Movement range: reachable tiles ignoring enemy-occupied, but
     excluding tiles occupied by ANY unit except self (can stand only on empty). */
  moveRange(u) {
    const { cost } = this.reachable(u.x, u.y, u.move, u.moveType, u.team);
    const out = [];
    for (const key of cost.keys()) {
      const x = key % this.w, y = (key / this.w) | 0;
      const occ = this.unitAt(x, y);
      if (occ && occ !== u) continue;
      out.push({ x, y, cost: cost.get(key) });
    }
    return out;
  },

  /* Tiles attackable after moving (union over move range + weapon range). */
  attackRangeFrom(u, moveTiles) {
    const w = u.weapon;
    if (!w) return new Set();
    const set = new Set();
    const ranges = Units.weaponRange(w);
    for (const t of moveTiles) {
      for (const r of ranges) {
        for (const [dx, dy] of RING[r] || []) {
          const x = t.x + dx, y = t.y + dy;
          if (!this.inBounds(x, y)) continue;
          set.add(y * this.w + x);
        }
        /* full ring for radius>2 without precomputed ring */
        if (!RING[r]) {
          for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) + Math.abs(dy) !== r) continue;
            const x = t.x + dx, y = t.y + dy;
            if (!this.inBounds(x, y)) continue;
            set.add(y * this.w + x);
          }
        }
      }
      /* also the tile itself for 0-range (staffs handled separately) */
      set.add(t.y * this.w + t.x);
    }
    return set;
  },

  /* Attack-only ring(s) from a fixed position (used for red enemy threat). */
  attackTilesAt(u) {
    const w = u.weapon;
    if (!w || w.type === 'staff') return new Set();
    const set = new Set();
    for (const r of Units.weaponRange(w)) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        const x = u.x + dx, y = u.y + dy;
        if (!this.inBounds(x, y)) continue;
        set.add(y * this.w + x);
      }
    }
    return set;
  },

  /* ---------- path reconstruction ---------- */
  pathTo(reach, sx, sy, tx, ty) {
    const target = ty * this.w + tx;
    if (!reach.cost.has(target)) return null;
    const path = [];
    let cur = [tx, ty];
    while (cur) {
      path.push(cur);
      if (cur[0] === sx && cur[1] === sy) break;
      cur = reach.prev.get(cur[1] * this.w + cur[0]) || null;
    }
    return path.reverse();
  },

  /* ---------- heal targets for staff users ---------- */
  healableAllies(u) {
    const w = u.weapon;
    if (!w || w.type !== 'staff') return [];
    const range = Units.weaponRange(w);
    const out = [];
    for (const ally of Game.units) {
      if (!Units.isAlive(ally) || ally.team !== u.team) continue;
      const d = Math.abs(ally.x - u.x) + Math.abs(ally.y - u.y);
      if (!range.includes(d)) continue;
      if (ally.hp >= ally.maxhp) continue;
      if (ally.carriedBy) continue;
      out.push(ally);
    }
    return out;
  },
};

const DIR4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/* map-string char -> terrain id (see chapter data legend) */
const TILE_CHARS = {
  p: 'plain',  r: 'road',   f: 'forest', t: 'thicket',
  m: 'mountain', P: 'peak', R: 'river',  B: 'bridge',
  '~': 'water', W: 'wall',  F: 'fort',   T: 'throne',
  H: 'house',  V: 'village', v: 'ruined', C: 'chest', D: 'door',
  '#': 'rubble', b: 'floor', c: 'carpet', o: 'pillar', s: 'sky',
};
const RING = {};
for (let r = 1; r <= 3; r++) {
  const arr = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.abs(dx) + Math.abs(dy) === r) arr.push([dx, dy]);
  }
  RING[r] = arr;
}
const MOVE_COST_OVER = {
  forest: { cavalry: 3, armor: 2 },
  thicket: { cavalry: 99, armor: 3 },
  mountain: { cavalry: 99, armor: 4 },
  peak: { cavalry: 99, armor: 99 },
  river: { armor: 99 },
  wall: {},
  fort: {},
};
