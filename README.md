# ESCAPE THE UNCLE

A low-res, first-person fever-dream chase. Uncle Scunter cannot be hurt,
cannot be reasoned with, and is always somewhere behind you. His bunnies
can be dealt with. He cannot.

Zero build step. Open `index.html` in a browser, or play the deployed copy.

## How it works

- `js/fps/escape.js` — the entire game: a from-scratch DDA raycaster
  (Wolfenstein/DOOM-style, flat-shaded walls, no textures), Uncle's
  line-of-sight chase AI, bunny patrol/hitscan, and the glitched main menu.
- `js/gfx/assets.js` — silent-fail loader for the real found-image/audio
  assets mixed into the game (see `js/assets/`).
- `js/gfx/fever.js` — a screen-space overlay (scanlines + occasional
  full-screen image intrusions) layered on top of every frame.
- `js/gfx/audio.js` — procedural chiptune engine; the music periodically
  sags ~2 semitones in pitch for an eerie "tape warp" feel.
- `js/core/` — shared config + small helpers.

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | Turn (left/right) + move (up/down) |
| Z / Enter / Space | Shoot (bunnies only — Uncle is invincible) |
| M | Mute |

## Known state

This used to be a turn-based tactics RPG ("Psydechat Emblem"); that game
was removed entirely per request — Escape the Uncle is the only game now.
