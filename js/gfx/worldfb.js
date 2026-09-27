/* =============================================================
   WORLD FRAMEBUFFER — the raycaster's world pass, in pixels.

   This exists because of a performance cliff. The world used to be
   drawn with the 2D context directly: one drawImage per floor run
   (a few hundred a frame), up to four per wall column, plus a
   fillRect per column to lay the distance fog over the top. That
   came to roughly 1900 canvas calls a frame for a 240x160 image —
   about 115,000 a second — and the frame budget went with it. The
   arithmetic was never the problem; the per-call overhead was.

   So the world is composited here instead, into a plain pixel
   buffer, and handed to the canvas once per frame with a single
   putImageData. Same pixels, one call. The world is a fixed
   240x160, so this is a rounding error of memory and a very cheap
   pass over ~38k pixels.

   Sprites, the HUD and the overlays still go through the normal
   context: they need alpha blending and scaling, there are only a
   handful of them, and they must land *on top* of this buffer.

   The look is deliberately unchanged from the canvas version — same
   fog colour, same falloff, same darkening on the N/S faces. The
   one intentional difference is the wall texture's vertical axis,
   which is now mapped properly per pixel instead of being squashed
   into a slice and repeated down the column; at these distances
   the repetition was visible as banding on tall walls.
   ============================================================= */
'use strict';

const WorldFB = (() => {

  /* the colour distance falls off toward. Matches the rgba(10,6,14)
     the canvas version filled over everything. */
  const FOG_R = 10, FOG_G = 6, FOG_B = 14;
  const FOG_SPAN = 9;        /* fully fogged at this distance */
  const FOG_FLOOR = 0.12;    /* ...but never past this much light */

  /* Pixel data for a tile canvas, read once and kept. Tiles are
     16x16 and there are a handful of distinct ones, so this is a
     few kilobytes for the whole set. Keyed by the canvas itself so
     two cells sharing a tile share the copy. */
  const tileCache = new WeakMap();

  function tileData(canvas) {
    let d = tileCache.get(canvas);
    if (d !== undefined) return d;
    try {
      const src = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      d = { w: src.width, h: src.height, px: new Uint32Array(src.data.buffer.slice(0)) };
    } catch (e) {
      /* No pixel access (tainted or stubbed context): fall back to a
         flat mid-grey so the world still renders, just untextured. */
      d = null;
    }
    tileCache.set(canvas, d);
    return d;
  }

  function create(width, height) {
    const img = new ImageData(width, height);
    const px = new Uint32Array(img.data.buffer);
    const rayDirX = new Float64Array(width);
    const rayDirY = new Float64Array(width);
    const zbuf = new Float32Array(width);

    /* one sky row's worth of pixels, reused for the whole band */
    const row = new Uint32Array(width);

    /* How far the current frame is bleached out, 0..1. Applied while
       each pixel is being composed rather than as a context filter, so
       it costs nothing extra and — more to the point — it cannot
       multiply the cost of every draw call in the frame, which is what
       ctx.filter used to do. */
    let drain = 0;

    function desaturate(c) {
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const nr = (r + (lum - r) * drain) | 0;
      const ng = (g + (lum - g) * drain) | 0;
      const nb = (b + (lum - b) * drain) | 0;
      return 0xFF000000 | (nb << 16) | (ng << 8) | nr;
    }

    /* Compose one texel: fog it toward the fog colour, then bleach it
       if a drain is running. The fog amount is uniform along a floor
       row and down a wall column, so this is called once per run or
       once per column rather than once per pixel wherever possible. */
    function shade(texel, fogAmt) {
      if (fogAmt > 0) {
        const r = texel & 255, g = (texel >> 8) & 255, b = (texel >> 16) & 255;
        texel = 0xFF000000 |
          (((b + (FOG_B - b) * fogAmt) | 0) << 16) |
          (((g + (FOG_G - g) * fogAmt) | 0) << 8) |
          ((r + (FOG_R - r) * fogAmt) | 0);
      }
      return drain > 0 ? desaturate(texel) : texel;
    }

    /* fog amount for a given distance — the same curve the canvas
       version used for its per-column overlay fills */
    function fogAmount(dist) {
      const s = Math.max(FOG_FLOOR, 1 - dist / FOG_SPAN);
      const a = 1 - s;
      return a > 0 ? (a > 1 ? 1 : a) : 0;
    }

    function render(o) {
      const W = o.W, H = o.H, grid = o.grid, horizon = height / 2;
      const px0 = o.px, py0 = o.py, pa = o.pa, FOV = o.FOV;
      drain = o.drain || 0;

      /* ---- sky ----
         A vertical gradient, computed once per row and splatted
         across the row. The canvas version allocated a CanvasGradient
         every frame to do the same thing. The horizon row itself is
         included: the ground pass starts one row below it, and leaving
         that single row unpainted leaves a transparent seam right down
         the middle of the screen. */
      const skyTopR = 0x12, skyTopG = 0x0c, skyTopB = 0x18;
      const skyBotR = 0x3a, skyBotG = 0x20, skyBotB = 0x28;
      for (let y = 0; y <= horizon; y++) {
        const t = horizon > 1 ? y / (horizon - 1) : 0;
        const c = 0xFF000000 |
          (((skyBotB + (skyTopB - skyBotB) * t) | 0) << 16) |
          (((skyBotG + (skyTopG - skyBotG) * t) | 0) << 8) |
          ((skyBotR + (skyTopR - skyBotR) * t) | 0);
        const v = drain > 0 ? desaturate(c) : c;
        row.fill(v);
        px.set(row, y * width);
      }

      /* ---- per-column ray directions ----
         Shared by the ground and wall passes, computed once. */
      for (let col = 0; col < width; col++) {
        const a = pa + ((2 * col / width) - 1) * (FOV / 2);
        rayDirX[col] = Math.cos(a);
        rayDirY[col] = Math.sin(a);
      }

      /* ---- ground ----
         Same casting as before: for a given screen row the distance
         is fixed, so walking across the row steps through floor cells.
         The colour only changes when the texel under the ray does, so
         it is recomputed on those columns and reused for the rest —
         one texel fetch per change rather than one per pixel. */
      const floorTiles = o.floorTiles;
      for (let y = horizon + 1; y < height; y++) {
        const rowDist = (0.5 * height) / (y - horizon);
        const fAmt = fogAmount(rowDist);
        const base = y * width;
        /* off the map, or a wall the ground pass ran under: just fog,
           which is what those pixels read as before the overlay fill
           went over them anyway */
        const fogCol = shade(0xFF000000, fAmt);
        let cur = fogCol;
        let lastTile = null, lastTX = -1, lastTY = -1;

        for (let col = 0; col < width; col++) {
          const fx = px0 + rowDist * rayDirX[col];
          const fy = py0 + rowDist * rayDirY[col];
          const cx = Math.floor(fx), cy = Math.floor(fy);
          let tile = null;
          if (cx >= 0 && cy >= 0 && cx < W && cy < H) tile = floorTiles[cy][cx];
          if (tile !== lastTile) { lastTile = tile; lastTX = -1; lastTY = -1; }
          if (tile) {
            const tX = Math.min(tile.width - 1, ((fx - cx) * tile.width) | 0);
            const tY = Math.min(tile.height - 1, ((fy - cy) * tile.height) | 0);
            if (tX !== lastTX || tY !== lastTY) {
              lastTX = tX; lastTY = tY;
              const td = tileData(tile);
              cur = td ? shade(td.px[tY * td.w + tX], fAmt) : fogCol;
            }
          } else {
            cur = fogCol;
          }
          px[base + col] = cur;
        }
      }

      /* ---- walls ----
         Per column: one DDA, then the face is written top to bottom
         with the texture mapped along its height and the fog laid
         over it. This is the only genuinely per-pixel loop in the
         renderer, and it is bounded by the wall's screen height
         rather than the whole frame. */
      const wallTiles = o.wallTiles;
      for (let col = 0; col < width; col++) {
        const rdx = rayDirX[col], rdy = rayDirY[col];
        const rayA = Math.atan2(rdy, rdx);
        let mx = Math.floor(px0), my = Math.floor(py0);
        const deltaX = Math.abs(1 / (rdx || 1e-9)), deltaY = Math.abs(1 / (rdy || 1e-9));
        let stepX, sideX, stepY, sideY;
        if (rdx < 0) { stepX = -1; sideX = (px0 - mx) * deltaX; } else { stepX = 1; sideX = (mx + 1 - px0) * deltaX; }
        if (rdy < 0) { stepY = -1; sideY = (py0 - my) * deltaY; } else { stepY = 1; sideY = (my + 1 - py0) * deltaY; }
        let side = 0, hit = false, dist = 6;
        for (let i = 0; i < 64; i++) {
          if (sideX < sideY) { sideX += deltaX; mx += stepX; side = 0; }
          else { sideY += deltaY; my += stepY; side = 1; }
          if (mx < 0 || my < 0 || mx >= W || my >= H || grid[my][mx] === 1) {
            dist = side === 0 ? (mx - px0 + (1 - stepX) / 2) / (rdx || 1e-9) : (my - py0 + (1 - stepY) / 2) / (rdy || 1e-9);
            hit = true; break;
          }
        }
        if (!hit) { zbuf[col] = dist; continue; }

        /* perpendicular distance for the texture lookup, screen-corrected
           for the height — the fisheye correction is for placement only */
        const perp = dist;
        const corr = Math.max(0.05, dist * Math.cos(rayA - pa));
        zbuf[col] = corr;

        const lineH = Math.min(height * 3, height / corr);
        const yBot = Math.min(height, horizon + lineH / 2);
        const yTop = Math.max(0, height - yBot);
        const fAmt = fogAmount(corr);
        /* a touch of extra darkening on the N/S faces so corners read */
        const fAmtSide = side === 1 ? Math.min(1, fAmt + 0.18) : fAmt;

        const tex = (mx >= 0 && my >= 0 && mx < W && my < H) ? wallTiles[my][mx] : null;
        const base = side === 1 ? [96, 48, 80] : [128, 64, 104];
        if (!tex) {
          /* flat-shaded stand-in, so the world stays readable even if the
             tile art somehow isn't available */
          const s = Math.max(FOG_FLOOR, 1 - corr / FOG_SPAN);
          const c = shade(0xFF000000 | ((base[2] * s) | 0) << 16 | ((base[1] * s) | 0) << 8 | ((base[0] * s) | 0), fAmt);
          for (let y = yTop; y < yBot; y++) px[y * width + col] = c;
          continue;
        }

        const td = tileData(tex);
        let wallX = side === 0 ? (py0 + perp * rdy) : (px0 + perp * rdx);
        wallX -= Math.floor(wallX);
        const texX = Math.min(td.w - 1, (wallX * td.w) | 0);
        const span = yBot - yTop;
        for (let y = yTop; y < yBot; y++) {
          /* 0 at the base of the wall, 1 at the top */
          const v = span > 1 ? (yBot - 1 - y) / (span - 1) : 1;
          const texY = Math.min(td.h - 1, (v * td.h) | 0);
          px[y * width + col] = shade(td.px[texY * td.w + texX], fAmtSide);
        }
      }
    }

    return {
      width, height, zbuf,
      /* draw order matters: present() wipes the region it writes, so it
         has to happen before anything else touches the canvas */
      render,
      present(g) { g.putImageData(img, 0, 0); },
    };
  }

  return { create };
})();
