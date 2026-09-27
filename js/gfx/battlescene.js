/* =============================================================
   BATTLE SCENE — side-view combat animation overlay.
   PlayBattle.play(a, d, events, isHeal, onDone) animates the
   event stream produced by Combat.run/heal, then calls onDone.

   v2 polish: terrain-themed gradient skies with silhouettes,
   stage platforms with shadows, VS slide-in intro, hit starbursts
   with motion trails, floating damage numbers, magic colored by
   trinity type, and a death-fall for the defeated fighter.
   ============================================================= */
'use strict';

/* trinity spell colors (module-level: used by event spawn + draw) */
const MAGIC_COL = {
  anima: ['#70a8f8', '#c8e0ff'],
  light: ['#f8d850', '#fff8c0'],
  dark:  ['#a060c0', '#e8c0f8'],
};

const PlayBattle = {
  active: false,
  a: null, d: null,
  events: [], idx: 0,
  timer: 0, state: 'intro',
  aHp: 0, dHp: 0, aHpShow: 0, dHpShow: 0,
  aOffset: 0, dOffset: 0,
  aFrame: 0, dFrame: 0,
  flash: 0, shake: 0,
  popup: null, popupT: 0,
  isHeal: false,
  onDone: null,
  bg: 'plain',
  bgScroll: 0,
  dmgPopups: [],           /* {v, side, t, crit} */
  bursts: [],              /* {x, y, t, col} */
  trails: [],              /* {side, t} */
  deathSide: null,
  deathFall: 0,
  proj: null,              /* flying arrow / spell orb */
  aWt: null, dWt: null,    /* attacker weapon types */

  play(a, d, events, isHeal, onDone, preA, preD) {
    this.active = true;
    this.a = a; this.d = d;
    this.events = events; this.idx = 0;
    this.timer = 0; this.state = 'intro';
    this.aHp = (preA !== undefined) ? preA : a.hp;
    this.dHp = (preD !== undefined) ? preD : d.hp;
    this.aHpShow = this.aHp; this.dHpShow = this.dHp;
    this.aOffset = 0; this.dOffset = 0;
    this.aFrame = 0; this.dFrame = 0;
    this.flash = 0; this.shake = 0;
    this.popup = null; this.popupT = 0;
    this.isHeal = !!isHeal;
    this.onDone = onDone;
    this.bg = GameMap.tileAt(a.x, a.y);
    this.dLeft = a.x <= d.x;
    this.dmgPopups = []; this.bursts = []; this.trails = [];
    this.deathSide = null; this.deathFall = 0;
    this.proj = null;
    this.aWt = a.weapon ? a.weapon.type : null;
    this.dWt = d.weapon ? d.weapon.type : null;
  },

  _next() {
    if (this.idx >= this.events.length) { this.state = 'outro'; return; }
    const ev = this.events[this.idx++];
    this.timer = 0;
    switch (ev.type) {
      case 'swing': {
        const isA = ev.atk === this.a;
        this.state = isA ? 'aSwing' : 'dSwing';
        this.timer = 0;
        Audio.SFX.attack();
        /* ranged attacks launch a projectile */
        const wt = ev.atk.weapon ? ev.atk.weapon.type : null;
        if (wt === 'bow' || MAGIC_COL[wt]) {
          this.proj = { from: isA ? 'a' : 'd', t: 0, arrow: wt === 'bow', col: MAGIC_COL[wt] ? MAGIC_COL[wt][0] : '#f8f850' };
        }
        break;
      }
      case 'hit': {
        this.applyDamage(ev.atk === this.a ? 'd' : 'a', ev.dmg);
        const isA = ev.atk === this.a;
        this.state = isA ? 'aHit' : 'dHit';
        Audio.SFX.hit();
        this.shake = 6;
        this.spawnHitFx(isA ? 'd' : 'a', ev.dmg, false);
        break;
      }
      case 'crit': {
        this.applyDamage(ev.atk === this.a ? 'd' : 'a', ev.dmg);
        const isA = ev.atk === this.a;
        this.state = isA ? 'aHit' : 'dHit';
        Audio.SFX.crit();
        this.flash = 10; this.shake = 12;
        this.popup = 'CRITICAL!'; this.popupT = 0;
        this.spawnHitFx(isA ? 'd' : 'a', ev.dmg, true);
        break;
      }
      case 'miss': {
        const isA = ev.atk === this.a;
        this.state = isA ? 'aMiss' : 'dMiss';
        Audio.SFX.miss();
        this.popup = 'MISS'; this.popupT = 0;
        break;
      }
      case 'drain': {
        this.popup = 'DRAIN'; this.popupT = 0;
        break;
      }
      case 'heal': {
        this.applyHeal(ev.caster === this.a ? 'd' : 'a', ev.amount);
        this.state = 'healing';
        Audio.SFX.heal();
        break;
      }
      case 'death': {
        /* handled at outro; brief pause while the fallen drops */
        this.state = 'deathPause';
        this.deathSide = this.aHp <= 0 ? 'a' : 'd';
        Audio.SFX.death();
        break;
      }
      case 'weaponBreak': break;
      default: this._next();
    }
  },

  applyDamage(side, dmg) {
    if (side === 'a') this.aHp = Math.max(0, this.aHp - dmg);
    else this.dHp = Math.max(0, this.dHp - dmg);
  },
  applyHeal(side, amt) {
    if (side === 'a') this.aHp = Math.min(this.a.maxhp, this.aHp + amt);
    else this.dHp = Math.min(this.d.maxhp, this.dHp + amt);
  },

  /* spawn starburst + damage number; side = the fighter BEING hit */
  spawnHitFx(side, dmg, crit) {
    const x = side === 'a' ? 76 : Config.SCREEN_W - 76;
    const y = 96;
    this.bursts.push({ x, y, t: 0, crit: !!crit });
    if (this.bursts.length > 6) this.bursts.shift();
    this.dmgPopups.push({ v: dmg, side, t: 0, crit: !!crit });
    if (this.dmgPopups.length > 4) this.dmgPopups.shift();
    /* swing trail on the attacker */
    this.trails.push({ side: side === 'a' ? 'd' : 'a', t: 0 });
  },

  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    this.bgScroll += dt * 0.01;
    /* HP bar catch-up */
    this.aHpShow += (this.aHp - this.aHpShow) * Math.min(1, dt * 0.02);
    this.dHpShow += (this.dHp - this.dHpShow) * Math.min(1, dt * 0.02);
    if (this.flash > 0) this.flash--;
    if (this.shake > 0) this.shake -= dt * 0.02;
    if (this.popupT !== null && this.popupT < 40) this.popupT += dt * 0.05;

    /* fx timers */
    for (const b of this.bursts) b.t += dt / 16;
    this.bursts = this.bursts.filter(b => b.t < 22);
    for (const p of this.dmgPopups) p.t += dt / 16;
    this.dmgPopups = this.dmgPopups.filter(p => p.t < 55);
    for (const tr of this.trails) tr.t += dt / 16;
    this.trails = this.trails.filter(tr => tr.t < 10);
    if (this.deathSide) this.deathFall = Math.min(1, this.deathFall + dt / 700);
    if (this.proj) { this.proj.t += dt / 300; if (this.proj.t > 1.2) this.proj = null; }

    const T = this.timer;
    switch (this.state) {
      case 'intro':
        if (T > 420) this._next();
        break;
      case 'aSwing': case 'aHit': case 'aMiss': {
        /* per-weapon tempo: heavy axe, quick lance thrust, small step for ranged */
        const wt = this.aWt;
        const dur = wt === 'axe' ? 380 : wt === 'lance' ? 270 : 300;
        const reach = wt === 'axe' ? 20 : wt === 'lance' ? 26 : (wt === 'bow' || MAGIC_COL[wt]) ? 4 : 14;
        const p = Math.min(1, T / dur);
        this.aOffset = Math.sin(p * Math.PI) * reach;
        this.aFrame = Math.floor(T / 80) % 2;
        if (T > dur) { this.aOffset = 0; this._next(); }
        break;
      }
      case 'dSwing': case 'dHit': case 'dMiss': {
        const wt = this.dWt;
        const dur = wt === 'axe' ? 380 : wt === 'lance' ? 270 : 300;
        const reach = wt === 'axe' ? 20 : wt === 'lance' ? 26 : (wt === 'bow' || MAGIC_COL[wt]) ? 4 : 14;
        const p = Math.min(1, T / dur);
        this.dOffset = -Math.sin(p * Math.PI) * reach;
        this.dFrame = Math.floor(T / 80) % 2;
        if (T > dur) { this.dOffset = 0; this._next(); }
        break;
      }
      case 'healing':
        if (T > 700) this._next();
        break;
      case 'deathPause':
        if (T > 550) {
          this.state = 'outro';
        }
        break;
      case 'outro':
        if (T > 450) {
          this.active = false;
          const cb = this.onDone; this.onDone = null;
          if (cb) cb();
        }
        break;
    }
    if (Input.pressed('confirm') || Input.pressed('cancel')) {
      /* fast-forward current beat */
      if (this.state !== 'outro') { this.timer += 500; }
      else { this.timer += 1000; }
    }
  },

  /* ---------- stage backgrounds ---------- */

  BG_DECO: {
    plain:    { sky: ['#7cb4e8', '#a8d0f0'], ground: ['#78a048', '#6e9840', '#5e8438'], deco: 'trees' },
    road:     { sky: ['#7cb4e8', '#a8d0f0'], ground: ['#c8b088', '#bca57e', '#a8966c'], deco: 'trees' },
    forest:   { sky: ['#68a0d8', '#8cc0e8'], ground: ['#3a6838', '#346032', '#2c522a'], deco: 'deepTrees' },
    mountain: { sky: ['#88b0d8', '#b8cce8'], ground: ['#887858', '#7c6e52', '#6e6046'], deco: 'mountains' },
    peak:     { sky: ['#88b0d8', '#b8cce8'], ground: ['#989078', '#8a8268', '#7a725c'], deco: 'mountains' },
    water:    { sky: ['#78b0e0', '#a4cef2'], ground: ['#3868a8', '#32619e', '#2c5692'], deco: 'water' },
    river:    { sky: ['#78b0e0', '#a4cef2'], ground: ['#4878b8', '#4070ae', '#3864a0'], deco: 'water' },
    bridge:   { sky: ['#78b0e0', '#a4cef2'], ground: ['#a8804c', '#9c7644', '#8c6a3e'], deco: 'water' },
    wall:     { sky: ['#4a5568', '#5a6478'], ground: ['#808088', '#767680', '#6c6c76'], deco: 'walls' },
    door:     { sky: ['#4a5568', '#5a6478'], ground: ['#808088', '#767680', '#6c6c76'], deco: 'walls' },
    gate:     { sky: ['#6888b0', '#88a8cc'], ground: ['#a89878', '#9c8c6c', '#8e8060'], deco: 'walls' },
    pillar:   { sky: ['#586070', '#687080'], ground: ['#907e6e', '#84745e', '#786a54'], deco: 'walls' },
    floor:    { sky: ['#586074', '#687084'], ground: ['#a89878', '#9c8c6c', '#908060'], deco: 'hall' },
    carpet:   { sky: ['#403050', '#504064'], ground: ['#a03838', '#933232', '#862c2c'], deco: 'hall' },
    throne:   { sky: ['#403050', '#504064'], ground: ['#a03838', '#933232', '#862c2c'], deco: 'hall' },
    fort:     { sky: ['#88a8c8', '#a8c4dc'], ground: ['#909090', '#848484', '#787878'], deco: 'walls' },
    house:    { sky: ['#7cb4e8', '#a8d0f0'], ground: ['#c8b088', '#bca57e', '#a8966c'], deco: 'trees' },
    village:  { sky: ['#7cb4e8', '#a8d0f0'], ground: ['#78a048', '#6e9840', '#5e8438'], deco: 'trees' },
    chest:    { sky: ['#586074', '#687084'], ground: ['#887050', '#7c6644', '#705a3c'], deco: 'hall' },
    rubble:   { sky: ['#88a0b8', '#a4bccc'], ground: ['#887868', '#7c6e5c', '#706252'], deco: 'ruins' },
  },

  drawBg(g, SW, SH) {
    const B = this.BG_DECO[this.bg] || this.BG_DECO.plain;
    /* sky gradient */
    const sky = g.createLinearGradient(0, 0, 0, 40);
    sky.addColorStop(0, B.sky[0]);
    sky.addColorStop(1, B.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, SW, 36);
    /* drifting clouds */
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = -20; x < SW + 20; x += 70) {
      const cx = x + (Math.floor(this.bgScroll * 0.5) % 70);
      g.fillRect(cx, 8, 14, 2);
      g.fillRect(cx + 3, 6, 8, 2);
    }
    /* horizon glow */
    g.fillStyle = 'rgba(255,255,240,0.30)';
    g.fillRect(0, 34, SW, 2);

    /* silhouettes behind the stage */
    const sil = 'rgba(24,34,56,0.55)';
    if (B.deco === 'trees' || B.deco === 'deepTrees') {
      for (let x = 2; x < SW; x += 22) {
        const h = B.deco === 'deepTrees' ? 26 : 18;
        g.fillStyle = sil;
        g.fillRect(x, 36 - h + 6, 3, h);                    /* trunk */
        g.fillRect(x - 4, 36 - h, 11, h - 8);               /* canopy */
        g.fillRect(x - 2, 36 - h - 3, 7, 4);
      }
    } else if (B.deco === 'mountains') {
      /* clean triangle peaks */
      for (let px = -8; px < SW + 8; px += 34) {
        g.fillStyle = sil;
        for (let row = 0; row < 18; row++) {
          const w = 2 + Math.round(row * 0.9);
          g.fillRect(px + 12 - w, 40 - 1 - row, w * 2, 1);
        }
      }
      /* snow caps */
      g.fillStyle = 'rgba(240,244,248,0.7)';
      for (let px = -8; px < SW + 8; px += 34) {
        g.fillRect(px + 11, 23, 3, 2);
        g.fillRect(px + 10, 25, 5, 1);
      }
    } else if (B.deco === 'walls') {
      g.fillStyle = sil;
      for (let x = 0; x < SW; x += 26) {
        g.fillRect(x, 14, 18, 24);                          /* tower */
        g.fillRect(x + 2, 10, 14, 4);                       /* battlement */
      }
      g.fillStyle = 'rgba(24,34,56,0.35)';
      for (let x = 9; x < SW; x += 26) g.fillRect(x, 20, 3, 4);  /* arrow slits */
    } else if (B.deco === 'hall') {
      /* interior: columns + warm window light */
      g.fillStyle = 'rgba(30,24,44,0.5)';
      for (let x = 6; x < SW; x += 48) g.fillRect(x, 6, 8, 32);
      g.fillStyle = 'rgba(232,200,120,0.28)';
      for (let x = 22; x < SW; x += 48) g.fillRect(x, 10, 6, 12);
      g.fillStyle = 'rgba(255,244,200,0.16)';
      for (let x = 21; x < SW; x += 48) { g.fillRect(x - 1, 22, 8, 2); g.fillRect(x, 24, 6, 2); g.fillRect(x + 1, 26, 4, 2); }
    } else if (B.deco === 'ruins') {
      g.fillStyle = sil;
      for (let x = 4; x < SW; x += 30) {
        const h = 10 + (x % 17);
        g.fillRect(x, 36 - h, 9, h);
      }
    } else if (B.deco === 'water') {
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let x = -10; x < SW + 10; x += 30) {
        g.fillRect(x + (Math.floor(this.bgScroll * 1.2) % 30), 30, 12, 1);
        g.fillRect(x + 6 + (Math.floor(this.bgScroll * 0.8) % 30), 33, 8, 1);
      }
    }

    /* ground gradient */
    const gd = g.createLinearGradient(0, 36, 0, SH);
    gd.addColorStop(0, B.ground[0]);
    gd.addColorStop(0.55, B.ground[1]);
    gd.addColorStop(1, B.ground[2]);
    g.fillStyle = gd;
    g.fillRect(0, 36, SW, SH - 36);

    /* ground texture dashes (perspective spacing) */
    g.fillStyle = B.ground[2];
    for (let x = -16; x < SW + 16; x += 24) {
      g.fillRect(x + (Math.floor(this.bgScroll) % 24), 48, 10, 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = -16; x < SW + 16; x += 18) {
      g.fillRect(x + (Math.floor(this.bgScroll * 1.7) % 18), SH - 18, 8, 2);
    }

    /* stage platforms */
    const baseY = SH - 44;
    const plat = g.createLinearGradient(0, baseY + 22, 0, baseY + 28);
    plat.addColorStop(0, B.ground[1]);
    plat.addColorStop(1, B.ground[2]);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(38, baseY + 26, 44, 3);
    g.fillRect(SW - 82, baseY + 26, 44, 3);
    g.fillStyle = plat;
    g.fillRect(36, baseY + 22, 48, 4);
    g.fillRect(SW - 84, baseY + 22, 48, 4);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(36, baseY + 22, 48, 1);
    g.fillRect(SW - 84, baseY + 22, 48, 1);
  },

  /* ---------- fighter fx layers ---------- */

  drawTrail(g, side, baseY) {
    for (const tr of this.trails) {
      if (tr.side !== side || tr.t >= 10) continue;
      const a = 1 - tr.t / 10;
      const dir = side === 'a' ? 1 : -1;
      const x0 = side === 'a' ? 60 : Config.SCREEN_W - 60 - 32;
      g.globalAlpha = a * 0.5;
      g.fillStyle = '#ffffff';
      for (let i = 1; i <= 3; i++) {
        g.fillRect(x0 + dir * i * 7, baseY - 40 + i, 3, 22 - i * 3);
      }
      g.globalAlpha = 1;
    }
  },

  drawBurst(g) {
    for (const b of this.bursts) {
      const p = b.t / 22;
      const col = b.crit ? '#ffe890' : '#ffffff';
      const r = Math.round(3 + p * (b.crit ? 14 : 9));
      g.globalAlpha = Utils.clamp(1 - p, 0, 1);
      /* 8-point star */
      g.fillStyle = col;
      g.fillRect(b.x - r, b.y - 1, r * 2, 2);
      g.fillRect(b.x - 1, b.y - r, 2, r * 2);
      const d = Math.round(r * 0.7);
      for (let i = 1; i <= d; i++) {
        g.fillRect(b.x + i, b.y - i, 1, 1);
        g.fillRect(b.x - i, b.y - i, 1, 1);
        g.fillRect(b.x + i, b.y + i, 1, 1);
        g.fillRect(b.x - i, b.y + i, 1, 1);
      }
      /* core */
      g.fillStyle = b.crit ? '#ffffff' : '#ffe890';
      g.fillRect(b.x - 2, b.y - 2, 4, 4);
      if (b.crit) {
        g.fillStyle = '#ffffff';
        g.fillRect(b.x - 4, b.y - 1, 8, 2);
        g.fillRect(b.x - 1, b.y - 4, 2, 8);
      }
      g.globalAlpha = 1;
    }
  },

  drawDmgPopups(g) {
    for (const p of this.dmgPopups) {
      const x = p.side === 'a' ? 76 : Config.SCREEN_W - 76;
      const rise = Math.min(14, p.t * 0.6);
      const a = p.t < 40 ? 1 : Utils.clamp(1 - (p.t - 40) / 15, 0, 1);
      const s = p.crit ? 2 : 1;
      const txt = String(p.v);
      const w = Font.width(txt, s);
      g.globalAlpha = a;
      Font.draw(g, txt, Math.round(x - w / 2) + 1, Math.round(66 - rise) + 1, '#101020', s);
      Font.draw(g, txt, Math.round(x - w / 2), Math.round(66 - rise), p.crit ? '#ffe890' : '#ffffff', s);
      g.globalAlpha = 1;
    }
  },

  draw(g) {
    if (!this.active) return;
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    g.save();
    if (this.shake > 0) {
      g.translate(Math.round(Utils.ri(-2, 2)), Math.round(Utils.ri(-2, 2)));
    }

    this.drawBg(g, SW, SH);

    const art = CharArt.unit;
    const A = this.a, D = this.d;
    const scale = 2;
    const baseY = SH - 44;
    const py0 = baseY - 16 * scale + 26;

    /* fighter shadows */
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(56, baseY + 20, 40, 3);
    g.fillRect(SW - 96, baseY + 20, 40, 3);

    /* intro slide-in offsets */
    let introA = 0, introD = 0, introA_a = 1, introD_a = 1;
    if (this.state === 'intro') {
      const T = this.timer;
      const p = Utils.clamp(T / 260, 0, 1);
      const ease = 1 - (1 - p) * (1 - p);
      introA = Math.round(-46 * (1 - ease));
      introD = Math.round(46 * (1 - ease));
      introA_a = 0.35 + 0.65 * p;
      introD_a = 0.35 + 0.65 * p;
      /* VS flash at contact */
      if (T > 240 && T < 340) {
        const a = 1 - (T - 240) / 100;
        g.globalAlpha = a * 0.8;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, SW, SH);
        g.globalAlpha = Math.min(1, a + 0.4);
        Font.draw(g, 'VS', SW / 2 - 11, 54, '#101020', 2);
        Font.draw(g, 'VS', SW / 2 - 12, 53, '#ffe890', 2);
        g.globalAlpha = 1;
      }
    }

    const drawFighter = (u, kind, frame, left, off, hurt, fadeIn, isDead) => {
      const img = art(kind, frame, !left);
      /* intro slam: brief scale pop at the VS moment */
      const pop = (this.state === 'intro') ? 1 + 0.22 * Math.max(0, 1 - Math.abs(this.timer - 250) / 90) : 1;
      const sc = scale * pop;
      const px = (left ? 60 + off + introA - Math.round((sc - scale) * 8)
                       : SW - 60 - 16 * scale + off + introD + Math.round((sc - scale) * 8));
      let py = py0 - Math.round((sc - scale) * 16);   /* feet stay planted */
      let alpha = fadeIn;
      if (isDead) {
        py += Math.round(this.deathFall * 10);
        alpha *= (1 - this.deathFall * 0.75);
      }
      if (hurt) {
        alpha *= (Math.floor(this.timer / 40) % 2) ? 0.35 : 1;
      }
      g.globalAlpha = Utils.clamp(alpha, 0, 1);
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, 16, 16, px, py, Math.round(16 * sc), Math.round(16 * sc));
      g.globalAlpha = 1;
      return px;
    };

    /* victim flash: state aHit = A's strike landed on D, dHit = D's on A */
    const aHurt = (this.state === 'dHit') && this.timer < 250;
    const dHurt = (this.state === 'aHit') && this.timer < 250;
    const aKind = A.battle || A.sprite || 'lord';
    const dKind = D.battle || D.sprite || 'esoldier';
    const aDead = this.deathSide === 'a';
    const dDead = this.deathSide === 'd';

    /* swing trails behind fighters */
    if (this.state === 'aSwing' || this.state === 'aHit') this.drawTrail(g, 'a', baseY);
    if (this.state === 'dSwing' || this.state === 'dHit') this.drawTrail(g, 'd', baseY);

    /* knockback: victim shoved 3px away while hurt-flickering */
    drawFighter(A, aKind, this.aFrame, true, this.aOffset - (aHurt ? 3 : 0), aHurt, introA_a, aDead);
    drawFighter(D, dKind, this.dFrame, false, this.dOffset + (dHurt ? 3 : 0), dHurt, introD_a, dDead);

    /* ---- per-weapon swipe fx (sword arc / axe sweep / lance thrust) ---- */
    const fxSide = (this.state === 'aSwing' || this.state === 'aHit') ? 'a'
      : (this.state === 'dSwing' || this.state === 'dHit') ? 'd' : null;
    if (fxSide) {
      const atk = fxSide === 'a' ? A : D;
      const wt = atk.weapon ? atk.weapon.type : null;
      if (wt === 'sword' || wt === 'axe' || wt === 'lance') {
        const dur = wt === 'axe' ? 380 : wt === 'lance' ? 270 : 300;
        const q = Utils.clamp(this.timer / dur, 0, 1);
        const ax = fxSide === 'a' ? 60 + this.aOffset + 16 : SW - 76 + this.dOffset;
        const ay = py0 + 10;
        const vx = fxSide === 'a' ? SW - 54 : 50;
        const swipeA = Utils.clamp(1 - Math.abs(q - 0.55) * 2.2, 0, 1);
        if (swipeA > 0) {
          const rad = wt === 'axe' ? 26 : wt === 'lance' ? 30 : 22;
          const from = wt === 'lance' ? -0.5 : -1.2;
          const to = wt === 'lance' ? 0.5 : 0.7;
          const sweeps = wt === 'axe' ? 3 : 1;
          for (let s = 0; s < sweeps; s++) {
            const qq = Utils.clamp(q - s * 0.09, 0, 1);
            g.globalAlpha = swipeA * (1 - s * 0.3);
            g.fillStyle = s === 0 ? '#fff8d0' : '#f8d850';
            const ang = from + (to - from) * qq;
            const steps = wt === 'lance' ? 9 : 5;
            for (let i = 0; i < steps; i++) {
              const aa = ang - i * 0.06;
              g.fillRect(Math.round(ax + Math.cos(aa) * rad), Math.round(ay + Math.sin(aa) * rad), 2, 2);
            }
          }
          /* lance thrust: bright line to the victim at full extension */
          if (wt === 'lance' && q > 0.45 && q < 0.85) {
            g.fillStyle = '#eef4f8';
            const dir = fxSide === 'a' ? 1 : -1;
            const len = Math.max(0, Math.min(Math.abs(vx - ax), 34));
            for (let i = 0; i < len; i += 2) g.fillRect(ax + dir * i, ay - 1, 2, 2);
          }
          g.globalAlpha = 1;
        }
      }
    }

    /* ---- projectile (arrow / spell orb) ---- */
    if (this.proj) {
      const P = this.proj;
      const x0 = P.from === 'a' ? 76 : SW - 76;
      const x1 = P.from === 'a' ? SW - 76 : 76;
      const y0 = py0 + 6, y1 = py0 + 8;
      const tt = Utils.clamp(P.t, 0, 1);
      const px = x0 + (x1 - x0) * tt;
      const py = y0 + (y1 - y0) * tt - Math.round(Math.sin(tt * Math.PI) * (P.arrow ? 10 : 3));
      if (P.arrow) {
        g.fillStyle = '#d8d8c0';
        g.fillRect(px - 3, py, 7, 1);
        g.fillStyle = '#ffffff';
        g.fillRect(px + 3, py, 2, 1);
      } else {
        const bob = Math.round(Math.sin(tt * 12) * 1);
        g.fillStyle = P.col;
        g.fillRect(px - 1, py - 1 + bob, 4, 4);
        g.fillStyle = '#ffffff';
        g.fillRect(px, py + bob, 2, 2);
      }
      /* impact ring as it lands */
      if (P.t > 1 && P.t < 1.25) {
        const ia = (1.25 - P.t) / 0.25;
        const r = Math.round(2 + (P.t - 1) * 26);
        g.globalAlpha = Utils.clamp(ia, 0, 1) * 0.8;
        g.fillStyle = '#fff8c0';
        g.fillRect(x1 - r, y1 - 1, r * 2, 1);
        g.fillRect(x1 - r, y1 + 1, r * 2, 1);
        g.fillRect(x1 - 1, y1 - r, 1, r * 2);
        g.fillRect(x1 + 1, y1 - r, 1, r * 2);
        g.globalAlpha = 1;
      }
    }

    /* ---- magic / heal fx ---- */
    const healFx = this.state === 'healing';
    const aCasting = this.state === 'aHit' && A.weapon && MAGIC_COL[A.weapon.type];
    const dCasting = this.state === 'dHit' && D.weapon && MAGIC_COL[D.weapon.type];
    if (healFx || aCasting || dCasting) {
      const t = this.timer;
      /* spell strikes the VICTIM: aHit -> D (right), dHit -> A (left) */
      let px, col, col2;
      if (healFx) {
        px = SW - 70; col = '#7af0a0'; col2 = '#c8ffc8';
      } else if (aCasting) {
        px = SW - 70; col = MAGIC_COL[A.weapon.type][0]; col2 = MAGIC_COL[A.weapon.type][1];
      } else {
        px = 70; col = MAGIC_COL[D.weapon.type][0]; col2 = MAGIC_COL[D.weapon.type][1];
      }
      for (let i = 0; i < 7; i++) {
        const sx = px + Math.sin(t / 90 + i) * 8;
        const sy = baseY - 20 - ((t / 2 + i * 18) % 60);
        g.fillStyle = col;
        g.fillRect(sx, sy, 2, 2);
        g.fillStyle = col2;
        g.fillRect(sx - 1, sy + 4, 1, 1);
        g.fillRect(sx + 2, sy + 2, 1, 1);
      }
      /* magic impact ring */
      if (aCasting || dCasting) {
        const p = Utils.clamp(t / 300, 0, 1);
        g.globalAlpha = 1 - p;
        g.fillStyle = col2;
        const r = Math.round(2 + p * 10);
        g.fillRect(px - r, baseY - 34, r * 2, 1);
        g.fillRect(px - r, baseY - 26, r * 2, 1);
        g.fillRect(px - r, baseY - 33, 1, 7);
        g.fillRect(px + r, baseY - 33, 1, 7);
        g.globalAlpha = 1;
      }
    }

    this.drawBurst(g);
    this.drawDmgPopups(g);

    /* ---- crit flash: 3-frame white pop, then a warm afterglow ---- */
    if (this.flash > 0) {
      const f = this.flash;                      /* 10 -> 0 */
      if (f > 7) {
        g.fillStyle = 'rgba(255,255,255,' + ((f - 7) / 4.5).toFixed(3) + ')';
        g.fillRect(0, 0, SW, SH);
      } else {
        g.fillStyle = 'rgba(255,220,140,' + ((f / 7) * 0.34).toFixed(3) + ')';
        g.fillRect(0, 0, SW, SH);
      }
    }

    /* ---- HP plates ---- */
    const plate = (x, u, hpShow, hp, name, wep) => {
      UI.window(g, x, 6, 108, 26);
      Font.draw(g, name.slice(0, 10), x + 4, 9, u.team === 'player' ? '#9ab8f8' : '#f8a0a0');
      Font.draw(g, wep ? wep.name.slice(0, 8) : '--', x + 4, 17, '#c8d8f8');
      UI.hpBar(g, x + 62, 10, 42, 5, hpShow, u.maxhp);
      Font.draw(g, Math.round(hp) + '/' + u.maxhp, x + 62, 20, '#e8e8d0');
    };
    plate(6, A, this.aHpShow, this.aHp, A.name, A.weapon);
    plate(SW - 114, D, this.dHpShow, this.dHp, D.name, D.weapon);

    /* popup text */
    if (this.popup && this.popupT < 40) {
      g.globalAlpha = Utils.clamp(1 - this.popupT / 40, 0, 1);
      const pw = Font.width(this.popup, 2);
      Font.draw(g, this.popup, Math.round(SW / 2 - pw / 2) + 1, 43, '#101020', 2);
      Font.draw(g, this.popup, Math.round(SW / 2 - pw / 2), 42, '#f8f850', 2);
      g.globalAlpha = 1;
    }

    g.restore();
  },
};
