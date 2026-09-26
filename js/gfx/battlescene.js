/* =============================================================
   BATTLE SCENE — side-view combat animation overlay.
   PlayBattle.play(a, d, events, isHeal, onDone) animates the
   event stream produced by Combat.run/heal, then calls onDone.
   ============================================================= */
'use strict';

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
        break;
      }
      case 'hit': {
        this.applyDamage(ev.atk === this.a ? 'd' : 'a', ev.dmg);
        const isA = ev.atk === this.a;
        this.state = isA ? 'aHit' : 'dHit';
        Audio.SFX.hit();
        this.shake = 6;
        break;
      }
      case 'crit': {
        this.applyDamage(ev.atk === this.a ? 'd' : 'a', ev.dmg);
        const isA = ev.atk === this.a;
        this.state = isA ? 'aHit' : 'dHit';
        Audio.SFX.crit();
        this.flash = 10; this.shake = 12;
        this.popup = 'CRITICAL!'; this.popupT = 0;
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
        /* handled at outro; brief pause */
        this.state = 'deathPause';
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

    const T = this.timer;
    switch (this.state) {
      case 'intro':
        if (T > 350) this._next();
        break;
      case 'aSwing': case 'aHit': case 'aMiss': {
        const dur = 300;
        const p = Math.min(1, T / dur);
        /* lunge toward center */
        this.aOffset = Math.sin(p * Math.PI) * 14;
        this.aFrame = Math.floor(T / 80) % 2;
        if (T > dur) { this.aOffset = 0; this._next(); }
        break;
      }
      case 'dSwing': case 'dHit': case 'dMiss': {
        const dur = 300;
        const p = Math.min(1, T / dur);
        this.dOffset = -Math.sin(p * Math.PI) * 14;
        this.dFrame = Math.floor(T / 80) % 2;
        if (T > dur) { this.dOffset = 0; this._next(); }
        break;
      }
      case 'healing':
        if (T > 700) this._next();
        break;
      case 'deathPause':
        if (T > 500) {
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

  draw(g) {
    if (!this.active) return;
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    g.save();
    if (this.shake > 0) {
      g.translate(Math.round(Utils.ri(-2, 2)), Math.round(Utils.ri(-2, 2)));
    }

    /* ---- background: horizon bands by terrain ---- */
    const terrainCols = {
      plain:   ['#78a048', '#88b058', '#689040'],
      road:    ['#c8b088', '#d8c49c', '#b09868'],
      forest:  ['#3a6838', '#4a8044', '#2c5028'],
      mountain:['#887858', '#989078', '#6a5a40'],
      water:   ['#3868a8', '#5888c8', '#284878'],
      river:   ['#4878b8', '#6888c8', '#3858a0'],
      bridge:  ['#a8804c', '#c8a068', '#88683c'],
      wall:    ['#808088', '#9898a0', '#585860'],
      carpet:  ['#a03838', '#c85858', '#782828'],
      floor:   ['#a89878', '#b8a888', '#907f60'],
      throne:  ['#a03838', '#c8a050', '#782828'],
      fort:    ['#909090', '#a8a8a8', '#687078'],
      house:   ['#c8b088', '#d8c49c', '#b09868'],
      village: ['#78a048', '#88b058', '#689040'],
      chest:   ['#887050', '#a06838', '#684828'],
      door:    ['#808088', '#9898a0', '#585860'],
      rubble:  ['#887868', '#a89888', '#685848'],
    };
    const cols = terrainCols[this.bg] || terrainCols.plain;
    g.fillStyle = '#1c2c48'; g.fillRect(0, 0, SW, 34);       /* sky */
    g.fillStyle = '#2c3c58'; g.fillRect(0, 30, SW, 6);
    g.fillStyle = cols[0]; g.fillRect(0, 36, SW, SH - 36);    /* ground */
    g.fillStyle = cols[1];
    for (let x = -16; x < SW + 16; x += 24) {
      g.fillRect(x + (Math.floor(this.bgScroll) % 24), 44, 10, 2);
    }
    g.fillStyle = cols[2];
    for (let x = -16; x < SW + 16; x += 18) {
      g.fillRect(x + (Math.floor(this.bgScroll * 1.7) % 18), SH - 18, 8, 2);
    }

    /* platforms */
    const baseY = SH - 44;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(38, baseY + 26, 44, 4);
    g.fillRect(SW - 82, baseY + 26, 44, 4);

    const art = CharArt.unit;
    const A = this.a, D = this.d;
    const scale = 2;
    const drawFighter = (u, kind, frame, left, off, hurt) => {
      const img = art(kind, frame, !left);
      const px = left ? 60 + off : SW - 60 - 16 * scale + off;
      const py = baseY - 16 * scale + 26;
      if (hurt) {
        g.globalAlpha = (Math.floor(this.timer / 40) % 2) ? 0.4 : 1;
      }
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, 16, 16, px, py, 16 * scale, 16 * scale);
      g.globalAlpha = 1;
    };

    const aHurt = (this.state === 'aHit') && this.timer < 250;
    const dHurt = (this.state === 'dHit') && this.timer < 250;
    const aKind = A.battle || A.sprite || 'lord';
    const dKind = D.battle || D.sprite || 'esoldier';

    drawFighter(A, aKind, this.aFrame, true, this.aOffset, aHurt);
    drawFighter(D, dKind, this.dFrame, false, this.dOffset, dHurt);

    /* ---- magic / heal fx ---- */
    if (this.state === 'healing' || (A.weapon && ['anima','light','dark'].includes(A.weapon.type) && (this.state === 'aHit'))) {
      const t = this.timer;
      for (let i = 0; i < 6; i++) {
        const px = this.state === 'healing' ? SW - 70 + Math.sin(t/90 + i) * 8 : 80 + Math.sin(t/70 + i*2) * 10;
        const py = baseY - 20 - ((t/2 + i*18) % 60);
        g.fillStyle = this.state === 'healing' ? '#7af0a0' : '#70a8f8';
        g.fillRect(px, py, 2, 2);
        g.fillStyle = this.state === 'healing' ? '#c8ffc8' : '#c8e0ff';
        g.fillRect(px - 1, py + 4, 1, 1);
      }
    }

    /* ---- crit flash ---- */
    if (this.flash > 0) {
      g.fillStyle = 'rgba(255,255,240,' + (this.flash / 14) + ')';
      g.fillRect(0, 0, SW, SH);
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
      Font.drawCentered(g, this.popup, SW / 2, 42, '#f8f850');
      g.globalAlpha = 1;
    }

    g.restore();
  },
};
