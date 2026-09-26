/* =============================================================
   EMBERWRATH CHRONICLE — core utilities
   ============================================================= */
'use strict';

const Utils = {
  /* integers */
  ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  /* clamp value into [a,b] */
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },

  /* GBA-style single-roll percent */
  roll(pct) { return Math.random() * 100 < pct; },

  /* GBA two-RN hit roll (hit rates above ~50 are more accurate than raw %) */
  roll2(pct) {
    const a = Math.random() * 100, b = Math.random() * 100;
    return ((a + b) / 2) < pct;
  },

  /* manhattan distance */
  dist(x1, y1, x2, y2) { return Math.abs(x1 - x2) + Math.abs(y1 - y2); },

  /* direction enum step */
  DIRS: { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] },

  /* deep-ish clone for plain data (stats, inventory snapshots) */
  clone(o) { return JSON.parse(JSON.stringify(o)); },

  /* deterministic-ish string id helper */
  slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); },

  /* format small numbers with padding for HUD */
  pad(n, len = 2) { return String(n).padStart(len, '0'); },
};
