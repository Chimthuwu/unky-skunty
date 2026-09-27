/* Headless harness: DOM + WebAudio stubs, loads the engine in a vm
   context and drives update/draw. Throwaway debugging tool — not a test
   suite. Usage: node test/harness.js [frames] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* ---- 2D context stub ---- */
function makeCtxStub() {
  const grad = { addColorStop: () => {} };
  const noop = () => {};
  return {
    canvas: { width: 240, height: 160 },
    fillStyle: '', strokeStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    globalCompositeOperation: '', filter: 'none',
    font: '', textAlign: '', lineWidth: 1,
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    arc: noop, closePath: noop, drawImage: noop, save: noop, restore: noop,
    translate: noop, scale: noop, rotate: noop,
    fillText: noop, measureText: () => ({ width: 0 }),
    createLinearGradient: () => grad,
    createPattern: () => null,
  };
}
function makeCanvasStub() {
  return { width: 0, height: 0, style: {}, addEventListener: () => {}, getContext: () => makeCtxStub() };
}

/* ---- WebAudio stub: counts scheduled notes so we can prove the ghost
       layer and the tempo drift actually fire ---- */
function makeAudioStub() {
  const log = { osc: [], paramSets: 0 };
  const param = (v) => ({
    value: v,
    setValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    setTargetAtTime() { log.paramSets++; return this; },
    cancelScheduledValues() { return this; },
  });
  const node = () => ({
    connect() {}, disconnect() {}, start() {}, stop() {},
    frequency: param(440), gain: param(1), type: '', Q: param(1),
  });
  class FakeCtx {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = node(); }
    resume() { this.state = 'running'; }
    createGain() { const n = node(); n.gain = param(1); return n; }
    createOscillator() { const n = node(); log.osc.push(n); return n; }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
  }
  return { FakeCtx, log };
}

function buildSandbox() {
  const listeners = {};
  const windowStub = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: () => {},
    Audio: function () { return { play: () => Promise.resolve(), cloneNode() { return this; }, volume: 0.5 }; },
  };
  const documentStub = {
    getElementById: () => makeCanvasStub(),
    createElement: () => makeCanvasStub(),
    addEventListener: () => {},
  };
  const store = {};
  const { FakeCtx, log } = makeAudioStub();
  windowStub.AudioContext = FakeCtx;   /* init() reads window.AudioContext */
  const sandbox = {
    console, Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp,
    Infinity, NaN, isFinite, parseInt, parseFloat, Promise, Error,
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    window: windowStub, document: documentStub,
    navigator: { getGamepads: () => [] },
    AudioContext: FakeCtx,
    __listeners: listeners, __audiolog: log,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const ORDER = [
  'js/core/utils.js', 'js/core/config.js', 'js/gfx/font.js', 'js/gfx/charart.js',
  'js/gfx/audio.js', 'js/gfx/input.js', 'js/gfx/assets.js', 'js/gfx/fever.js',
  'js/fps/escape.js',
];

function load(sandbox) {
  for (const f of ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox;
}

module.exports = { buildSandbox, load, makeCtxStub, ORDER, ROOT };

if (require.main === module) {
  const frames = parseInt(process.argv[2], 10) || 600;
  const sandbox = load(buildSandbox());
  const ctx = makeCtxStub();
  /* Input/EscapeMode are top-level `const`s, so they live in the context's
     lexical scope rather than on the sandbox object — drive from inside. */
  vm.runInContext(`
    globalThis.__scr = EscapeMode.make();
    globalThis.__ctx = null;
    Input.pressed = () => false;
    Input.down = () => false;
  `, sandbox);
  sandbox.__ctx = ctx;
  vm.runInContext(`
    for (let i = 0; i < __frames; i++) { __scr.update(16); __scr.draw(__ctx); }
    Audio.stopMusic();
  `, Object.assign(sandbox, { __frames: frames }));
  console.log('OK ' + frames + ' frames, no exceptions');
  console.log('oscillators scheduled: ' + sandbox.__audiolog.osc.length);
  /* the music scheduler owns a real setInterval; don't let it hold the loop */
  process.exit(0);
}
