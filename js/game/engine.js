/* =============================================================
   ENGINE — the main state machine and map-mode interaction.
   States: title -> intro -> prep -> chapter -> results / gameover
   Map sub-modes: idle, unitSelected, moveChosen, menu, submenu,
   forecast, enemyTurn, dialogue, toast.
   ============================================================= */
'use strict';

const Game = {
  state: 'boot',          /* boot,title,intro,prep,chapter,results,gameover */
  chapterId: 'ch1',
  chapter: null,
  units: [],
  turn: 1,
  phase: 'player',        /* player | enemy */
  gold: 0,
  visited: new Set(),     /* visited villages/houses */
  opened: new Set(),      /* opened chests/doors */
  mapOverrides: {},       /* idx -> terrain id (opened doors/chests) */
  cursor: { x: 4, y: 20 },
  cam: { x: 0, y: 0 },

  /* map interaction state */
  mode: 'idle',
  selected: null,          /* selected unit */
  reach: null,             /* movement range data */
  moveTiles: [],           /* [{x,y}] for overlay */
  atkTiles: new Set(),
  moveTarget: null,
  menuItems: [], menuSel: 0, menuW: 70,
  submenu: null,           /* {type:'items'|'trade'|'heal', unit, sel} */
  forecastPair: null,
  enemyQueue: [],
  enemyTimer: 0,
  toast: null, toastT: 0,
  phaseBanner: 0,
  gameResult: null,
  deaths: 0,
  animSpeed: 1,

  /* ---------- boot / chapter setup ---------- */

  startChapter(chapterId, restoreData) {
    this.chapterId = chapterId;
    this.chapter = ChapterDB[chapterId];
    GameMap.load(this.chapter);
    this.units = [];
    this.visited = new Set();
    this.opened = new Set();
    this.mapOverrides = {};
    this.turn = 1;
    this.deaths = 0;
    this.pendingVoskDeath = false;
    this.debugRanges = null;
    this.targetSel = null;
    this.itemActionMenu = null;
    this.submenu = null;
    this.selected = null;
    this.moveTiles = [];
    this.atkTiles = new Set();

    if (restoreData) {
      this.units = SaveLoad.restoreUnits(restoreData);
      this.turn = restoreData.turn;
      this.phase = restoreData.phase || 'player';
      this.gold = restoreData.gold;
      for (const k of restoreData.visited || []) this.visited.add(k);
      for (const k of restoreData.opened || []) this.opened.add(k);
      this.mapOverrides = restoreData.mapOverrides || {};
    } else {
      this.gold = this.chapter.gold || 0;
      /* deploy players in a block near playerStart */
      const deployList = this.deployOverride || this.chapter.playerDeploy;
      this.deployOverride = null;
      const spots = [];
      const sx = this.chapter.playerStart.x, sy = this.chapter.playerStart.y;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) spots.push([sx + dx, sy + dy]);
      deployList.forEach((dep, i) => {
        const u = Units.makePlayerUnit(dep.charId);
        const s = spots[i] || [sx, sy];
        u.x = s[0]; u.y = s[1];
        this.units.push(u);
      });
      for (const spawn of this.chapter.units) this.units.push(Units.makeNPCUnit(spawn));
    }

    this.cursor = { x: this.chapter.playerStart.x, y: this.chapter.playerStart.y };
    this.state = 'chapter';
    this.mode = 'idle';
    this.phase = 'player';
    this.phaseBanner = 120;
    Audio.startMusic('player');
  },

  /* ---------- helpers ---------- */

  terrainAt(x, y) { return GameMap.terrainAt(x, y); },

  boss() { return this.units.find(u => u.bossKey && Units.isAlive(u)); },

  playersAlive() { return this.units.filter(u => u.team === 'player' && Units.isAlive(u)); },

  killUnit(u) {
    u.dead = true;
    u.hp = 0;
    if (u.bossKey) this.pendingVoskDeath = true;
    /* drop rescued unit */
    if (u.rescuing) { const r = u.rescuing; r.carriedBy = null; r.x = u.x; r.y = u.y; u.rescuing = null; }
    if (u.carriedBy) { const c = u.carriedBy; c.rescuing = null; u.carriedBy = null; }
    /* permadeath for players (configurable) */
    if (u.team === 'player' && Config.RULES.PERMADEATH) {
      this.toastMsg(u.name + ' has fallen...');
      this.deaths++;
    } else {
      this.units = this.units.filter(x => x !== u);
    }
  },

  toastMsg(text) { this.toast = text; this.toastT = 0; },

  /* ---------- map interactions ---------- */

  interactionAt(x, y) {
    return (this.chapter.interactions || []).find(i => i.x === x && i.y === y && !this.visited.has(y * 1000 + x) && !this.opened.has(y * 1000 + x)) || null;
  },

  doorAt(x, y) {
    if (GameMap.tileAt(x, y) !== 'door') return null;
    return (this.chapter.interactions || []).find(i => i.kind === 'door' && Math.abs(i.x - x) + Math.abs(i.y - y) <= 1) || {};
  },

  /* Visit village/house; open chest. Returns true if consumed the action. */
  doVisit(u, x, y) {
    const inter = this.interactionAt(x, y);
    if (!inter) return false;
    this.visited.add(y * 1000 + x);
    const key = y * 1000 + x;
    if (inter.script && this.chapter.dialogue[inter.script]) {
      Dialogue.start(this.chapter.dialogue[inter.script], () => {
        this.grantReward(inter);
        u.acted = true;
        this.mode = 'idle';
      });
      this.mode = 'dialogue';
      return true;
    }
    this.grantReward(inter);
    u.acted = true;
    this.mode = 'idle';
    return true;
  },

  grantReward(inter) {
    if (inter.reward) {
      if (inter.reward.gold) {
        this.gold += inter.reward.gold;
        this.toastMsg('Got ' + inter.reward.gold + ' gold!');
        Audio.SFX.open();
      }
      if (inter.reward.item) {
        this.giveItemToAny(inter.reward.item);
        this.toastMsg('Got ' + (ItemDB[inter.reward.item] || WeaponDB[inter.reward.item] || { name: inter.reward.item }).name + '!');
        Audio.SFX.open();
      }
    }
  },

  giveItemToAny(dbId) {
    /* give to first player with space, else first player (forced swap) */
    const ps = this.playersAlive();
    for (const p of ps) {
      if (p.items.length < Config.RULES.MAX_INVENTORY) { p.items.push(Items.make(dbId)); return; }
    }
    if (ps[0]) ps[0].items.push(Items.make(dbId));
  },

  doChest(u, x, y) {
    const key = y * 1000 + x;
    const inter = (this.chapter.interactions || []).find(i => i.kind === 'chest' && i.x === x && i.y === y);
    if (this.opened.has(key)) return false;
    /* need key or thief standing on chest */
    const hasKey = u.items.find(it => it.kind === 'key' && (it.opens === 'chest' || (it.opens && it.opens.includes('chest'))));
    const thief = u.lockpick;
    if (!hasKey && !thief) { this.toastMsg('Needs a chest key...'); return false; }
    if (hasKey) hasKey.uses--;
    if (hasKey && hasKey.uses <= 0) u.items = u.items.filter(i => i !== hasKey);
    this.opened.add(key);
    this.mapOverrides[key] = 'chestOpen';
    const itemId = inter ? inter.contents : 'gem';
    this.giveItemToAny(itemId);
    Audio.SFX.open();
    this.toastMsg('Opened the chest!');
    u.acted = true;
    this.mode = 'idle';
    return true;
  },

  doDoor(u, x, y) {
    /* u stands adjacent to door tile (x,y) */
    const hasKey = u.items.find(it => it.kind === 'key' && (it.opens === 'door' || (it.opens && it.opens.includes('door'))));
    if (!hasKey && !u.lockpick) { this.toastMsg('Needs a door key...'); return false; }
    const key = y * 1000 + x;
    if (hasKey) { hasKey.uses--; if (hasKey.uses <= 0) u.items = u.items.filter(i => i !== hasKey); }
    this.opened.add(key);
    this.mapOverrides[key] = 'doorOpen';
    Audio.SFX.door();
    this.toastMsg('Opened the door!');
    u.acted = true;
    return true;
  },

  /* ---------- selection & actions ---------- */

  selectUnit(u) {
    this.selected = u;
    this.reach = GameMap.reachable(u.x, u.y, u.move, u.moveType, u.team);
    this.moveTiles = GameMap.moveRange(u);
    this.atkTiles = GameMap.attackRangeFrom(u, this.moveTiles);
    this.preMovePos = this.preMovePos || {};
    this.preMovePos[u.id] = { x: u.x, y: u.y };   /* for cancel-undo */
    this.mode = 'unitSelected';
    Audio.SFX.select();
  },

  deselect() { this.selected = null; this.moveTiles = []; this.atkTiles = new Set(); this.mode = 'idle'; },

  /* build the action menu for the selected unit at its tile */
  buildActionMenu(u) {
    const items = [];
    const terr = this.terrainAt(u.x, u.y);
    /* attack */
    const foes = this.attackableFrom(u.x, u.y, u);
    if (foes.length) items.push({ label: 'Attack', act: 'attack' });
    /* heal */
    if (u.weapon && u.weapon.type === 'staff') {
      const allies = GameMap.healableAllies(u);
      if (allies.length) items.push({ label: 'Heal', act: 'heal' });
    }
    /* visit / chest / door */
    if (terr.visit && this.interactionAt(u.x, u.y)) items.push({ label: 'Visit', act: 'visit' });
    if (GameMap.tileAt(u.x, u.y) === 'chest' && !this.opened.has(u.y * 1000 + u.x)) items.push({ label: 'Open', act: 'chest' });
    const doorAdj = this.adjacentDoor(u);
    if (doorAdj) items.push({ label: 'Door', act: 'door' });
    /* items */
    if (u.items.length) items.push({ label: 'Items', act: 'items' });
    /* trade with adjacent ally */
    if (this.adjacentAllies(u).length) items.push({ label: 'Trade', act: 'trade' });
    /* rescue / drop / take */
    if (!u.rescuing && !u.carriedBy) {
      const target = this.adjacentAllies(u).find(a => a.items.length < Config.RULES.MAX_INVENTORY &&
        (u.stats.con || 8) >= (a.stats.con || 8) * Config.RULES.RESCUE_CON_LIMIT && Units.isAlive(a) && !a.rescuing);
      if (target) items.push({ label: 'Rescue', act: 'rescue', target });
    }
    if (u.rescuing) {
      items.push({ label: 'Drop', act: 'drop' });
      const t = this.adjacentAllies(u).find(a => !a.rescuing && !a.carriedBy);
      if (t) items.push({ label: 'Give', act: 'give', target: t });
    }
    items.push({ label: 'Wait', act: 'wait' });
    return items;
  },

  attackableFrom(x, y, u) {
    const out = [];
    for (const t of this.units) {
      if (!Units.isAlive(t) || t.team === u.team) continue;
      if (t.carriedBy) continue;
      const d = Math.abs(t.x - x) + Math.abs(t.y - y);
      if (Units.attackRange(u).includes(d)) out.push(t);
    }
    return out;
  },

  adjacentAllies(u) {
    return this.units.filter(o => Units.isAlive(o) && o !== u && o.team === u.team &&
      !o.carriedBy && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1);
  },

  adjacentDoor(u) {
    for (const [dx, dy] of DIR4) {
      if (GameMap.tileAt(u.x + dx, u.y + dy) === 'door') return { x: u.x + dx, y: u.y + dy };
    }
    return null;
  },

  executeAction(u, act, payload) {
    switch (act) {
      case 'attack': {
        const target = payload.target;
        this.startCombat(u, target);
        break;
      }
      case 'heal': {
        const target = payload.target;
        const events = [];
        const preH = target.hp;
        const exp = Combat.heal(u, target, (e) => events.push(e));
        u.acted = true;
        PlayBattle.play(u, target, events, true, () => {
          this.afterCombatExp(u, exp, null);
        }, u.hp, preH);
        this.mode = 'battleAnim';
        break;
      }
      case 'visit': this.doVisit(u, u.x, u.y); break;
      case 'chest': this.doChest(u, u.x, u.y); break;
      case 'door': { const d = this.adjacentDoor(u); if (d) this.doDoor(u, d.x, d.y); this.mode = 'idle'; this.deselect(); break; }
      case 'items': this.openItems(u); break;
      case 'trade': this.openTrade(u); break;
      case 'rescue': {
        const t = payload.target;
        t.carriedBy = u; u.rescuing = t;
        t.x = u.x; t.y = u.y;
        u.move = Math.max(2, Math.floor(u.move / 2));  /* simplified carry penalty */
        u.acted = true;
        this.deselect();
        break;
      }
      case 'drop': {
        const t = u.rescuing;
        if (t) {
          t.carriedBy = null; u.rescuing = null;
          const spot = this.freeAdjacent(u.x, u.y);
          t.x = spot[0]; t.y = spot[1];
          u.move = ClassDB[u.classId].move;   /* restore full move */
        }
        u.acted = true;
        this.deselect();
        break;
      }
      case 'give': {
        const t = payload.target;
        const c = u.rescuing;
        if (c && t.items.length < Config.RULES.MAX_INVENTORY) {
          c.carriedBy = t; t.rescuing = c; u.rescuing = null;
          c.x = t.x; c.y = t.y;
          u.move = ClassDB[u.classId].move;   /* restore full move */
          t.move = Math.max(2, Math.floor(ClassDB[t.classId].move / 2));
        }
        u.acted = true;
        this.deselect();
        break;
      }
      case 'wait':
        u.acted = true;
        this.deselect();
        break;
    }
  },

  freeAdjacent(x, y) {
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (GameMap.inBounds(nx, ny) && !GameMap.unitAt(nx, ny) && GameMap.moveCost(nx, ny, 'infantry') < 99) return [nx, ny];
    }
    return [x, y];
  },

  openItems(u) {
    this.submenu = { type: 'items', unit: u, sel: 0 };
    this.mode = 'submenu';
  },

  openTrade(u) {
    this.submenu = { type: 'trade', unit: u, sel: 0, partner: null, psel: 0 };
    this.mode = 'submenu';
  },

  /* ---------- combat kickoff ---------- */

  startCombat(a, d) {
    const events = [];
    const preA = a.hp, preD = d.hp;
    const aExpBefore = a.exp;

    /* boss dialogue on first aggro */
    if (d.bossKey && !d.bossAggroed) {
      d.bossAggroed = true;
      const script = this.chapter.dialogue['boss_range'];
      if (script) {
        Dialogue.start(script, () => {
          this.runCombat(a, d, events, preA, preD);
        });
        this.mode = 'dialogue';
        return;
      }
    }

    this.runCombat(a, d, events, preA, preD);
  },

  runCombat(a, d, events, preA, preD) {
    if (a.bossKey) a.bossAggroed = true;
    if (d.bossKey) d.bossAggroed = true;
    Combat.run(a, d, (e) => events.push(e));
    a.acted = true;
    this.mode = 'battleAnim';
    PlayBattle.play(a, d, events, false, () => {
      this.afterCombat(a, d, events, preA, preD);
    }, preA, preD);
  },

  afterCombat(a, d, events, preA, preD) {
    /* deaths already applied to hp; finalize (dead flag guards double-kill) */
    if (d.hp <= 0 && !d.dead) this.killUnit(d);
    if (a.hp <= 0 && !a.dead) this.killUnit(a);

    /* EXP for attacker */
    if (a.team === 'player' && Units.isAlive(a)) {
      let exp = 0;
      if (d.dead || d.hp <= 0) exp = Units.expForKill(a, d);
      else {
        const dealt = preD - Math.max(0, d.hp);
        exp = Units.expForDamage(a, d, dealt);
      }
      if (exp > 0) this.afterCombatExp(a, exp, null);
      else this.postActionCleanup();
    } else {
      this.postActionCleanup();
    }
  },

  afterCombatExp(u, exp, extra) {
    if (u.team !== 'player' || exp <= 0) { this.postActionCleanup(); return; }
    const res = Units.gainExp(u, exp);
    if (res.levels && res.levels.length) {
      LevelUp.show(u, exp, res.levels, () => this.postActionCleanup());
    } else {
      this.postActionCleanup();
    }
  },

  postActionCleanup() {
    /* chapter end checks */
    const boss = this.boss();
    if (!boss && this.chapter.objective.type === 'boss') { this.winChapter(); return; }

    /* vosk death dialogue already queued via events */
    if (this.pendingVoskDeath) {
      this.pendingVoskDeath = false;
      /* the mask comes off for good once Scunter goes down */
      CharArt.setImagePortrait('vosk', Assets.getImage('scunterGbGlitch'));
      const script = this.chapter.dialogue['vosk_death'];
      if (script) {
        Dialogue.start(script, () => { this.mode = 'idle'; this.deselect(); this.checkLoss(); });
        this.mode = 'dialogue';
        return;
      }
    }
    this.checkLoss();
    if (this.state !== 'chapter') return;
    this.deselect();
    /* returning to the right phase matters: counterattack EXP can resolve
       this while the ENEMY phase is still running. */
    this.mode = (this.phase === 'enemy') ? 'enemyTurn' : 'idle';
  },

  checkLoss() {
    /* rowan death = game over */
    const rowan = this.units.find(u => u.charId === 'rowan');
    if (rowan && rowan.dead) { this.state = 'gameover'; this.screen = Screens.makeGameOver(); Audio.stopMusic(); return; }
    if (this.playersAlive().length === 0) { this.state = 'gameover'; this.screen = Screens.makeGameOver(); Audio.stopMusic(); }
  },

  winChapter() {
    this.state = 'results';
    this.screen = Screens.makeResults();
    Audio.startMusic('victory');
  },

  /* ---------- turn / phase flow ---------- */

  endPlayerPhase() {
    for (const u of this.units) u.acted = false;
    this.phase = 'enemy';
    this.phaseBanner = 90;
    Audio.SFX.phase();
    Audio.startMusic('enemy');
    /* reinforcements */
    this.spawnReinforcements();
    this.enemyQueue = this.units.filter(u => u.team === 'enemy' && Units.isAlive(u) && !u.dead);
    this.enemyTimer = 0;
    this.mode = 'enemyTurn';
  },

  spawnReinforcements() {
    if (!this.chapter.reinforcements) return;
    for (const r of this.chapter.reinforcements) {
      if (this.turn !== r.turn) continue;
      if (this.units.some(u => u.id === r.id && Units.isAlive(u))) continue;
      const u = Units.makeNPCUnit(r);
      this.units.push(u);
      this.toastMsg('Reinforcements appeared!');
    }
  },

  updateEnemyPhase(dt) {
    this.enemyTimer -= dt;
    if (this.enemyTimer > 0) return;
    if (!this.enemyQueue.length) {
      this.endEnemyPhase();
      return;
    }
    const u = this.enemyQueue.shift();
    if (!Units.isAlive(u)) { this.enemyTimer = 120; return; }
    AI.act(u);
    this.enemyTimer = 260 * this.animSpeed;
  },

  endEnemyPhase() {
    for (const u of this.units) u.acted = false;
    this.phase = 'player';
    this.turn++;
    this.phaseBanner = 90;
    Audio.SFX.phase();
    Audio.startMusic('player');
    /* turn healing on forts/thrones */
    for (const u of this.units) {
      if (!Units.isAlive(u)) continue;
      const terr = this.terrainAt(u.x, u.y);
      if (terr.heal && u.hp < u.maxhp) {
        u.hp = Math.min(u.maxhp, u.hp + Math.ceil(u.maxhp * terr.heal / 100));
      }
    }
    this.mode = 'idle';
  },

  /* ---------- AI hooks (used by AI module) ---------- */

  aiAttack(u, target, x, y) {
    u.x = x; u.y = y;
    if (u.bossKey) u.bossAggroed = true;
    if (target.bossKey) target.bossAggroed = true;
    const events = [];
    const preD = target.hp, preA = u.hp;
    Combat.run(u, target, (e) => events.push(e));
    u.acted = true;
    /* brief battle scene */
    this.mode = 'battleAnim';
    PlayBattle.play(u, target, events, false, () => {
      if (target.hp <= 0 && !target.dead) this.killUnit(target);
      if (u.hp <= 0 && !u.dead) this.killUnit(u);
      /* EXP for player counterattacks in AI-initiated fights */
      if (target.team === 'player' && Units.isAlive(target)) {
        const dealt = preA - Math.max(0, u.hp);
        if (u.dead || u.hp <= 0) this.afterCombatExp(target, Units.expForKill(target, u), null);
        else if (dealt > 0) this.afterCombatExp(target, Units.expForDamage(target, u, dealt), null);
      }
      if (target.charId === 'rowan' && target.dead) this.checkLoss();
      if (this.state === 'chapter') this.mode = 'enemyTurn';
    }, preA, preD);
    return 'attack';
  },

  aiMove(u, path) {
    const last = path[path.length - 1];
    u.x = last[0]; u.y = last[1];
    u.acted = true;
    return 'move';
  },

  aiHeal(u, target) {
    Combat.heal(u, target, () => {});
    u.acted = true;
    return 'heal';
  },

  aiWait(u) { u.acted = true; return 'wait'; },

  /* ---------- camera ---------- */
  updateCamera() {
    const viewW = Config.SCREEN_W / Config.TILE, viewH = Config.SCREEN_H / Config.TILE;
    let tx = this.cursor.x - (viewW - 1) / 2;
    let ty = this.cursor.y - (viewH - 1) / 2;
    tx = Utils.clamp(Math.round(tx), 0, Math.max(0, GameMap.w - viewW));
    ty = Utils.clamp(Math.round(ty), 0, Math.max(0, GameMap.h - viewH));
    this.cam.x = tx; this.cam.y = ty;
  },

  /* ---------- per-frame update (chapter map mode) ---------- */

  update(dt) {
    if (Dialogue.active) { Dialogue.update(dt); return; }
    if (PlayBattle.active) { PlayBattle.update(dt); return; }
    if (LevelUp.active) { LevelUp.update(dt); return; }

    if (this.toastT !== null && this.toast) {
      this.toastT += dt;
      if (this.toastT > 1600) { this.toast = null; this.toastT = 0; }
    }
    if (this.phaseBanner > 0) this.phaseBanner -= dt;

    switch (this.mode) {
      case 'idle': this.updateIdle(dt); break;
      case 'unitSelected': this.updateUnitSelected(dt); break;
      case 'enemyRange': this.updateEnemyRange(dt); break;
      case 'menu': this.updateMenu(dt); break;
      case 'sysmenu': this.updateSysMenu(dt); break;
      case 'submenu': this.updateSubmenu(dt); break;
      case 'itemaction': this.updateItemAction(dt); break;
      case 'target': this.updateTarget(dt); break;
      case 'status': this.updateStatus(dt); break;
      case 'enemyTurn': this.updateEnemyPhase(dt); break;
      case 'battleAnim': case 'dialogue': case 'moveChosen': break;
    }
    this.updateCamera();
  },

  /* cursor movement (Input repeat gives smooth scroll) */
  moveCursor() {
    let moved = false;
    if (Input.pressed('up')) { this.cursor.y--; moved = true; }
    if (Input.pressed('down')) { this.cursor.y++; moved = true; }
    if (Input.pressed('left')) { this.cursor.x--; moved = true; }
    if (Input.pressed('right')) { this.cursor.x++; moved = true; }
    if (moved) {
      this.cursor.x = Utils.clamp(this.cursor.x, 0, GameMap.w - 1);
      this.cursor.y = Utils.clamp(this.cursor.y, 0, GameMap.h - 1);
      Audio.SFX.cursor();
    }
    return moved;
  },

  /* cursor free movement */
  updateIdle(dt) {
    this.moveCursor();
    if (Input.pressed('confirm')) {
      const u = GameMap.unitAt(this.cursor.x, this.cursor.y);
      if (u && u.team === 'player' && !u.acted && this.phase === 'player') {
        this.selectUnit(u);
      } else if (u && u.team === 'enemy' && !u.acted) {
        /* show enemy range preview */
        this.selected = u;
        this.moveTiles = GameMap.moveRange(u);
        this.atkTiles = GameMap.attackTilesAt(u);
        this.mode = 'enemyRange';
        Audio.SFX.select();
      } else {
        Audio.SFX.cancel();
      }
    }
    if (Input.pressed('menu')) { this.openSystemMenu(); }
    if (Input.pressed('endturn')) { this.endPlayerPhase(); }
  },

  updateEnemyRange(dt) {
    if (Input.pressed('confirm') || Input.pressed('cancel')) {
      this.selected = null; this.moveTiles = []; this.atkTiles = new Set();
      this.mode = 'idle';
    }
  },

  updateUnitSelected(dt) {
    const u = this.selected;
    /* move cursor within range: confirm on a reachable tile */
    this.moveCursor(true);
    if (Input.pressed('cancel')) { this.deselect(); return; }
    if (Input.pressed('confirm')) {
      const t = this.moveTiles.find(t => t.x === this.cursor.x && t.y === this.cursor.y);
      if (t) {
        u.x = this.cursor.x; u.y = this.cursor.y;
        this.moveTarget = t;
        this.menuItems = this.buildActionMenu(u);
        this.menuSel = 0;
        this.mode = 'menu';
        Audio.SFX.confirm();
      }
    }
  },

  updateMenu(dt) {
    const u = this.selected;
    if (Input.pressed('up')) { this.menuSel = (this.menuSel + this.menuItems.length - 1) % this.menuItems.length; Audio.SFX.cursor(); }
    if (Input.pressed('down')) { this.menuSel = (this.menuSel + 1) % this.menuItems.length; Audio.SFX.cursor(); }
    if (Input.pressed('cancel')) {
      /* undo move */
      const u = this.selected;
      const orig = (this.preMovePos && this.preMovePos[u.id]) || null;
      if (orig) { u.x = orig.x; u.y = orig.y; }
      this.deselect();
      return;
      /* note: once an action fires we do not return here */
    }
    if (Input.pressed('confirm')) {
      const it = this.menuItems[this.menuSel];
      Audio.SFX.confirm();
      if (it.act === 'attack' || it.act === 'heal') {
        /* target selection */
        this.targetSel = { act: it.act, list: it.act === 'attack' ? this.attackableFrom(u.x, u.y, u) : GameMap.healableAllies(u), idx: 0 };
        this.mode = 'target';
        return;
      }
      this.executeAction(u, it.act, it);
    }
  },

  updateTarget(dt) {
    const ts = this.targetSel;
    const list = ts.list;
    /* sort targets by position for intuitive cycling */
    if (Input.pressed('up') || Input.pressed('left')) { ts.idx = (ts.idx + list.length - 1) % list.length; Audio.SFX.cursor(); }
    if (Input.pressed('down') || Input.pressed('right')) { ts.idx = (ts.idx + 1) % list.length; Audio.SFX.cursor(); }
    if (Input.pressed('confirm')) {
      const target = list[ts.idx];
      Audio.SFX.confirm();
      const act = ts.act;
      this.targetSel = null;
      this.executeAction(this.selected, act, { target });
    }
    if (Input.pressed('cancel')) {
      this.targetSel = null;
      this.menuSel = 0;
      this.mode = 'menu';
    }
  },

  /* ---------- system menu ---------- */
  openSystemMenu() {
    this.menuItems = [
      { label: 'Status', act: 'sys_status' },
      { label: 'Save', act: 'sys_save' },
      { label: 'Mute', act: 'sys_mute' },
      { label: 'End Turn', act: 'sys_end' },
      { label: 'Close', act: 'sys_close' },
    ];
    this.menuSel = 0;
    this.mode = 'sysmenu';
    Audio.SFX.open();
  },

  updateSysMenu(dt) {
    if (Input.pressed('up')) { this.menuSel = (this.menuSel + this.menuItems.length - 1) % this.menuItems.length; Audio.SFX.cursor(); }
    if (Input.pressed('down')) { this.menuSel = (this.menuSel + 1) % this.menuItems.length; Audio.SFX.cursor(); }
    if (Input.pressed('cancel')) { this.mode = 'idle'; Audio.SFX.cancel(); }
    if (Input.pressed('confirm')) {
      const it = this.menuItems[this.menuSel];
      Audio.SFX.confirm();
      switch (it.act) {
        case 'sys_status': {
          const u = GameMap.unitAt(this.cursor.x, this.cursor.y) || this.playersAlive()[0];
          this.statusUnit = u;
          this.mode = 'status';
          break;
        }
        case 'sys_save': {
          const okSave = SaveLoad.save({ chapter: this.chapterId, turn: this.turn });
          this.toastMsg(okSave ? 'Game saved!' : 'Save failed...');
          this.mode = 'idle';
          break;
        }
        case 'sys_mute': Audio.toggleMute(); this.mode = 'idle'; break;
        case 'sys_end': this.endPlayerPhase(); break;
        case 'sys_close': this.mode = 'idle'; break;
      }
    }
  },

  /* ---------- item / trade submenus ---------- */
  updateSubmenu(dt) {
    const sm = this.submenu;
    if (!sm) { this.mode = 'menu'; return; }
    const u = sm.unit;

    if (Input.pressed('cancel')) {
      if (sm.type === 'trade' && sm.partner !== null && sm.partner !== undefined) {
        sm.partner = null;  /* back to partner pick */
      } else {
        this.submenu = null;
        this.mode = 'menu';
      }
      Audio.SFX.cancel();
      return;
    }

    if (sm.type === 'items') {
      if (Input.pressed('up')) { sm.sel = (sm.sel + u.items.length - 1) % u.items.length; Audio.SFX.cursor(); }
      if (Input.pressed('down')) { sm.sel = (sm.sel + 1) % u.items.length; Audio.SFX.cursor(); }
      if (Input.pressed('confirm')) {
        const it = u.items[sm.sel];
        Audio.SFX.confirm();
        this.itemActionMenu = { item: it, sel: 0 };
        this.mode = 'itemaction';
      }
    }

    if (sm.type === 'trade') {
      if (sm.partner === null || sm.partner === undefined) {
        const partners = this.adjacentAllies(u);
        if (Input.pressed('up')) { sm.sel = (sm.sel + partners.length - 1) % partners.length; Audio.SFX.cursor(); }
        if (Input.pressed('down')) { sm.sel = (sm.sel + 1) % partners.length; Audio.SFX.cursor(); }
        if (Input.pressed('confirm')) {
          sm.partner = partners[sm.sel % partners.length];
          sm.psel = 0;
          Audio.SFX.confirm();
        }
      } else {
        /* pick item from unit then partner */
        const nU = u.items.length, nP = sm.partner.items.length;
        if (Input.pressed('up')) { sm.sel = (sm.sel + nU - 1) % Math.max(1, nU); Audio.SFX.cursor(); }
        if ( Input.pressed('down')) { sm.sel = (sm.sel + 1) % Math.max(1, nU); Audio.SFX.cursor(); }
        if (Input.pressed('confirm')) {
          const it = u.items[sm.sel];
          if (it && sm.partner.items.length < Config.RULES.MAX_INVENTORY) {
            u.items.splice(u.items.indexOf(it), 1);
            sm.partner.items.push(it);
            if (u.weapon && !u.items.includes(u.weapon)) Units.equipBest(u);
            Audio.SFX.open();
            sm.sel = 0;
            if (!u.items.length) { this.submenu = null; this.mode = 'menu'; }
          } else { Audio.SFX.cancel(); }
        }
      }
    }
  },

  /* item action menu: equip / use / drop */
  updateItemAction(dt) {
    const iam = this.itemActionMenu;
    const sm = this.submenu;
    const u = sm ? sm.unit : this.selected;
    const opts = ['Equip', 'Use', 'Drop', 'Back'];
    if (Input.pressed('up')) { iam.sel = (iam.sel + 3) % 4; Audio.SFX.cursor(); }
    if (Input.pressed('down')) { iam.sel = (iam.sel + 1) % 4; Audio.SFX.cursor(); }
    if (Input.pressed('cancel')) { this.mode = 'submenu'; }
    if (Input.pressed('confirm')) {
      const it = iam.item;
      Audio.SFX.confirm();
      const opt = opts[iam.sel];
      if (opt === 'Equip') {
        if (Units.canWield(u, it) && it.type) { u.weapon = it; Audio.SFX.open(); }
        else Audio.SFX.cancel();
      } else if (opt === 'Use') {
        this.useItem(u, it);
      } else if (opt === 'Drop') {
        u.items = u.items.filter(i => i !== it);
        if (u.weapon === it) Units.equipBest(u);
        this.submenu = null;
        this.mode = 'menu';
      } else {
        this.mode = 'submenu';
      }
      if (opt === 'Use') {
        this.submenu = null;
        this.mode = 'menu';
      }
    }
  },

  useItem(u, it) {
    if (it.kind === 'heal') {
      const amt = Math.min(it.heal, u.maxhp - u.hp);
      if (amt > 0) {
        u.hp += amt;
        it.uses--;
        Audio.SFX.heal();
        this.toastMsg(u.name + ' recovered ' + amt + ' HP!');
      }
    } else if (it.kind === 'promo') {
      if (Units.canPromote(u)) {
        Units.promote(u);
        it.uses--;
        Audio.SFX.levelup();
        this.toastMsg(u.name + ' promoted to ' + ClassDB[u.classId].name + '!');
      } else {
        this.toastMsg(u.promoted ? 'Already promoted.' : 'Must be level ' + Config.PROMOTION.MIN_LEVEL + '+.');
        return;
      }
    } else if (it.kind === 'cure') {
      u.statuses = [];
      it.uses--;
      this.toastMsg('Status cured!');
    }
    if (it.uses <= 0) {
      u.items = u.items.filter(i => i !== it);
      if (u.weapon === it) Units.equipBest(u);
    }
    u.acted = true;
  },

  /* ---------- status screen ---------- */
  updateStatus(dt) {
    const list = this.playersAlive();
    if (Input.pressed('left')) {
      const i = list.indexOf(this.statusUnit);
      this.statusUnit = list[(i - 1 + list.length) % list.length];
      Audio.SFX.cursor();
    }
    if (Input.pressed('right')) {
      const i = list.indexOf(this.statusUnit);
      this.statusUnit = list[(i + 1) % list.length];
      Audio.SFX.cursor();
    }
    if (Input.pressed('cancel') || Input.pressed('menu') || Input.pressed('confirm')) {
      this.mode = 'idle';
      Audio.SFX.cancel();
    }
  },

  /* ---------- main draw ---------- */

  draw(g) {
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    g.fillStyle = '#101828';
    g.fillRect(0, 0, SW, SH);

    if (Dialogue.active) { this.drawMap(g); Dialogue.draw(g); return; }
    if (PlayBattle.active) { PlayBattle.draw(g); return; }
    if (LevelUp.active) { this.drawMap(g); LevelUp.draw(g); return; }

    this.drawMap(g);

    /* overlays by mode */
    if (this.mode === 'menu') {
      UI.menu(g, SW - 84, 8, 76, this.menuItems, this.menuSel);
    } else if (this.mode === 'sysmenu') {
      UI.menu(g, SW - 84, 8, 76, this.menuItems, this.menuSel);
    } else if (this.mode === 'itemaction') {
      UI.menu(g, SW - 84, 8, 76, [{ label: 'Equip' }, { label: 'Use' }, { label: 'Drop' }, { label: 'Back' }], this.itemActionMenu.sel);
    } else if (this.mode === 'submenu' && this.submenu) {
      this.drawSubmenu(g);
    } else if (this.mode === 'target') {
      this.drawTargetOverlay(g);
    } else if (this.mode === 'status' && this.statusUnit) {
      this.drawStatus(g, this.statusUnit);
    }

    if (this.toast) UI.banner(g, this.toast, SH - 26, this.toastT, 100);

    /* phase banner (GBA gold-ribbon style) */
    if (this.phaseBanner > 0) {
      const text = this.phase === 'player' ? 'PLAYER PHASE' : 'ENEMY PHASE';
      const col = this.phase === 'player' ? '#70b0f8' : '#f07070';
      UI.phaseBanner(g, text, col, 120 - this.phaseBanner, 120);
    }

    /* objective */
    const objText = 'TURN ' + this.turn + '  ' + this.chapter.objective.label;
    UI.window(g, 2, 2, Font.width(objText) + 10, 14);
    Font.draw(g, objText, 7, 5, '#f8f8d0');
  },

  drawMap(g) {
    const T = Config.TILE;
    const ox = -this.cam.x * T, oy = -this.cam.y * T;
    const x0 = this.cam.x, y0 = this.cam.y;
    const x1 = Math.min(GameMap.w, x0 + Math.ceil(Config.SCREEN_W / T) + 1);
    const y1 = Math.min(GameMap.h, y0 + Math.ceil(Config.SCREEN_H / T) + 1);

    /* tiles — water/river/gate are 2-frame animated, others static */
    const AF = TileArt.FRAMES || 1;
    const waterAnim = ['water', 'river', 'gate'];
    const aFrame = Math.floor(performance.now() / 500) % AF;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const id = GameMap.tileAt(x, y);
        const img = waterAnim.includes(id) ? TileArt.tile(id, aFrame) : TileArt.tile(id);
        g.drawImage(img, ox + x * T, oy + y * T);
      }
    }

    /* range overlays — soft pulse so edges read as "alive" */
    const pulse = 0.30 + 0.10 * Math.sin(performance.now() / 240);
    if (this.moveTiles.length) {
      for (const t of this.moveTiles) {
        g.fillStyle = 'rgba(80,140,248,' + pulse.toFixed(3) + ')';
        g.fillRect(ox + t.x * T, oy + t.y * T, T, T);
      }
    }
    if (this.atkTiles && this.atkTiles.size) {
      const aPulse = 0.26 + 0.10 * Math.sin(performance.now() / 240);
      for (const key of this.atkTiles) {
        const tx = key % GameMap.w, ty = (key / GameMap.w) | 0;
        g.fillStyle = 'rgba(240,80,80,' + aPulse.toFixed(3) + ')';
        g.fillRect(ox + tx * T, oy + ty * T, T, T);
      }
    }

    /* FE-style move arrow while picking a destination */
    if (this.mode === 'unitSelected' && this.selected && this.reach && this.preMovePos) {
      const orig = this.preMovePos[this.selected.id];
      if (orig) {
        const path = GameMap.pathTo(this.reach, orig.x, orig.y, this.cursor.x, this.cursor.y);
        if (path && path.length > 1) {
          UI.moveArrow(g, path.map(pt => ({ x: pt[0], y: pt[1] })), T, ox, oy);
        }
      }
    }

    /* units */
    for (const u of this.units) {
      if (u.dead || u.carriedBy) continue;
      const px = ox + u.x * T, py = oy + u.y * T;
      const kind = u.sprite || 'npc';
      const frame = (Math.floor(performance.now() / 400) % 2);
      g.drawImage(CharArt.unit(kind, frame, false), px, py);
      /* team pip: blue player / red enemy / green NPC, top-left */
      const pip = u.team === 'player' ? '#4c78e8' : (u.team === 'enemy' ? '#d84040' : '#4ca85c');
      g.fillStyle = '#0a0f22';
      g.fillRect(px + 1, py + 1, 4, 4);
      g.fillStyle = pip;
      g.fillRect(px + 2, py + 2, 2, 2);
      if (u.acted) {
        g.fillStyle = 'rgba(40,40,60,0.55)';
        g.fillRect(px, py, T, T);
      }
      /* small hp pip */
      if (u.team !== 'player') {
        UI.hpBar(g, px + 2, py - 3, T - 4, 2, u.hp, u.maxhp);
      }
    }

    /* cursor (hidden during pure anim modes) */
    if (['idle', 'unitSelected', 'menu', 'submenu', 'itemaction', 'sysmenu', 'target'].includes(this.mode)) {
      UI.cursor(g, ox + this.cursor.x * T, oy + this.cursor.y * T, performance.now());
    }

    /* hover info panels */
    if (this.mode === 'idle' || this.mode === 'unitSelected') {
      const u = GameMap.unitAt(this.cursor.x, this.cursor.y);
      const terr = this.terrainAt(this.cursor.x, this.cursor.y);
      if (u) UI.unitPanel(g, u, 2, 18);
      else UI.terrainPanel(g, terr, 2, 18);
    }
  },

  drawSubmenu(g) {
    const sm = this.submenu;
    const u = sm.unit;
    if (sm.type === 'items') {
      const items = u.items.map(it => ({
        label: it.name.slice(0, 11) + ' ' + it.uses,
        disabled: false,
      }));
      if (!items.length) items.push({ label: '(empty)' });
      UI.menu(g, 8, 8, 110, items, sm.sel);
      const it = u.items[sm.sel];
      if (it) {
        UI.window(g, 8, 8 + items.length * 12 + 10, 120, 18);
        Font.draw(g, (it.desc || (it.type ? 'MT' + it.might + ' HIT' + it.hit + ' ' + it.range : '')).slice(0, 22), 13, 12 + 8 + items.length * 12 + 10, '#a8b8d8');
      }
    } else if (sm.type === 'trade') {
      if (sm.partner === null || sm.partner === undefined) {
        const partners = this.adjacentAllies(u);
        const items = partners.map(p => ({ label: p.name }));
        UI.menu(g, 8, 8, 90, items.length ? items : [{ label: '(none)' }], sm.sel);
      } else {
        const items = u.items.map(it => it.name.slice(0, 10) + ' ' + it.uses);
        if (!items.length) items.push('(empty)');
        UI.window(g, 8, 8, 100, items.length * 12 + 8);
        items.forEach((s, i) => Font.draw(g, s, 14, 12 + i * 12, i === sm.sel ? '#f8f850' : '#e8e8d0'));
        UI.window(g, Config.SCREEN_W - 108, 8, 100, Math.max(1, sm.partner.items.length) * 12 + 8);
        sm.partner.items.forEach((it, i) => Font.draw(g, it.name.slice(0, 10) + ' ' + it.uses, Config.SCREEN_W - 102, 12 + i * 12, '#e8e8d0'));
      }
    }
  },

  drawTargetOverlay(g) {
    const ts = this.targetSel;
    if (!ts || !ts.list.length) return;
    const t = ts.list[ts.idx];
    const T = Config.TILE;
    const ox = -this.cam.x * T, oy = -this.cam.y * T;
    UI.cursor(g, ox + t.x * T, oy + t.y * T, performance.now());
    /* live GBA-style forecast card (centered) */
    const fc = Units.forecast(this.selected, t);
    fc.tri = Units.triangleMod(this.selected, t).dmg;
    const fx = Math.round((Config.SCREEN_W - 150) / 2);
    const fy = Config.SCREEN_H - 58;
    UI.forecast(g, fx, fy, 150, fc, this.selected.name, t.name, performance.now());
  },

  drawStatus(g, u) {
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    g.fillStyle = 'rgba(8,10,24,0.85)';
    g.fillRect(0, 0, SW, SH);
    const w = 190, h = 130;
    const x = Math.round((SW - w) / 2), y = Math.round((SH - h) / 2);
    UI.frame(g, x, y, w, h);
    const art = CharArt.portrait(u.portrait || 'npc');
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, 32, 32, x + 6, y + 6, 48, 48);
    Font.draw(g, u.name, x + 60, y + 8, '#9ab8f8', 2);
    const cls = ClassDB[u.classId];
    Font.draw(g, 'LV' + u.level + ' EXP' + u.exp, x + 60, y + 26, '#e8e8d0');
    Font.draw(g, cls ? cls.name : u.classId, x + 60, y + 36, '#c8d8f8');
    const st = u.stats;
    const row = (label, v, xx, yy, col) => {
      Font.draw(g, label, xx, yy, col || '#a8b8d8');
      Font.draw(g, String(v), xx + 34, yy, '#f8f8d0');
    };
    row('HP', u.hp + '/' + u.maxhp, x + 6, y + 60, '#90f090');
    row('STR', st.str, x + 6, y + 70);
    row('SKL', st.skl, x + 6, y + 80);
    row('SPD', st.spd, x + 6, y + 90);
    row('LUK', st.luk, x + 6, y + 100);
    row('DEF', st.def, x + 6, y + 110);
    row('MAG', st.mag, x + 52, y + 70);
    row('RES', st.res, x + 52, y + 80);
    row('CON', st.con, x + 52, y + 90);
    row('MOV', u.move, x + 52, y + 100);
    Font.draw(g, 'GOLD ' + this.gold, x + 52, y + 110, '#f8d850');
    /* inventory */
    Font.draw(g, '- ITEMS -', x + 100, y + 60, '#f8f850');
    u.items.slice(0, 7).forEach((it, i) => {
      Font.draw(g, (u.weapon === it ? 'E ' : '  ') + it.name.slice(0, 9) + ' ' + it.uses, x + 100, y + 70 + i * 9, '#e8e8d0');
    });
    /* bio */
    if (u.bio) {
      const words = u.bio.split(' ');
      let line = '', yy = y + h - 24;
      /* draw last 2 lines of bio */
      const lines = [];
      for (const wd of words) {
        const t = line ? line + ' ' + wd : wd;
        if (Font.width(t) > w - 16) { lines.push(line); line = wd; } else line = t;
      }
      if (line) lines.push(line);
      lines.slice(-2).forEach((l, i) => Font.draw(g, l, x + 8, yy + i * 9, '#8898b8'));
    }
  },
};
