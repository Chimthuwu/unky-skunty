/* =============================================================
   LEVEL UP — EXP bar fill, then stat gains revealed one by one.
   LevelUp.show(unit, expGained, gainsList, onDone)
   gainsList = [{str:1},{spd:1,hp:1}, ...] per level gained.
   ============================================================= */
'use strict';

const LevelUp = {
  active: false,
  unit: null,
  expGained: 0,
  gains: [],
  state: 'exp',        /* exp -> level -> stats -> done */
  timer: 0,
  expShown: 0,
  levelShown: 0,
  statIdx: 0,
  statList: [],
  onDone: null,

  show(unit, expGained, gains, onDone) {
    this.active = true;
    this.unit = unit;
    this.expGained = expGained;
    this.gains = gains || [];
    this.state = 'exp';
    this.timer = 0;
    this.expShown = Math.max(0, unit.exp - expGained);  /* start from pre-gain exp */
    this.levelShown = this.gains.length ? unit.level - this.gains.length : unit.level;
    this.statIdx = 0;
    this.statList = [];
    for (const g of this.gains) {
      for (const k of Object.keys(g)) this.statList.push({ key: k, n: g[k] });
    }
    this.onDone = onDone || null;
    if (!this.gains.length && expGained > 0) this.state = 'exp';
    Audio.SFX.exp();
  },

  _finish() {
    this.active = false;
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  },

  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    const T = this.timer;

    if (this.state === 'exp') {
      /* animate exp bar up to gained amount (wrap at 100) */
      const target = this.expGained;
      const speed = dt * 0.12;
      if (this.expShown < this.unit.exp) {
        this.expShown = Math.min(this.unit.exp, this.expShown + speed);
        if (this.expShown >= 100) { this.expShown = this.expShown - 100; Audio.SFX.levelup(); this.state = 'level'; this.timer = 0; }
      } else if (T > 500) {
        if (this.gains.length) { this.state = 'level'; this.timer = 0; Audio.SFX.levelup(); }
        else this._finish();
      }
    } else if (this.state === 'level') {
      if (T > 600) { this.state = 'stats'; this.timer = 0; this.statIdx = 0; }
    } else if (this.state === 'stats') {
      if (T > 320 && this.statIdx < this.statList.length) {
        this.statIdx++;
        this.timer = 0;
        Audio.SFX.confirm();
      }
      if (this.statIdx >= this.statList.length) {
        if (Input.pressed('confirm') || T > 900) this._finish();
      }
    }

    if (Input.pressed('cancel')) this._finish(); /* skip */
  },

  draw(g) {
    if (!this.active) return;
    const u = this.unit;
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    g.fillStyle = 'rgba(8,8,20,0.6)';
    g.fillRect(0, 0, SW, SH);

    const w = 120, h = 108;
    const x = Math.round((SW - w) / 2), y = Math.round((SH - h) / 2);
    UI.frame(g, x, y, w, h);

    Font.drawCentered(g, 'LEVEL UP!', SW / 2, y + 6, '#f8f850');
    Font.draw(g, u.name, x + 8, y + 18, '#9ab8f8');

    /* level number */
    const lvShown = this.state === 'exp' ? this.levelShown : u.level;
    Font.draw(g, 'LV', x + 8, y + 30, '#e8e8d0');
    Font.draw(g, String(lvShown), x + 24, y + 28, '#f8f850', 2);

    /* exp bar */
    if (this.state === 'exp') {
      UI.expBar(g, x + 8, y + 46, w - 16, this.expShown / 100);
      Font.draw(g, 'EXP ' + Math.floor(this.expShown), x + 8, y + 54, '#a8c8f0');
    } else {
      UI.expBar(g, x + 8, y + 46, w - 16, u.exp / 100);
      Font.draw(g, 'EXP ' + u.exp, x + 8, y + 54, '#a8c8f0');
    }

    /* stat gains revealed so far */
    const NAMES = { hp: 'HP', str: 'STR', mag: 'MAG', skl: 'SKL', spd: 'SPD', luk: 'LUK', def: 'DEF', res: 'RES' };
    let yy = y + 66;
    for (let i = 0; i < this.statIdx && i < this.statList.length; i++) {
      const s = this.statList[i];
      Font.draw(g, (NAMES[s.key] || s.key), x + 22, yy, '#e8e8d0');
      Font.draw(g, '+' + s.n, x + 58, yy, '#70f070');
      yy += 9;
    }
    if (this.state === 'stats' && this.statIdx >= this.statList.length && this.statList.length === 0) {
      Font.draw(g, 'NO GROWTH...', x + 22, yy, '#a0a0b0');
    }
  },
};
