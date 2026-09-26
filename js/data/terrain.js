/* =============================================================
   TERRAIN DATA — add a new terrain by adding one entry.
   move: movement cost (99 = impassable), avoid/def: combat bonuses,
   heal: % HP restored at turn start while standing on it.
   ============================================================= */
'use strict';

const TerrainDB = {
  plain:   { name: 'Plain',    move: 1,  avoid: 0,  def: 0,  heal: 0 },
  road:    { name: 'Road',     move: 1,  avoid: 0,  def: 0,  heal: 0 },
  forest:  { name: 'Forest',   move: 2,  avoid: 20, def: 1,  heal: 0 },
  thicket: { name: 'Thicket',  move: 3,  avoid: 30, def: 1,  heal: 0 },
  mountain:{ name: 'Mountain', move: 3,  avoid: 30, def: 2,  heal: 0 },
  peak:    { name: 'Peak',     move: 4,  avoid: 40, def: 3,  heal: 0 },
  fort:    { name: 'Fort',     move: 1,  avoid: 20, def: 2,  heal: 10 },
  gate:    { name: 'Gate',     move: 1,  avoid: 20, def: 2,  heal: 10 },
  throne:  { name: 'Throne',   move: 1,  avoid: 30, def: 3,  heal: 10 },
  pillar:  { name: 'Pillar',   move: 99, avoid: 0,  def: 0,  heal: 0 },
  wall:    { name: 'Wall',     move: 99, avoid: 0,  def: 0,  heal: 0 },
  house:   { name: 'House',    move: 99, avoid: 0,  def: 0,  heal: 0 },
  village: { name: 'Village',  move: 1,  avoid: 10, def: 1,  heal: 0, visit: true },
  ruined:  { name: 'Ruins',    move: 1,  avoid: 0,  def: 0,  heal: 0 },
  bridge:  { name: 'Bridge',   move: 1,  avoid: 0,  def: 0,  heal: 0 },
  river:   { name: 'River',    move: 2,  avoid: 0,  def: 0,  heal: 0 },
  water:   { name: 'Water',    move: 99, avoid: 0,  def: 0,  heal: 0 },
  floor:   { name: 'Floor',    move: 1,  avoid: 0,  def: 0,  heal: 0 },
  carpet:  { name: 'Carpet',   move: 1,  avoid: 0,  def: 0,  heal: 0 },
  door:    { name: 'Door',     move: 99, avoid: 0,  def: 0,  heal: 0, door: true },
  chest:   { name: 'Chest',    move: 1,  avoid: 0,  def: 0,  heal: 0, chest: true },
  chestOpen:{ name: 'Chest',   move: 1,  avoid: 0,  def: 0,  heal: 0 },
  rubble:  { name: 'Rubble',   move: 2,  avoid: 10, def: 1,  heal: 0 },
  sky:     { name: 'Sky',      move: 1,  avoid: 0,  def: 0,  heal: 0 },
};
