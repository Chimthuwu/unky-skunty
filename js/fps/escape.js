/* =============================================================
   ESCAPE MODE — low-res first-person raycaster, Wolfenstein/DOOM
   style. A separate mini-game bolted onto the same engine: you
   are being hunted through Uncle Scunter's compound. He cannot be
   hurt — only avoided, or lost by breaking line of sight. His
   bunnies patrol the halls and CAN be shot.
   Self-contained: only touches Config/Font/UI/Input/Audio/Assets.
   Never touches the tactics engine.
   ============================================================= */
'use strict';

const EscapeMode = (() => {

  /* ---------------- map ---------------- */
  const W = 24, H = 16;

  function buildMap() {
    const grid = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) row.push((x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 1 : 0);
      grid.push(row);
    }
    const pillars = [
      [4,4],[5,4],[4,5],[5,5],
      [14,3],[15,3],[14,4],
      [9,9],[10,9],[9,10],[10,10],
      [18,7],[18,8],[19,8],
      [6,12],[7,12],[6,13],
      [16,11],[17,11],[16,12],
      [12,5],[12,6],
      [3,9],[3,10],
      [20,3],[20,4],
    ];
    for (const [x, y] of pillars) if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 1;
    return grid;
  }

  function isWall(grid, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return true;
    return grid[iy][ix] === 1;
  }

  /* quick line-of-sight test by sampling along the segment */
  function hasLOS(grid, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 0.2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(grid, x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  /* ---------------- procedural bunny billboard ---------------- */
  let bunnyCanvas = null;
  function bunnySprite() {
    if (bunnyCanvas) return bunnyCanvas;
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const g = c.getContext('2d');
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    p(9, 2, 3, 9, '#f0d8e8'); p(14, 2, 3, 9, '#f0d8e8');
    p(10, 4, 1, 5, '#e888b0'); p(15, 4, 1, 5, '#e888b0');
    p(7, 10, 12, 10, '#f8f0f0');
    p(6, 12, 2, 6, '#f8f0f0'); p(18, 12, 2, 6, '#f8f0f0');
    p(9, 13, 2, 2, '#181818'); p(14, 13, 2, 2, '#181818');
    p(11, 16, 3, 2, '#e888b0');
    p(6, 20, 4, 3, '#e8dcdc'); p(15, 20, 4, 3, '#e8dcdc');
    bunnyCanvas = c;
    return c;
  }

  /* ---------------- factory ---------------- */
  function make() {
    const grid = buildMap();
    let px = 2.5, py = 2.5, pa = 0.4;
    const MOVE_SPD = 2.6, TURN_SPD = 2.6;
    const FOV = Math.PI / 2.6;
    const catchRadius = 0.55;
    const exitPos = { x: 21.5, y: 13.5 };

    let uncle = { x: 12.5, y: 8.5, alert: 0, lastSeenX: 12.5, lastSeenY: 8.5 };
    const UNCLE_SPD = 2.15;

    let bunnies = [
      { x: 7.5, y: 3.5, dead: false, wobble: Math.random() * 10 },
      { x: 18.5, y: 4.5, dead: false, wobble: Math.random() * 10 },
      { x: 3.5, y: 11.5, dead: false, wobble: Math.random() * 10 },
      { x: 13.5, y: 13.5, dead: false, wobble: Math.random() * 10 },
      { x: 20.5, y: 10.5, dead: false, wobble: Math.random() * 10 },
      { x: 9.5, y: 6.5, dead: false, wobble: Math.random() * 10 },
    ];

    let state = 'intro';   /* intro | playing | caught | escaped */
    let t = 0;
    let shotFlash = 0;
    let bunniesSlain = 0;
    let caughtT = 0;
    let camPlane; /* recomputed each frame from pa */

    const introLines = [
      'Somewhere in the walls, something with headphones is listening.',
      'Uncle Scunter cannot be stopped. Only outrun — or lost.',
      'His bunnies patrol the halls. They CAN be dealt with.',
      'Find the exit. Do not let him catch you.',
    ];

    function tryMove(nx, ny) {
      const r = 0.18;
      if (!isWall(grid, nx + r, py) && !isWall(grid, nx - r, py)) px = nx;
      if (!isWall(grid, px, ny + r) && !isWall(grid, px, ny - r)) py = ny;
    }

    function updateUncle(dt) {
      const dtS = dt / 1000;
      const see = hasLOS(grid, uncle.x, uncle.y, px, py);
      if (see) { uncle.alert = 2.5; uncle.lastSeenX = px; uncle.lastSeenY = py; }
      else uncle.alert = Math.max(0, uncle.alert - dtS);

      const tx = uncle.alert > 0 ? uncle.lastSeenX : uncle.lastSeenX + Math.sin(t / 900) * 2;
      const ty = uncle.alert > 0 ? uncle.lastSeenY : uncle.lastSeenY + Math.cos(t / 900) * 2;
      const dx = tx - uncle.x, dy = ty - uncle.y;
      const d = Math.hypot(dx, dy);
      const spd = (uncle.alert > 0 ? UNCLE_SPD : UNCLE_SPD * 0.45) * dtS;
      if (d > 0.15) {
        const stepx = dx / d * spd, stepy = dy / d * spd;
        const r = 0.2;
        let nx = uncle.x + stepx, ny = uncle.y + stepy;
        if (!isWall(grid, nx + r, uncle.y) && !isWall(grid, nx - r, uncle.y)) uncle.x = nx;
        if (!isWall(grid, uncle.x, ny + r) && !isWall(grid, uncle.x, ny - r)) uncle.y = ny;
      }
    }

    function updateBunnies(dt) {
      for (const b of bunnies) {
        if (b.dead) continue;
        b.wobble += dt / 1000;
        const wx = Math.sin(b.wobble * 0.7) * 0.01, wy = Math.cos(b.wobble * 0.5) * 0.01;
        const r = 0.15;
        const nx = b.x + wx, ny = b.y + wy;
        if (!isWall(grid, nx + r, b.y) && !isWall(grid, nx - r, b.y)) b.x = nx;
        if (!isWall(grid, b.x, ny + r) && !isWall(grid, b.x, ny - r)) b.y = ny;
      }
    }

    function shoot() {
      if (shotFlash > 0) return;
      shotFlash = 120;
      Audio.SFX.confirm();
      /* hitscan: nearest bunny within a narrow cone & short range */
      let best = null, bestD = 6.5;
      for (const b of bunnies) {
        if (b.dead) continue;
        const dx = b.x - px, dy = b.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist > bestD) continue;
        const ang = Math.atan2(dy, dx) - pa;
        const wrapped = Math.atan2(Math.sin(ang), Math.cos(ang));
        if (Math.abs(wrapped) < 0.16 && hasLOS(grid, px, py, b.x, b.y)) { best = b; bestD = dist; }
      }
      if (best) { best.dead = true; bunniesSlain++; Assets.playSound('doorOpen', 0.3); }
    }

    function update(dt) {
      t += dt;
      if (shotFlash > 0) shotFlash = Math.max(0, shotFlash - dt);

      if (state === 'intro') {
        if (Input.pressed('confirm') || Input.pressed('cancel')) state = 'playing';
        return;
      }
      if (state === 'caught') {
        caughtT += dt;
        if (caughtT > 400 && (Input.pressed('confirm') || Input.pressed('cancel'))) Game.screen = Screens.makeTitle();
        return;
      }
      if (state === 'escaped') {
        caughtT += dt;
        if (caughtT > 400 && (Input.pressed('confirm') || Input.pressed('cancel'))) Game.screen = Screens.makeTitle();
        return;
      }

      const dtS = Math.min(50, dt) / 1000;
      if (Input.down('left')) pa -= TURN_SPD * dtS;
      if (Input.down('right')) pa += TURN_SPD * dtS;
      if (Input.down('up')) tryMove(px + Math.cos(pa) * MOVE_SPD * dtS, py + Math.sin(pa) * MOVE_SPD * dtS);
      if (Input.down('down')) tryMove(px - Math.cos(pa) * MOVE_SPD * dtS, py - Math.sin(pa) * MOVE_SPD * dtS);
      if (Input.pressed('confirm')) shoot();

      updateUncle(dt);
      updateBunnies(dt);

      if (Math.hypot(uncle.x - px, uncle.y - py) < catchRadius) {
        state = 'caught'; caughtT = 0;
        CharArt.setImagePortrait('vosk', Assets.getImage('scunterGbGlitch'));
        Assets.playSound('openFence', 0.5);
      }
      if (Math.hypot(exitPos.x - px, exitPos.y - py) < 0.7) {
        state = 'escaped'; caughtT = 0;
      }
    }

    /* ---------------- raycast render ---------------- */
    function drawScene(g) {
      const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
      const horizon = SH / 2;
      g.fillStyle = '#1a1420'; g.fillRect(0, 0, SW, horizon);       /* ceiling */
      g.fillStyle = '#141018'; g.fillRect(0, horizon, SW, SH - horizon); /* floor */

      const zbuf = new Float32Array(SW);
      for (let col = 0; col < SW; col++) {
        const camX = (2 * col / SW) - 1;
        const rayA = pa + camX * (FOV / 2);
        const rdx = Math.cos(rayA), rdy = Math.sin(rayA);
        let mx = Math.floor(px), my = Math.floor(py);
        const deltaX = Math.abs(1 / (rdx || 1e-9)), deltaY = Math.abs(1 / (rdy || 1e-9));
        let stepX, sideX, stepY, sideY;
        if (rdx < 0) { stepX = -1; sideX = (px - mx) * deltaX; } else { stepX = 1; sideX = (mx + 1 - px) * deltaX; }
        if (rdy < 0) { stepY = -1; sideY = (py - my) * deltaY; } else { stepY = 1; sideY = (my + 1 - py) * deltaY; }
        let side = 0, hit = false, dist = 6;
        for (let i = 0; i < 64; i++) {
          if (sideX < sideY) { sideX += deltaX; mx += stepX; side = 0; }
          else { sideY += deltaY; my += stepY; side = 1; }
          if (mx < 0 || my < 0 || mx >= W || my >= H || grid[my][mx] === 1) {
            dist = side === 0 ? (mx - px + (1 - stepX) / 2) / (rdx || 1e-9) : (my - py + (1 - stepY) / 2) / (rdy || 1e-9);
            hit = true; break;
          }
        }
        dist = Math.max(0.05, dist * Math.cos(rayA - pa));
        zbuf[col] = dist;
        if (!hit) continue;
        const lineH = Math.min(SH * 2, SH / dist);
        const y0 = horizon - lineH / 2, y1 = horizon + lineH / 2;
        const shade = Math.max(0.12, 1 - dist / 9);
        const base = side === 1 ? [96, 48, 80] : [128, 64, 104];
        const col2 = `rgb(${(base[0]*shade)|0},${(base[1]*shade)|0},${(base[2]*shade)|0})`;
        g.fillStyle = col2;
        g.fillRect(col, y0, 1, y1 - y0);
      }

      /* ---- billboard sprites (bunnies + Uncle), painter's algorithm ---- */
      const sprites = [];
      for (const b of bunnies) if (!b.dead) sprites.push({ x: b.x, y: b.y, img: bunnySprite(), scale: 0.8 });
      const uImg = (Math.floor(t / 300) % 2 === 0) ? Assets.getImage('scunterMapIdle') : Assets.getImage('scunterMapWalk');
      sprites.push({ x: uncle.x, y: uncle.y, img: uImg, scale: 1.35, uncle: true });
      sprites.sort((a, b2) => Math.hypot(b2.x - px, b2.y - py) - Math.hypot(a.x - px, a.y - py));

      for (const s of sprites) {
        if (!s.img) continue;
        const dx = s.x - px, dy = s.y - py;
        const invDet = 1 / (camPlaneX * Math.sin(pa) - Math.cos(pa) * camPlaneY);
        const tx = invDet * (Math.sin(pa) * dx - Math.cos(pa) * dy);
        const ty = invDet * (-camPlaneY * dx + camPlaneX * dy);
        if (ty <= 0.1) continue;
        const screenX = Math.floor((SW / 2) * (1 + tx / ty));
        const spriteH = Math.abs(Math.floor(SH / ty * s.scale));
        const spriteW = spriteH * (s.img.width / s.img.height);
        const drawStartY = horizon - spriteH / 2, drawStartX = screenX - spriteW / 2;
        const sampleCol = Math.max(0, Math.min(SW - 1, screenX));
        if (ty > zbuf[sampleCol] + 0.15) continue; /* behind a wall */
        g.save();
        g.globalAlpha = Math.max(0.25, 1 - ty / 9);
        g.imageSmoothingEnabled = false;
        g.drawImage(s.img, drawStartX, drawStartY, spriteW, spriteH);
        g.restore();
      }

      /* muzzle flash + gun */
      if (shotFlash > 0) { g.fillStyle = 'rgba(255,220,140,' + (shotFlash / 120 * 0.5) + ')'; g.fillRect(0, 0, SW, SH); }
      g.fillStyle = '#302840';
      g.fillRect(SW / 2 - 22, SH - 26, 44, 26);
      g.fillStyle = '#4a3f60';
      g.fillRect(SW / 2 - 6, SH - 40, 12, 20);
    }

    function draw(g) {
      const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
      camPlaneX = -Math.sin(pa) * Math.tan(FOV / 2);
      camPlaneY = Math.cos(pa) * Math.tan(FOV / 2);

      if (state === 'intro') {
        g.fillStyle = '#0a0810'; g.fillRect(0, 0, SW, SH);
        Font.drawCentered(g, 'ESCAPE THE UNCLE', SW / 2, 20, '#e88090', 2);
        const idx = Math.min(introLines.length - 1, Math.floor(t / 1800));
        introLines.slice(0, idx + 1).forEach((line, i) => {
          let yy = 50 + i * 22, xx = 12;
          const words = line.split(' '); let cur = '';
          for (const w of words) {
            const test = cur ? cur + ' ' + w : w;
            if (Font.width(test) > SW - 24) { Font.draw(g, cur, xx, yy, '#c8b8d8'); cur = w; yy += 9; }
            else cur = test;
          }
          if (cur) Font.draw(g, cur, xx, yy, '#c8b8d8');
        });
        if (idx >= introLines.length - 1) Font.drawCentered(g, 'Z / ENTER TO BEGIN', SW / 2, SH - 14, '#e8c850');
        return;
      }

      drawScene(g);

      /* HUD */
      UI.window ? null : null;
      g.fillStyle = 'rgba(10,8,16,0.55)';
      g.fillRect(0, SH - 12, SW, 12);
      Font.draw(g, 'BUNNIES: ' + bunniesSlain, 4, SH - 9, '#e8b0c8');
      Font.draw(g, uncle.alert > 0 ? 'HE SEES YOU' : 'quiet...', SW - 90, SH - 9, uncle.alert > 0 ? '#f86060' : '#607080');

      if (state === 'caught') {
        g.fillStyle = 'rgba(30,0,4,0.55)'; g.fillRect(0, 0, SW, SH);
        const img = Assets.getImage('scunterGbGlitch');
        if (img) {
          const s = Math.min(SW / img.width, SH / img.height) * 1.6;
          g.imageSmoothingEnabled = false;
          g.drawImage(img, (SW - img.width * s) / 2, (SH - img.height * s) / 2, img.width * s, img.height * s);
        }
        Font.drawCentered(g, 'HE GOT YOU', SW / 2, 12, '#f86060', 2);
        if (caughtT > 400) Font.drawCentered(g, 'Z / X TO RETURN TO TITLE', SW / 2, SH - 12, '#e8c850');
      } else if (state === 'escaped') {
        g.fillStyle = 'rgba(6,20,10,0.5)'; g.fillRect(0, 0, SW, SH);
        Font.drawCentered(g, 'YOU MADE IT OUT', SW / 2, SH / 2 - 10, '#a0e8b0', 2);
        Font.drawCentered(g, 'bunnies dealt with: ' + bunniesSlain, SW / 2, SH / 2 + 10, '#c8d8c8');
        if (caughtT > 400) Font.drawCentered(g, 'Z / X TO RETURN TO TITLE', SW / 2, SH - 12, '#e8c850');
      }
    }

    let camPlaneX = 0, camPlaneY = 0;
    return { name: 'escape', update, draw };
  }

  return { make };
})();
