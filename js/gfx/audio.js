/* =============================================================
   AUDIO — procedural chiptune (WebAudio). No assets.
   Music: sequenced square lead + triangle bass, looped.
   SFX: short synthesized cues. Lazy-init on first user gesture.
   ============================================================= */
'use strict';

const Audio = (() => {
  let ac = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let current = null;          /* current track name */
  let schedTimer = null;
  let schedTime = 0;
  let trackPos = { lead: 0, bass: 0 };
  let nextTime = { lead: 0, bass: 0 };
  let muted = false;

  /* note name -> midi */
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function n(str) {
    /* 'A4' -> 69, 0 = rest */
    if (!str) return 0;
    const m = /^([A-G]#?)(\d)$/.exec(str);
    if (!m) return 0;
    return 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]];
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------------- TRACKS (original compositions) ---------------- */
  /* seq entries: [note, beats]. bpm = beats per minute. */
  const TRACKS = {
    title: {
      bpm: 96,
      lead: [[n('A4'), 1], [n('C5'), 1], [n('E5'), 2], [n('D5'), 1], [n('C5'), 1], [n('B4'), 2],
             [n('C5'), 1], [n('B4'), 1], [n('A4'), 2], [0, 2],
             [n('E5'), 1], [n('F5'), 1], [n('E5'), 2], [n('D5'), 1], [n('C5'), 1], [n('B4'), 2],
             [n('A4'), 1], [n('G4'), 1], [n('A4'), 4]],
      bass: [[n('A2'), 2], [n('E3'), 2], [n('F2'), 2], [n('C3'), 2],
             [n('D3'), 2], [n('A2'), 2], [n('E3'), 2], [n('E2'), 2],
             [n('A2'), 2], [n('E3'), 2], [n('F2'), 2], [n('C3'), 2],
             [n('D3'), 2], [n('E3'), 2], [n('A2'), 4]],
    },
    player: {
      bpm: 138,
      lead: [[n('C5'), .5], [n('E5'), .5], [n('G5'), .5], [n('E5'), .5], [n('F5'), 1], [n('D5'), 1],
             [n('E5'), .5], [n('C5'), .5], [n('G4'), .5], [n('C5'), .5], [n('D5'), 2],
             [n('C5'), .5], [n('E5'), .5], [n('G5'), .5], [n('A5'), .5], [n('G5'), 1], [n('E5'), 1],
             [n('F5'), .5], [n('E5'), .5], [n('D5'), .5], [n('E5'), .5], [n('C5'), 2]],
      bass: [[n('C3'), 1], [n('G2'), 1], [n('C3'), 1], [n('G2'), 1],
             [n('F2'), 1], [n('C3'), 1], [n('G2'), 1], [n('B2'), 1],
             [n('C3'), 1], [n('G2'), 1], [n('C3'), 1], [n('G2'), 1],
             [n('F2'), 1], [n('G2'), 1], [n('C3'), 2]],
    },
    enemy: {
      bpm: 132,
      lead: [[n('D5'), .5], [n('A4'), .5], [n('D5'), .5], [n('F5'), .5], [n('E5'), 1], [n('C#5'), 1],
             [n('D5'), 1], [0, .5], [n('A4'), .5], [n('Bb4'), 1], [n('A4'), 2],
             [n('D5'), .5], [n('A4'), .5], [n('D5'), .5], [n('F5'), .5], [n('G5'), 1], [n('E5'), 1],
             [n('F5'), 1], [n('E5'), 1], [n('D5'), 2]],
      bass: [[n('D2'), 1], [n('D3'), 1], [n('A2'), 1], [n('D3'), 1],
             [n('Bb2'), 1], [n('D3'), 1], [n('A2'), 1], [n('A2'), 1],
             [n('D2'), 1], [n('D3'), 1], [n('A2'), 1], [n('D3'), 1],
             [n('G2'), 1], [n('A2'), 1], [n('D3'), 2]],
    },
    battle: {
      bpm: 164,
      lead: [[n('E5'), .5], [n('E5'), .5], [n('G5'), .5], [n('E5'), .5], [n('D5'), .5], [n('E5'), .5], [n('B4'), 1],
             [n('C5'), .5], [n('E5'), .5], [n('A5'), 1], [n('G#5'), 1],
             [n('E5'), .5], [n('E5'), .5], [n('G5'), .5], [n('E5'), .5], [n('D5'), .5], [n('E5'), .5], [n('B4'), 1],
             [n('A4'), .5], [n('C5'), .5], [n('E5'), 1], [n('D5'), 1]],
      bass: [[n('E2'), .5], [n('E2'), .5], [n('E2'), .5], [n('E2'), .5], [n('C2'), .5], [n('C2'), .5], [n('D2'), .5], [n('D2'), .5],
             [n('C2'), .5], [n('C2'), .5], [n('A1'), .5], [n('A1'), .5], [n('B1'), .5], [n('B1'), .5], [n('E2'), .5], [n('E2'), .5],
             [n('E2'), .5], [n('E2'), .5], [n('E2'), .5], [n('E2'), .5], [n('C2'), .5], [n('C2'), .5], [n('D2'), .5], [n('D2'), .5],
             [n('A1'), .5], [n('A1'), .5], [n('C2'), .5], [n('C2'), .5], [n('E2'), 1]],
    },
    boss: {
      bpm: 150,
      lead: [[n('A4'), .75], [n('A4'), .25], [n('C5'), .5], [n('A4'), .5], [n('G#4'), 1],
             [n('A4'), .75], [n('A4'), .25], [n('D5'), .5], [n('C5'), .5], [n('B4'), 1],
             [n('F5'), .75], [n('E5'), .25], [n('C5'), .5], [n('A4'), .5], [n('G#4'), 1],
             [n('A4'), .5], [n('B4'), .5], [n('C5'), .5], [n('E5'), .5], [n('A5'), 2]],
      bass: [[n('A1'), .5], [n('A1'), .5], [n('A1'), .5], [n('G1'), .5], [n('F1'), .5], [n('F1'), .5], [n('E1'), .5], [n('E1'), .5],
             [n('A1'), .5], [n('A1'), .5], [n('A1'), .5], [n('G1'), .5], [n('F1'), .5], [n('F1'), .5], [n('E1'), 1],
             [n('D1'), .5], [n('D1'), .5], [n('D1'), .5], [n('C1'), .5], [n('B0'), .5], [n('B0'), .5], [n('E1'), .5], [n('E1'), .5],
             [n('A1'), 1], [n('A1'), 1], [n('A1'), 2]],
    },
    victory: {
      bpm: 120, loop: false,
      lead: [[n('G4'), .33], [n('C5'), .33], [n('E5'), .34], [n('G5'), 1], [n('E5'), .5], [n('G5'), 1.5],
             [n('A5'), .33], [n('G5'), .33], [n('E5'), .34], [n('C5'), 1], [n('D5'), .5], [n('C5'), 2]],
      bass: [[n('C2'), 1], [n('C3'), 1], [n('G2'), 1], [n('C3'), 1], [n('F2'), 1], [n('G2'), 1], [n('C2'), 2]],
    },
  };

  /* ---------------- engine ---------------- */

  function init() {
    if (ac) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = 0.8;
      musicGain.connect(master);
      sfxGain = ac.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function voice(kind, midi, t, dur, vol, dest) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = kind;
    o.frequency.value = hz(midi);
    const a = 0.008, r = Math.min(0.12, dur * 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, Math.max(t + a, t + dur - r));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function scheduler() {
    if (!current) return;
    const tr = TRACKS[current];
    if (!tr) return;
    const spb = 60 / tr.bpm;
    const ahead = ac.currentTime + 0.35;
    for (const v of ['lead', 'bass']) {
      const seq = tr[v];
      if (!seq) continue;
      while (nextTime[v] < ahead) {
        const [note, beats] = seq[trackPos[v] % seq.length];
        const dur = beats * spb;
        if (note > 0) {
          if (v === 'lead') voice('square', note, nextTime[v], dur * 0.92, 0.10, musicGain);
          else voice('triangle', note, nextTime[v], dur * 0.95, 0.16, musicGain);
        }
        nextTime[v] += dur;
        trackPos[v]++;
      }
    }
  }

  function startMusic(name) {
    if (current === name) return;
    if (!init()) { current = name; return; }  /* retry later on next call */
    resume();
    current = name;
    trackPos = { lead: 0, bass: 0 };
    nextTime = { lead: ac.currentTime + 0.05, bass: ac.currentTime + 0.05 };
    if (schedTimer) clearInterval(schedTimer);
    const tr = TRACKS[name];
    if (!tr) return;
    schedTimer = setInterval(scheduler, 120);
    scheduler();
  }

  function stopMusic() {
    current = null;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    /* let scheduled notes finish naturally (~0.4s tail) */
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.55;
    return muted;
  }

  /* ---------------- SFX ---------------- */

  function blip(freq, dur, type, vol, slide) {
    if (!init()) return;
    resume();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, hp) {
    if (!init()) return;
    resume();
    const t = ac.currentTime;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = vol || 0.3;
    const f = ac.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp || 900;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  const SFX = {
    cursor:   () => blip(920, 0.04, 'square', 0.10),
    confirm:  () => { blip(660, 0.05, 'square', 0.15); setTimeout(() => blip(990, 0.07, 'square', 0.15), 40); },
    cancel:   () => { blip(520, 0.05, 'square', 0.15); setTimeout(() => blip(330, 0.08, 'square', 0.15), 40); },
    open:     () => { blip(440, 0.06, 'triangle', 0.2); setTimeout(() => blip(660, 0.06, 'triangle', 0.2), 60); setTimeout(() => blip(880, 0.09, 'triangle', 0.2), 120); },
    attack:   () => { noiseBurst(0.09, 0.35, 700); blip(300, 0.1, 'sawtooth', 0.18, 120); },
    hit:      () => { noiseBurst(0.14, 0.45, 500); blip(180, 0.14, 'square', 0.2, 60); },
    crit:     () => { noiseBurst(0.22, 0.55, 900); blip(1200, 0.1, 'square', 0.25, 300); blip(150, 0.2, 'sawtooth', 0.3, 40); },
    miss:     () => blip(1400, 0.09, 'sine', 0.15, 400),
    magic:    () => { blip(600, 0.18, 'sine', 0.2, 1600); setTimeout(() => blip(900, 0.15, 'sine', 0.18, 2200), 60); },
    heal:     () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'triangle', 0.2), i * 70)); },
    levelup:  () => { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'square', 0.16), i * 80)); },
    death:    () => { blip(400, 0.5, 'sawtooth', 0.25, 40); noiseBurst(0.3, 0.3, 300); },
    phase:    () => { blip(330, 0.1, 'square', 0.18); setTimeout(() => blip(440, 0.12, 'square', 0.18), 90); },
    exp:      () => blip(1046, 0.05, 'triangle', 0.12),
    door:     () => { noiseBurst(0.12, 0.3, 250); blip(140, 0.15, 'square', 0.2, 90); },
    select:   () => blip(740, 0.06, 'square', 0.14),
  };

  return { startMusic, stopMusic, SFX, toggleMute, init, resume, TRACKS, get muted() { return muted; } };
})();
