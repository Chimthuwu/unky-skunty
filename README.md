# ESCAPE THE UNCLE

A low-res, first-person fever-dream chase. Uncle Scunter cannot be hurt,
cannot be reasoned with, and is always somewhere behind you. His bunnies
can be dealt with. He cannot.

Zero build step. Open `index.html` in a browser, or play the deployed copy.

## How it works

- `js/fps/escape.js` — the game: a from-scratch DDA raycaster
  (Wolfenstein/DOOM-style, textured walls and ground, no ceiling), Uncle's
  line-of-sight chase AI, bunny patrol/hitscan, and the glitched main menu.
  Two rounds: the first as described, the second with everything in the
  room walking backwards through your own movements, the song reversed and
  slowed, and Uncle nearly twice the size.
- `js/gfx/worldfb.js` — the world pass. Sky, ground and walls are
  composited into a pixel buffer and blitted with a single `putImageData`
  per frame; drawing them straight to the context cost ~2000 canvas calls
  a frame and was, by itself, the entire frame budget.
- `js/fps/aftermath.js` — the death sequence: the screen comes apart, two
  Matrix statements grow until they fill the screen, the old 2D tactics
  game comes back, and the first move you make in it inverts the colours.
- `js/gfx/matrix.js` / `js/fps/tactics.js` — the falling-glyph renderer
  and the single-map skirmish board the death sequence drops you into.
- `js/gfx/assets.js` — silent-fail loader for the real found-image/audio
  assets mixed into the game (see `js/assets/`).
- `js/gfx/fever.js` — a screen-space overlay (scanlines + occasional
  full-screen image intrusions) layered on top of every frame.
- `js/gfx/audio.js` — procedural chiptune engine; the music periodically
  sags ~2 semitones in pitch for an eerie "tape warp" feel, and can be
  played back reversed and slow.
- `js/core/` — shared config + small helpers.

## Tests

`node test/escape.test.js` drives the engine headlessly (DOM + WebAudio
stubs, no browser) and asserts movement, damage, both rounds, the death
sequence, the music layering and the render. `node test/harness.js [n]`
just runs `n` frames and reports scheduled oscillators.

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | Turn (left/right) + move (up/down) |
| Z / Enter / Space | Shoot (bunnies, and Uncle if you can land it) |
| X / Escape | Skip the death sequence / back |
| M | Mute |

## Known state

This used to be a turn-based tactics RPG ("Psydechat Emblem"); that game
was removed entirely per request — Escape the Uncle is the only game now.
