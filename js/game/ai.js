/* =============================================================
   ENEMY AI — evaluates reachable tiles × attackable targets and
   picks the tactically best action. Never cheats: everything is
   limited by the same movement/range/terrain rules the player has.
   ============================================================= */
'use strict';

const AI = {

  /* Take one action for a unit. Calls Game hooks for animation/progression. */
  act(u) {
    const profile = u.ai || 'aggro';
    if (profile === 'healer') return this.actHealer(u);
    return this.actFighter(u);
  },

  /* ---------------- fighters ---------------- */
  actFighter(u) {
    const profile = u.ai || 'aggro';
    const reach = GameMap.reachable(u.x, u.y, u.move, u.moveType, u.team);
    const options = [];

    /* zone-aggro bosses hold their post until provoked: an opponent inside
       their zone, or having taken damage, unlocks full aggression. */
    const zone = (u.aggroWhen === 'zone') ? u.bossZone : null;
    const provoked = u.hp < u.maxhp || u.bossAggroed;
    const inZone = (x, y) => !zone || provoked ||
      (x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2);

    for (const key of reach.cost.keys()) {
      const x = key % GameMap.w, y = (key / GameMap.w) | 0;
      const occ = GameMap.unitAt(x, y);
      if (occ && occ !== u) continue;

      for (const t of Game.units) {
        if (!Units.isAlive(t) || t.team === u.team) continue;
        if (t.carriedBy) continue;
        if (!inZone(t.x, t.y)) continue;
        const d = Math.abs(t.x - x) + Math.abs(t.y - y);
        if (!Units.attackRange(u).includes(d)) continue;

        /* pseudo-forecast: what happens if u attacks t from (x,y) */
        const savedXY = { x: u.x, y: u.y };
        u.x = x; u.y = y;
        const fc = Units.forecast(u, t);
        u.x = savedXY.x; u.y = savedXY.y;

        let score = 0;
        const hits = fc.a.hit / 100;
        const killNow = fc.a.can && fc.a.mt >= t.hp;
        if (killNow && hits > 0.35) score += Config.AI.LETHAL_WEIGHT * 100;
        score += fc.a.can ? fc.a.mt * hits * Config.AI.DAMAGE_WEIGHT * 10 : 0;
        score += hits * Config.AI.HIT_WEIGHT * 10;
        /* counterattack risk */
        if (fc.d.can && Units.attackRange(t).includes(d)) {
          score -= fc.d.mt * (fc.d.hit / 100) * Config.AI.COUNTER_RISK * 10;
        }
        /* terrain value of the destination tile */
        const terr = GameMap.terrainAt(x, y);
        score += ((terr.def || 0) + (terr.avoid || 0) / 10) * Config.AI.TERRAIN_BONUS * 10;
        /* prefer closeness */
        score -= Math.abs(x - u.x) + Math.abs(y - u.y);
        /* guard/boss profiles only engage near their post */
        if ((profile === 'guard' || profile === 'boss') && u.guardPos) {
          const homeD = Math.abs(x - u.guardPos.x) + Math.abs(y - u.guardPos.y);
          if (homeD > Config.AI.GUARD_RADIUS + u.move) score -= 1000;
        }
        options.push({ x, y, target: t, score });
      }
    }

    if (options.length) {
      options.sort((p, q) => q.score - p.score);
      const best = options[0];
      if (best.score > -900) {
        return Game.aiAttack(u, best.target, best.x, best.y);
      }
    }

    /* no attack available: advance toward nearest opponent */
    return this.advance(u, profile, reach);
  },

  advance(u, profile, reach) {
    if (profile === 'guard' || profile === 'boss') {
      /* provoked bosses chase; otherwise hold/return to post */
      const provoked = u.hp < u.maxhp || u.bossAggroed;
      if (profile === 'boss' && (provoked || !(u.aggroWhen === 'zone'))) {
        return this.advanceAggro(u, reach);
      }
      if (u.guardPos && (u.x !== u.guardPos.x || u.y !== u.guardPos.y)) {
        const path = GameMap.pathTo(reach, u.x, u.y, u.guardPos.x, u.guardPos.y);
        if (path) return Game.aiMove(u, path);
      }
      return Game.aiWait(u);
    }
    if (profile === 'patrol') {
      return this.patrol(u, reach);
    }
    return this.advanceAggro(u, reach);
  },

  advanceAggro(u, reach) {
    /* move toward nearest player-team unit */
    let best = null, bestD = Infinity;
    for (const t of Game.units) {
      if (!Units.isAlive(t) || t.team === u.team) continue;
      if (t.carriedBy) continue;
      const d = Utils.dist(u.x, u.y, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return Game.aiWait(u);
    const step = this.stepToward(u, best.x, best.y, reach);
    if (step) return Game.aiMove(u, step);
    return Game.aiWait(u);
  },

  patrol(u, reach) {
    /* walk the road: prefer road/bridge tiles, head east across the bridge */
    let best = null, bestScore = -Infinity;
    for (const key of reach.cost.keys()) {
      const x = key % GameMap.w, y = (key / GameMap.w) | 0;
      const occ = GameMap.unitAt(x, y);
      if (occ && occ !== u) continue;
      const t = GameMap.tileAt(x, y);
      let s = (t === 'road' || t === 'bridge') ? 10 : 0;
      s += x * 0.5;                       /* drift east */
      s -= Math.abs(y - 12) * 0.4;        /* hug the bridge line */
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
    if (best && (best.x !== u.x || best.y !== u.y)) {
      const path = GameMap.pathTo(reach, u.x, u.y, best.x, best.y);
      if (path) return Game.aiMove(u, path);
    }
    return Game.aiWait(u);
  },

  stepToward(u, tx, ty, reach) {
    /* pick reachable tile minimizing distance to target */
    let best = null, bestD = Infinity;
    for (const key of reach.cost.keys()) {
      const x = key % GameMap.w, y = (key / GameMap.w) | 0;
      const occ = GameMap.unitAt(x, y);
      if (occ && occ !== u) continue;
      const d = Utils.dist(x, y, tx, ty);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    if (!best || (best.x === u.x && best.y === u.y)) return null;
    return GameMap.pathTo(reach, u.x, u.y, best.x, best.y);
  },

  /* ---------------- healers ---------------- */
  actHealer(u) {
    /* heal most-wounded ally in reach */
    const allies = GameMap.healableAllies(u);
    if (allies.length) {
      allies.sort((a, b) => (b.maxhp - b.hp) - (a.maxhp - a.hp));
      const t = allies[0];
      if (t.x !== u.x || t.y !== u.y || true) {
        /* heal from current position if in range; else step closer */
        const d = Utils.dist(u.x, u.y, t.x, t.y);
        if (Units.staffRange(u).includes(d)) return Game.aiHeal(u, t);
      }
    }
    /* step toward the most wounded ally */
    const wounded = Game.units.filter(t => Units.isAlive(t) && t.team === u.team && t.hp < t.maxhp && !t.carriedBy);
    if (wounded.length) {
      wounded.sort((a, b) => (b.maxhp - b.hp) - (a.maxhp - a.hp));
      const reach = GameMap.reachable(u.x, u.y, u.move, u.moveType, u.team);
      const step = this.stepToward(u, wounded[0].x, wounded[0].y, reach);
      if (step) return Game.aiMove(u, step);
    }
    return Game.aiWait(u);
  },
};
