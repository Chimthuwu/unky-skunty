/* =============================================================
   MAIN — bootstrap + game loop.
   ============================================================= */
'use strict';

(function () {

  /* ---------- canvas ---------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = Config.SCREEN_W;
  canvas.height = Config.SCREEN_H;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    const pad = 8;
    const w = window.innerWidth - pad, h = window.innerHeight - pad;
    const s = Math.max(1, Math.min(Math.floor(w / Config.SCREEN_W), Math.floor(h / Config.SCREEN_H)));
    canvas.style.width = (Config.SCREEN_W * s) + 'px';
    canvas.style.height = (Config.SCREEN_H * s) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- boot ---------- */
  Game.screen = Screens.makeTitle();

  /* first user gesture unlocks audio */
  const unlock = () => { if (Audio.init()) Audio.resume(); };
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });

  /* debug toggle */
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') { e.preventDefault(); Debug.toggle(); }
  });

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(50, now - last);
    if (!isFinite(dt) || dt <= 0) dt = 16;   /* tab-restore / clock skew guard */
    last = now;
    Input.beginFrame(dt);

    try {
      Debug.update(dt);
      if (Game.state === 'chapter') {
        Game.update(dt);
        Game.draw(ctx);
      } else if (Game.screen) {
        Game.screen.update(dt);
        Game.screen.draw(ctx);
      }
      Debug.draw(ctx);
    } catch (err) {
      /* show errors on-screen instead of a black screen */
      console.error(err);
      ctx.fillStyle = '#200810';
      ctx.fillRect(0, 0, Config.SCREEN_W, Config.SCREEN_H);
      Font.draw(ctx, 'ERROR:', 8, 8, '#f07070');
      String(err.stack || err).split('\n').slice(0, 8).forEach((l, i) =>
        Font.draw(ctx, l.slice(0, 46), 8, 20 + i * 9, '#e8b0b0'));
    }

    Input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* mute hotkey */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') Audio.toggleMute();
  });
})();
