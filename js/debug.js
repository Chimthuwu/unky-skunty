/* =============================================================
   DEBUG — developer tools, fully isolated behind Debug.enabled.
   Toggle with ` (backquote) during the chapter or title screen.
   ============================================================= */
'use strict';

const Debug = {
  enabled: Config.DEBUG_DEFAULT,
  sel: 0,
  toast: null, toastT: 0,

  items: [
    { label: 'Toggle Ranges', act: 'ranges' },
    { label: 'Give 90 EXP',   act: 'exp' },
    { label: 'Damage -10 HP', act: 'hurt' },
    { label: 'Heal Full',     act: 'heal' },
    { label: 'Inspect AI',    act: 'ai' },
    { label: 'Spawn Test Unit', act: 'spawn' },
    { label: 'Restart Chapter', act: 'restart' },
    { label: 'Win Chapter',   act: 'win' },
  ],

  toggle() {
    this.enabled = !this.enabled;
    this.sel = 0;
    this.toast = this.enabled ? 'DEBUG ON' : 'DEBUG OFF';
    this.toastT = 900;
  },

  msg(s) { this.toast = s; this.toastT = 1400; },

  update(dt) {
    if (!this.enabled) return;
    if (this.toastT > 0) this.toastT -= dt;
    if (Game.state === 'chapter') {
      if (Input.pressed('up')) { this.sel = (this.sel + this.items.length - 1) % this.items.length; Audio.SFX.cursor(); }
      if (Input.pressed('down')) { this.sel = (this.sel + 1) % this.items.length; Audio.SFX.cursor(); }
      if (Input.pressed('confirm')) { this.run(this.items[this.sel].act); }
    }
  },

  run(act) {
    const u = GameMap.unitAt(Game.cursor.x, Game.cursor.y) || Game.playersAlive()[0];
    Audio.SFX.confirm();
    switch (act) {
      case 'ranges':
        /* overlay all enemy threat ranges for 3s */
        Game.debugRanges = Game.debugRanges ? null : true;
        this.msg(Game.debugRanges ? 'Threat ranges ON' : 'Threat ranges OFF');
        break;
      case 'exp': {
        if (u && u.team === 'player') {
          const res = Units.gainExp(u, 90);
          this.msg(u.name + ' +' + 90 + ' EXP' + (res.levels.length ? ' (LEVEL UP)' : ''));
        } else this.msg('No player unit targeted');
        break;
      }
      case 'hurt': if (u) { u.hp = Math.max(1, u.hp - 10); this.msg(u.name + ' -10 HP'); } break;
      case 'heal': if (u) { u.hp = u.maxhp; this.msg(u.name + ' healed'); } break;
      case 'ai': {
        if (u && u.ai) {
          console.log('[AI]', u.id, u.name, 'profile=' + u.ai, 'pos=' + u.x + ',' + u.y, 'guardPos=' + JSON.stringify(u.guardPos));
          this.msg(u.name + ': ' + u.ai + ' (see console)');
        } else this.msg('Unit has no AI');
        break;
      }
      case 'spawn': {
        const spot = Game.freeAdjacent(Game.cursor.x, Game.cursor.y);
        const testU = Units.makeNPCUnit({ id: 'dbg_' + Date.now(), team: 'player', classId: 'mercenary', name: 'Tester', x: spot[0], y: spot[1], level: 5, inventory: ['iron_sword', 'potion'], ai: null });
        testU.sprite = 'lord';
        Game.units.push(testU);
        this.msg('Spawned Tester at ' + spot[0] + ',' + spot[1]);
        break;
      }
      case 'restart':
        Game.startChapter(Game.chapterId, null);
        this.msg('Chapter restarted');
        break;
      case 'win':
        Game.winChapter();
        break;
    }
  },

  draw(g) {
    if (!this.enabled) {
      if (this.toastT > 0) {
        UI.banner(g, this.toast, Config.SCREEN_H - 46, 900 - this.toastT, 900);
      }
      return;
    }
    const x = Config.SCREEN_W - 92, y = 24;
    UI.window(g, x, y, 90, this.items.length * 11 + 14);
    Font.draw(g, 'DEBUG', x + 4, y + 4, '#f07070');
    this.items.forEach((it, i) => {
      const yy = y + 16 + i * 11;
      if (i === this.sel) { g.fillStyle = '#483848'; g.fillRect(x + 3, yy - 2, 84, 11); }
      Font.draw(g, it.label, x + 5, yy, i === this.sel ? '#f8f850' : '#e8e8d0');
    });
    /* tile coords under cursor */
    if (Game.state === 'chapter') {
      const terr = Game.terrainAt(Game.cursor.x, Game.cursor.y);
      UI.window(g, 2, Config.SCREEN_H - 14, 110, 12);
      Font.draw(g, '(' + Game.cursor.x + ',' + Game.cursor.y + ') ' + (terr.name || '?').slice(0, 8), 6, Config.SCREEN_H - 12, '#90f090');
    }
    if (this.toastT > 0) {
      UI.banner(g, this.toast, Config.SCREEN_H - 60, 1400 - this.toastT, 1400);
    }
  },
};
