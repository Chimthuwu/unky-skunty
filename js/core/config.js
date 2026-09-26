/* =============================================================
   CONFIG — every tunable balance constant lives here.
   Formulas are centralized; content data never hardcodes numbers.
   ============================================================= */
'use strict';

const Config = {
  /* ---------- presentation ---------- */
  SCREEN_W: 240,            // virtual GBA-resolution canvas width
  SCREEN_H: 160,
  SCALE: 3,                 // integer nearest-neighbor scale
  TILE: 16,                 // pixels per tile at virtual resolution
  FPS: 60,

  /* ---------- combat ---------- */
  COMBAT: {
    CRIT_MULT: 3,                 // critical hit damage multiplier
    ADV_HIT: 15,                  // weapon triangle: hit bonus for advantage
    ADV_DMG: 1,                   // weapon triangle: damage bonus
    DIS_HIT: -15,
    DIS_DMG: -1,
    DOUBLE_SPEED: 4,              // AS advantage needed for follow-up attack
    AS_WEIGHT_DIV: 3,             // AS = speed - floor(weight / this)
    CON_WEIGHT_FREE: 5,           // weapon weight reduced by constitution up to this
    EFFECTIVE_MULT: 2,            // effectiveness (bows vs flyers etc.)
    MIN_DAMAGE: 0,
    STAFF_EXP: 15,                // exp per staff use
    HEAL_EXP_PER_HP: 8,           // bonus exp per HP restored (staff)
  },

  /* ---------- experience ---------- */
  EXP: {
    BASE_HIT: 10,                 // exp for dealing damage
    PER_DAMAGE: 1,                // exp per point of damage dealt
    KILL_BONUS: 30,               // flat bonus for a kill
    BOSS_BONUS: 40,               // extra exp from bosses
    MAX_LEVEL: 20,
    MAX_PROMOTED_LEVEL: 20,
    HEAL_MIN: 15,                 // min exp from healing
    LEVELUP_STAT_GROWTH_FLOOR: 1, // GBA guarantee: 1 stat increases per level
  },

  /* ---------- promotion ---------- */
  PROMOTION: {
    MIN_LEVEL: 10,                // level required to use a promotion item
    BASE_STAT_BONUS: { hp: 5, str: 3, mag: 3, skl: 3, spd: 3, luk: 2, def: 3, res: 3 },
  },

  /* ---------- experience curve for enemy exp gain ---------- */
  EXP_CURVE: {
    /* exp gained from damaging/killing enemy of relative level diff */
    BASE: 20,
    PER_LEVEL: 4,                 // +/- per relative level (attacker vs target)
    MIN: 1,
    MAX: 100,
  },

  /* ---------- misc rules ---------- */
  RULES: {
    PERMADEATH: true,             // set false for a future casual mode
    MAX_INVENTORY: 5,
    RESCUE_CON_LIMIT: 2,          // rescuer con must be >= 2x target con
    DROPPED_ITEM_TURNS: 999,      // dropped items persist
    TURN_HEAL_TILES: { fort: 10, gate: 10, throne: 10 }, // % hp heal on heal tiles
    STAFF_RANGE_SELF: true,
    VISIT_REWARD_TURNS: 1,
  },

  /* ---------- AI ---------- */
  AI: {
    LETHAL_WEIGHT: 6.0,     // multiplier when a strike is expected to kill
    DAMAGE_WEIGHT: 0.55,    // value per point of expected damage
    COUNTER_RISK: 0.5,      // penalty factor for expected counter damage
    HIT_WEIGHT: 0.25,       // value per point of hit chance (%)
    CRIT_WEIGHT: 0.35,      // value per point of enemy crit chance against AI
    TERRAIN_BONUS: 0.45,    // value per point of def/avoid terrain bonus
    DISTANCE_DECAY: 0.9,    // preference for closer targets when equal
    GUARD_RADIUS: 3,        // guard AI: engage targets within this radius
  },

  /* ---------- economy ---------- */
  ECONOMY: {
    START_GOLD: 1500,
  },

  /* ---------- debug ---------- */
  DEBUG_DEFAULT: false,
};
