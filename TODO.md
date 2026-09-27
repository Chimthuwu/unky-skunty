# TODO — Escape the Uncle

## Summary
The tactics RPG is gone. Per explicit request, this repo is now ONLY the
first-person horror chase mode ("Escape the Uncle") — see README.md.

## Status (2026-09-27, rip-out session)
- Deleted `js/data/`, `js/game/`, `js/gfx/{charart,tiles,ui,dialogue,
  battlescene,levelup}.js`, `js/screens.js`, `js/debug.js`, and the three
  old test files (`test/smoke.js`, `browser-sim.js`, `gfx-test.js` — they
  tested the deleted engine). No automated tests exist right now; verified
  instead with a throwaway standalone VM harness (same DOM-stub pattern the
  old browser-sim.js used) driving 1000 update/draw frames through
  menu → play → turning, plus the Fever overlay, with zero exceptions. Not
  committed — recreate if you need it again, it's cheap.
- `index.html` trimmed to the minimal script set: `core/utils.js`,
  `core/config.js`, `gfx/font.js`, `gfx/audio.js`, `gfx/input.js`,
  `gfx/assets.js`, `gfx/fever.js`, `fps/escape.js`, `main.js`.
- `js/main.js` rewritten: no more `Game`/`Screens` — boots straight into
  `EscapeMode.make()` and drives its update/draw + the Fever overlay.
- `js/fps/escape.js`: `'intro'` state renamed `'menu'`, now a persistent
  glitchy main menu (not a one-shot intro) — `resetRun()` reinitializes
  player/uncle/bunnies each time you start or return to it from
  caught/escaped, instead of the old `Screens.makeTitle()` handoff.
  Dropped the `CharArt` dependency entirely (was only used for one dead
  code path).
- Horror pass on the main menu: tiled PSX dungeon wall texture (pulled from
  `_ASSETS/_extracted/Dungeons-Interiors/PSX_Dungeon`, → `js/assets/img/
  wall_texture.png`) + the feverdream gif ghosted behind everything, static
  speckle noise, jittering glitch title text/color, and five bunny-ear
  shapes poking in from asymmetric/off-canvas positions
  (`menuEars`/`drawBunnyEar` in escape.js). Also added
  `intrusion_doortex.png` (same PSX pack) to the Fever intrusion image pool.
- Periodic desaturation: `desaturatePulse(t)` in escape.js drives a sharp,
  brief `canvas.filter = grayscale(...)` spike on the main menu only (~92%
  grey, ~380ms, every ~6.4s) — separate from and in addition to the earlier
  audio pitch-sag.
- Music: `Audio.startMusic('boss')` now runs continuously from the menu
  onward (previously music only played during the old tactics battles).
  The ~2-semitone-every-13s pitch sag from the prior session applies here
  automatically since it's global to the scheduler.

## Now / Next / Later
**Now** — nothing blocking. This was an explicitly fast/low-effort pass;
**never played in a real browser**, only headless-simulated. Before
trusting it, actually open it and check: menu glitch readability, whether
the grayscale spike is too jarring/not jarring enough, wall-texture tiling
seams, and whether bunny ears read as intentional vs. a rendering bug.

**Next (optional, only if asked)**
- Real per-column texture-mapped walls using `wall_texture.png` (currently
  only used as a flat decorative tile on the menu, not in the raycaster
  itself — walls in-game are still flat-shaded solid colors).
- A results/game-over redesign using `scunter_victory_front.png` /
  `scunter_hurt_front.png` (currently only `scunter_hurt_front` is used, in
  the Fever intrusion pool — not shown on the actual results screens).
- Re-add some form of automated smoke test now that the engine is small
  (the old three-suite setup tested the deleted tactics game specifically).

## Open questions
- Licensing of the PSX dungeon texture pack and the other `_ASSETS`/
  `euclydia` images (per `_ASSETS/INDEX.md`) still hasn't been checked —
  this is live on a public URL (unky-skunty.pages.dev), so worth a pass
  before sharing the link further.
