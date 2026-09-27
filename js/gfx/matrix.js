/* =============================================================
   MATRIX TEXT — the falling-glyph layer for the death sequence.

   Two jobs. The first is ordinary rain: columns of characters
   falling at their own speeds, each one occasionally mutating, the
   head of each column bright and the tail fading out behind it. The
   second is the statement — a line of text repeated down every
   column, which grows from a readable caption to something bigger
   than the screen and then swallows it.

   On the strobing question, which this file has to answer for
   itself: a Matrix rain is traditionally the most seizure-prone
   thing a game can put on screen, because it is high contrast and
   because people implement the flicker literally. So the movement
   here is slow and continuous, glyphs mutate on a long per-column
   timer rather than per frame, the global brightness breathes on a
   ~2.6s cycle instead of blinking, and nothing in here ever flips
   the whole screen between two colours. The one deliberate full
   inversion in the sequence is owned by the caller and is a held
   state, not a toggle.
   ============================================================= */
'use strict';

const Matrix = (() => {

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\[]{}=+*#$%&@';
  const CELL = 8;                 /* glyph cell, matches the 5x7 font plus a gap */
  const TAIL = 14;                /* how many glyphs each trail draws */

  function create(w, h) {
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);

    /* one falling trail per column: where its head is, how fast it
       falls, and when it next mutates */
    const head = new Float32Array(cols);
    const speed = new Float32Array(cols);
    const chars = new Array(cols);
    const nextMutate = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      head[c] = -Math.random() * rows * 2;
      /* a wide spread of speeds is what stops it looking like a single
         sheet of text sliding down */
      speed[c] = 2.2 + Math.random() * 5.5;
      chars[c] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      nextMutate[c] = Math.random() * 600;
    }

    let t = 0;

    function update(dt) {
      t += dt;
      for (let c = 0; c < cols; c++) {
        head[c] += (speed[c] * dt) / 1000;
        if (head[c] - rows > 0) head[c] = -Math.random() * 6;
        nextMutate[c] -= dt;
        if (nextMutate[c] <= 0) {
          nextMutate[c] = 220 + Math.random() * 700;
          chars[c] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      }
    }

    /* The rain. `dim` fades the whole field, `headGlow` sets how much
       brighter the leading glyph of each trail is than its tail. */
    function drawRain(g, colour, dim, headGlow) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL;
        const top = Math.floor(head[c]);
        for (let r = 0; r < TAIL; r++) {
          const y = (top - r) * CELL;
          if (y < -CELL || y > h) continue;
          const fade = (1 - r / TAIL) * (r === 0 ? headGlow : 0.5) * dim;
          if (fade < 0.06) continue;
          g.globalAlpha = Math.min(1, fade);
          Font.draw(g, r === 0 ? chars[c] : GLYPHS[(c * 7 + r * 13 + ((t / 110) | 0)) % GLYPHS.length],
            x, y, colour);
        }
      }
      g.globalAlpha = 1;
    }

    /* The statement: `text` tiled down the screen and drifting slowly
       sideways. Once `scale` is big enough that one copy is wider than
       the screen, the tiling stops being legible on its own and the
       words become a texture the eye reads as "too much text" — which
       is the effect being asked for. */
    function drawStatement(g, text, scale, colour, alpha) {
      if (!text || alpha <= 0) return;
      const w = Font.width(text, scale);
      const stride = w + 30;
      const drift = -((t / 26) % stride);
      g.globalAlpha = Math.min(1, alpha);
      for (let y = -2; y < h; y += Math.max(10, Math.round(stride * 0.42))) {
        for (let x = drift; x < w + stride; x += stride) {
          Font.draw(g, text, x, y, colour, scale);
        }
      }
      g.globalAlpha = 1;
    }

    return {
      cols, rows, t,
      update,
      /* a gentle breath on the whole field — one slow cycle, never a
         blink. Returns the current level so callers can ride it. */
      pulse() { return 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t / 1300)); },
      drawRain, drawStatement,
    };
  }

  return { create, CELL, GLYPHS };
})();
