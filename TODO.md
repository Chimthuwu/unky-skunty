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

## Status (2026-09-27, deploy session)
- Live deploy: **https://unky-skunty.pages.dev** (Cloudflare Pages project
  `unky-skunty`, deployed by direct `wrangler pages deploy` upload of
  `index.html` + `js/` only — not connected to GitHub auto-deploy, so a
  code change needs a manual redeploy; see the exact command in shell
  history / ask to redo it). Separate GitHub repo (not the original
  `nexussynchronize-dev/fire-emblem-psydechat`):
  **github.com/Chimthuwu/unky-skunty**, `origin` remote on the original repo
  left untouched, this one pushed via a second `unky` remote.
- Note for next session: `wrangler pages project create`/`deploy` on this
  account silently redirects new projects into Cloudflare's unified
  "Workers + static assets" product (a `*.workers.dev` URL) unless you pass
  `--force` on the *first* `project create` call. Also always deploy from a
  clean folder containing only `index.html` + `js/` (copy to a temp dir) —
  deploying from the repo root drags in `.git/`.
- User supplied real character art: a full sprite sheet (idle/walk/run/
  attack/hurt/victory/emotes × 4 facings) of Uncle Scunter. Auto-detected
  sprite blobs via scipy connected-components; cropped+chroma-keyed 4 poses:
  `scunter_map_idle.png` / `scunter_map_walk.png` (16×16, used as his
  overworld map sprite via a new `CharArt.setImageSprite(kind, [f0,f1])`
  hook — boss's `sprite` field changed from `'armor'` to `'scunter'` in
  `chapter1.js`, `battle` field left as `'armor'` so the battle-scene
  animation is untouched) and `scunter_hurt_front.png` /
  `scunter_victory_front.png` (added to the `Fever` intrusion image pool /
  available for a results-screen easter egg, not yet used there).
- Built **Escape the Uncle** (`js/fps/escape.js`): a from-scratch low-res
  DDA raycaster (Wolfenstein/DOOM-style, flat-shaded walls, no textures) —
  third title-menu option. Uncle is invincible and hunts via line-of-sight
  (loses you if you break LOS long enough); his bunnies (procedural
  billboard sprite) patrol and can be one-shot with a hitscan cone. Win by
  reaching the exit tile, lose by letting him close to melee range (jump
  -scare using `scunter_gb_glitch.png`). Verified with a throwaway
  standalone VM harness (same DOM-stub pattern as `test/browser-sim.js`,
  not committed) driving 350+ update/draw frames through intro → movement →
  turning → shooting with zero exceptions; **never played in a real
  browser**.
- Removed the fever-overlay's chromatic-jitter screen flicker per explicit
  ask (kept the static scanline tint only — see `js/gfx/fever.js`).
- Added a periodic ~2-semitone pitch "sag" to the chiptune scheduler
  (`js/gfx/audio.js` `detuneSemitones()`) — lead+bass dip together every
  ~13s for an eerie tape-warp feel. SFX blips are unaffected.
- Added OG/Twitter meta tags to `index.html` + a composited 1200×630
  thumbnail (`js/assets/img/og_thumbnail.png`, built with PIL from the
  user's character art + the feverdream gif + Impact/Consolas text) so
  Discord/Twitter links render a proper title/description/image card.
  Image URL is hardcoded to `https://unky-skunty.pages.dev/...` — if the
  Pages project or domain ever changes, this needs updating.

## Now / Next / Later
**Now** — nothing blocking; the whole stack (tactics game, fever remix,
Escape mode) is live at the URL above and all three `node test/*.js` suites
pass. Escape mode specifically has not been played by a human yet — worth
doing before calling it finished, since raycaster edge cases (corner
clipping, sprite occlusion at grazing angles) are the kind of thing that
only show up by playing.

**Next (optional, only if asked)**
- Playtest Escape mode: tune `UNCLE_SPD`/alert timers (currently: he moves
  at 2.15 tiles/s when alert, 45% of that when searching, stays alert 2.5s
  after losing LOS — all guessed, not tuned), check wall-collision feel,
  confirm the exit is discoverable without a map/compass.
- Mix in a couple of the extracted 2D sprite packs (e.g. `ASSETS2/sprites`,
  `#ASSETS#/Sunnyside_World...`) as jarring one-off enemy/unit reskins, not
  just background intrusions.
- Tune `Fever` intrusion frequency/opacity — currently tuned by feel, not
  playtested.
- Consider wiring Cloudflare Pages to auto-deploy from the `unky-skunty`
  GitHub repo on push, instead of manual `wrangler pages deploy`.

**Later**
- The `_ASSETS` library also has actual 3D model packs (FBX/GLB) — those
  aren't usable directly in this 2D canvas engine without a full 3D pipeline;
  skipped for this remix rather than half-integrating them.

## Open questions
- Licensing of the third-party asset packs (train/door/station photos,
  procedural-adjacent pixel packs) wasn't checked (per `_ASSETS/INDEX.md`,
  "check each archive's own license/readme before shipping") — this is now
  live on a public URL, not just a local remix, so worth a pass before
  telling more people about the link.
