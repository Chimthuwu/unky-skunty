# TODO — Psydechat Emblem

## Summary
Zero-dependency procedural tactical RPG (see README.md for architecture).
Currently mid-remix: layering an optional "fever dream" horror aesthetic on
top of the pure-procedural Chapter 1 using found assets from
`z:\GITHUB\euclydia - Copy` and `z:\github\_ASSETS` (neither is part of this
repo — they're personal asset libraries on this machine).

## Status (2026-09-27)
- Added `js/gfx/assets.js` (image/audio preloader, fails silently if a file
  is missing) and `js/gfx/fever.js` (chromatic-aberration glitch pass +
  random full-screen "intrusion" image flashes, drawn as a pure overlay in
  `main.js`'s render loop — never touches game state).
- Copied a curated set of images/audio into `js/assets/img` + `js/assets/snd`
  (psychedelic gif, a couple of out-of-place pixel sprites, some surreal
  train/door photos, two sound stingers).
- Title screen (`js/screens.js`) now ghosts the psychedelic gif behind the
  logo and the subtitle reads "A TACTICAL FEVER DREAM".
- `CharArt.setImagePortrait(id, img)` (`js/gfx/charart.js`) lets a real image
  override a procedural portrait by id — used once, for the final boss.
- Renamed the Chapter 1 boss "Warden Vosk" → **Uncle Scunter** (internal
  id/`bossKey` left as `vosk` to avoid touching engine plumbing). Rewrote his
  three dialogue scripts (`vosk_intro`, `boss_range`, `vosk_death` in
  `js/data/chapter1.js`): he's a blustering, performatively edgy bigot who's
  actually hiding his own shame behind the act — hypocrisy/self-loathing
  played as dark comedy, not the secret itself. On death, `engine.js`
  (`postActionCleanup`) swaps his portrait to a real found image
  (`scunter_true.png`) — the "mask comes off" beat.
- All three test suites still pass: `node test/smoke.js`,
  `node test/browser-sim.js` (had to add the two new script files to its
  fixed load list), `node test/gfx-test.js`.

## Status (2026-09-27, later same session)
- User supplied a stylized pixel-art self-portrait (bunny ears, headphones,
  lab coat) of themselves as "Uncle Scunter" and confirmed it's their own
  likeness/character. Converted it with PIL into two 4-color DMG Game Boy
  green palette portraits: `js/assets/img/scunter_gb.png` (normal, used as
  his default dialogue portrait via `CharArt.setImagePortrait('vosk', ...)`
  in `main.js`) and `js/assets/img/scunter_gb_glitch.png` (row-jittered
  red/black palette variant, swapped in on death in `engine.js` for the
  "mask comes off" beat — replaces the old unrelated skeleton-image swap).
  Removed the now-unused `scunter_true.png` / `scunter_mask.png` files.
- Declined an earlier ask to use an unstylized real photo of what turned out
  to be the same person, since at that point identity/consent wasn't
  established — flagged for the record, not a blocker now.

## Now / Next / Later
**Now** — remix is functional and tested; open the game in a browser to
eyeball the glitch pacing/intensity (never actually rendered it in a real
browser this session, only Node DOM-shim tests).

**Next (optional, only if asked)**
- Mix in a couple of the extracted 2D sprite packs (e.g. `ASSETS2/sprites`,
  `#ASSETS#/Sunnyside_World...`) as jarring one-off enemy/unit reskins, not
  just background intrusions.
- Tune `Fever` intrusion frequency/opacity — currently tuned by feel, not
  playtested.
- Consider a debug toggle to disable the fever layer entirely (currently
  always-on; degrades gracefully if assets 404 but there's no explicit off
  switch).

**Later**
- The `_ASSETS` library also has actual 3D model packs (FBX/GLB) — those
  aren't usable directly in this 2D canvas engine without a full 3D pipeline;
  skipped for this remix rather than half-integrating them.

## Open questions
- None blocking. Licensing of the third-party asset packs wasn't checked
  (per `_ASSETS/INDEX.md`, "check each archive's own license/readme before
  shipping") — fine for a personal/local remix, but flag before any public
  release.
