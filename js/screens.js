/* =============================================================
   SCREENS — title, intro, prep (deployment), results, game over.
   Each screen: { update(dt), draw(g) } via Game.screen object.
   ============================================================= */
'use strict';

const Screens = {

  /* ================= TITLE ================= */
  makeTitle() {
    let t = 0, sel = 0;
    const opts = () => {
      const o = [{ label: 'NEW GAME', act: 'new' }];
      if (SaveLoad.has()) o.push({ label: 'CONTINUE', act: 'continue' });
      return o;
    };
    return {
      name: 'title',
      update(dt) {
        t += dt;
        const list = opts();
        if (Input.pressed('up')) { sel = (sel + list.length - 1) % list.length; Audio.SFX.cursor(); }
        if (Input.pressed('down')) { sel = (sel + 1) % list.length; Audio.SFX.cursor(); }
        if (Input.pressed('confirm')) {
          Audio.SFX.confirm();
          if (list[sel].act === 'new') {
            SaveLoad.clear();
            Game.screen = Screens.makeIntro();
          } else {
            const data = SaveLoad.load();
            if (data) { Game.startChapter(data.chapterId || 'ch1', data); }
          }
        }
      },
      draw(g) {
        const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
        /* night sky */
        g.fillStyle = '#0c1228'; g.fillRect(0, 0, SW, SH);
        /* stars */
        for (let i = 0; i < 40; i++) {
          const x = (i * 97) % SW, y = (i * 53) % 90;
          g.fillStyle = (Math.floor(t / 500 + i) % 4 === 0) ? '#f8f8d0' : '#5868a0';
          g.fillRect(x, y, 1, 1);
        }
        /* mountains silhouette */
        g.fillStyle = '#141c38';
        for (let x = 0; x < SW; x += 8) {
          const h = 20 + Math.abs(Math.sin(x * 0.07)) * 26;
          g.fillRect(x, SH - 40 - h, 8, h + 40);
        }
        g.fillStyle = '#1c2848';
        g.fillRect(0, SH - 44, SW, 44);
        /* fortress silhouette */
        g.fillStyle = '#0a0e1e';
        g.fillRect(SW - 80, SH - 78, 56, 38);
        for (let i = 0; i < 5; i++) g.fillRect(SW - 80 + i * 12, SH - 84, 6, 6);
        g.fillStyle = '#e8c850';
        g.fillRect(SW - 58, SH - 66, 4, 4); /* lit window */

        /* logo */
        const title = 'EMBERWRATH';
        const sub = 'CHRONICLE';
        const bob = Math.sin(t / 600) * 1.5;
        UI.frame(g, 30, 18, SW - 60, 52);
        Font.drawCentered(g, title, SW / 2, 26 + bob, '#f8d050', 2);
        Font.drawCentered(g, sub, SW / 2, 44 + bob, '#a8c8f0', 2);
        Font.drawCentered(g, 'A TACTICAL SAGA', SW / 2, 60, '#6878a8');

        /* menu */
        const list = opts();
        UI.window(g, SW / 2 - 52, SH - 52, 104, list.length * 14 + 10);
        list.forEach((o, i) => {
          const yy = SH - 52 + 6 + i * 14;
          if (i === sel) {
            g.fillStyle = '#384878'; g.fillRect(SW / 2 - 49, yy - 2, 98, 13);
            Font.draw(g, '→', SW / 2 - 44, yy, '#f8f850');
          }
          Font.draw(g, o.label, SW / 2 - 34, yy, i === sel ? '#f8f850' : '#e8e8d0');
        });
        Font.drawCentered(g, 'Z/ENTER CONFIRM   X CANCEL   C MENU', SW / 2, SH - 8, '#485878');
      },
    };
  },

  /* ================= INTRO (story text) ================= */
  makeIntro() {
    const pages = [
      'The Ashenreach — a borderland of windswept peaks and old watch-roads.',
      'For a hundred years the EMBERWATCH kept its beacon-gates, and the raids never crossed.',
      'Then the IRONMARK came. Beacon-towers were salted. Villages burned. The Gate fell in a single night.',
      'Now a young commander gathers six souls and marches to take it back...',
    ];
    let page = 0, chars = 0, timer = 0, t = 0;
    return {
      name: 'intro',
      update(dt) {
        t += dt; timer += dt;
        chars = Math.min(pages[page].length, Math.floor(timer * 0.03 * 1000 / 33));
        chars = Math.min(pages[page].length, Math.floor(timer / 33));
        if (Input.pressed('confirm')) {
          if (chars < pages[page].length) { chars = pages[page].length; timer = 9999; }
          else {
            Audio.SFX.confirm();
            page++;
            timer = 0; chars = 0;
            if (page >= pages.length) Game.screen = Screens.makePrep();
          }
        }
        if (Input.pressed('cancel')) Game.screen = Screens.makePrep();
      },
      draw(g) {
        const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
        g.fillStyle = '#0a0e20'; g.fillRect(0, 0, SW, SH);
        /* slow ember particles */
        for (let i = 0; i < 14; i++) {
          const x = (i * 61 + Math.sin(t / 900 + i) * 20 + t / 40) % SW;
          const y = SH - ((t / 18 + i * 37) % (SH + 20));
          g.fillStyle = i % 2 ? '#c86030' : '#e8a040';
          g.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
        UI.window(g, 14, SH - 78, SW - 28, 56);
        /* wrap current page */
        const words = pages[page].slice(0, chars).split(' ');
        let line = '', yy = SH - 70;
        const lines = [];
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (Font.width(test) > SW - 48) { lines.push(line); line = w; } else line = test;
        }
        if (line) lines.push(line);
        lines.forEach((l, i) => Font.draw(g, l, 22, SH - 70 + i * 10, '#e8e8d0'));
        if (Math.floor(t / 350) % 2 === 0) Font.draw(g, '→', SW - 30, SH - 32, '#f8f850');
        Font.drawCentered(g, 'X TO SKIP', SW / 2, 8, '#40507a');
      },
    };
  },

  /* ================= PREP (deployment) ================= */
  makePrep() {
    const roster = ChapterDB.ch1.playerDeploy.map(p => CharacterDB[p.charId]);
    let sel = 0, t = 0;
    let deployed = roster.map(() => true);
    return {
      name: 'prep',
      update(dt) {
        t += dt;
        if (Input.pressed('up')) { sel = (sel + roster.length - 1) % roster.length; Audio.SFX.cursor(); }
        if (Input.pressed('down')) { sel = (sel + 1) % roster.length; Audio.SFX.cursor(); }
        if (Input.pressed('confirm')) {
          Audio.SFX.confirm();
          deployed[sel] = !deployed[sel];
        }
        if (Input.pressed('cancel') || Input.pressed('start')) {
          Audio.SFX.confirm();
          const chosen = ChapterDB.ch1.playerDeploy.filter((_, i) => deployed[i]);
          if (chosen.length) Game.deployOverride = chosen;
          Game.startChapter('ch1', null);
        }
        if (Input.pressed('menu')) {
          Audio.SFX.confirm();
          Game.deployOverride = null;
          Game.startChapter('ch1', null);
        }
      },
      draw(g) {
        const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
        g.fillStyle = '#101828'; g.fillRect(0, 0, SW, SH);
        Font.drawCentered(g, 'CHAPTER 1', SW / 2, 8, '#f8d050');
        Font.drawCentered(g, 'THE ASHENREACH GATE', SW / 2, 20, '#e8e8d0');
        Font.drawCentered(g, 'DEPLOY YOUR FORCES', SW / 2, 34, '#7888b8');
        UI.frame(g, 24, 44, SW - 48, SH - 62);
        roster.forEach((c, i) => {
          const y = 52 + i * 13;
          const on = deployed[i];
          if (i === sel) { g.fillStyle = '#384878'; g.fillRect(28, y - 2, SW - 56, 12); }
          Font.draw(g, on ? '·' : ' ', 30, y, on ? '#70f070' : '#586078');
          Font.draw(g, c.name, 40, y, on ? '#e8e8d0' : '#586078');
          Font.draw(g, ClassDB[c.classId].name.slice(0, 14), 90, y, '#a8b8d8');
          Font.draw(g, 'LV' + c.level, 168, y, '#c8d8f8');
          /* portrait */
          if (i === sel) {
            const art = CharArt.portrait(c.portrait);
            g.imageSmoothingEnabled = false;
            UI.frame(g, SW - 74, 46, 56, 56);
            g.drawImage(art, 0, 0, 32, 32, SW - 70, 50, 48, 48);
            /* bio */
            UI.window(g, 30, SH - 34, SW - 60, 26);
            const words = (c.bio || '').split(' ');
            let line = '', lines = [];
            for (const w of words) {
              const test = line ? line + ' ' + w : w;
              if (Font.width(test) > SW - 80) { lines.push(line); line = w; } else line = test;
            }
            if (line) lines.push(line);
            lines.slice(0, 2).forEach((l, j) => Font.draw(g, l, 36, SH - 30 + j * 9, '#a8b8d8'));
          }
        });
        Font.drawCentered(g, 'Z: TOGGLE   X: BEGIN BATTLE   C: ALL+GO', SW / 2, SH - 8, '#6878a8');
      },
    };
  },

  /* ================= RESULTS ================= */
  makeResults() {
    let t = 0;
    const survivors = Game.playersAlive();
    return {
      name: 'results',
      update(dt) {
        t += dt;
        if (t > 800 && Input.pressed('confirm')) {
          Audio.SFX.confirm();
          SaveLoad.clear();
          Game.screen = Screens.makeTitle();
          Audio.startMusic('title');
        }
      },
      draw(g) {
        const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
        g.fillStyle = '#0c1428'; g.fillRect(0, 0, SW, SH);
        for (let i = 0; i < 30; i++) {
          const x = (i * 83) % SW, y = (i * 41) % SH;
          g.fillStyle = (Math.floor(t / 400 + i) % 5) ? '#5868a0' : '#f8f8d0';
          g.fillRect(x, y, 1, 1);
        }
        Font.drawCentered(g, 'CHAPTER CLEAR!', SW / 2, 14, '#f8d050', 2);
        Font.drawCentered(g, 'THE ASHENREACH GATE IS RETAKEN', SW / 2, 34, '#a8c8f0');
        UI.frame(g, 40, 46, SW - 80, 66);
        Font.draw(g, 'TURN', 52, 54, '#a8b8d8');
        Font.draw(g, String(Game.turn), 120, 54, '#f8f8d0');
        Font.draw(g, 'FALLEN', 52, 66, '#a8b8d8');
        Font.draw(g, String(Game.deaths), 120, 66, Game.deaths ? '#f07070' : '#f8f8d0');
        Font.draw(g, 'GOLD', 52, 78, '#a8b8d8');
        Font.draw(g, String(Game.gold), 120, 78, '#f8d850');
        Font.draw(g, 'SURVIVORS', 52, 92, '#a8b8d8');
        survivors.forEach((u, i) => Font.draw(g, u.name.slice(0, 7), 118 + i * 22, 92, '#90f090'));
        if (t > 800 && Math.floor(t / 350) % 2 === 0) {
          Font.drawCentered(g, 'PRESS Z', SW / 2, SH - 14, '#f8f850');
        }
      },
    };
  },

  /* ================= GAME OVER ================= */
  makeGameOver() {
    let t = 0;
    return {
      name: 'gameover',
      update(dt) {
        t += dt;
        if (t > 1200 && Input.pressed('confirm')) {
          Audio.SFX.confirm();
          Game.screen = Screens.makeTitle();
          Audio.startMusic('title');
        }
      },
      draw(g) {
        const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
        g.fillStyle = '#180808'; g.fillRect(0, 0, SW, SH);
        const a = Math.min(1, t / 1500);
        g.globalAlpha = a;
        Font.drawCentered(g, 'GAME OVER', SW / 2, SH / 2 - 16, '#f05050', 3);
        Font.drawCentered(g, 'THE EMBERWATCH HAS FALLEN...', SW / 2, SH / 2 + 12, '#a87878');
        g.globalAlpha = 1;
        if (t > 1200 && Math.floor(t / 350) % 2 === 0) {
          Font.drawCentered(g, 'PRESS Z', SW / 2, SH - 16, '#f8f850');
        }
      },
    };
  },
};
