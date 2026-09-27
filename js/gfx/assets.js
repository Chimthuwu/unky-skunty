/* =============================================================
   ASSETS — loader for the fever-dream remix. This is the ONLY
   place the game touches real external image/audio files; the
   base engine remains fully procedural (see js/gfx/charart.js
   etc). Everything here is best-effort: if a file 404s the game
   just skips that image/sound rather than crashing.
   ============================================================= */
'use strict';

const Assets = (() => {
  const img = {};
  const snd = {};
  let ready = false;

  const IMG_FILES = {
    feverdream: 'js/assets/img/feverdream.gif',
    scunterGb: 'js/assets/img/scunter_gb.png',
    scunterGbGlitch: 'js/assets/img/scunter_gb_glitch.png',
    scunterMapIdle: 'js/assets/img/scunter_map_idle.png',
    scunterMapWalk: 'js/assets/img/scunter_map_walk.png',
    scunterMapRun: 'js/assets/img/scunter_map_run.png',
    scunterAttack: 'js/assets/img/scunter_attack_front.png',
    scunterHurt: 'js/assets/img/scunter_hurt_front.png',
    scunterVictory: 'js/assets/img/scunter_victory_front.png',
    wallTexture: 'js/assets/img/wall_texture.png',
    intrusionDoortex: 'js/assets/img/intrusion_doortex.png',
    intrusionSlime: 'js/assets/img/intrusion_slime.png',
    intrusionTrain: 'js/assets/img/intrusion_train.png',
    intrusionStation: 'js/assets/img/intrusion_station.png',
    intrusionDoor1: 'js/assets/img/intrusion_door1.png',
    intrusionDoor2: 'js/assets/img/intrusion_door2.png',
    intrusionWhite: 'js/assets/img/intrusion_white.png',
    intrusionPlayer: 'js/assets/img/intrusion_player.png',
  };

  const SND_FILES = {
    doorOpen: 'js/assets/snd/door_open.wav',
    openFence: 'js/assets/snd/open_fence.mp3',
  };

  function loadImage(key, src) {
    return new Promise((resolve) => {
      const el = new Image();
      el.onload = () => { img[key] = el; resolve(); };
      el.onerror = () => resolve(); /* skip missing/broken assets silently */
      el.src = src;
    });
  }

  function loadSound(key, src) {
    return new Promise((resolve) => {
      const el = new window.Audio();
      el.preload = 'auto';
      el.oncanplaythrough = () => { snd[key] = el; resolve(); };
      el.onerror = () => resolve();
      el.src = src;
    });
  }

  async function init() {
    const jobs = [];
    for (const k in IMG_FILES) jobs.push(loadImage(k, IMG_FILES[k]));
    for (const k in SND_FILES) jobs.push(loadSound(k, SND_FILES[k]));
    await Promise.all(jobs);
    ready = true;
  }

  function getImage(key) { return img[key] || null; }

  function playSound(key, volume) {
    const el = snd[key];
    if (!el || (window.Audio && Audio.muted)) return;
    try {
      const inst = el.cloneNode(true);
      inst.volume = volume == null ? 0.5 : volume;
      inst.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }

  return { init, getImage, playSound, get ready() { return ready; }, IMG_FILES };
})();
