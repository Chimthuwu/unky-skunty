/* =============================================================
   SAVE / LOAD — localStorage snapshot of the chapter state.
   ============================================================= */
'use strict';

const SaveLoad = {
  KEY: 'psydechat_save_v1',
  OLD_KEY: 'emberwrath_save_v1',   /* pre-rename saves migrate transparently */

  has() {
    try {
      if (localStorage.getItem(this.KEY)) return true;
      const old = localStorage.getItem(this.OLD_KEY);
      if (old) { localStorage.setItem(this.KEY, old); return true; }
      return false;
    } catch (e) { return false; }
  },

  save(meta) {
    const data = {
      chapterId: Game.chapterId,
      turn: Game.turn,
      phase: Game.phase,
      gold: Game.gold,
      units: Game.units.map(u => ({
        charId: u.charId, id: u.id, name: u.name,
        classId: u.classId, team: u.team,
        level: u.level, exp: u.exp, promoted: u.promoted,
        x: u.x, y: u.y, hp: u.hp,
        stats: u.stats, growths: u.growths, caps: u.caps,
        ranks: u.ranks, tags: u.tags,
        move: u.move, moveType: u.moveType,
        items: u.items.map(it => ({ id: it.dbId, uses: it.uses })),
        weaponIdx: u.weapon ? u.items.indexOf(u.weapon) : -1,
        statuses: u.statuses,
        ai: u.ai, guardPos: u.guardPos,
        bossKey: u.bossKey, bossAggroed: u.bossAggroed,
        aggroWhen: u.aggroWhen, bossZone: u.bossZone,
        dead: !!u.dead,
        sprite: u.sprite, battle: u.battle, portrait: u.portrait,
        bio: u.bio, personality: u.personality, affinity: u.affinity,
        lockpick: u.lockpick,
        rescuing: u.rescuing, carriedBy: u.carriedBy,
      })),
      visited: Array.from(Game.visited),
      opened: Array.from(Game.opened),
      mapOverrides: Game.mapOverrides,
      meta,
    };
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  },

  /* Rebuild live units from a snapshot (used by Game.loadState). */
  restoreUnits(data) {
    const out = [];
    for (const s of data.units) {
      let u;
      if (s.charId) {
        u = Units.makePlayerUnit(s.charId);
        u.classId = s.classId;   /* may have been promoted since creation */
      } else {
        const spawn = { id: s.id, classId: s.classId, name: s.name, level: s.level, x: s.x, y: s.y, inventory: s.items.map(i => i.id), ai: s.ai };
        u = Units.makeNPCUnit(spawn, 0);
      }
      u.team = s.team;
      u.level = s.level; u.exp = s.exp; u.promoted = s.promoted;
      u.x = s.x; u.y = s.y; u.hp = s.hp;
      u.stats = s.stats; u.growths = s.growths; u.caps = s.caps;
      u.ranks = s.ranks; u.tags = s.tags || [];
      u.move = s.move; u.moveType = s.moveType;
      u.items = s.items.map(it => { const o = Items.make(it.id); o.uses = it.uses; return o; });
      u.weapon = s.weaponIdx >= 0 ? u.items[s.weaponIdx] : null;
      u.statuses = s.statuses || [];
      u.ai = s.ai; u.guardPos = s.guardPos;
      u.bossKey = s.bossKey; u.bossAggroed = !!s.bossAggroed;
      u.aggroWhen = s.aggroWhen; u.bossZone = s.bossZone;
      u.dead = !!s.dead;
      u.sprite = s.sprite; u.battle = s.battle; u.portrait = s.portrait;
      u.bio = s.bio || u.bio; u.personality = s.personality || u.personality;
      u.affinity = s.affinity; u.lockpick = !!s.lockpick;
      u.rescuing = s.rescuing; u.carriedBy = s.carriedBy;
      Units.refreshMaxHp(u);
      out.push(u);
    }
    return out;
  },
};
