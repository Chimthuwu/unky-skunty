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
- Seizure-safety pass (28f8332): removed the per-frame random full-screen
  red on/off toggle + alternating red/cyan text on the jumpscare (was a
  genuine photosensitive hazard at 30-60Hz) in favour of a single smooth
  fade in/hold/out in one steady colour; and replaced the full-screen
  muzzle-flash tint — which could re-trigger every ~120ms under mashed fire
  — with a small localised glow at the gun barrel.

## Status (2026-09-27, hostile-movement session)
- **Music** (`js/gfx/audio.js`): the lead now plays over itself a semitone
  up in a sawtooth at 0.045 gain against the square's 0.10, scheduled at
  the root note's own start time so the two can't drift. Tempo glides
  toward a target re-rolled every 4-12s to 0.62x-1.17x of the written bpm.
  Music ducks to 55% while Uncle has line of sight, so he's the loudest
  thing in the mix exactly when it matters.
- **Colour drain** (`js/fps/escape.js`): in-game `canvas.filter`
  grayscale on a random 9-20s cycle, ramping 0.9s in / 1.4s hold / 1.1s
  out, peaking 58-86%. Measured worst single-frame change 2.0%, so no code
  path can snap between coloured and grey — same reasoning as the strobe
  fix above. Caps below full desaturation so the ash palette stays
  readable as "wrong" rather than just "off".
- **Grid-locked movement**: enemies no longer free-steer. Each commits to
  a step from one cell centre to an orthogonally adjacent one and only
  picks the next on arrival — 4 directions, no diagonals. `bfsFirstStep`
  is a BFS returning the first square of a shortest route; the first step
  is carried per-node because taking "the first neighbour expanded" makes
  units oscillate when that neighbour is a dead end. All three enemy types
  now hunt the player rather than drifting.
- **Player HP**: 100 HP, contact damage with 650ms global i-frames so a
  crowd can't stack damage into an instant loss. Hurt feedback is a soft
  edge vignette, never a full-screen tint.
- **Uncle is killable**: 6 HP, damageable by the player's bullets, with an
  `escaped` win state and screen. He only hunts while he has line of
  sight, and keeps walking to your last known cell after losing you.
- **Bunnies redrawn**: same silhouette so they still read at 240x160, but
  de-coloured to matte black with a wet rim, mismatched ears, a split
  torso, three arms on one side and two on the other, and a gash where
  the face was.
- **Tests**: `test/escape.test.js` (headless assertions, run with
  `node test/escape.test.js`) and `test/harness.js`. Deleted
  `test/{playtest,trace,debug-wedge}.js` — they drove the removed tactics
  engine and failed on missing files.
- `EscapeMode.make()` now returns a `_debug()` snapshot used only by the
  harness. Nothing in the game reads it.

### Open balance questions
- Uncle only closes when he has LOS, and a bullet only travels 8.1 cells
  (`PROJ_SPD` 9 x `PROJ_LIFE` 900ms). In testing, walking at him through
  six bunnies was not survivable by a scripted policy — it may be too
  hard for a human too. Worth playtesting: consider a longer bullet
  lifetime, a bigger uncle hitbox, or bunnies that don't all converge at
  once on stage 1.
- The scripted bot soloed Uncle successfully in one run out of ~10, so the
  kill-to-escaped path is believed working but is **not** covered by a
  gated test. It needs a human in a browser.
- **Still never played in a real browser.** Everything above is verified
  headlessly only.

## Now / Next / Later

**Now — port the old tactics Chapter 1 map ("The Ashenreach Gate") into
`buildMap()` as the outside map, with a horror reskin.**

The original Fire Emblem overworld is still recoverable from git history:

    git show cf0e571^:js/data/chapter1.js     # the map
    git show cf0e571^:js/data/terrain.js      # the terrain legend

(`cf0e571` is the "Remove the tactics game entirely" commit; `^` is the tree
just before it. Note the live site at psydechat-emblem.pages.dev returns the
shell HTML for every path — SPA fallback — so the map is NOT fetchable from
the URL, only from git.)

### The map — 32 wide × 24 tall, rows written as eight 4-tile chunks

Legend: `p`=plain `r`=road `f`=forest `m`=mountain `R`=river `B`=bridge
`W`=wall `T`=throne `H`=house `V`=village `C`=chest `D`=door `c`=carpet
`F`=ruined

    mmmm pppp ppRR ppff fppp pppp pppp pppp     y=0
    mmmm pppp ppRR ppff fppp pppp pppp pppp     y=1
    mmmm pppp ppRR ppff fppp pppp pppp pppp     y=2
    pppp pppp CpRR pppp pppp pppp pppp pppp     y=3   chest at x=8
    pppp pppp ppRR pppp pppp pppp pppp pppp     y=4
    pppp pppp ppRR pppp pppp pppp pppp pppp     y=5
    pppp pppp ppRR pppp pppp pVpp pppp pppp     y=6   village Ashford
    pppp pppp ppRR pppp pppp pppp pppp pppp     y=7
    pppp pppp ppRR pppp pppp ppFp pppp pppp     y=8   ruins
    pppp pppp ppRR pppp pppp pppp WWWW WWpp     y=9   ┐
    pppp pppp ppRR pppp pppp pppp Wccc cWpp    y=10   │
    pppp pppp ppRR pppp pppp pppp Wccc TWpp    y=11   │ keep
    pppr rrrr rrBB rrrr rrrr rrrr Dccc cWpp    y=12   ┘ throne + door
    pppr pppp ppRR pppp pppp pppp Wccc CWpp    y=13   chest at x=28
    pppr pppp ppRR pppp pppp pppp Wccc cWpp    y=14   │
    pppr pppp ppRR pppp pppp pppp WWWW WWpp    y=15   ┘
    pppr pppp ppRR pppp pppp pppp pppp pppp    y=16
    pppr pppp ppRR pppp pppp pVpp pppp pppp    y=17   village Willowmere
    pppr pppp ppRR pppp pppp pHpp pppp pppp    y=18   house Gateward
    pppr pppp ppRR pppp pppp pppp pppp pppp    y=19
    pppr pppp ppRR pppp pppp pppp pppp pppp    y=20
    pppr ppff ppRR pppp pppp pppp pppp pppp    y=21
    pppr ppff ppRR pppp ppff fppp pppp pppp    y=22
    pppr pppp ppRR pppp ppff fppp pppp pppp    y=23

Landmarks worth preserving, since they're what makes the map read:
- **Mountain massif** top-left, rows 0-2 × cols 0-3 — hard border on that
  corner, so the map is not a symmetric box.
- **The river** runs the full height at cols 10-11 and splits the map in
  two. **One bridge**, at row 12 (cols 12-13). This is the map's whole
  tactical shape: crossing is a chokepoint, and being caught mid-bridge
  is the natural death.
- **Roads** — col 3 down the left half, and cols 12-18 along row 12,
  meeting at the bridge. Open and fast, no cover.
- **The keep** on the right, cols 24-27 × rows 9-15, walled, with a carpet
  floor and the throne at row 11. Door on the west face at row 12. Uncle
  Scunter's throne was at x=28, y=11.
- **Forests** — top strip cols 14-15 rows 0-2, plus a block at cols 6-7
  rows 21-22 and cols 14-15 rows 22-23. Forest was the cover terrain
  (+20 avoid, +1 def) so the forest patches are the hiding spots.
- **Villages** at (21,6) and (21,17), **house** at (21,18), **chests** at
  (8,3) and (28,13), **ruins** at (21,8).
- Player deployed at (4,21) — bottom-left, across the river from the keep.

### Terrain → FPS mapping (the actual port)
Current `buildMap()` is a hand-authored 24×16 interior: a solid 1-cell
border plus ~24 scattered 1-cell pillars. There is no outdoor read at all.
Suggested mapping, keeping the geometry identical to the original:
- `m` mountain, `W` wall → solid sight-blocker (the real blockers)
- `f` forest, `F` ruins, `V` village, `H` house → **partial** cover: solid
  to movement, blocks or heavily degrades LOS. Simplest faithful option is
  to make them solid like walls but render them differently (dense canopy
  / rubble / cottages) so they read as distinct.
- `R` river → solid (deep water), `B` bridge → walkable
- `p` plain, `r` road, `c` carpet → open
- `T` throne, `C` chest, `D` door → open / interactable

### Constraints to respect
- `isWall()`, `hasLOS()`, uncle/bunny/nightmare pathing, and projectile
  collision all read `grid[y][x] === 1`. If partial-cover terrain is
  wanted, that means a cell *type* byte rather than a boolean, and every
  one of those readers has to be updated. Cheapest first pass: stay
  boolean, get the layout right, add cover types after.
- `W`/`H` are currently 24×16. Going to 32×24 changes the FOV feel and
  the uncle's aggro range — check `DETECT_R` and the bunny patrol radius,
  which were tuned against the old pillar density (~2-3 cell spacing).
- `wall_texture.png` is a **dungeon interior** texture. It's used on the
  menu and, flat/decoratively, in-game. It is the wrong texture for
  outdoor walls; outdoor needs its own, or a flat-shaded treatment.
- The `floorCells` list in `resetRun()` (bunny/nightmare spawn picking) is
  built from `grid`, so it picks up the new map for free — but the density
  changes a lot (32×24 open outdoors vs. a boxy interior), so the spawn
  counts likely need retuning.
- No minimap exists in the FPS mode. `scunter_map_{idle,walk,run}.png` are
  declared in `assets.js` and unreferenced. On a 32×24 outdoor map a
  minimap would help a lot — possibly the best use for those assets.

### Disturbing direction (agreed): same layout, horror reskin
Keep the geometry 1:1 with the original so it stays comparable to the FE
map, and put the horror entirely in palette/lighting/ambience:
- Dusk/ash palette instead of pastoral green — the chapter is called
  *Ashenreach*, so grey-orange sky, dead grass, ash drifting.
- Forest renders as bare black tree trunks / dense canopy silhouettes.
- River as black water with a slow reflective sheen; crossing the bridge
  in the open with the river on both sides should feel exposed.
- The keep as the only lit thing on the map — warm light spilling from the
  door and throne windows, visible across the fields as the goal. Keeps
  the original's "the objective is over there" readability.
- Uncle as the same chokepoint guardian he was as the FE boss: hold the
  bridge and the keep door rather than chasing across open ground. The
  original AI was `guard`/`zone` there; mirror that.

### Verification
Still has **never been opened in a real browser** — only headless-simulated.
Before trusting any of the above, actually open it and check: outdoor
readability at 240×160, whether the forest/partial-cover cells are legible
as blockers, whether the bridge chokepoint is fun or just annoying, and
whether the keep reads as a destination.

**Also Now** — nothing else blocking.

**Next (optional, only if asked)**
- Real per-column texture-mapped walls (currently walls in-game are still
  flat-shaded solid colors, and `wall_texture.png` is only used as a flat
  decorative tile on the menu — not in the raycaster itself).
- A results/game-over redesign using `scunter_victory_front.png` /
  `scunter_hurt_front.png` (currently only `scunter_hurt_front` is used, in
  the Fever intrusion pool — not shown on the actual results screens).
- Re-add some form of automated smoke test now that the engine is small
  (the old three-suite setup tested the deleted tactics game specifically).

## Open questions
- Licensing of the PSX dungeon texture pack and the other `_ASSETS`/
  `euclydia` images (per `_ASSETS/INDEX.md`) still hasn't been checked — this
  is live on a public URL (unky-skunty.pages.dev), so worth a pass before
  sharing the link further. If the outdoor map needs new textures, check
  this first.
