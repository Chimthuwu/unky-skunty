/* =============================================================
   FEVER — the "hell remix" layer. Purely additive: draws glitch
   noise, chromatic jitter and occasional intrusive flashes of
   real found-footage-style images on top of the normal
   procedural game render. Never touches game logic.
   ============================================================= */
'use strict';

const Fever = (() => {
  let t = 0;
  let nextIntrusion = 3000 + Math.random() * 4000;
  let intrusion = null;   /* { key, life, x, y } */
  let scratch = null;

  const INTRUSION_KEYS = [
    'intrusionSlime', 'intrusionTrain', 'intrusionStation',
    'intrusionDoor1', 'intrusionDoor2', 'intrusionWhite', 'intrusionPlayer',
    'scunterHurt',
  ];

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function update(dt) {
    t += dt;
    if (intrusion) {
      intrusion.life -= dt;
      if (intrusion.life <= 0) intrusion = null;
    } else {
      nextIntrusion -= dt;
      if (nextIntrusion <= 0) {
        const key = pick(INTRUSION_KEYS);
        if (Assets.getImage(key)) {
          intrusion = {
            key,
            life: 90 + Math.random() * 160,
            x: Math.random() * Config.SCREEN_W,
            y: Math.random() * Config.SCREEN_H,
          };
          if (Math.random() < 0.4) Assets.playSound(Math.random() < 0.5 ? 'doorOpen' : 'openFence', 0.25);
        }
        nextIntrusion = 5000 + Math.random() * 9000;
      }
    }
  }

  /* chromatic-aberration + scanline pass: cheap, image-free, runs every frame */
  function glitchPass(g) {
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = SW; scratch.height = SH;
    }
    const jitter = Math.sin(t / 137) > 0.985 ? 3 : (Math.sin(t / 211) < -0.99 ? -2 : 0);
    if (jitter !== 0) {
      const sctx = scratch.getContext('2d');
      sctx.clearRect(0, 0, SW, SH);
      sctx.drawImage(g.canvas, 0, 0);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5;
      g.drawImage(scratch, jitter, 0);
      g.globalAlpha = 0.35;
      g.drawImage(scratch, -jitter, 0);
      g.restore();
    }
    /* faint scanlines, always on, sells the "wrong channel" vibe */
    g.save();
    g.globalAlpha = 0.06;
    g.fillStyle = '#000000';
    for (let y = 0; y < SH; y += 2) g.fillRect(0, y, SW, 1);
    g.restore();
  }

  function drawIntrusion(g) {
    if (!intrusion) return;
    const im = Assets.getImage(intrusion.key);
    if (!im) return;
    const SW = Config.SCREEN_W, SH = Config.SCREEN_H;
    const fadeIn = Math.min(1, (150 - intrusion.life) / 40);
    const fadeOut = Math.min(1, intrusion.life / 40);
    const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut))) * 0.85;
    if (alpha <= 0) return;
    const scale = Math.min(SW / im.width, SH / im.height) * (0.5 + Math.random() * 0.1);
    const w = im.width * scale, h = im.height * scale;
    g.save();
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'difference';
    g.imageSmoothingEnabled = false;
    g.drawImage(im, intrusion.x - w / 2, intrusion.y - h / 2, w, h);
    g.restore();
  }

  function drawOverlay(g) {
    drawIntrusion(g);
    glitchPass(g);
  }

  return { update, drawOverlay };
})();
