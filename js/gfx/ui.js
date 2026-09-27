/* =============================================================
   UI — GBA / Fire-Emblem-style interface kit.
   9-slice-ish windows with gold pinstripes, gradients, drop
   shadows, hand-pointer menus, combat forecast, move arrow.
   All coordinates in virtual pixels (240x160).
   ============================================================= */
'use strict';

const UI = {

  /* ================= WINDOW CHROME ================= */

  /* Base dark panel with vertical gradient (the window "body"). */
  _body(g, x, y, w, h, dark) {
    const grad = g.createLinearGradient(0, y, 0, y + h);
    if (dark) {
      grad.addColorStop(0, '#1c2c50');
      grad.addColorStop(0.55, '#152344');
      grad.addColorStop(1, '#101c38');
    } else {
      grad.addColorStop(0, '#20325c');
      grad.addColorStop(0.6, '#182850');
      grad.addColorStop(1, '#121e40');
    }
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    /* subtle horizontal sheen */
    g.fillStyle = 'rgba(120,160,230,0.10)';
    g.fillRect(x, y + 2, w, 1);
    g.fillStyle = 'rgba(0,0,10,0.30)';
    g.fillRect(x, y + h - 3, w, 1);
  },

  /* Soft drop shadow under a window. */
  shadow(g, x, y, w, h) {
    g.fillStyle = 'rgba(0,0,0,0.42)';
    g.fillRect(x + 2, y + h, w, 2);
    g.fillRect(x + w, y + 2, 2, h);
    g.fillRect(x + w, y + h, 1, 1);
  },

  /* FE map window: thick ivory-gold frame, navy gradient body,
     gold pinstripe inside the frame. */
  window(g, x, y, w, h) {
    this.shadow(g, x, y, w, h);
    /* frame */
    const fr = g.createLinearGradient(0, y, 0, y + h);
    fr.addColorStop(0, '#fdfdf4');
    fr.addColorStop(0.5, '#e2ddc0');
    fr.addColorStop(1, '#c2b98e');
    g.fillStyle = fr;
    g.fillRect(x, y, w, h);
    /* outer frame bevel */
    g.fillStyle = '#f8f8f0';
    g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
    g.fillStyle = '#8e855e';
    g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
    /* body */
    this._body(g, x + 2, y + 2, w - 4, h - 4);
    /* gold pinstripe hugging the frame */
    g.fillStyle = '#c8a848';
    g.fillRect(x + 2, y + 2, w - 4, 1);
    g.fillRect(x + 2, y + 2, 1, h - 4);
    g.fillStyle = '#f0d878';
    g.fillRect(x + 3, y + 3, w - 6, 1);
  },

  /* Dialogue / status frame: bright frame, slightly airier body. */
  frame(g, x, y, w, h) {
    this.shadow(g, x, y, w, h);
    const fr = g.createLinearGradient(0, y, 0, y + h);
    fr.addColorStop(0, '#ffffff');
    fr.addColorStop(0.5, '#e8e4cc');
    fr.addColorStop(1, '#b8b090');
    g.fillStyle = fr;
    g.fillRect(x, y, w, h);
    g.fillStyle = '#8e855e';
    g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
    this._body(g, x + 2, y + 2, w - 4, h - 4, true);
    g.fillStyle = '#c8a848';
    g.fillRect(x + 2, y + 2, w - 4, 1);
    g.fillRect(x + 2, y + 2, 1, h - 4);
  },

  /* ================= BARS ================= */

  /* HP gauge with darker trough, glossy top highlight, tick marks. */
  hpBar(g, x, y, w, h, cur, max, color) {
    g.fillStyle = '#0a0f22';
    g.fillRect(x, y, w, h);
    const pct = Utils.clamp(cur / Math.max(1, max), 0, 1);
    if (pct > 0) {
      const col = color || (pct > 0.5 ? '#48c848' : pct > 0.25 ? '#e8c850' : '#e04848');
      const fw = Math.max(1, Math.round((w - 2) * pct));
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, col);
      grad.addColorStop(1, col);
      g.fillStyle = grad;
      g.fillRect(x + 1, y + 1, fw, h - 2);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x + 1, y + h - 2, fw, 1);
    }
    /* tick marks every 25% for readability */
    g.fillStyle = 'rgba(10,15,34,0.55)';
    for (let q = 1; q < 4; q++) g.fillRect(x + Math.round(w * q / 4), y + 1, 1, h - 2);
  },

  expBar(g, x, y, w, pct) {
    g.fillStyle = '#0a0f22';
    g.fillRect(x, y, w, 5);
    const pw = Math.round((w - 2) * Utils.clamp(pct, 0, 1));
    if (pw > 0) {
      const grad = g.createLinearGradient(0, y, 0, y + 5);
      grad.addColorStop(0, '#bfe4ff');
      grad.addColorStop(0.4, '#48a8f0');
      grad.addColorStop(1, '#2870c0');
      g.fillStyle = grad;
      g.fillRect(x + 1, y + 1, pw, 3);
    }
    /* animated leading sparkle */
    const t = Math.floor(performance.now() / 240) % 3;
    if (pw > 2) {
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(x + 1 + (pw - 2 > t ? pw - 2 - t : 0), y + 1, 1, 3);
    }
  },

  /* ================= CURSORS ================= */

  /* Map cursor: FE-style corner brackets + soft glow + bright tip. */
  cursor(g, x, y, t) {
    const pulse = Math.floor(t / 20) % 2;
    const s = 16, o = pulse ? 1 : 0;
    const c = '#f8f8f0', gcol = '#c8a848';
    /* glow underlay */
    g.fillStyle = 'rgba(248,216,80,0.18)';
    g.fillRect(x - 2 - o, y - 2 - o, s + 4 + o * 2, s + 4 + o * 2);
    /* gold outer, white inner — 3px corner brackets */
    const draw = (col, grow) => {
      g.fillStyle = col;
      const L = 5 + grow, e = grow;
      g.fillRect(x - e - o, y - e - o, L, 1); g.fillRect(x - e - o, y - e - o, 1, L);
      g.fillRect(x + s - L + 1 + e + o, y - e - o, L, 1); g.fillRect(x + s + e + o, y - e - o, 1, L);
      g.fillRect(x - e - o, y + s + e + o, L, 1); g.fillRect(x - e - o, y + s - L + 1 + e + o, 1, L);
      g.fillRect(x + s - L + 1 + e + o, y + s + e + o, L, 1); g.fillRect(x + s + e + o, y + s - L + 1 + e + o, 1, L);
    };
    draw(gcol, 1);
    draw(c, 0);
  },

  /* Menu selection pointer: FE-style flapping hand. */
  hand(g, x, y, t, flip) {
    const f = Math.floor(t / 14) % 2;
    const dx = flip ? -f : f;
    /* glove */
    g.fillStyle = '#f8f8f0';
    g.fillRect(x + dx, y, 4, 5);
    g.fillRect(x + 1 + dx, y - 1, 2, 1);
    g.fillRect(x - 1 + dx, y + 1, 1, 3);
    /* outline + thumb */
    g.fillStyle = '#8e855e';
    g.fillRect(x - 1 + dx, y + 4, 6, 1);
    g.fillRect(x + 3 + dx, y - 1, 1, 5);
    g.fillStyle = '#f8f8f0';
    g.fillRect(x - 1 + dx, y + 1, 1, 1);
  },

  /* ================= MENUS ================= */

  /* Vertical menu; items = [{label, disabled, color, right}].
     `right` is right-aligned text (e.g. HP numbers). */
  menu(g, x, y, w, items, sel) {
    const lineH = 12, h = items.length * lineH + 8;
    this.window(g, x, y, w, h);
    items.forEach((it, i) => {
      const yy = y + 6 + i * lineH;
      if (i === sel) {
        g.fillStyle = '#2c4a8c';
        g.fillRect(x + 3, yy - 3, w - 6, lineH - 1);
        g.fillStyle = 'rgba(200,168,72,0.30)';
        g.fillRect(x + 3, yy - 3, w - 6, 1);
        g.fillRect(x + 3, yy + lineH - 4, w - 6, 1);
        this.hand(g, x + 4, yy, performance.now());
      }
      const col = it.disabled ? '#687088' : (i === sel ? '#fff8c0' : '#e8e8d0');
      Font.draw(g, it.label, x + 13, yy, it.color || col);
      if (it.right !== undefined) {
        Font.draw(g, String(it.right), x + w - 5 - Font.width(String(it.right)), yy, i === sel ? '#a8c8ff' : '#8898b8');
      }
    });
  },

  /* ================= INFO PANELS ================= */

  /* Unit card (top-left on hover): name/class/HP/weapon with icons. */
  unitPanel(g, u, x, y) {
    const w = 72, h = 44;
    this.window(g, x, y, w, h);
    const tc = u.team === 'player' ? '#8cb0ff' : (u.team === 'enemy' ? '#ff8c8c' : '#8cf0a8');
    Font.draw(g, u.name.slice(0, 9), x + 4, y + 4, tc);
    Font.draw(g, 'LV' + u.level, x + w - 21, y + 4, '#ffe890');
    /* tiny team pip */
    g.fillStyle = tc;
    g.fillRect(x + w - 11, y + 5, 4, 4);
    g.fillStyle = '#0a0f22';
    g.fillRect(x + w - 10, y + 6, 2, 2);
    /* hp bar */
    this.hpBar(g, x + 4, y + 14, w - 8, 5, u.hp, u.maxhp);
    Font.draw(g, 'HP ' + u.hp + '/' + u.maxhp, x + 4, y + 22, '#e8e8d0');
    const cls = ClassDB[u.classId] ? ClassDB[u.classId].name : u.classId;
    Font.draw(g, cls.slice(0, 9), x + 4, y + 31, '#a8b8d8');
    const wep = u.weapon ? u.weapon.name.slice(0, 7) : '--';
    Font.draw(g, wep, x + w - 34, y + 31, '#c8d8f8');
    if (u.weapon && u.weapon.uses !== undefined) {
      Font.draw(g, String(u.weapon.uses), x + w - 9, y + 31, u.weapon.uses === 0 ? '#f07070' : '#f8d850');
    }
  },

  terrainPanel(g, terr, x, y) {
    const w = 58, h = 26;
    this.window(g, x, y, w, h);
    Font.draw(g, (terr.name || 'Plain').slice(0, 10), x + 4, y + 4, '#ffe890');
    Font.draw(g, 'DF+' + (terr.def || 0) + ' AV+' + (terr.avoid || 0), x + 4, y + 14, '#a8b8d8');
  },

  /* ================= COMBAT FORECAST (GBA-style) ================= */

  /* Two-column card: both combatants' MT/HIT/CRT + HP, with the
     weapon-triangle arrow drawn between the columns. */
  forecast(g, x, y, w, fc, atkName, defName, t) {
    const h = 54;
    this.shadow(g, x, y, w, h);
    this.frame(g, x, y, w, h);
    const colA = x + 6, colB = x + w - 6;
    const tri = fc.tri || 0;

    /* names */
    Font.draw(g, atkName.slice(0, 5), colA, y + 4, '#9ab8f8');
    Font.draw(g, defName.slice(0, 5), colB - Font.width(defName.slice(0, 5)), y + 4, '#f8a0a0');

    /* HP row */
    Font.draw(g, String(fc.aHp), colA, y + 13, '#a8f0a8');
    Font.draw(g, String(fc.dHp), colB - Font.width(String(fc.dHp)), y + 13, '#f0a8a8');
    Font.draw(g, 'HP', x + w / 2 - 5, y + 13, '#c8a848');

    /* stats rows */
    const row = (label, yy) => {
      Font.draw(g, label, x + w / 2 - Font.width(label) / 2, yy, '#c8a848');
    };
    row('MT', y + 23); row('HIT', y + 32); row('CRT', y + 41);
    const val = (v, yy, right) => {
      const s = String(v);
      Font.draw(g, s, right ? colB - Font.width(s) : colA, yy, '#f0f0d8');
    };
    val(fc.a.mt, y + 23); val(fc.a.hit, y + 32); val(fc.a.crit, y + 41);
    val(fc.d.mt, y + 23, true); val(fc.d.hit, y + 32, true); val(fc.d.crit, y + 41, true);
    /* doubling badge */
    if (fc.a.double) Font.draw(g, 'x2', colA + 10, y + 23, '#f8a050');
    if (fc.d.double) Font.draw(g, 'x2', colB - 17, y + 23, '#f8a050');

    /* weapon-triangle arrow between columns */
    const ax = x + w / 2;
    const ay = y + 48;
    if (tri !== 0) {
      const right = tri > 0;
      const dir = right ? 1 : -1;
      g.fillStyle = '#f8d850';
      /* shaft */
      g.fillRect(ax - 5, ay, 8, 1);
      g.fillRect(ax - 5, ay + 1, 8, 1);
      /* head */
      g.fillRect(ax + 3 + (right ? 0 : -2), ay, 2, 2);
      g.fillRect(ax + (right ? 5 : -5), ay + 1, 1, 1);
      /* small flutter */
      if (Math.floor(t / 16) % 2) {
        g.fillStyle = '#fff8c0';
        g.fillRect(ax + dir * 2, ay + 1, 2, 1);
      }
    }
  },

  /* ================= BANNERS ================= */

  /* toast banner (same signature as the classic banner) */
  banner(g, text, y, t, dur) {
    const w = Font.width(text) + 18;
    const x = Math.round((Config.SCREEN_W - w) / 2);
    const a = t < 8 ? t / 8 : (t > dur - 8 ? (dur - t) / 8 : 1);
    g.globalAlpha = Utils.clamp(a, 0, 1);
    this.window(g, x, y, w, 18);
    Font.drawCentered(g, text, Config.SCREEN_W / 2, y + 5, '#ffe890');
    g.globalAlpha = 1;
  },

  /* GBA phase banner: widening gold ribbon with gradient core.
     yC optionally pins the ribbon's vertical center (default: screen middle). */
  phaseBanner(g, text, col, t, dur, yC) {
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    const p = Utils.clamp(t / 12, 0, 1);           /* slide-in progress */
    const fade = Utils.clamp((dur - t) / 12, 0, 1); /* fade-out */
    const wBand = Math.round(SW * (0.6 + 0.4 * p));
    const bh = 26;
    const y = Math.round((yC === undefined ? SH / 2 : yC) - bh / 2);
    g.globalAlpha = 0.75 * Math.min(p, fade);
    g.fillStyle = 'rgba(8,10,24,0.8)';
    g.fillRect(0, y, SW, bh);
    /* gold ribbon edges */
    const bw = Math.round(wBand * Math.min(p, fade));
    const x0 = Math.round((SW - bw) / 2);
    const grad = g.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, '#2c4a8c');
    grad.addColorStop(0.5, col);
    grad.addColorStop(1, '#101c38');
    g.fillStyle = grad;
    g.fillRect(x0, y, bw, bh);
    g.fillStyle = '#c8a848';
    g.fillRect(x0, y, bw, 1);
    g.fillRect(x0, y + bh - 1, bw, 1);
    g.fillRect(x0, y, 1, bh);
    g.fillRect(x0 + bw - 1, y, 1, bh);
    g.globalAlpha = Math.min(p, fade);
    const tw = Font.width(text, 2);
    /* shadow text */
    Font.draw(g, text, Math.round((SW - tw) / 2) + 1, y + 6, '#000010', 2);
    Font.draw(g, text, Math.round((SW - tw) / 2), y + 6, col, 2);
    g.globalAlpha = 1;
  },

  /* ================= MOVE ARROW (FE-style path arrow) ================= */

  /* path = [{x,y}, ...] tile coords from unit to cursor. */
  moveArrow(g, path, T, ox, oy) {
    if (!path || path.length < 2) return;
    const seg = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const x = ox + (a.x * T + T / 2), y = oy + (a.y * T + T / 2);
      seg.push({ x, y, dx: b.x - a.x, dy: b.y - a.y });
    }
    const last = path[path.length - 1];
    const lx = ox + (last.x * T + T / 2), ly = oy + (last.y * T + T / 2);
    const pv = seg[seg.length - 1];
    seg.push({ x: lx, y: ly, dx: pv.dx, dy: pv.dy, head: true });

    const t = performance.now();
    const bob = Math.floor(t / 22) % 2;
    for (const s of seg) {
      const horiz = s.dx !== 0;
      const th = 4; /* arrow thickness */
      let cx = s.x, cy = s.y;
      if (s.head) {
        cx += (horiz ? s.dx * bob : 0);
        cy += (!horiz ? s.dy * bob : 0);
      }
      g.fillStyle = 'rgba(10,15,34,0.45)';
      if (horiz) g.fillRect(cx - T / 2 + (s.dx < 0 ? 0 : 0), cy - th / 2 + 1, T / 2, th);
      else       g.fillRect(cx - th / 2 + 1, cy - T / 2, th, T / 2);
      g.fillStyle = '#f8d850';
      if (horiz) g.fillRect(cx - T / 2, cy - th / 2, T / 2, th);
      else       g.fillRect(cx - th / 2, cy - T / 2, th, T / 2);
      g.fillStyle = '#fff8c0';
      if (horiz) g.fillRect(cx - T / 2, cy - th / 2, T / 2, 1);
      else       g.fillRect(cx - th / 2, cy - T / 2, 1, th);
      /* arrowhead */
      if (s.head) {
        g.fillStyle = '#f8d850';
        if (horiz) {
          const hx = cx + s.dx * (T / 4);
          g.fillRect(hx - 1, cy - th / 2 - 1, 3, th + 2);
          g.fillRect(hx + (s.dx > 0 ? 2 : -4), cy - th / 2, 3, th);
          g.fillRect(hx + (s.dx > 0 ? 5 : -6), cy - 1, 2, 3);
        } else {
          const hy = cy + s.dy * (T / 4);
          g.fillRect(cx - th / 2 - 1, hy - 1, th + 2, 3);
          g.fillRect(cx - th / 2, hy + (s.dy > 0 ? 2 : -4), th, 3);
          g.fillRect(cx - 1, hy + (s.dy > 0 ? 5 : -6), 3, 2);
        }
      }
    }
  },
};
