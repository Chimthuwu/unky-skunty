/* =============================================================
   AFTERMATH — what happens when he catches you.

   A cutscene, in five beats: the screen comes apart, the statement
   writes itself over and over while it grows until it fills the
   screen, a second statement says the other thing, the old 2D game
   comes back looking normal for a few seconds, and then the moment
   you commit to a move in it the colours invert and the words come
   back garbled. Then you are back in the corridor.

   The colour inversion is the one moment here that touches every
   pixel at once, so it is deliberately a *held* state: it comes on
   once, when the first move is committed, and it is still on when
   this sequence ends. Nothing in the sequence toggles it, and
   nothing strobes — the movement is all slow and continuous.
   ============================================================= */
'use strict';

const Aftermath = (() => {

  const JS_LINE = 'NOW INITIATING JAVA SCRIPT.';
  const LINUX_LINE = 'You NEED to install Linux.';
  const GARBLE = 'JAVASCRIPT LINUX JAVASCRIPT LINUX JAVANUX SCRINUX '
               + 'LAVASCRIPT JINUX JAVASCRIPT. JAVA. SCRPIT';

  /* phase lengths in ms */
  const T_GLITCH = 1500;
  const T_JS = 8000;
  const T_LINUX = 6000;
  const T_INVERT = 5200;
  const BOARD_TIMEOUT = 25000;      /* so a confused player isn't stuck */

  const GREEN = '#7ce87c';
  const PALE = '#d8f0c8';

  /* piecewise-linear curve helper: stops are [position, value] */
  function curve(stops, p) {
    if (p <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        const [p0, v0] = stops[i - 1], [p1, v1] = stops[i];
        const k = p1 === p0 ? 0 : (p - p0) / (p1 - p0);
        return v0 + (v1 - v0) * k;
      }
    }
    return stops[stops.length - 1][1];
  }

  /* the growth schedule both statements share: readable, bigger,
     smaller again, then big enough to stop being words */
  const SCALE_STOPS = [[0, 1], [0.16, 1], [0.32, 2], [0.46, 1], [0.62, 1], [0.86, 5], [1, 5.4]];
  const ALPHA_STOPS = [[0, 0], [0.08, 1], [0.8, 1], [1, 0]];

  function create(SW, SH) {
    const rain = Matrix.create(SW, SH);
    const board = Tactics.create();
    const boardX = Math.round((SW - board.w) / 2);
    const boardY = Math.round((SH - board.h) / 2) + 4;

    let phase = 'glitch';
    let t = 0;              /* time in the current phase */
    let total = 0;
    let inverted = false;
    let finished = false;

    function begin(next) { phase = next; t = 0; }

    function update(dt, input) {
      t += dt; total += dt;
      rain.update(dt);

      if (phase === 'glitch') {
        if (t >= T_GLITCH) begin('js');
        return;
      }
      if (phase === 'js') {
        if (t >= T_JS) begin('linux');
        return;
      }
      if (phase === 'linux') {
        if (t >= T_LINUX) begin('board');
        return;
      }
      if (phase === 'board') {
        /* the board is live, and the first committed move is the
           trigger — the timeout is only there so nobody gets stuck */
        const moved = board.update(dt, input);
        if (moved || t >= BOARD_TIMEOUT) {
          inverted = true;
          begin('invert');
        }
        return;
      }
      if (phase === 'invert') {
        if (t >= T_INVERT) { phase = 'done'; finished = true; }
      }
    }

    /* a slow horizontal tear: bands of the field pulled sideways and
       dropped back. Continuous offsets, no frame-to-frame snapping. */
    function drawGlitch(g) {
      const p = Math.min(1, t / T_GLITCH);
      g.fillStyle = '#05070a';
      g.fillRect(0, 0, SW, SH);
      rain.drawRain(g, GREEN, 0.5 * (1 - p) + 0.15, 0.9);
      const bands = 9;
      for (let i = 0; i < bands; i++) {
        const seed = i * 97.3;
        const y = ((Math.sin(seed + total / 300) * 0.5 + 0.5) * SH) | 0;
        const h = 3 + ((Math.sin(seed * 1.7 + total / 190) * 0.5 + 0.5) * 9) | 0;
        const off = Math.round(Math.sin(seed + total / 120) * 26 * (1 - p));
        g.globalAlpha = 0.5 * (1 - p * 0.6);
        g.fillStyle = i % 3 === 0 ? '#20301c' : '#0c1410';
        g.fillRect(off, y, SW, h);
        g.globalAlpha = 1;
      }
      if (p > 0.55) {
        g.globalAlpha = (p - 0.55) / 0.45;
        Font.drawCentered(g, JS_LINE, SW / 2, SH / 2 - 4, PALE, 1);
        g.globalAlpha = 1;
      }
    }

    /* one statement, grown through the schedule, over live rain */
    function drawStatement(g, text, dur) {
      const p = Math.min(1, t / dur);
      g.fillStyle = '#04060a';
      g.fillRect(0, 0, SW, SH);
      rain.drawRain(g, GREEN, 0.30 * (1 - p * 0.5), 0.8);
      const scale = curve(SCALE_STOPS, p);
      const alpha = curve(ALPHA_STOPS, p);
      rain.drawStatement(g, text, scale, PALE, alpha);
      /* the caption stays legible at the bottom until the growth
         swallows it — the one line you can actually read */
      if (p < 0.7) {
        g.globalAlpha = Math.max(0, 0.9 - p * 1.3);
        Font.drawCentered(g, text, SW / 2, SH - 14, PALE, 1);
        g.globalAlpha = 1;
      }
    }

    function drawBoard(g) {
      g.fillStyle = '#0a0c14';
      g.fillRect(0, 0, SW, SH);
      board.draw(g, boardX, boardY);
      /* frame + chrome, so it reads as a screen rather than a map */
      g.strokeStyle = '#2a3348';
      g.lineWidth = 1;
      g.strokeRect(boardX - 2.5, boardY - 2.5, board.w + 5, board.h + 5);
      Font.drawCentered(g, 'BATTLE', SW / 2, boardY - 14, '#c8d0e0', 1);
      const line = board.log;
      if (line) Font.drawCentered(g, line, SW / 2, boardY + board.h + 6, '#a8b0c0', 1);
      Font.drawCentered(g, 'ARROWS MOVE CURSOR  Z CONFIRM', SW / 2, SH - 8, '#5a6478', 1);
    }

    function draw(g) {
      /* the inversion is applied to everything below and is a held
         state — set once, cleared once, never toggled per frame */
      g.filter = inverted ? 'invert(1)' : 'none';

      if (phase === 'glitch') drawGlitch(g);
      else if (phase === 'js') drawStatement(g, JS_LINE, T_JS);
      else if (phase === 'linux') drawStatement(g, LINUX_LINE, T_LINUX);
      else if (phase === 'board' || phase === 'done') drawBoard(g);
      else if (phase === 'invert') {
        drawBoard(g);
        rain.drawRain(g, PALE, 0.5 * rain.pulse(), 1);
        const p = Math.min(1, t / T_INVERT);
        rain.drawStatement(g, GARBLE, 1, '#ffffff', Math.max(0, 1 - p * 1.1));
        if (p < 0.75) {
          g.globalAlpha = Math.max(0, 1 - p * 1.4);
          Font.drawCentered(g, 'RESETTING', SW / 2, SH - 10, '#ffffff', 1);
          g.globalAlpha = 1;
        }
      }

      g.filter = 'none';
    }

    return {
      update, draw,
      get phase() { return phase; },
      get done() { return finished; },
      get inverted() { return inverted; },
      get boardMoves() { return board.movesMade; },
      get elapsed() { return total; },
    };
  }

  return { create, JS_LINE, LINUX_LINE, GARBLE };
})();
