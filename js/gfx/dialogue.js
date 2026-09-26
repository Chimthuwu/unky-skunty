/* =============================================================
   DIALOGUE — GBA-style conversation overlay with portraits,
   typewriter text and confirm-to-advance. Calls back when done.
   ============================================================= */
'use strict';

const Dialogue = {
  active: false,
  script: null,
  idx: 0,
  chars: 0,
  timer: 0,
  onDone: null,
  portraits: {},       /* cached scaled portraits per side */
  flash: 0,

  start(script, onDone) {
    this.script = script || [];
    this.idx = 0;
    this.chars = 0;
    this.timer = 0;
    this.active = true;
    this.onDone = onDone || null;
    if (!this.script.length) this.finish();
  },

  finish() {
    this.active = false;
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  },

  skip() { this.chars = 1e9; },

  update(dt) {
    if (!this.active) return;
    const line = this.script[this.idx];
    if (!line) { this.finish(); return; }
    /* typewriter */
    if (this.chars < line.text.length) {
      this.timer += dt;
      const speed = 28; /* chars per second */
      const target = Math.min(line.text.length, Math.floor(this.timer * speed));
      if (target > this.chars) {
        this.chars = target;
        if (this.chars % 3 === 0) Audio.SFX.exp();
      }
    }
    if (Input.pressed('confirm')) {
      if (this.chars < line.text.length) this.skip();
      else {
        Audio.SFX.confirm();
        this.idx++;
        this.chars = 0;
        this.timer = 0;
        if (this.idx >= this.script.length) this.finish();
      }
    }
    if (Input.pressed('cancel')) {
      this.finish();
    }
  },

  draw(g) {
    if (!this.active) return;
    const line = this.script[this.idx];
    if (!line) return;
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;

    /* darkened letterbox */
    g.fillStyle = 'rgba(8,8,20,0.55)';
    g.fillRect(0, 0, SW, SH);

    /* portraits */
    const P = 56; /* portrait draw size (32px art scaled 1.75 → crisp-ish) */
    const drawPortraitSide = (pid, left) => {
      if (!pid) return;
      const art = CharArt.portrait(pid);
      const x = left ? 16 : SW - 16 - P;
      const y = 34;
      g.imageSmoothingEnabled = false;
      /* frame */
      UI.frame(g, x - 4, y - 4, P + 8, P + 8);
      g.drawImage(art, 0, 0, 32, 32, x, y, P, P);
    };
    drawPortraitSide(line.portrait, line.side !== 'right');

    /* name box */
    if (line.speaker) {
      const nx = line.side === 'right' ? SW - 150 : 10;
      const w = Font.width(line.speaker) + 10;
      UI.window(g, line.side === 'right' ? SW - 10 - w : 10, 24, w, 14);
      Font.draw(g, line.speaker, (line.side === 'right' ? SW - 10 - w : 10) + 5, 28, '#f8f850');
    }

    /* text window */
    const bw = SW - 20, bh = 34, bx = 10, by = SH - bh - 6;
    UI.window(g, bx, by, bw, bh);
    /* wrapped text */
    const shown = line.text.slice(0, Math.floor(this.chars));
    this.wrapText(g, shown, bx + 5, by + 6, bw - 10);

    /* blinking advance arrow */
    if (this.chars >= line.text.length && Math.floor(performance.now() / 350) % 2 === 0) {
      Font.draw(g, '→', bx + bw - 10, by + bh - 9, '#f8f850');
    }
  },

  wrapText(g, text, x, y, maxW) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (Font.width(test) > maxW) {
        Font.draw(g, line, x, yy, '#e8e8d0');
        line = w; yy += 9;
      } else {
        line = test;
      }
    }
    if (line) Font.draw(g, line, x, yy, '#e8e8d0');
  },
};
