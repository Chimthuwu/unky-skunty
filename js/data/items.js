/* =============================================================
   ITEM DATA — consumables and key items. Add an item = add data.
   ============================================================= */
'use strict';

const ItemDB = {
  potion:      { name: 'Vulnerary',   kind: 'heal',   heal: 10, uses: 3, value: 300, desc: 'Restores 10 HP.' },
  elixir:      { name: 'Elixir',      kind: 'heal',   heal: 99, uses: 2, value: 1500, desc: 'Fully restores HP.' },
  antidote:    { name: 'Antidote',    kind: 'cure',   cures: ['poison'], uses: 1, value: 250, desc: 'Cures poison.' },
  door_key:    { name: 'Door Key',    kind: 'key',    opens: 'door',  uses: 1, value: 500, desc: 'Opens one door.' },
  chest_key:   { name: 'Chest Key',   kind: 'key',    opens: 'chest', uses: 1, value: 500, desc: 'Opens one chest.' },
  lockpick:    { name: 'Lockpick',    kind: 'key',    opens: ['door', 'chest'], uses: 99, value: 1200, desc: 'Thief tool. Opens locks.' },
  master_seal: { name: 'Master Seal', kind: 'promo',  uses: 1, value: 2500, desc: 'Promotes a Lv10+ unit.' },
  torch:       { name: 'Torch',       kind: 'use',    uses: 1, value: 100, desc: 'Lights up fog. (spare)' },
  gem:         { name: 'Sun Gem',     kind: 'treasure', uses: 1, value: 3000, desc: 'A priceless gem. Sell it.' },
};

/* Instance factory: DB entry -> usable inventory object. */
const Items = {
  make(dbId) {
    const db = ItemDB[dbId] || WeaponDB[dbId];
    if (!db) throw new Error('Unknown item: ' + dbId);
    const o = Object.assign({}, db);
    o.dbId = dbId;
    o.uses = db.dur || db.uses || 1;
    o.maxUses = o.uses;
    o.iid = dbId + '_' + Math.random().toString(36).slice(2, 8);
    return o;
  },

  isWeapon(it) { return !!it.type; },
  isStaff(it)  { return it.type === 'staff'; },
  label(it)    { return it.name; },
};
