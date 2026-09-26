/* =============================================================
   WEAPON DATA — one entry per weapon. Add a weapon = add data.
   type: sword lance axe bow anima light dark staff
   rank: E D C B A S   range: string like "1" or "2" or "1-2"
   effective: list of unit tags it is strong against (armor, cavalry, flyer, dragon)
   ============================================================= */
'use strict';

const WeaponDB = {
  /* ---------------- SWORDS ---------------- */
  iron_sword:   { name: 'Iron Blade',    type: 'sword', rank: 'E', might: 5,  hit: 90, crit: 0,  weight: 5,  range: '1',   dur: 46, value: 460 },
  slim_sword:   { name: 'Slim Saber',    type: 'sword', rank: 'E', might: 3,  hit: 95, crit: 5,  weight: 2,  range: '1',   dur: 40, value: 480 },
  steel_sword:  { name: 'Steel Blade',   type: 'sword', rank: 'D', might: 8,  hit: 80, crit: 0,  weight: 9,  range: '1',   dur: 32, value: 680 },
  iron_sword_p: { name: 'Longsword',     type: 'sword', rank: 'E', might: 5,  hit: 90, crit: 0,  weight: 5,  range: '1-2', dur: 22, value: 900 },
  killer_sword: { name: 'Killer Edge',   type: 'sword', rank: 'C', might: 9,  hit: 85, crit: 30, weight: 8,  range: '1',   dur: 20, value: 1300 },
  silver_sword: { name: 'Silver Edge',   type: 'sword', rank: 'B', might: 13, hit: 90, crit: 0,  weight: 9,  range: '1',   dur: 25, value: 1800 },
  rapier:       { name: 'Duelist Rapier',type: 'sword', rank: 'D', might: 7,  hit: 95, crit: 10, weight: 5,  range: '1',   dur: 45, value: 1200, effective: ['armor', 'cavalry'] },
  /* ---------------- LANCES ---------------- */
  iron_lance:   { name: 'Iron Pike',     type: 'lance', rank: 'E', might: 7,  hit: 80, crit: 0,  weight: 8,  range: '1',   dur: 45, value: 360 },
  slim_lance:   { name: 'Slim Lance',    type: 'lance', rank: 'E', might: 4,  hit: 85, crit: 5,  weight: 3,  range: '1',   dur: 40, value: 420 },
  steel_lance:  { name: 'Steel Pike',    type: 'lance', rank: 'D', might: 10, hit: 70, crit: 0,  weight: 11, range: '1',   dur: 30, value: 600 },
  killer_lance: { name: 'Killer Pike',   type: 'lance', rank: 'C', might: 9,  hit: 75, crit: 30, weight: 9,  range: '1',   dur: 20, value: 1200 },
  silver_lance: { name: 'Silver Pike',   type: 'lance', rank: 'B', might: 14, hit: 80, crit: 0,  weight: 10, range: '1',   dur: 20, value: 1800 },
  javelin:      { name: 'Javelin',       type: 'lance', rank: 'E', might: 6,  hit: 70, crit: 0,  weight: 9,  range: '1-2', dur: 20, value: 500 },
  horse_slayer: { name: 'Ridersplitter', type: 'lance', rank: 'D', might: 10, hit: 70, crit: 0,  weight: 12, range: '1',   dur: 18, value: 1100, effective: ['cavalry'] },
  wing_spear:   { name: 'Wingpiercer',   type: 'lance', rank: 'D', might: 8,  hit: 80, crit: 0,  weight: 10, range: '1',   dur: 18, value: 1100, effective: ['flyer'] },
  /* ---------------- AXES ---------------- */
  iron_axe:     { name: 'Iron Cleaver',  type: 'axe',   rank: 'E', might: 8,  hit: 75, crit: 0,  weight: 10, range: '1',   dur: 45, value: 270 },
  steel_axe:    { name: 'Steel Cleaver', type: 'axe',   rank: 'D', might: 11, hit: 65, crit: 0,  weight: 13, range: '1',   dur: 30, value: 540 },
  killer_axe:   { name: 'Killer Cleaver',type: 'axe',   rank: 'C', might: 9,  hit: 70, crit: 35, weight: 10, range: '1',   dur: 20, value: 1300 },
  silver_axe:   { name: 'Silver Cleaver',type: 'axe',   rank: 'B', might: 15, hit: 75, crit: 0,  weight: 12, range: '1',   dur: 20, value: 1800 },
  hand_axe:     { name: 'Hatchet',       type: 'axe',   rank: 'E', might: 7,  hit: 65, crit: 0,  weight: 11, range: '1-2', dur: 20, value: 300 },
  halberd:      { name: 'Halberd',       type: 'axe',   rank: 'D', might: 10, hit: 70, crit: 0,  weight: 13, range: '1',   dur: 20, value: 1100, effective: ['armor'] },
  hammer:       { name: 'Hammer',        type: 'axe',   rank: 'D', might: 8,  hit: 70, crit: 0,  weight: 15, range: '1',   dur: 20, value: 800,  effective: ['armor'] },
  /* ---------------- BOWS ---------------- */
  iron_bow:     { name: 'Hunter Bow',    type: 'bow',   rank: 'E', might: 6,  hit: 85, crit: 0,  weight: 5,  range: '2',   dur: 45, value: 540 },
  short_bow:    { name: 'Shortbow',      type: 'bow',   rank: 'E', might: 5,  hit: 90, crit: 5,  weight: 3,  range: '2',   dur: 40, value: 700 },
  steel_bow:    { name: 'War Bow',       type: 'bow',   rank: 'D', might: 9,  hit: 75, crit: 0,  weight: 8,  range: '2',   dur: 30, value: 920 },
  killer_bow:   { name: 'Killer Bow',    type: 'bow',   rank: 'C', might: 9,  hit: 80, crit: 25, weight: 8,  range: '2',   dur: 20, value: 1600 },
  longbow:      { name: 'Longbow',       type: 'bow',   rank: 'E', might: 5,  hit: 75, crit: 0,  weight: 7,  range: '2-3', dur: 25, value: 1100 },
  bright_bow:   { name: 'Gale Bow',      type: 'bow',   rank: 'C', might: 8,  hit: 90, crit: 0,  weight: 6,  range: '2',   dur: 25, value: 1500, effective: ['flyer'] },
  /* ---------------- ANIMA MAGIC ---------------- */
  fire:         { name: 'Emberstone',    type: 'anima', rank: 'E', might: 5,  hit: 90, crit: 0,  weight: 4,  range: '1-2', dur: 45, value: 500 },
  thunder:      { name: 'Stormspindle',  type: 'anima', rank: 'D', might: 8,  hit: 80, crit: 5,  weight: 6,  range: '1-2', dur: 35, value: 800 },
  elfire:       { name: 'Cindral Tome',  type: 'anima', rank: 'C', might: 12, hit: 85, crit: 0,  weight: 7,  range: '1-2', dur: 25, value: 1300 },
  /* ---------------- LIGHT MAGIC ---------------- */
  light:        { name: 'Aureole',       type: 'light', rank: 'E', might: 6,  hit: 95, crit: 0,  weight: 4,  range: '1-2', dur: 40, value: 600 },
  shine:        { name: 'Beacon',        type: 'light', rank: 'D', might: 9,  hit: 90, crit: 0,  weight: 6,  range: '1-2', dur: 30, value: 900 },
  /* ---------------- DARK MAGIC ---------------- */
  flux:         { name: 'Nightmire',     type: 'dark',  rank: 'E', might: 7,  hit: 80, crit: 0,  weight: 6,  range: '1-2', dur: 45, value: 700 },
  luna:         { name: 'Gloomveil',     type: 'dark',  rank: 'D', might: 10, hit: 75, crit: 5,  weight: 9,  range: '1-2', dur: 30, value: 1100 },
  nosferatu:    { name: 'Soulleech',     type: 'dark',  rank: 'C', might: 8,  hit: 75, crit: 0,  weight: 9,  range: '1-2', dur: 20, value: 1500, drain: true },
  /* ---------------- STAFFS ---------------- */
  heal_staff:   { name: 'Mending Rod',   type: 'staff', rank: 'E', might: 0,  hit: 0,  crit: 0,  weight: 3,  range: '1',   dur: 30, value: 600, heal: 10 },
  mend_staff:   { name: 'Restoring Rod', type: 'staff', rank: 'D', might: 0,  hit: 0,  crit: 0,  weight: 4,  range: '1',   dur: 20, value: 1000, heal: 20 },
  recover_staff:{ name: 'Wholerod',      type: 'staff', rank: 'C', might: 0,  hit: 0,  crit: 0,  weight: 5,  range: '1',   dur: 10, value: 1500, heal: 80 },
  physic_staff: { name: 'Farheal Rod',   type: 'staff', rank: 'C', might: 0,  hit: 0,  crit: 0,  weight: 5,  range: '1-2',dur: 15, value: 1800, heal: 10 },
};
