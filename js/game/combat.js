/* =============================================================
   COMBAT — resolution of a full engagement (attack → counter →
   follow-up). Pure logic + events for the UI. Used by both
   player-initiated battles and AI battles.
   ============================================================= */
'use strict';

const Combat = {
  /* Execute a battle. onEvent({type,...}) is called for each beat so the
     UI can animate: forecast, swing, hit, crit, miss, heal, levelup, death. */
  run(a, d, onEvent) {
    const fc = Units.forecast(a, d);
    const seq = [];

    /* build strike sequence */
    seq.push({ atk: a, def: d });
    if (fc.d.can && fc.d.mt > 0) seq.push({ atk: d, def: a });
    if (fc.a.double && fc.a.can && fc.a.mt > 0) seq.push({ atk: a, def: d });
    else if (fc.d.double && fc.d.can && fc.d.mt > 0) seq.push({ atk: d, def: a });

    for (const step of seq) {
      if (!Units.isAlive(step.atk) || !Units.isAlive(step.def)) break;
      this.strike(step.atk, step.def, onEvent);
    }

    /* durability */
    for (const u of [a, d]) {
      if (u.weapon && u.weapon.type !== 'staff') {
        u.weapon.uses = Math.max(0, u.weapon.uses - 1);
        if (u.weapon.uses === 0) {
          u.items = u.items.filter(i => i !== u.weapon);
          u.weapon = null;
          Units.equipBest(u);
          if (onEvent) onEvent({ type: 'weaponBreak', unit: u });
        }
      }
    }
    if (onEvent) onEvent({ type: 'end' });
  },

  strike(atk, def, onEvent) {
    const fc = Units.forecast(atk, def);
    const w = atk.weapon;
    if (!w) return;
    if (w.drain && fc.a.mt > 0) { /* heal attacker on hit (rolled below) */ }

    const hitRoll = Utils.roll2(fc.a.hit);
    if (onEvent) onEvent({ type: 'swing', atk, def });
    if (!hitRoll) {
      if (onEvent) onEvent({ type: 'miss', atk, def });
      return;
    }
    const isCrit = Utils.roll(fc.a.crit);
    let dmg = fc.a.mt;
    if (isCrit) dmg *= Config.COMBAT.CRIT_MULT;
    dmg = Math.max(0, dmg);
    def.hp = Math.max(0, def.hp - dmg);
    if (w.drain && dmg > 0) {
      atk.hp = Math.min(atk.maxhp, atk.hp + dmg);
      if (onEvent) onEvent({ type: 'drain', atk, def, amount: dmg });
    }
    if (onEvent) onEvent({ type: isCrit ? 'crit' : 'hit', atk, def, dmg, hpLeft: def.hp });
    if (def.hp <= 0) {
      if (onEvent) onEvent({ type: 'death', unit: def, killer: atk });
    }
  },

  /* Staff heal: amount = caster mag + staff heal bonus. */
  heal(caster, target, onEvent) {
    const staff = caster.weapon;
    if (!staff || staff.type !== 'staff') return 0;
    const amount = Math.min(target.maxhp - target.hp, caster.stats.mag + (staff.heal || 10));
    if (amount <= 0) return 0;
    target.hp += amount;
    staff.uses -= 1;
    if (staff.uses <= 0) {
      caster.items = caster.items.filter(i => i !== staff);
      caster.weapon = null;
    }
    const exp = Units.expForHeal(caster, amount);
    if (onEvent) onEvent({ type: 'heal', caster, target, amount });
    return exp;
  },
};
