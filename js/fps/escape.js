/* =============================================================
   ESCAPE MODE — low-res first-person raycaster, Wolfenstein/DOOM
   style. A separate mini-game bolted onto the same engine: you
   are being hunted through Uncle Scunter's compound. He cannot be
   hurt — only avoided, or lost by breaking line of sight. His
   bunnies patrol the halls and CAN be shot.
   Also haunted by the old (deleted) tactics game: its enemy/hero unit
   sprites live on in CharArt, melted and given glowing red eyes, as
   roaming "nightmare" enemies that hunt you once they spot you.
   ============================================================= */
'use strict';

const EscapeMode = (() => {

  /* ---------------- map ---------------- */
  const W = 24, H = 16;

  function buildMap() {
    const grid = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) row.push((x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 1 : 0);
      grid.push(row);
    }
    const pillars = [
      [4,4],[5,4],[4,5],[5,5],
      [14,3],[15,3],[14,4],
      [9,9],[10,9],[9,10],[10,10],
      [18,7],[18,8],[19,8],
      [6,12],[7,12],[6,13],
      [16,11],[17,11],[16,12],
      [12,5],[12,6],
      [3,9],[3,10],
      [20,3],[20,4],
    ];
    for (const [x, y] of pillars) if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 1;
    return grid;
  }

  function isWall(grid, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return true;
    return grid[iy][ix] === 1;
  }

  /* quick line-of-sight test by sampling along the segment */
  function hasLOS(grid, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 0.2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(grid, x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  /* ---------------- grid-locked movement (Fire Emblem style) ----------------
     Enemies do not free-steer. Each one commits to a single step from the
     centre of the cell it occupies to the centre of an orthogonally
     adjacent cell, and only picks the next cell once it has arrived —
     the way a tactics unit walks one square of its path per move. Four
     directions only, no diagonals, which is what makes it read as Fire
     Ember rather than as a generic chase. */

  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* Scratch buffers for the search. The grid is tiny and a full BFS per
     enemy every few hundred ms is nothing, so there is no need for
     anything clever — but these are reused rather than reallocated so a
     horde doesn't churn the GC every path tick. */
  const _bfsPrev = new Int32Array(W * H);
  const _bfsFirst = new Int32Array(W * H);
  const _bfsSeen = new Int32Array(W * H);
  const _bfsQueue = new Int32Array(W * H);
  let _bfsStamp = 0;

  /* The cell to step onto when walking from (sx,sy) toward (gx,gy), or
     null if there is no route (or we're already there).

     The first step has to be carried per-node as the search runs. Taking
     "the first neighbour we happened to expand" instead is wrong: that is
     just whichever came first in DIRS4 order, and when it happens to be a
     dead end the unit walks the wrong way, re-paths on arrival, walks back
     and oscillates in place instead of advancing. */
  function bfsFirstStep(grid, sx, sy, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
    if (sx === gx && sy === gy) return null;
    const start = sy * W + sx, goal = gy * W + gx;
    const stamp = ++_bfsStamp;
    let head = 0, tail = 0;
    _bfsQueue[tail++] = start;
    _bfsSeen[start] = stamp;
    _bfsPrev[start] = -1;
    _bfsFirst[start] = start;
    while (head < tail) {
      const cur = _bfsQueue[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      for (let d = 0; d < 4; d++) {
        const ax = cx + DIRS4[d][0], ay = cy + DIRS4[d][1];
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        const idx = ay * W + ax;
        if (_bfsSeen[idx] === stamp) continue;
        if (grid[ay][ax] === 1) continue;
        _bfsSeen[idx] = stamp;
        _bfsPrev[idx] = cur;
        _bfsFirst[idx] = (cur === start) ? idx : _bfsFirst[cur];
        if (idx === goal) {
          const f = _bfsFirst[idx];
          return { x: f % W, y: (f / W) | 0 };
        }
        _bfsQueue[tail++] = idx;
      }
    }
    return null;
  }

  function isOpenCell(grid, cx, cy) {
    return cx >= 0 && cy >= 0 && cx < W && cy < H && grid[cy][cx] !== 1;
  }

  /* A random open orthogonal neighbour, for idle wandering. Falls back to
     standing still if the unit is boxed in. */
  function randomStepTarget(grid, cx, cy) {
    const opts = [];
    for (let d = 0; d < 4; d++) {
      const ax = cx + DIRS4[d][0], ay = cy + DIRS4[d][1];
      if (isOpenCell(grid, ax, ay)) opts.push({ x: ax, y: ay });
    }
    if (!opts.length) return null;
    return opts[(Math.random() * opts.length) | 0];
  }

  /* Give a unit the bookkeeping it needs to walk cell-to-cell. */
  function makeMover(cx, cy) {
    return {
      x: cx + 0.5, y: cy + 0.5,   /* rendered position, interpolated */
      cx, cy,                        /* cell we last stood on */
      stepX: cx, stepY: cy,         /* cell being walked toward */
      stepT: 1,                      /* 0..1 through the current step */
      moved: false,                  /* set on the frame a step completes */
    };
  }

  /* Advance one cell-to-cell step. `chooseNext` is called only once the
     unit has arrived, and should point stepX/stepY at the next cell (or
     leave them where they are to mean "hold"). Returns true on any frame
     where the unit finished a step or changed cell. */
  function advanceMover(e, dtS, spd, chooseNext) {
    if (e.stepT >= 1) {
      /* arrived: commit to the cell we're standing on and pick the next */
      e.cx = e.stepX; e.cy = e.stepY;
      e.x = e.cx + 0.5; e.y = e.cy + 0.5;
      e.moved = true;
      e.stepT = 0;                 /* MUST reset before choosing, or the
                                      step completes instantly and the unit
                                      teleports a cell every frame */
      chooseNext(e);
      if (e.stepX === e.cx && e.stepY === e.cy) { e.stepT = 1; return true; }
    }
    e.stepT += dtS * spd;           /* one full cell per 1/spd seconds */
    const fx = e.cx + 0.5, fy = e.cy + 0.5;
    const tx = e.stepX + 0.5, ty = e.stepY + 0.5;
    if (e.stepT >= 1) {
      e.stepT = 1;
      e.cx = e.stepX; e.cy = e.stepY;
      e.x = tx; e.y = ty;
      return true;
    }
    e.x = fx + (tx - fx) * e.stepT;
    e.y = fy + (ty - fy) * e.stepT;
    return false;
  }

  /* ---------------- procedural bullet billboard ---------------- */
  let bulletCanvas = null;
  function bulletSprite() {
    if (bulletCanvas) return bulletCanvas;
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = '#fff4b0'; g.fillRect(2, 2, 4, 4);
    g.fillStyle = '#ffd050'; g.fillRect(1, 1, 6, 1); g.fillRect(1, 6, 6, 1);
    bulletCanvas = c;
    return c;
  }

  /* ---------------- bunny billboard ----------------
     Same silhouette as the old cute sprite — two ears, round body, two
     feet — but stripped of everything that made it read as a toy. All the
     pink is gone; what is left is matte black with a wet grey rim. The
     ears don't match each other, the torso is split down the middle by a
     seam with a gap in it, there are three arms on the left and two on
     the right, and where the eyes were there is now a single gash. The
     shape still has to be readable as "bunny" from across a dark field at
     240x160, so the silhouette is preserved; only the contents are wrong. */
  let bunnyCanvas = null;
  function bunnySprite() {
    if (bunnyCanvas) return bunnyCanvas;
    const W_B = 32, H_B = 32;
    const c = document.createElement('canvas');
    c.width = W_B; c.height = H_B;
    const g = c.getContext('2d');
    const FLESH = '#0e0c12', RIM = '#4a4552', WET = '#b9c2d4';

    /* ears: left is long and straight, right is shorter and kinked */
    g.fillStyle = FLESH;
    g.fillRect(9, 1, 3, 11);
    g.fillRect(20, 4, 3, 7);
    g.fillRect(18, 10, 4, 2);          /* the kink */
    g.fillStyle = RIM;
    g.fillRect(9, 1, 1, 11);
    g.fillRect(22, 4, 1, 7);
    g.fillStyle = '#2a1418';            /* hollow inside the ear */
    g.fillRect(10, 3, 1, 7);
    g.fillRect(21, 6, 1, 4);

    /* head, tilted slightly off-square */
    g.fillStyle = FLESH;
    g.fillRect(8, 11, 16, 9);
    g.fillStyle = RIM;
    g.fillRect(8, 11, 16, 1);
    g.fillRect(8, 11, 1, 9);

    /* the gash where the face should be — one cut, no eyes */
    g.fillStyle = WET;
    g.fillRect(11, 15, 10, 1);
    g.fillStyle = '#2a0a0e';
    g.fillRect(12, 15, 8, 2);

    /* torso, split by a seam with daylight through it */
    g.fillStyle = FLESH;
    g.fillRect(9, 20, 6, 6);
    g.fillRect(17, 20, 6, 6);
    g.fillStyle = RIM;
    g.fillRect(15, 20, 2, 6);
    g.fillRect(9, 20, 1, 6);
    g.fillRect(24, 20, 1, 6);

    /* three arms on the left, two on the right */
    g.fillStyle = FLESH;
    g.fillRect(5, 20, 4, 2);
    g.fillRect(4, 23, 4, 2);
    g.fillRect(6, 26, 3, 2);
    g.fillRect(23, 21, 5, 2);
    g.fillRect(24, 25, 4, 2);

    /* legs too long, ending in splayed feet */
    g.fillStyle = FLESH;
    g.fillRect(11, 26, 4, 4);
    g.fillRect(18, 26, 4, 4);
    g.fillStyle = RIM;
    g.fillRect(9, 30, 6, 2);
    g.fillRect(18, 30, 6, 2);

    bunnyCanvas = c;
    return c;
  }

  /* ---------------- twisted nightmare sprites ----------------
     Takes an old tactics-game unit sprite (CharArt.unit) and melts it:
     row-by-row horizontal warp + wobble-stretch, out-of-proportion limbs,
     and forced glowing red eyes. Cached per (kind,frame) since it's a
     pixel-by-pixel redraw. */
  const NIGHTMARE_KINDS = ['ebrigand', 'earcher', 'earmor', 'eshaman', 'lord', 'arch', 'brute', 'mage', 'cleric', 'cav'];
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const twistCache = new Map();
  function twistedSprite(kind, frame) {
    const key = kind + '|' + frame;
    if (twistCache.has(key)) return twistCache.get(key);
    const src = CharArt.unit(kind, frame, false);
    const seed = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = mulberry32(seed);
    const OW = 26, OH = 30;
    const c = document.createElement('canvas');
    c.width = OW; c.height = OH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < 16; y++) {
      const destY = Math.floor(y * (OH / 16) + Math.sin(y * 1.4 + seed) * 1.8);
      const xShift = Math.sin(y * 0.8 + seed * 2.1) * (3 + rand() * 3);
      const rowScale = 1 + Math.sin(y * 0.6 + seed) * 0.5 + (y > 10 ? rand() * 0.6 : 0); /* legs go extra wrong */
      g.save();
      g.translate(OW / 2 + xShift, destY);
      g.scale(rowScale, 1.4);
      g.drawImage(src, 0, y, 16, 1, -8, 0, 16, 2);
      g.restore();
    }
    /* glowing red eyes, forced on regardless of source art */
    g.fillStyle = '#ff2030';
    g.fillRect(OW / 2 - 5, 6, 2, 2);
    g.fillRect(OW / 2 + 3, 6, 2, 2);
    g.fillStyle = 'rgba(255,20,40,0.5)';
    g.fillRect(OW / 2 - 6, 5, 4, 4);
    g.fillRect(OW / 2 + 2, 5, 4, 4);
    twistCache.set(key, c);
    return c;
  }

  /* Uncle's chat-log voice: forum-native, grievance-accumulating, and
     increasingly unhinged as the run goes on. Aimed at the *mechanics* of
     the behaviour — the filing system, the cadence, the forum posting —
     rather than at restating anyone's actual statements. Keep these under
     46 chars; draw() truncates the subtitle at that length. */
  const TAUNTS = [
    "certified virgin mentality (source: me)",
    "touch grass. (the grass is a problem)",
    "my nephew could route better and he's four",
    "I have a doctorate in crying",
    "400 units deployed. none are different",
    "ratio + you're on camera 2 + I have the gate",
    "anyway that's the report. edit: wrong report",
    "named the rabbit after my ex. she is winning",
    ">>implying I don't out-range you",
    "I am not the problem. the problem is me",
    "certified immune to criticism (source: me)",
    "b/c before you ask: not the flag kind",
    "#NoMoreSandWars",
    "Swap to Linux bro <rage emote>",
    "Don't look at the door! Don't look at it!",
    "I'm not angry, I'm just... culturally passionate.",
    "the bunnies are unionised now. <cry emote>",
    "back in MY day the bunnies knew their place",
  ];

  /* ---------------- factory ---------------- */
  function make() {
    const grid = buildMap();

    /* Wall faces are painted with the original tactics game's own terrain
       tiles, revived from js/gfx/tiles.js (deleted when the tactics engine
       was ripped out; recovered from git at cf0e571^). They're generated
       procedurally at 16x16, so there's nothing to download and the old
       art style comes back exactly as it was.

       The interior map stores a single solid value per cell, so which tile
       a wall gets is picked from a stable hash of its coordinates — mostly
       plain wall, with ruins, rubble and pillars mixed in, so a long
       corridor doesn't read as one stamp repeated. Picked once here rather
       than per column per frame. */
    const WALL_TILE_IDS = ['wall', 'wall', 'wall', 'wall', 'wall', 'ruined', 'rubble', 'pillar'];
    const wallTiles = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        if (grid[y][x] !== 1 || typeof TileArt === 'undefined') { row.push(null); continue; }
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        row.push(TileArt.tile(WALL_TILE_IDS[h % WALL_TILE_IDS.length], 0));
      }
      wallTiles.push(row);
    }

    /* The ground is the Ashenreach terrain: green plain as the default,
       with standing water broken through it. This interior grid never had
       a water cell — the river belonged to the outdoor map that wasn't
       ported — so where the water sits is chosen by a stable hash rather
       than authored. Both tiles are the tactics game's own. */
    const FLOOR_TILE_IDS = ['plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'water'];
    const floorTiles = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        if (grid[y][x] === 1 || typeof TileArt === 'undefined') { row.push(null); continue; }
        const h = ((x * 2654435761) ^ (y * 40503)) >>> 0;
        row.push(TileArt.tile(FLOOR_TILE_IDS[h % FLOOR_TILE_IDS.length], 0));
      }
      floorTiles.push(row);
    }

    let px, py, pa;
    const MOVE_SPD = 2.6, TURN_SPD = 2.6;
    const FOV = Math.PI / 2.6;
    const catchRadius = 0.55;

    /* ---- the player can be hurt now ----
       Everything in this mode wants you dead, so contact has to cost
       something rather than being an instant loss. I-frames are global
       rather than per-enemy: a crowd converging on you would otherwise
       stack their damage in the same few frames and delete you on
       contact, which is the instant-death behaviour we're moving away
       from. */
    const PLAYER_MAX_HP = 100;
    const HURT_IFRAMES = 650;
    const BUNNY_DMG = 11, NIGHTMARE_DMG = 17, UNCLE_DMG = 30;
    let playerHP = PLAYER_MAX_HP;
    let hurtCooldown = 0;      /* global i-frames, counts down in ms */
    let hurtFlash = 0;

    function hurtPlayer(amount) {
      if (hurtCooldown > 0 || state !== 'playing') return false;
      playerHP = Math.max(0, playerHP - amount);
      hurtCooldown = HURT_IFRAMES;
      hurtFlash = 420;
      if (playerHP <= 0) { state = 'caught'; caughtT = 0; Assets.playSound('openFence', 0.5); }
      return true;
    }

    /* Uncle is killable now — he's a proper boss with a health pool, so
       shooting him is a plan rather than a curiosity. */
    const UNCLE_MAX_HP = 6;
    let uncleDead = false;
    let uncleHurtFlash = 0;

    /* every open floor cell, used to scatter bunnies each stage */
    const floorCells = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!grid[y][x]) floorCells.push({ x: x + 0.5, y: y + 0.5 });

    let uncle;
    const UNCLE_SPD = 2.15;

    let bunnies;
    let stage = 1;
    let stageBanner = 0;

    function spawnBunnies(count) {
      const pool = floorCells.filter(c => Math.hypot(c.x - px, c.y - py) > 3);
      const picked = [];
      for (let i = 0; i < count && pool.length; i++) {
        const idx = (Math.random() * pool.length) | 0;
        picked.push(pool.splice(idx, 1)[0]);
      }
      /* every bunny is a cell-walker now, not a drifter */
      return picked.map(c => Object.assign(makeMover(Math.floor(c.x), Math.floor(c.y)), {
        dead: false, wobble: Math.random() * 10, pathT: 0,
      }));
    }

    let nightmares;
    const NIGHTMARE_SPD = 1.5, DETECT_R = 5.5;
    function spawnNightmares(count) {
      const pool = floorCells.filter(c => Math.hypot(c.x - px, c.y - py) > 4);
      const picked = [];
      for (let i = 0; i < count && pool.length; i++) {
        const idx = (Math.random() * pool.length) | 0;
        picked.push(pool.splice(idx, 1)[0]);
      }
      return picked.map(c => Object.assign(makeMover(Math.floor(c.x), Math.floor(c.y)), {
        dead: false, spotted: false, wobble: Math.random() * 10, pathT: 0,
        kind: NIGHTMARE_KINDS[(Math.random() * NIGHTMARE_KINDS.length) | 0],
      }));
    }

    function resetRun() {
      px = 2.5; py = 2.5; pa = 0.4;
      stage = 1;
      uncle = Object.assign(makeMover(12, 8), {
        alert: 0, lastSeenX: 12.5, lastSeenY: 8.5,
        hp: UNCLE_MAX_HP, pathT: 0,
      });
      bunnies = spawnBunnies(5 + stage);
      nightmares = spawnNightmares(2);
      bunniesSlain = 0;
      shotFlash = 0;
      projectiles = [];
      stageBanner = 1400;
      nextTaunt = 4000 + Math.random() * 3000;
      spotFlash = 0;
      drainT = 0; drainLen = 0; drainPeak = 0;
      drainNext = 6000 + Math.random() * 5000;
      playerHP = PLAYER_MAX_HP;
      hurtCooldown = 0; hurtFlash = 0;
      uncleDead = false; uncleHurtFlash = 0;
      escapedT = 0;
      Audio.duckMusic(1);
    }

    function nextStage() {
      stage++;
      bunnies = spawnBunnies(Math.min(14, 5 + stage));
      nightmares.push(...spawnNightmares(Math.min(6, 1 + Math.floor(stage / 2))));
      stageBanner = 1400;
      UNCLE_SPD_MULT = 1 + (stage - 1) * 0.08;
    }

    let state = 'menu';   /* menu | playing | caught | escaped */
    let t = 0;
    let shotFlash = 0;
    let bunniesSlain = 0;
    let caughtT = 0;
    let camPlane; /* recomputed each frame from pa */
    let projectiles = [];
    let nextTaunt = 5000;
    let tauntText = '', tauntT = 0;
    let UNCLE_SPD_MULT = 1;
    let spotFlash = 0;
    let drainT = 0, drainLen = 0, drainPeak = 0, drainNext = 6000;
    let escapedT = 0;
    resetRun();

    /* fixed-looking but slightly-off ear positions poking in from the
       menu's edges — deliberately "wrong", never symmetric */
    const menuEars = [
      { x: -6, y: 18, s: 30, rot: -0.5 },
      { x: 246, y: 6, s: 22, rot: 2.6 },
      { x: 60, y: -8, s: 26, rot: 0.15 },
      { x: 210, y: 150, s: 20, rot: -2.3 },
      { x: -4, y: 140, s: 24, rot: 0.9 },
    ];

    /* how grey the menu goes — mostly 0, sharp brief spikes */
    function desaturatePulse(time) {
      const cycle = 6400;
      const phase = (time % cycle) / cycle;
      if (phase > 0.06) return 0;
      return Math.sin((phase / 0.06) * Math.PI) * 92;
    }

    /* ---- in-game colour drain ----
       The world periodically bleaches out and seeps the colour back, on a
       random cycle rather than a fixed one so it never feels metronomic.
       Every transition is a slow ramp and the gap between drains is
       floored: a hard full-screen on/off flip of overall luminance is a
       known photosensitive-seizure trigger, so there is deliberately no
       code path here that can snap between coloured and grey in one frame.
       Caps at ~86% grey and never fully desaturates, which also keeps a
       little of the ash-orange palette readable as "wrong" rather than
       just "off". */
    const DRAIN_IN = 900, DRAIN_HOLD = 1400, DRAIN_OUT = 1100;

    function updateColorDrain(dt) {
      if (drainT > 0) { drainT = Math.max(0, drainT - dt); return; }
      if (t < drainNext) return;
      drainLen = DRAIN_IN + DRAIN_HOLD + DRAIN_OUT;
      drainT = drainLen;
      drainPeak = 58 + Math.random() * 28;   /* 58-86% */
      drainNext = t + drainLen + 9000 + Math.random() * 11000;
    }

    function colorDrainAmount() {
      if (drainT <= 0) return 0;
      const elapsed = drainLen - drainT;
      let a;
      if (elapsed < DRAIN_IN) a = elapsed / DRAIN_IN;
      else if (elapsed > drainLen - DRAIN_OUT) a = (drainLen - elapsed) / DRAIN_OUT;
      else a = 1;
      return a * drainPeak;
    }

    function tryMove(nx, ny) {
      const r = 0.18;
      if (!isWall(grid, nx + r, py) && !isWall(grid, nx - r, py)) px = nx;
      if (!isWall(grid, px, ny + r) && !isWall(grid, px, ny - r)) py = ny;
    }

    function updateUncle(dt) {
      const dtS = dt / 1000;
      if (uncleDead) return;
      const see = hasLOS(grid, uncle.x, uncle.y, px, py);
      if (see) { uncle.alert = 2.5; uncle.lastSeenX = px; uncle.lastSeenY = py; }
      else uncle.alert = Math.max(0, uncle.alert - dtS);

      /* He hunts on the same 4-way lattice as everything else, but unlike
         the bunnies he keeps coming after you after losing sight — he
         walks to the last cell he saw you in and mills around it. That's
         what makes him a pursuer rather than a monster with an aggro
         radius. */
      const hunting = uncle.alert > 0;
      const gx = hunting ? Math.floor(uncle.lastSeenX) : uncle.cx;
      const gy = hunting ? Math.floor(uncle.lastSeenY) : uncle.cy;
      uncle.pathT -= dt;
      const spd = UNCLE_SPD * UNCLE_SPD_MULT * (hunting ? 1 : 0.4);
      advanceMover(uncle, dtS, spd, (e) => {
        if (hunting) {
          if (e.pathT > 0) return;                 /* reuse the last route briefly */
          const step = bfsFirstStep(grid, e.cx, e.cy, gx, gy);
          e.pathT = 260;
          if (step) { e.stepX = step.x; e.stepY = step.y; }
        } else if (Math.random() < 0.55) {
          const s = randomStepTarget(grid, e.cx, e.cy);   /* idle drift, not a patrol route */
          if (s) { e.stepX = s.x; e.stepY = s.y; }
        }
      });
      uncle.moved = false;

      if (Math.hypot(uncle.x - px, uncle.y - py) < catchRadius) hurtPlayer(UNCLE_DMG);
    }

    function updateBunnies(dt) {
      const dtS = dt / 1000;
      const gx = Math.floor(px), gy = Math.floor(py);
      for (const b of bunnies) {
        if (b.dead) continue;
        b.wobble += dtS;
        b.pathT -= dt;
        /* Bunnies used to drift on a sine wave and mind their own business.
           They hunt now, on the same cell-to-cell walk as everything else. */
        advanceMover(b, dtS, 1.25, (e) => {
          if (e.pathT > 0) return;
          const step = bfsFirstStep(grid, e.cx, e.cy, gx, gy);
          e.pathT = 320;
          if (step) { e.stepX = step.x; e.stepY = step.y; }
        });
        b.moved = false;
        if (Math.hypot(b.x - px, b.y - py) < catchRadius) hurtPlayer(BUNNY_DMG);
      }
    }

    function updateNightmares(dt) {
      const dtS = dt / 1000;
      const gx = Math.floor(px), gy = Math.floor(py);
      for (const nm of nightmares) {
        if (nm.dead) continue;
        nm.wobble += dtS;
        nm.pathT -= dt;
        const dist = Math.hypot(px - nm.x, py - nm.y);
        if (!nm.spotted && dist < DETECT_R && hasLOS(grid, nm.x, nm.y, px, py)) {
          nm.spotted = true;
          spotFlash = 1100;
          Assets.playSound('openFence', 0.4);
        }
        advanceMover(nm, dtS, NIGHTMARE_SPD, (e) => {
          if (nm.spotted) {
            if (e.pathT > 0) return;
            const step = bfsFirstStep(grid, e.cx, e.cy, gx, gy);
            e.pathT = 260;
            if (step) { e.stepX = step.x; e.stepY = step.y; }
          } else if (Math.random() < 0.4) {
            const s = randomStepTarget(grid, e.cx, e.cy);
            if (s) { e.stepX = s.x; e.stepY = s.y; }
          }
        });
        nm.moved = false;
        if (Math.hypot(nm.x - px, nm.y - py) < catchRadius) hurtPlayer(NIGHTMARE_DMG);
      }
    }

    const PROJ_SPD = 9, PROJ_LIFE = 900, PROJ_HIT_R = 0.32;

    function shoot() {
      if (shotFlash > 0) return;
      shotFlash = 120;
      Audio.SFX.confirm();
      projectiles.push({
        x: px + Math.cos(pa) * 0.3, y: py + Math.sin(pa) * 0.3,
        dx: Math.cos(pa), dy: Math.sin(pa), life: PROJ_LIFE,
      });
    }

    function updateProjectiles(dt) {
      const dtS = dt / 1000;
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life -= dt;
        const nx = p.x + p.dx * PROJ_SPD * dtS, ny = p.y + p.dy * PROJ_SPD * dtS;
        if (p.life <= 0 || isWall(grid, nx, ny)) { projectiles.splice(i, 1); continue; }
        p.x = nx; p.y = ny;
        let hitSomething = false;
        for (const b of bunnies) {
          if (b.dead) continue;
          if (Math.hypot(b.x - p.x, b.y - p.y) < PROJ_HIT_R) {
            b.dead = true; bunniesSlain++;
            Assets.playSound('doorOpen', 0.3);
            hitSomething = true;
            break;
          }
        }
        if (!hitSomething) {
          for (const nm of nightmares) {
            if (nm.dead) continue;
            if (Math.hypot(nm.x - p.x, nm.y - p.y) < PROJ_HIT_R) {
              nm.dead = true;
              Assets.playSound('doorOpen', 0.3);
              hitSomething = true;
              break;
            }
          }
        }
        /* Uncle takes a hit but doesn't die outright — he has a pool, and
           shooting him is the win condition rather than a curiosity. */
        if (!hitSomething && !uncleDead &&
            Math.hypot(uncle.x - p.x, uncle.y - p.y) < PROJ_HIT_R) {
          uncle.hp--;
          uncleHurtFlash = 220;
          Audio.SFX.hit();
          hitSomething = true;
          if (uncle.hp <= 0) {
            uncleDead = true;
            escapedT = 0;
            tauntText = "he is just... standing there. he is not moving.";
            tauntT = 6000;
            Audio.stopMusic();
            Audio.SFX.death();
          }
        }
        if (hitSomething) projectiles.splice(i, 1);
      }
    }

    function update(dt) {
      t += dt;
      if (shotFlash > 0) shotFlash = Math.max(0, shotFlash - dt);

      if (state === 'menu') {
        Audio.startMusic('boss');
        if (Input.pressed('confirm') || Input.pressed('cancel')) { resetRun(); state = 'playing'; }
        return;
      }
      if (state === 'caught') {
        caughtT += dt;
        if (caughtT > 400 && (Input.pressed('confirm') || Input.pressed('cancel'))) state = 'menu';
        return;
      }
      if (state === 'escaped') {
        escapedT += dt;
        if (escapedT > 400 && (Input.pressed('confirm') || Input.pressed('cancel'))) state = 'menu';
        return;
      }

      if (stageBanner > 0) stageBanner = Math.max(0, stageBanner - dt);
      if (tauntT > 0) tauntT = Math.max(0, tauntT - dt);
      if (spotFlash > 0) spotFlash = Math.max(0, spotFlash - dt);
      if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - dt);
      if (hurtCooldown > 0) hurtCooldown = Math.max(0, hurtCooldown - dt);
      if (uncleHurtFlash > 0) uncleHurtFlash = Math.max(0, uncleHurtFlash - dt);
      updateColorDrain(dt);

      /* music steps back while he's actively hunting — he should be the
         loudest thing in the mix exactly when it matters */
      Audio.duckMusic(uncle.alert > 0 ? 0.55 : 1);

      const dtS = Math.min(50, dt) / 1000;
      if (Input.down('left')) pa -= TURN_SPD * dtS;
      if (Input.down('right')) pa += TURN_SPD * dtS;
      if (Input.down('up')) tryMove(px + Math.cos(pa) * MOVE_SPD * dtS, py + Math.sin(pa) * MOVE_SPD * dtS);
      if (Input.down('down')) tryMove(px - Math.cos(pa) * MOVE_SPD * dtS, py - Math.sin(pa) * MOVE_SPD * dtS);
      if (Input.pressed('confirm')) shoot();

      updateUncle(dt);
      updateBunnies(dt);
      updateNightmares(dt);
      updateProjectiles(dt);

      nextTaunt -= dt;
      if (nextTaunt <= 0) {
        tauntText = TAUNTS[(Math.random() * TAUNTS.length) | 0];
        tauntT = 3200;
        nextTaunt = 7000 + Math.random() * 6000;
      }

      if (uncleDead) {
        state = 'escaped';
        return;
      }
      if (bunnies.length && bunnies.every(b => b.dead)) {
        nextStage();
        tauntText = TAUNTS[(Math.random() * TAUNTS.length) | 0];
        tauntT = 3200;
      }
    }

    /* ---------------- raycast render ---------------- */
    function drawScene(g) {
      const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
      const horizon = SH / 2;

      /* No roof. Walls are drawn all the way to the top of the screen, so
         the old flat ceiling is replaced by open sky — which is also why
         the wall's *base* still sits below the horizon and the floor stays
         visible underneath it. Removing the ceiling without keeping that
         base would leave no ground plane at all. */
      const sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#120c18');
      sky.addColorStop(1, '#3a2028');
      g.fillStyle = sky; g.fillRect(0, 0, SW, horizon);

      /* Per-column ray directions, needed by both the wall and the floor
         pass. Computed once up front rather than twice. */
      const rayDirX = new Float64Array(SW), rayDirY = new Float64Array(SW);
      for (let col = 0; col < SW; col++) {
        const rayA = pa + ((2 * col / SW) - 1) * (FOV / 2);
        rayDirX[col] = Math.cos(rayA);
        rayDirY[col] = Math.sin(rayA);
      }

      /* ---- ground ----
         Proper floor casting: for each screen row below the horizon the
         distance to the floor is fixed, so walking across that row you
         step through floor cells in runs. Each run is one drawImage of a
         single texel stretched to the run's width, which keeps this to a
         few hundred calls instead of one per pixel. */
      for (let y = horizon + 1; y < SH; y++) {
        const rowDist = (0.5 * SH) / (y - horizon);
        let runStart = 0, runCell = -1, runTile = null, runTX = 0, runTY = 0;
        for (let col = 0; col <= SW; col++) {
          let cell = -1, tile = null, tX = 0, tY = 0;
          if (col < SW) {
            const fx = px + rowDist * rayDirX[col];
            const fy = py + rowDist * rayDirY[col];
            const cx = Math.floor(fx), cy = Math.floor(fy);
            if (cx >= 0 && cy >= 0 && cx < W && cy < H) {
              tile = floorTiles[cy][cx];
              if (tile) {
                cell = cy * W + cx;
                tX = Math.min(tile.width - 1, ((fx - cx) * tile.width) | 0);
                tY = Math.min(tile.height - 1, ((fy - cy) * tile.height) | 0);
              }
            }
          }
          if (cell !== runCell) {
            if (runTile) {
              g.drawImage(runTile, runTX, runTY, 1, 1, runStart, y, col - runStart, 1);
            }
            runStart = col; runCell = cell; runTile = tile; runTX = tX; runTY = tY;
          }
        }
        /* same falloff as the walls, so the ground recedes with them */
        const fshade = Math.max(0.12, 1 - rowDist / 9);
        if (fshade < 0.99) {
          g.fillStyle = `rgba(10,6,14,${(1 - fshade).toFixed(3)})`;
          g.fillRect(0, y, SW, 1);
        }
      }

      const zbuf = new Float32Array(SW);
      const MAX_SLICES = 4;
      for (let col = 0; col < SW; col++) {
        const camX = (2 * col / SW) - 1;
        const rayA = pa + camX * (FOV / 2);
        const rdx = rayDirX[col], rdy = rayDirY[col];
        let mx = Math.floor(px), my = Math.floor(py);
        const deltaX = Math.abs(1 / (rdx || 1e-9)), deltaY = Math.abs(1 / (rdy || 1e-9));
        let stepX, sideX, stepY, sideY;
        if (rdx < 0) { stepX = -1; sideX = (px - mx) * deltaX; } else { stepX = 1; sideX = (mx + 1 - px) * deltaX; }
        if (rdy < 0) { stepY = -1; sideY = (py - my) * deltaY; } else { stepY = 1; sideY = (my + 1 - py) * deltaY; }
        let side = 0, hit = false, dist = 6;
        for (let i = 0; i < 64; i++) {
          if (sideX < sideY) { sideX += deltaX; mx += stepX; side = 0; }
          else { sideY += deltaY; my += stepY; side = 1; }
          if (mx < 0 || my < 0 || mx >= W || my >= H || grid[my][mx] === 1) {
            dist = side === 0 ? (mx - px + (1 - stepX) / 2) / (rdx || 1e-9) : (my - py + (1 - stepY) / 2) / (rdy || 1e-9);
            hit = true; break;
          }
        }
        /* keep the perpendicular distance for the texture lookup — the
           fisheye correction below is for screen position only */
        const perp = dist;
        dist = Math.max(0.05, dist * Math.cos(rayA - pa));
        zbuf[col] = dist;
        if (!hit) continue;

        const lineH = Math.min(SH * 3, SH / dist);
        const yBase = Math.min(SH, horizon + lineH / 2);

        const tex = (mx >= 0 && my >= 0 && mx < W && my < H) ? wallTiles[my][mx] : null;
        if (tex) {
          /* where along the wall face this column lands, 0..1 */
          let wallX = side === 0 ? (py + perp * rdy) : (px + perp * rdx);
          wallX -= Math.floor(wallX);
          const tw = tex.width;
          const texX = Math.min(tw - 1, (wallX * tw) | 0);
          /* Tile the texture down the face, one copy per lineH of screen.
             Capped at MAX_SLICES copies and then stretched to fill the
             rest: without the cap a distant wall wanted ~6 slices per
             column, which is over a thousand drawImage calls a frame for
             detail nobody can resolve at 240x160. */
          const want = Math.ceil(yBase / lineH);
          const n = Math.max(1, Math.min(MAX_SLICES, want));
          const sliceH = yBase / n;
          for (let i = 0; i < n; i++) {
            const y = i * sliceH;
            g.drawImage(tex, texX, 0, 1, tex.height, col, y, 1, sliceH + 0.5);
          }
        } else {
          /* flat-shaded stand-in, so the world stays readable even if the
             tile art somehow isn't available */
          const shade = Math.max(0.12, 1 - dist / 9);
          const base = side === 1 ? [96, 48, 80] : [128, 64, 104];
          g.fillStyle = `rgb(${(base[0] * shade) | 0},${(base[1] * shade) | 0},${(base[2] * shade) | 0})`;
          g.fillRect(col, 0, 1, yBase);
        }

        /* distance falloff, applied over the texture rather than by
           fading the sprite alpha, so it darkens toward black instead of
           toward whatever is behind it */
        const shade = Math.max(0.12, 1 - dist / 9);
        if (shade < 0.99) {
          g.fillStyle = `rgba(10,6,14,${(1 - shade).toFixed(3)})`;
          g.fillRect(col, 0, 1, yBase);
        }
        /* a touch of extra darkening on the N/S faces so corners read */
        if (side === 1) {
          g.fillStyle = 'rgba(10,6,14,0.18)';
          g.fillRect(col, 0, 1, yBase);
        }
      }

      /* ---- billboard sprites (bunnies + Uncle), painter's algorithm ---- */
      const sprites = [];
      for (const b of bunnies) if (!b.dead) sprites.push({ x: b.x, y: b.y, img: bunnySprite(), scale: 0.8 });
      const uImg = uncle.alert > 0
        ? ((Math.floor(t / 150) % 2 === 0) ? Assets.getImage('scunterMapRun') : Assets.getImage('scunterMapWalk'))
        : ((Math.floor(t / 400) % 2 === 0) ? Assets.getImage('scunterMapIdle') : Assets.getImage('scunterMapWalk'));
      sprites.push({ x: uncle.x, y: uncle.y, img: uImg, scale: 1.35, uncle: true });
      for (const p of projectiles) sprites.push({ x: p.x, y: p.y, img: bulletSprite(), scale: 0.16, glow: true });
      for (const nm of nightmares) {
        if (nm.dead) continue;
        const frame = Math.floor(nm.wobble * 2) % 2;
        sprites.push({ x: nm.x, y: nm.y, img: twistedSprite(nm.kind, frame), scale: 1.1 });
      }
      sprites.sort((a, b2) => Math.hypot(b2.x - px, b2.y - py) - Math.hypot(a.x - px, a.y - py));

      for (const s of sprites) {
        if (!s.img) continue;
        const dx = s.x - px, dy = s.y - py;
        const invDet = 1 / (camPlaneX * Math.sin(pa) - Math.cos(pa) * camPlaneY);
        const tx = invDet * (Math.sin(pa) * dx - Math.cos(pa) * dy);
        const ty = invDet * (-camPlaneY * dx + camPlaneX * dy);
        if (ty <= 0.1) continue;
        const screenX = Math.floor((SW / 2) * (1 + tx / ty));
        const spriteH = Math.abs(Math.floor(SH / ty * s.scale));
        const spriteW = spriteH * (s.img.width / s.img.height);
        const drawStartY = horizon - spriteH / 2, drawStartX = screenX - spriteW / 2;
        const sampleCol = Math.max(0, Math.min(SW - 1, screenX));
        if (ty > zbuf[sampleCol] + 0.15) continue; /* behind a wall */
        g.save();
        g.globalAlpha = Math.max(0.25, 1 - ty / 9);
        if (s.glow) g.globalCompositeOperation = 'lighter';
        g.imageSmoothingEnabled = false;
        g.drawImage(s.img, drawStartX, drawStartY, spriteW, spriteH);
        g.restore();
      }

      /* muzzle flash + gun — a small local glow near the barrel, NOT a
         full-screen flash: even mashing fire can't produce a screen-wide
         strobe this way, however fast the flashes repeat */
      if (shotFlash > 0) {
        g.fillStyle = 'rgba(255,220,140,' + (shotFlash / 120 * 0.7) + ')';
        g.beginPath();
        g.arc(SW / 2, SH - 42, 16 * (shotFlash / 120), 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#302840';
      g.fillRect(SW / 2 - 22, SH - 26, 44, 26);
      g.fillStyle = '#4a3f60';
      g.fillRect(SW / 2 - 6, SH - 40, 12, 20);
    }

    function drawBunnyEar(g, x, y, s, rot) {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.fillStyle = '#3a1428';
      g.beginPath();
      g.moveTo(-s * 0.22, 0); g.lineTo(s * 0.22, 0); g.lineTo(0, -s); g.closePath(); g.fill();
      g.fillStyle = '#e888b0';
      g.beginPath();
      g.moveTo(-s * 0.12, -s * 0.08); g.lineTo(s * 0.12, -s * 0.08); g.lineTo(0, -s * 0.82); g.closePath(); g.fill();
      g.restore();
    }

    function drawMenu(g) {
      const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
      const grey = desaturatePulse(t);
      g.filter = grey > 1 ? `grayscale(${grey.toFixed(0)}%) contrast(1.15)` : 'none';

      g.fillStyle = '#0a0710'; g.fillRect(0, 0, SW, SH);

      const wallTex = Assets.getImage('wallTexture');
      if (wallTex) {
        g.save(); g.globalAlpha = 0.16; g.imageSmoothingEnabled = false;
        for (let x = -20; x < SW; x += 48) g.drawImage(wallTex, x, 0, 48, SH);
        g.restore();
      }
      const dream = Assets.getImage('feverdream');
      if (dream) {
        g.save();
        g.globalAlpha = 0.20 + Math.sin(t / 500) * 0.06;
        g.globalCompositeOperation = 'screen';
        const scale = Math.max(SW / dream.width, SH / dream.height);
        const dw = dream.width * scale, dh = dream.height * scale;
        g.drawImage(dream, (SW - dw) / 2, (SH - dh) / 2, dw, dh);
        g.restore();
      }

      /* ears poking in from "wrong" places */
      for (const e of menuEars) drawBunnyEar(g, e.x, e.y + Math.sin(t / 900 + e.x) * 2, e.s, e.rot);

      /* static noise speckle */
      for (let i = 0; i < 40; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.10)';
        g.fillRect(Math.random() * SW, Math.random() * SH, 1, 1);
      }

      const jitterX = (Math.sin(t / 47) > 0.9) ? (Math.random() * 4 - 2) : 0;
      const titleCol = (Math.floor(t / 90) % 13 === 0) ? '#f83050' : '#e88090';
      Font.drawCentered(g, 'ESCAPE', SW / 2 + jitterX, 22, titleCol, 2);
      Font.drawCentered(g, 'THE UNCLE', SW / 2 - jitterX, 42, titleCol, 2);

      const lines = [
        'he listens from inside the walls',
        'everything here wants you dead',
        'he CAN be dealt with. bring bullets.',
      ];
      lines.forEach((line, i) => Font.drawCentered(g, line, SW / 2, 80 + i * 11, '#a898b8'));

      if (Math.floor(t / 400) % 2 === 0) Font.drawCentered(g, 'Z / ENTER TO BEGIN', SW / 2, SH - 16, '#e8c850');

      g.filter = 'none';
    }

    function draw(g) {
      const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
      camPlaneX = -Math.sin(pa) * Math.tan(FOV / 2);
      camPlaneY = Math.cos(pa) * Math.tan(FOV / 2);

      if (state === 'menu') { drawMenu(g); return; }

      const drain = colorDrainAmount();
      if (drain > 1) g.filter = `grayscale(${drain.toFixed(0)}%)`;
      drawScene(g);

      /* hurt vignette — a soft edge bloom, never a full-screen tint, so
         taking a hit can't become a strobe under repeated contact */
      if (hurtFlash > 0) {
        const a = hurtFlash / 420;
        g.save();
        g.globalAlpha = a * 0.5;
        const grd = g.createRadialGradient(SW / 2, SH / 2, SH * 0.25, SW / 2, SH / 2, SH * 0.85);
        grd.addColorStop(0, 'rgba(140,0,10,0)');
        grd.addColorStop(1, 'rgba(140,0,10,0.9)');
        g.fillStyle = grd;
        g.fillRect(0, 0, SW, SH);
        g.restore();
      }

      /* HUD */
      g.fillStyle = 'rgba(10,8,16,0.55)';
      g.fillRect(0, SH - 12, SW, 12);
      Font.draw(g, 'BUNNIES: ' + bunniesSlain, 4, SH - 9, '#e8b0c8');
      Font.draw(g, 'STAGE ' + stage, SW / 2 - 18, SH - 9, '#8898c8');
      Font.draw(g, uncle.alert > 0 ? 'HE SEES YOU' : 'quiet...', SW - 90, SH - 9, uncle.alert > 0 ? '#f86060' : '#607080');

      /* player health */
      const hpW = 44, hpX = SW / 2 - hpW / 2, hpY = 4;
      g.fillStyle = 'rgba(10,8,16,0.6)'; g.fillRect(hpX - 1, hpY - 1, hpW + 2, 5);
      const hpFrac = Math.max(0, playerHP / PLAYER_MAX_HP);
      g.fillStyle = hpFrac > 0.5 ? '#68c078' : hpFrac > 0.25 ? '#d8b040' : '#e05050';
      g.fillRect(hpX, hpY, Math.round(hpW * hpFrac), 3);

      /* Uncle's health, only once you've engaged him */
      if (uncle.hp < UNCLE_MAX_HP || uncle.alert > 0) {
        const uW = 60, uX = SW / 2 - uW / 2, uY = SH - 20;
        g.fillStyle = 'rgba(10,8,16,0.6)'; g.fillRect(uX - 1, uY - 1, uW + 2, 4);
        g.fillStyle = uncleDead ? '#404048' : '#c03848';
        g.fillRect(uX, uY, Math.round(uW * Math.max(0, uncle.hp) / UNCLE_MAX_HP), 2);
      }

      /* Uncle's taunts, subtitled like he's right behind you (he might be) */
      if (tauntT > 0 && tauntText) {
        const a = Math.min(1, tauntT / 400);
        g.save();
        g.globalAlpha = a;
        g.fillStyle = 'rgba(10,4,8,0.7)';
        g.fillRect(0, 0, SW, 18);
        Font.drawCentered(g, '"' + tauntText.slice(0, 46) + '"', SW / 2, 5, '#f8c0d0');
        g.restore();
      }
      if (stageBanner > 0) {
        const a = Math.min(1, stageBanner / 300);
        g.save();
        g.globalAlpha = a;
        Font.drawCentered(g, 'STAGE ' + stage, SW / 2, SH / 2 - 4, '#e8c850', 2);
        g.restore();
      }

      /* jumpscare: a nightmare just spotted you — corrupted text burst.
         Deliberately NOT a strobe: one smooth fade in/hold/out, a single
         steady tint, no per-frame random flashing or color-alternation —
         those can trigger photosensitive seizures. */
      if (spotFlash > 0) {
        const total = 1100, elapsed = total - spotFlash;
        let a;
        if (elapsed < 150) a = elapsed / 150;
        else if (elapsed > total - 400) a = (total - elapsed) / 400;
        else a = 1;
        a = Math.max(0, Math.min(1, a));
        g.save();
        g.globalAlpha = a * 0.85;
        g.fillStyle = 'rgba(120,0,10,0.22)';
        g.fillRect(0, 0, SW, SH);
        g.globalAlpha = a;
        Font.drawCentered(g, 'fire embl3333333//}', SW / 2, SH / 2 - 6, '#ff4050', 2);
        g.restore();
      }

      if (state === 'caught') {
        g.fillStyle = 'rgba(30,0,4,0.55)'; g.fillRect(0, 0, SW, SH);
        const img = Assets.getImage('scunterAttack') || Assets.getImage('scunterGbGlitch');
        if (img) {
          const s = Math.min(SW / img.width, SH / img.height) * 1.6;
          g.imageSmoothingEnabled = false;
          g.drawImage(img, (SW - img.width * s) / 2, (SH - img.height * s) / 2, img.width * s, img.height * s);
        }
        Font.drawCentered(g, 'HE GOT YOU', SW / 2, 12, '#f86060', 2);
        Font.drawCentered(g, 'reached stage ' + stage, SW / 2, SH / 2 + 40, '#c8b0b8');
        if (caughtT > 400) Font.drawCentered(g, 'Z / X TO RETURN TO TITLE', SW / 2, SH - 12, '#e8c850');
      }

      if (state === 'escaped') {
        g.fillStyle = 'rgba(4,6,10,0.72)'; g.fillRect(0, 0, SW, SH);
        const img = Assets.getImage('scunterVictory') || Assets.getImage('scunterHurt');
        if (img) {
          const s = Math.min(SW / img.width, SH / img.height) * 1.3;
          g.imageSmoothingEnabled = false;
          g.globalAlpha = Math.min(1, escapedT / 900);
          g.drawImage(img, (SW - img.width * s) / 2, (SH - img.height * s) / 2 - 6, img.width * s, img.height * s);
          g.globalAlpha = 1;
        }
        Font.drawCentered(g, 'HE IS DOWN', SW / 2, 14, '#a8d8b0', 2);
        Font.drawCentered(g, 'the gate is still shut', SW / 2, SH / 2 + 34, '#c8b0b8');
        Font.drawCentered(g, 'bunnies slain: ' + bunniesSlain, SW / 2, SH / 2 + 46, '#8898a8');
        if (escapedT > 400) Font.drawCentered(g, 'Z / X TO RETURN TO TITLE', SW / 2, SH - 12, '#e8c850');
      }

      g.filter = 'none';   /* don't leak the drain into the next frame */
    }

    let camPlaneX = 0, camPlaneY = 0;
    /* `_debug` is a read-only window onto the closure for the headless
       harness in test/ — it is how the grid-lock and HP invariants get
       asserted without a browser. Nothing in the game reads it. */
    function debugState() {
      return {
        px, py, pa, state, stage, playerHP, uncleDead, escapedT,
        uncle: {
          x: uncle.x, y: uncle.y, cx: uncle.cx, cy: uncle.cy, hp: uncle.hp,
          alert: uncle.alert, dead: uncleDead,
          los: hasLOS(grid, uncle.x, uncle.y, px, py),
          dist: Math.hypot(uncle.x - px, uncle.y - py),
        },
        bunnies: bunnies.map(b => ({ x: b.x, y: b.y, cx: b.cx, cy: b.cy, dead: b.dead })),
        nightmares: nightmares.map(n => ({ x: n.x, y: n.y, cx: n.cx, cy: n.cy, spotted: n.spotted, dead: n.dead })),
      };
    }

    return { name: 'escape', update, draw, _debug: debugState };
  }

  return { make };
})();
