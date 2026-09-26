/* =============================================================
   INPUT — keyboard + gamepad. Poll-style:
     Input.pressed('confirm')  just pressed this frame
     Input.down('up')          held (with repeat for directions)
   Engine calls Input.beginFrame() at top of loop, and consumes
   just-pressed state at end of frame via Input.endFrame().
   ============================================================= */
'use strict';

const Input = (() => {
  const down = new Set();
  const pressed = new Set();
  const repeatTimer = new Map();
  let anyGesture = false;

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
    z: 'confirm', Z: 'confirm', Enter: 'confirm', ' ': 'confirm',
    x: 'cancel', X: 'cancel', Backspace: 'cancel', Escape: 'cancel',
    c: 'menu', C: 'menu', Shift: 'menu', Tab: 'menu',
    e: 'endturn', E: 'endturn',
  };

  const REPEAT_KEYS = ['up', 'down', 'left', 'right'];
  const REPEAT_DELAY = 260, REPEAT_RATE = 70;

  function press(name) {
    if (!down.has(name)) {
      pressed.add(name);
      if (REPEAT_KEYS.includes(name)) repeatTimer.set(name, -REPEAT_DELAY);
      anyGesture = true;
    }
    down.add(name);
  }
  function release(name) {
    down.delete(name);
    repeatTimer.delete(name);
  }

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); press(a); }
    anyGesture = true;
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); release(a); }
  });
  window.addEventListener('blur', () => { down.clear(); repeatTimer.clear(); });

  /* gamepad state from previous frame */
  let gpPrev = {};
  let gpAxisCooldown = 0;

  function pollGamepad(dtMs) {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const gp = pads && pads[0];
    if (!gp) { gpPrev = {}; return; }
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const cur = {
      up: btn(12), down: btn(13), left: btn(14), right: btn(15),
      confirm: btn(0), cancel: btn(1), menu: btn(9) || btn(8), endturn: btn(2),
    };
    /* axis as dpad */
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (gpAxisCooldown <= 0) {
      if (ax < -0.5) { press('left'); gpAxisCooldown = 140; }
      else if (ax > 0.5) { press('right'); gpAxisCooldown = 140; }
      else if (ay < -0.5) { press('up'); gpAxisCooldown = 140; }
      else if (ay > 0.5) { press('down'); gpAxisCooldown = 140; }
    } else {
      gpAxisCooldown -= dtMs;
      if (Math.abs(ax) < 0.3 && Math.abs(ay) < 0.3) gpAxisCooldown = 0;
    }
    for (const k of Object.keys(cur)) {
      if (cur[k] && !gpPrev[k]) press(k);
      if (!cur[k] && gpPrev[k] && !down.has(k)) { /* keep keyboard state intact */ }
    }
    gpPrev = cur;
  }

  function beginFrame(dtMs) {
    pollGamepad(dtMs);
    /* key repeat */
    for (const k of REPEAT_KEYS) {
      if (down.has(k) && repeatTimer.has(k)) {
        repeatTimer.set(k, repeatTimer.get(k) + dtMs);
        if (repeatTimer.get(k) >= REPEAT_RATE) {
          pressed.add(k);
          repeatTimer.set(k, 0);
        }
      }
    }
  }

  function endFrame() {
    pressed.clear();
  }

  return {
    beginFrame, endFrame,
    pressed: (n) => pressed.has(n),
    down: (n) => down.has(n),
    gotGesture: () => { const g = anyGesture; anyGesture = false; return g; },
    clear: () => { pressed.clear(); },
  };
})();
