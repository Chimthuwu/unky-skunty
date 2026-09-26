# EMBERWRATH CHRONICLE — Version 0.1

An original turn-based tactical RPG prototype in the spirit of early-2000s
handheld tactical RPGs. Zero dependencies, zero build step, zero external
assets — all sprites, tiles, portraits, fonts, music and sound are generated
procedurally in code.

> **Chapter 1: "The Ashenreach Gate"** — A young commander and five companions
> assault a frontier fortress held by the Ironmark faction. Defeat Warden Vosk.

---

## How to launch

Open `index.html` in any modern browser. That's it.

```bash
# from this folder, any of these works:
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows
```

No server, no install, no build. The game runs at GBA resolution (240x160)
scaled up with crisp nearest-neighbor pixels.

## Controls

| Key | Action |
|---|---|
| Arrow keys / WASD | Move cursor |
| Z / Enter | Confirm |
| X / Esc | Cancel / back |
| C | Menu / status |
| E | End turn (player phase) |
| M | Mute audio |
| ` (backquote) | Toggle debug tools |

Gamepad: D-pad + A (confirm) + B (cancel) + Start/Select (menu), auto-detected.

---

## What's in Version 0.1

- Title screen → intro story → deployment screen → tactical battle → results
- 6 original playable characters with personal stats, growth rates, bios
- 13 enemies + a boss (Warden Vosk) with pre-fight and death dialogue
- Weapon triangle (sword > axe > lance > sword), magic trinity, bows vs flyers
- Battle forecasts, follow-up attacks, criticals, weapon durability
- Terrain: plains, roads, forests, river, bridge, mountains, walls, throne…
- Visit villages/houses, open chests (keys or thief), open a locked door
- Enemy AI profiles: aggro, guard, patrol, healer, boss (never cheats)
- EXP, level-ups with per-stat growth rolls, promotion system (Master Seal)
- Permadeath (protagonist death = game over), save/load via system menu
- Chiptune music (player/enemy/battle/boss/victory themes) + retro SFX
- Animated side-view battle scenes with hit/crit/miss/dodge/heal/magic FX
- Debug tools: give EXP, damage/heal, inspect AI, spawn units, restart, win

## Adding content (no engine changes needed)

**New character** — add one entry to `js/data/characters.js`:

```js
kira: {
  name: 'Kira', classId: 'myrmidon', level: 2,
  stats: { hp: 1, str: 1, mag: 0, skl: 2, spd: 2, luk: 1, def: 0, res: 0 },
  growths: { hp: 65, str: 45, mag: 5, skl: 65, spd: 65, luk: 30, def: 20, res: 20 },
  inventory: ['iron_sword', 'potion'],
  portrait: 'kira', sprite: 'duelist', battle: 'duelist',
  bio: '...', personality: '...',
},
```

then add `{ charId: 'kira' }` to the chapter's `playerDeploy` list.

**New weapon** — one entry in `js/data/weapons.js` (might/hit/crit/weight/
range/durability/rank/type/effectiveness).

**New class** — one entry in `js/data/classes.js` (bases, growths, caps,
weapon ranks, movement, terrain moveCost overrides, promotesTo).

**New terrain** — one entry in `js/data/terrain.js` + a tile painter in
`js/gfx/tiles.js` + a char in `TILE_CHARS` (`js/game/map.js`).

**New chapter** — copy `js/data/chapter1.js`, draw the map with legend
characters, list spawns/interactions/dialogue, add a `<script>` tag and
point the title flow at it.

**Rebalance everything** — all combat/exp/AI/promotion constants live in
`js/core/config.js` (crit multiplier, triangle bonuses, doubling threshold,
EXP curve, AI weights, promotion stats, permadeath toggle…).

## Architecture

```
index.html               entry point (loads scripts in order)
js/
  core/    utils.js, config.js          helpers + every tunable constant
  data/    terrain, weapons, items,     PURE CONTENT — edit these to
           classes, characters,         add/change game content
           chapter1.js
  game/    units.js                     stats, leveling, promotion, combat math
           map.js                       pathfinding, ranges, terrain
           combat.js                    engagement resolution
           ai.js                        enemy decision-making
           save.js                      localStorage save/load
           engine.js                    state machine, turns, menus, rendering
  gfx/     font.js                      5x7 pixel font
           charart.js                   procedural unit sprites + portraits
           tiles.js                     procedural terrain tiles
           audio.js                     chiptune sequencer + SFX
           input.js                     keyboard + gamepad
           ui.js                        GBA windows, panels, cursors
           dialogue.js                  conversation overlay
           battlescene.js               side-view battle animations
           levelup.js                   level-up presentation
  screens.js                           title/intro/prep/results/gameover
  debug.js                             developer tools
test/
  smoke.js         logic tests (run: node test/smoke.js)
  browser-sim.js   full UI flow simulation (run: node test/browser-sim.js)
  gfx-test.js      graphics/render smoke test (run: node test/gfx-test.js)
```

**Content data never contains balance logic; the engine never hardcodes
content.** Characters/classes/weapons/maps are looked up by id at runtime.

## Known prototype limitations

- Rescue/carry is implemented but simplified (half movement, CON check)
- No fog of war, shops, support conversations, or skill system yet
- Promotion is reachable via debug/Master Seal but not required in Chapter 1
- Audio requires a user gesture first (browser policy) — press any key
