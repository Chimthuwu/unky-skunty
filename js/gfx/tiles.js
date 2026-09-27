/* =============================================================
   TILE ART — procedural original 16x16 terrain tiles, cached.
   Dithered light, per-tile hash variation, animated water.
   ============================================================= */
'use strict';

const TileArt = (() => {

  const cache = new Map();

  function cv() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    return c;
  }

  /* tiny hash for tile-variant variation: stable, cheap, no allocation */
  function hash(id) {
    let s = 0;
    for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) & 0x7fffffff;
    return s;
  }

  function rng(seed) {
    let s = (seed | 0) || 1;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return (s >>> 8) / 0x800000;
    };
  }

  /* ordered-dither checkerboard fill */
  function dither(g, x, y, w, h, a, b, off) {
    const o = ((off | 0) % 2 + 2) % 2;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        g.fillStyle = ((x + xx + y + yy + o) & 1) ? a : b;
        g.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }

  function noise(g, seed, n, col, w, h) {
    let s = seed;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      g.fillStyle = col;
      g.fillRect(s % 16, (s >> 5) % 16, w || 1, h || 1);
    }
  }

  /* vertical ramp: several fillRects, no gradients needed */
  function ramp(g, x, y, w, h, c0, c1, steps) {
    steps = steps || 4;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      g.fillStyle = t < 0.5 ? c0 : c1;
      g.fillRect(x, y + Math.floor(i * h / steps), w, Math.ceil(h / steps));
    }
  }

  /* soft inner vignette: darken tile edges so the grid reads */
  function edge(g, a) {
    g.fillStyle = a;
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
    g.fillRect(15, 0, 1, 16); g.fillRect(0, 15, 16, 1);
  }

  function drawTile(g, id, frame) {
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const v = hash(id) % 1000;          /* per-tile variation seed */
    const R = rng(v);
    const f = frame || 0;               /* animation frame */

    switch (id) {
      case 'plain': {
        ramp(g, 0, 0, 16, 16, '#82aa50', '#78a048', 4);
        noise(g, 7, 12, '#8cb45c');
        noise(g, 13, 7, '#689038');
        dither(g, 0, 8, 16, 8, '#78a048', '#6e963e', 0);
        /* grass tufts */
        for (let i = 0; i < 3; i++) {
          const tx = 1 + Math.floor(R() * 14), ty = 2 + Math.floor(R() * 12);
          p(tx, ty, 1, 2, '#94bc64'); p(tx + 1, ty + 1, 1, 1, '#5c8434');
        }
        edge(g, 'rgba(64,92,40,0.25)');
        break;
      }
      case 'road': {
        ramp(g, 0, 0, 16, 16, '#d0ba92', '#c2ac80', 4);
        noise(g, 21, 10, '#dcc89e');
        noise(g, 33, 8, '#ac9464');
        /* cobble speckles */
        for (let i = 0; i < 4; i++) {
          const tx = Math.floor(R() * 14), ty = Math.floor(R() * 14);
          p(tx, ty, 2, 1, '#b8a074');
        }
        edge(g, 'rgba(150,130,90,0.30)');
        break;
      }
      case 'forest': {
        p(0, 0, 16, 16, '#6e963e');
        dither(g, 0, 6, 16, 10, '#6e963e', '#628a36', 0);
        /* canopy blobs with light side */
        p(2, 3, 12, 9, '#3a6838');
        p(4, 1, 8, 4, '#3a6838');
        p(3, 4, 10, 4, '#457840');
        p(4, 5, 3, 3, '#4f8a48'); p(9, 6, 3, 3, '#4f8a48');
        p(7, 0, 2, 2, '#54944c');
        p(5, 7, 2, 2, '#2c5028'); p(10, 9, 2, 1, '#2c5028');
        /* trunk + shadow */
        p(3, 12, 10, 2, '#4a3a24');
        p(4, 14, 8, 1, 'rgba(30,50,20,0.4)');
        /* highlights */
        p(6, 4, 1, 1, '#68a860'); p(11, 7, 1, 1, '#68a860');
        edge(g, 'rgba(40,64,28,0.35)');
        break;
      }
      case 'thicket': {
        p(0, 0, 16, 16, '#5a8838');
        dither(g, 0, 0, 16, 16, '#5a8838', '#4e7a30', 1);
        for (let i = 0; i < 6; i++) p(1 + (i * 3) % 12, 2 + (i * 5) % 11, 3, 3, '#3a6838');
        noise(g, 99, 9, '#2c5028');
        p(4, 4, 1, 1, '#6ca458'); p(11, 9, 1, 1, '#6ca458');
        edge(g, 'rgba(34,58,24,0.40)');
        break;
      }
      case 'mountain': {
        ramp(g, 0, 0, 16, 16, '#907f60', '#83745a', 3);
        p(1, 9, 14, 7, '#6a5a40');
        dither(g, 1, 9, 14, 7, '#6a5a40', '#5e5038', 0);
        p(4, 3, 8, 6, '#989078');
        p(6, 0, 4, 4, '#c8c8c0');
        p(7, 1, 2, 2, '#e8e8e0');
        /* crag shading */
        p(3, 5, 3, 3, '#786848'); p(10, 6, 3, 3, '#786848');
        p(5, 6, 2, 1, '#a89c80'); p(11, 11, 2, 1, '#7c6c50');
        /* scree */
        for (let i = 0; i < 4; i++) p(Math.floor(R() * 14), 11 + Math.floor(R() * 4), 1, 1, '#b0a888');
        edge(g, 'rgba(70,58,40,0.35)');
        break;
      }
      case 'peak': {
        ramp(g, 0, 0, 16, 16, '#a89f84', '#989078', 3);
        p(2, 10, 12, 6, '#787060');
        dither(g, 2, 10, 12, 6, '#787060', '#6c6454', 1);
        p(5, 2, 6, 6, '#d8d8d0');
        p(6, 3, 3, 3, '#f0f0e8');
        p(7, 0, 2, 3, '#ffffff');
        p(4, 8, 3, 2, '#b8b4a0');
        edge(g, 'rgba(80,74,58,0.35)');
        break;
      }
      case 'water': {
        /* two-frame drift */
        const o = f % 2;
        ramp(g, 0, 0, 16, 16, '#3868a8', '#2f5a98', 3);
        dither(g, 0, 4, 16, 12, '#3868a8', '#32629e', o);
        /* wave bands */
        p((2 + o * 3) % 14, 3, 5, 1, '#5888c8'); p((9 - o * 2 + 14) % 14, 6, 5, 1, '#5888c8');
        p((4 - o * 2 + 14) % 14, 11, 5, 1, '#5888c8'); p((11 + o) % 14, 13, 4, 1, '#284878');
        /* glints */
        p(3 + o, 8, 2, 1, '#8cb8e0'); p(12 - o, 2, 1, 1, '#8cb8e0');
        edge(g, 'rgba(16,34,64,0.35)');
        break;
      }
      case 'river': {
        const o = f % 2;
        ramp(g, 0, 0, 16, 16, '#4c7ec0', '#4272b2', 3);
        dither(g, 0, 2, 16, 14, '#4c7ec0', '#4577b6', o);
        p(1 + o, 2, 6, 1, '#6888c8'); p(8 - o, 5, 6, 1, '#6888c8');
        p(3 - o, 9, 6, 1, '#6888c8'); p(10 + o, 12, 5, 1, '#3858a0');
        p(6 + o, 7, 2, 1, '#9cc0e4'); p(13 - o, 3, 1, 1, '#9cc0e4');
        edge(g, 'rgba(20,40,72,0.35)');
        break;
      }
      case 'bridge': {
        ramp(g, 0, 0, 16, 16, '#b08854', '#a8804c', 3);
        for (let i = 0; i < 4; i++) p(0, i * 4, 16, 1, '#88683c');
        for (let i = 0; i < 4; i++) dither(g, 0, i * 4 + 1, 16, 3, '#a8804c', '#a07a48', i);
        p(1, 1, 2, 2, '#c8a068'); p(11, 9, 2, 2, '#c8a068');
        /* plank nails */
        p(4, 2, 1, 1, '#7c5c34'); p(9, 6, 1, 1, '#7c5c34'); p(13, 10, 1, 1, '#7c5c34');
        edge(g, 'rgba(90,66,36,0.35)');
        break;
      }
      case 'wall': {
        ramp(g, 0, 0, 16, 16, '#808088', '#787880', 2);
        p(0, 0, 16, 1, '#9a9aa4');
        for (let r = 0; r < 4; r++) {
          p(0, r * 4 + 3, 16, 1, '#585860');
          for (let c = 0; c < 3; c++) p(((r % 2) * 4 + c * 6 + 2) % 16, r * 4, 1, 3, '#585860');
        }
        /* per-brick top light */
        for (let r = 0; r < 4; r++) {
          const off2 = (r % 2) * 4;
          p(off2 + 1, r * 4, 3, 1, '#8c8c96'); p(off2 + 7, r * 4, 3, 1, '#8c8c96'); p(off2 + 13, r * 4, 3, 1, '#8c8c96');
        }
        noise(g, v, 4, '#6c6c76');
        edge(g, 'rgba(40,40,48,0.40)');
        break;
      }
      case 'pillar': {
        ramp(g, 0, 0, 16, 16, '#907e6e', '#887868', 2);
        p(3, 1, 10, 14, '#c8c0b0');
        p(4, 2, 2, 12, '#e0d8c8');
        p(3, 0, 10, 2, '#e0d8c8');
        /* fluting + base */
        p(7, 2, 1, 12, '#b0a890');
        p(10, 2, 1, 12, '#b0a890');
        p(3, 13, 10, 2, '#a09880');
        p(2, 15, 12, 1, 'rgba(40,32,24,0.4)');
        edge(g, 'rgba(60,52,44,0.35)');
        break;
      }
      case 'floor': {
        ramp(g, 0, 0, 16, 16, '#b0a07e', '#a89878', 2);
        p(0, 7, 16, 1, '#907f60'); p(7, 0, 1, 16, '#907f60');
        dither(g, 0, 8, 7, 7, '#a89878', '#a09070', 0);
        dither(g, 8, 0, 7, 7, '#a89878', '#a09070', 1);
        noise(g, 5, 4, '#bcb08e');
        edge(g, 'rgba(110,95,70,0.30)');
        break;
      }
      case 'carpet': {
        ramp(g, 0, 0, 16, 16, '#a84040', '#9c3636', 2);
        p(0, 0, 16, 1, '#c85858'); p(0, 15, 16, 1, '#782828');
        p(7, 0, 1, 16, '#c85858'); p(0, 7, 16, 1, '#c85858');
        /* woven pattern */
        p(2, 2, 2, 2, '#b04a4a'); p(12, 2, 2, 2, '#b04a4a');
        p(2, 12, 2, 2, '#b04a4a'); p(12, 12, 2, 2, '#b04a4a');
        dither(g, 6, 6, 4, 4, '#c8a050', '#d8b060', 0);
        edge(g, 'rgba(90,20,20,0.35)');
        break;
      }
      case 'throne': {
        ramp(g, 0, 0, 16, 16, '#a84040', '#9c3636', 2);
        p(2, 0, 12, 16, '#886028');
        p(4, 1, 8, 13, '#c8a050');
        dither(g, 4, 5, 8, 8, '#c8a050', '#bd9648', 0);
        p(5, 2, 6, 3, '#e8c850');
        p(6, 3, 4, 1, '#ffe880');
        p(4, 8, 8, 1, '#886028');
        p(6, 10, 4, 3, '#e8c850');
        p(7, 11, 2, 1, '#fff4a8');
        p(2, 0, 1, 16, '#6a4c1e'); p(13, 0, 1, 16, '#6a4c1e');
        edge(g, 'rgba(80,24,24,0.35)');
        break;
      }
      case 'fort': {
        ramp(g, 0, 0, 16, 16, '#7ca44c', '#78a048', 2);
        ramp(g, 1, 3, 14, 12, '#9a9a9a', '#909090', 2);
        p(2, 1, 3, 2, '#9a9a9a'); p(7, 1, 3, 2, '#9a9a9a'); p(12, 1, 3, 2, '#9a9a9a');
        p(2, 3, 1, 11, '#a4a4a4');
        p(3, 6, 4, 4, '#585858');
        p(4, 7, 2, 3, '#484848');
        p(10, 6, 4, 9, '#a8a8a8');
        p(11, 7, 2, 7, '#b4b4b4');
        /* grass overgrowth */
        noise(g, v, 5, '#688c40');
        p(0, 14, 16, 2, '#68803e');
        edge(g, 'rgba(56,76,36,0.35)');
        break;
      }
      case 'gate': {
        ramp(g, 0, 0, 16, 16, '#b0a07e', '#a89878', 2);
        ramp(g, 2, 2, 12, 12, '#d0b058', '#c8a050', 2);
        p(4, 4, 8, 8, '#e8d890');
        dither(g, 5, 5, 6, 6, '#e8d890', '#dfcd84', 0);
        /* rune glint (animated) */
        if (f % 2) p(7, 6, 2, 1, '#fff8c8');
        p(2, 2, 12, 1, '#e0c068'); p(2, 13, 12, 1, '#a88840');
        edge(g, 'rgba(110,95,70,0.35)');
        break;
      }
      case 'house': {
        p(0, 0, 16, 16, '#78a048');
        noise(g, 3, 4, '#688c38');
        /* roof with shingle rows */
        p(1, 2, 14, 7, '#b04830');
        p(1, 2, 14, 1, '#d86848');
        p(2, 4, 12, 1, '#9c3c28');
        p(2, 6, 12, 1, '#9c3c28');
        p(3, 3, 4, 1, '#c25838'); p(9, 5, 4, 1, '#c25838');
        p(0, 4, 2, 6, '#b04830'); p(14, 4, 2, 6, '#b04830');
        /* wall + timber */
        ramp(g, 2, 9, 12, 6, '#d0c098', '#c8b088', 2);
        p(2, 9, 12, 1, '#88704c');
        p(6, 10, 4, 5, '#684828');
        p(7, 10, 1, 1, '#e8c850');               /* door handle */
        p(11, 10, 2, 2, '#4878b8'); p(11, 10, 1, 1, '#78a8d8');  /* window + shine */
        edge(g, 'rgba(56,76,36,0.30)');
        break;
      }
      case 'village': {
        p(0, 0, 16, 16, '#78a048');
        noise(g, 9, 4, '#688c38');
        /* house with thatched roof */
        p(1, 3, 10, 6, '#c88848');
        p(1, 3, 10, 1, '#dfa05c');
        p(2, 5, 8, 1, '#b07438');
        p(0, 5, 2, 4, '#c88848'); p(11, 5, 2, 4, '#c88848');
        p(2, 9, 8, 5, '#d8c8a0');
        p(5, 10, 3, 4, '#785838');
        p(6, 10, 1, 1, '#e8c850');
        /* tree */
        p(11, 8, 4, 4, '#48803c');
        p(12, 7, 2, 2, '#589848');
        p(12, 12, 1, 2, '#5a4a30');
        p(12, 9, 1, 1, '#6cb45c');
        edge(g, 'rgba(56,76,36,0.30)');
        break;
      }
      case 'ruined': {
        p(0, 0, 16, 16, '#78a048');
        dither(g, 0, 4, 16, 12, '#78a048', '#6e963e', 1);
        p(2, 6, 5, 8, '#909088');
        p(3, 7, 2, 7, '#a09a92');
        p(9, 9, 5, 5, '#a09888');
        p(10, 10, 2, 3, '#aca69a');
        /* broken tops */
        p(2, 5, 2, 1, '#847f76'); p(10, 8, 3, 1, '#847f76');
        noise(g, 42, 7, '#687858');
        noise(g, 77, 3, '#54704a');
        edge(g, 'rgba(52,70,40,0.32)');
        break;
      }
      case 'chest': {
        p(0, 0, 16, 16, '#887050');
        /* wood-grain ground */
        dither(g, 0, 4, 16, 12, '#887050', '#806848', 0);
        p(2, 4, 12, 9, '#a06838');
        ramp(g, 2, 4, 12, 3, '#c89050', '#c08848', 2);
        p(2, 8, 12, 1, '#684828');
        p(7, 7, 2, 3, '#e8c850');
        p(7, 7, 1, 1, '#fff4a8');
        /* metal bands */
        p(2, 4, 1, 9, '#684828'); p(13, 4, 1, 9, '#684828');
        p(4, 4, 1, 9, '#8a5c30'); p(11, 4, 1, 9, '#8a5c30');
        p(3, 12, 10, 1, '#583c20');               /* drop shadow */
        edge(g, 'rgba(70,54,36,0.30)');
        break;
      }
      case 'chestOpen': {
        p(0, 0, 16, 16, '#887050');
        dither(g, 0, 4, 16, 12, '#887050', '#806848', 1);
        p(2, 4, 12, 9, '#a06838');
        p(2, 2, 12, 3, '#c08848');                /* lid up */
        p(3, 3, 10, 1, '#d89c58');
        p(3, 8, 10, 4, '#3a2818');                /* empty inside */
        p(4, 8, 8, 1, '#4a3424');
        p(2, 8, 12, 1, '#684828');
        p(2, 4, 1, 9, '#684828'); p(13, 4, 1, 9, '#684828');
        edge(g, 'rgba(70,54,36,0.30)');
        break;
      }
      case 'door': {
        ramp(g, 0, 0, 16, 16, '#888890', '#808088', 2);
        p(2, 1, 12, 15, '#785838');
        p(3, 2, 4, 13, '#8a6848');
        p(8, 2, 5, 13, '#8a6848');
        p(4, 2, 2, 13, '#9a7858');                /* light grain */
        dither(g, 8, 2, 5, 13, '#8a6848', '#805e40', 0);
        p(7, 1, 1, 14, '#584028');
        p(12, 8, 1, 1, '#e8c850'); p(12, 8, 1, 1, '#fff4a8');
        /* frame highlight */
        p(1, 0, 14, 1, '#a0a0a8');
        edge(g, 'rgba(50,50,58,0.40)');
        break;
      }
      case 'doorOpen': {
        ramp(g, 0, 0, 16, 16, '#888890', '#808088', 2);
        p(2, 1, 12, 15, '#3a3028');
        p(2, 1, 12, 1, '#181818');
        p(3, 3, 4, 13, '#282018');
        p(9, 3, 4, 13, '#241c14');
        /* faint light from within */
        p(4, 2, 8, 1, '#4a4034');
        edge(g, 'rgba(50,50,58,0.40)');
        break;
      }
      case 'rubble': {
        ramp(g, 0, 0, 16, 16, '#907e6e', '#887868', 2);
        p(2, 8, 5, 4, '#a89888');
        p(3, 9, 2, 2, '#b8a898');
        p(8, 6, 5, 5, '#989078');
        p(9, 7, 2, 2, '#a89c88');
        p(5, 12, 6, 3, '#786858');
        noise(g, 77, 6, '#b0a898');
        noise(g, 41, 4, '#68584a');
        edge(g, 'rgba(60,52,44,0.32)');
        break;
      }
      default: /* fallback */
        p(0, 0, 16, 16, '#c040c0');
        p(2, 2, 12, 12, '#803080');
    }
  }

  function tile(id, frame) {
    const key = id + '|' + (frame || 0);
    if (cache.has(key)) return cache.get(key);
    const c = cv();
    drawTile(c.getContext('2d'), id, frame);
    cache.set(key, c);
    return c;
  }

  return { tile, FRAMES: 2 };
})();
