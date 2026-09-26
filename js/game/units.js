/* =============================================================
   UNITS — creation, growth, experience, promotion.
   Pure logic: no rendering, no input. UI consumes these functions.
   ============================================================= */
'use strict';

const Units = {

  /* ---------- creation ---------- */

  /* Build a playable unit from CharacterDB data. */
  makePlayerUnit(charId) {
    const ch = CharacterDB[charId];
    const cls = ClassDB[ch.classId];
    const u = {
      id: charId,
      name: ch.name,
      charId: charId,
      classId: ch.classId,
      team: 'player',
      level: ch.level,
      exp: 0,
      promoted: !!cls.promoted,
      portrait: ch.portrait || charId,
      sprite: ch.sprite || 'lord',
      battle: ch.battle || ch.sprite || 'lord',
      bio: ch.bio || '',
      personality: ch.personality || '',
      affinity: ch.affinity || null,
      x: 0, y: 0,
      hp: 0, maxhp: 0,
      stats: {}, growths: {}, caps: {},
      ranks: {},
      items: [],
      statuses: [],
      rescuing: null, carriedBy: null,
      acted: false, droppedOnDeath: false,
      ai: null,
    };
    this.applyStats(u, ch.stats, ch.growths);
    this.applyClass(u, cls);
    u.items = ch.inventory.map(id => Items.make(id));
    this.equipBest(u);
    this.refreshMaxHp(u);
    u.hp = u.maxhp;
    return u;
  },

  /* Build an enemy/NPC unit from chapter spawn data. */
  makeNPCUnit(spawn, id) {
    const cls = ClassDB[spawn.classId];
    const lvGain = Math.max(0, spawn.level - 1);
    const u = {
      id: spawn.id || ('npc' + id),
      name: spawn.name,
      charId: null,
      classId: spawn.classId,
      team: spawn.team,
      level: spawn.level,
      exp: 0,
      promoted: !!cls.promoted,
      portrait: spawn.portrait || (spawn.team === 'npc' ? 'npc' : null),
      sprite: spawn.sprite || this.enemySprite(cls),
      battle: spawn.battle || this.enemySprite(cls),
      bio: spawn.bio || '',
      personality: '',
      affinity: null,
      x: spawn.x, y: spawn.y,
      hp: 0, maxhp: 0,
      stats: {}, growths: {}, caps: {},
      ranks: {},
      items: [],
      statuses: [],
      rescuing: null, carriedBy: null,
      acted: false,
      ai: spawn.ai || 'aggro',
      guardPos: (spawn.ai === 'guard' || spawn.ai === 'boss') ? { x: spawn.x, y: spawn.y } : null,
      bossKey: spawn.bossKey || null,
      bossQuote: spawn.bossQuote || null,
      bossAggroed: false,
      aggroWhen: spawn.aggroWhen || null,
      bossZone: spawn.bossZone || null,
    };
    this.applyClass(u, cls);
    /* enemies gain stats per level: class growths applied at half rate so
       low-level mooks stay simple and bosses scale meaningfully. */
    for (const k of STAT_KEYS) {
      const g = (cls.growths[k] || 0);
      u.stats[k] += Math.round((g * lvGain) / 50);
    }
    u.items = spawn.inventory.map(id2 => Items.make(id2));
    this.equipBest(u);
    this.refreshMaxHp(u);
    u.hp = u.maxhp;
    return u;
  },

  enemySprite(cls) {
    const has = (w) => { const r = cls.weapons[w]; return r && r !== '*'; };
    if (cls.moveType === 'armor') return 'earmor';
    if (cls.moveType === 'cavalry') return 'ecav';
    if (has('staff')) return 'epriest';
    if (has('dark')) return 'eshaman';
    if (has('bow')) return 'earcher';
    if (has('axe')) return 'ebrigand';
    return 'esoldier';
  },

  applyStats(u, bases, growths) {
    for (const k of STAT_KEYS) {
      u.stats[k] = (bases[k] || 0);
      u.growths[k] = (growths[k] || 0);
    }
  },

  applyClass(u, cls) {
    /* class bases are ADDED to character bases at level 1 representation.
       For enemies, class bases are the whole base. For players we keep it
       simple: character 'stats' entries are personal additions on top of
       class bases. */
    for (const k of STAT_KEYS) {
      u.stats[k] = (u.stats[k] || 0) + (cls.bases[k] || 0);
      u.growths[k] = (u.growths[k] || 0) + (cls.growths[k] || 0);
      u.caps[k] = cls.caps[k];
    }
    u.moveType = cls.moveType;
    u.move = cls.move;
    u.ranks = Object.assign({}, cls.weapons);
    u.tags = (cls.tags || []).slice();
    u.lockpick = !!cls.lockpick;
  },

  /* ---------- derived values ---------- */

  refreshMaxHp(u) {
    const cap = u.caps.hp || 60;
    u.maxhp = Math.min(cap, u.stats.hp);
    if (u.hp > u.maxhp) u.hp = u.maxhp;
  },

  /* effective attack speed: speed - weapon weight burden */
  attackSpeed(u) {
    const w = u.weapon ? u.weapon.weight : 0;
    const con = u.stats.con || Config.COMBAT.CON_WEIGHT_FREE;
    const burden = Math.max(0, w - Math.max(0, con));
    return u.stats.spd - Math.floor(burden / Config.COMBAT.AS_WEIGHT_DIV);
  },

  weaponRange(w) {
    if (!w) return [];
    const parts = String(w.range).split('-').map(Number);
    if (parts.length === 1) return [parts[0]];
    const out = [];
    for (let i = parts[0]; i <= parts[1]; i++) out.push(i);
    return out;
  },

  attackRange(u) {
    const w = u.weapon;
    if (!w) return [];
    if (w.type === 'staff') return [];
    return this.weaponRange(w);
  },

  staffRange(u) {
    const w = u.weapon;
    if (!w || w.type !== 'staff') return [];
    return this.weaponRange(w);
  },

  canAttackAt(u, dx, dy) {
    const d = Math.abs(dx) + Math.abs(dy);
    return this.attackRange(u).includes(d);
  },

  isAlive(u) { return u.hp > 0 && !u.dead; },

  /* ---------- weapons & equipping ---------- */

  canWield(u, item) {
    if (!item || !item.type) return false;
    const r = u.ranks[item.type];
    if (!r || r === '*') return false;
    return RANK_ORDER.indexOf(item.rank) <= RANK_ORDER.indexOf(r);
  },

  equipBest(u) {
    let best = null, bestScore = -1;
    for (const it of u.items) {
      if (!it.type || it.type === 'staff') continue;
      if (it.uses <= 0) continue;
      if (!this.canWield(u, it)) continue;
      const score = it.might * 2 + (it.effective ? 4 : 0);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    /* staff users fall back to their staff so heal logic works */
    if (!best) {
      best = u.items.find(it => it.type === 'staff' && it.uses > 0 && this.canWield(u, it)) || null;
    }
    u.weapon = best;
  },

  equip(u, itemId) {
    const it = u.items.find(i => i.iid === itemId);
    if (!it || !this.canWield(u, it)) return false;
    u.weapon = it;
    return true;
  },

  /* ---------- combat math (GBA-style) ---------- */

  triangleMod(a, d) {
    /* returns {dmg, hit} modifiers from weapon triangle / magic trinity */
    const at = a.weapon && a.weapon.type;
    const dt = d.weapon && d.weapon.type;
    if (!at || !dt) return { dmg: 0, hit: 0 };
    const phys = { sword: 'axe', axe: 'lance', lance: 'sword' };
    const magic = { anima: 'light', light: 'dark', dark: 'anima' };
    if (phys[at] === dt) return { dmg: Config.COMBAT.ADV_DMG, hit: Config.COMBAT.ADV_HIT };
    if (phys[dt] === at) return { dmg: Config.COMBAT.DIS_DMG, hit: Config.COMBAT.DIS_HIT };
    if (magic[at] === dt) return { dmg: Config.COMBAT.ADV_DMG, hit: Config.COMBAT.ADV_HIT };
    if (magic[dt] === at) return { dmg: Config.COMBAT.DIS_DMG, hit: Config.COMBAT.DIS_HIT };
    return { dmg: 0, hit: 0 };
  },

  effectiveAgainst(w, target) {
    if (!w.effective) return false;
    const tags = target.tags || [];
    return w.effective.some(t => tags.includes(t));
  },

  terrainOf(u) {
    return Game ? Game.terrainAt(u.x, u.y) : TerrainDB.plain;
  },

  forecast(a, d) {
    /* full combat forecast: attacker strikes first. */
    const out = {};
    const tri = this.triangleMod(a, d);
    const wA = a.weapon, wD = d.weapon;
    const terrA = this.terrainOf(a), terrD = this.terrainOf(d);

    function side(atk, def, triMod, defTerrain) {
      const w = atk.weapon;
      if (!w) {
        return { mt: 0, hit: 0, crit: 0, as: Units.attackSpeed(atk), can: false, double: false };
      }
      const magic = (w.type === 'anima' || w.type === 'light' || w.type === 'dark');
      const eff = Units.effectiveAgainst(w, def) ? Config.COMBAT.EFFECTIVE_MULT : 1;
      let mt = w.might + (magic ? atk.stats.mag : atk.stats.str) + triMod.dmg;
      mt *= eff;
      const defv = magic ? def.stats.res : def.stats.def;
      mt = Math.max(Config.COMBAT.MIN_DAMAGE, mt - defv - (defTerrain.def || 0));
      const triDef = Units.triangleMod(def, atk);
      const hit = Utils.clamp(w.hit + atk.stats.skl * 2 + atk.stats.luk + triMod.hit - triDef.hit
        - def.stats.spd * 2 - (defTerrain.avoid || 0), 0, 100);
      const crit = Utils.clamp(w.crit + Math.floor(atk.stats.skl / 2), 0, 100)
        - def.stats.luk;
      const asAtk = Units.attackSpeed(atk);
      const asDef = Units.attackSpeed(def);
      const dbl = (w.type !== 'staff') && (asAtk - asDef >= Config.COMBAT.DOUBLE_SPEED);
      return { mt, hit, crit, as: asAtk, can: true, double: dbl };
    }

    out.a = side(a, d, tri, terrD);
    out.d = side(d, a, this.triangleMod(d, a), terrA);
    out.aName = a.name; out.dName = d.name;
    out.aHp = a.hp; out.dHp = d.hp;
    out.aMaxHp = a.maxhp; out.dMaxHp = d.maxhp;
    out.aWep = wA ? wA.name : '—';
    out.dWep = wD ? wD.name : '—';
    out.aDeaths = 0; out.dDeaths = 0;
    /* rough death count for smart display */
    if (out.a.can && out.a.mt > 0) {
      const hits = out.a.double ? 2 : 1;
      out.dDeaths = Math.max(0, Math.ceil(out.dHp / (out.a.mt * Config.COMBAT.CRIT_MULT)) <= hits ? 1 : 0);
      /* simpler: does expected damage kill */
      out.dDeaths = (out.a.mt * hits >= out.dHp) ? 1 : 0;
    }
    if (out.d.can && out.d.mt > 0 && !out.aDeaths) {
      const hits = out.d.double ? 2 : 1;
      out.aDeaths = (out.d.mt * hits >= out.aHp) ? 1 : 0;
    }
    return out;
  },

  /* ---------- experience ---------- */

  expForKill(attacker, target) {
    const diff = target.level - attacker.level;
    let exp = Config.EXP_CURVE.BASE + diff * Config.EXP_CURVE.PER_LEVEL;
    if (target.bossKey) exp += Config.EXP.BOSS_BONUS;
    return Utils.clamp(Math.round(exp), Config.EXP_CURVE.MIN, Config.EXP.EXP_PER_LEVEL_MAX || 100);
  },

  expForDamage(attacker, target, dmg) {
    const base = Config.EXP.BASE_HIT + dmg * Config.EXP.PER_DAMAGE;
    const diff = target.level - attacker.level;
    return Utils.clamp(Math.round(base + diff * Config.EXP.PER_LEVEL * 0.5), 1, 60);
  },

  expForHeal(healer, amount) {
    return Utils.clamp(Config.EXP.HEAL_MIN + Math.floor(amount / 2), Config.EXP.HEAL_MIN, 60);
  },

  maxLevel(u) {
    return u.promoted ? Config.EXP.MAX_PROMOTED_LEVEL : Config.EXP.MAX_LEVEL;
  },

  gainExp(u, amount, onLevelUp) {
    if (amount <= 0 || u.promoted === 'capped') return { levels: 0, gains: [] };
    if (u.level >= this.maxLevel(u) && u.exp >= 100) return { levels: 0, gains: [] };
    u.exp += amount;
    const levels = [];
    while (u.exp >= 100 && u.level < this.maxLevel(u)) {
      u.exp -= 100;
      u.level++;
      const gains = this.growUnit(u);
      levels.push(gains);
    }
    if (u.level >= this.maxLevel(u)) u.exp = Math.min(u.exp, 99);
    return { levels, gains: levels };
  },

  /* roll each stat against growth; GBA guarantees >= 1 increase */
  growUnit(u) {
    const gains = {};
    let any = false;
    for (const k of STAT_KEYS) {
      if (k === 'con') continue;
      if (u.stats[k] >= (u.caps[k] || 99)) continue;
      const g = Utils.clamp(u.growths[k] || 0, 0, 120);
      let inc = 0;
      if (g > 100) { inc = 1; if (Utils.roll(g - 100)) inc = 2; }
      else if (Utils.roll(g)) inc = 1;
      if (inc > 0) {
        u.stats[k] = Math.min(u.caps[k] || 99, u.stats[k] + inc);
        gains[k] = inc;
        any = true;
      }
    }
    if (!any) {
      /* GBA rule: at least one stat grows */
      const eligible = STAT_KEYS.filter(k => k !== 'con' && u.stats[k] < (u.caps[k] || 99));
      if (eligible.length) {
        const k = eligible[Utils.ri(0, eligible.length - 1)];
        u.stats[k]++;
        gains[k] = 1;
      }
    }
    this.refreshMaxHp(u);
    if (u.stats.hp > u.maxhp) u.hp = Math.min(u.maxhp, u.hp + (u.stats.hp - u.maxhp));
    return gains;
  },

  /* ---------- promotion ---------- */

  canPromote(u) {
    if (u.promoted) return false;
    const cls = ClassDB[u.classId];
    if (!cls.promotesTo || !cls.promotesTo.length) return false;
    if (u.level < Config.PROMOTION.MIN_LEVEL) return false;
    return true;
  },

  promote(u) {
    if (!this.canPromote(u)) return false;
    const cls = ClassDB[u.classId];
    const nextId = cls.promotesTo[0];
    const next = ClassDB[nextId];
    u.classId = nextId;
    u.promoted = true;
    u.level = 1;
    u.exp = 0;
    for (const k of STAT_KEYS) {
      const bonus = Config.PROMOTION.BASE_STAT_BONUS[k] || 0;
      u.stats[k] = Utils.clamp(u.stats[k] + bonus, 0, next.caps[k] || 99);
      u.growths[k] = (u.growths[k] || 0) - (cls.growths[k] || 0) + (next.growths[k] || 0);
      u.caps[k] = next.caps[k];
    }
    u.moveType = next.moveType;
    u.move = next.move;
    u.ranks = Object.assign({}, next.weapons);
    u.tags = (next.tags || []).slice();
    u.lockpick = !!next.lockpick;
    u.sprite = PROMOTE_SPRITES[u.sprite] || u.sprite;
    u.battle = PROMOTE_SPRITES[u.battle] || u.battle;
    this.refreshMaxHp(u);
    u.hp = u.maxhp;
    return true;
  },
};

const STAT_KEYS = ['hp', 'str', 'mag', 'skl', 'spd', 'luk', 'def', 'res', 'con'];
const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];
const PROMOTE_SPRITES = {
  lord: 'pvanguard', cav: 'pcav', arch: 'parch', brute: 'pbrute',
  mage: 'pmage', cleric: 'pcleric',
  ebrigand: 'ebrigand', earcher: 'earcher', earmor: 'earmor',
  eshaman: 'eshaman', epriest: 'epriest', ecav: 'ecav', esoldier: 'esoldier',
};
