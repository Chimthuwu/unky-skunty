/* =============================================================
   CHARACTER DATA — add a character = add one entry.
   stats: personal bases (level 1). growths: personal % growths.
   portraits/sprites map to procedural art in graphics/charart.js.
   ============================================================= */
'use strict';

const CharacterDB = {
  rowan: {
    name: 'Rowan', classId: 'commander', level: 3,
    stats: { hp: 2, str: 1, mag: 0, skl: 1, spd: 1, luk: 2, def: 1, res: 0 },
    growths: { hp: 80, str: 50, mag: 10, skl: 50, spd: 45, luk: 60, def: 40, res: 25 },
    inventory: ['rapier', 'iron_sword', 'potion'],
    affinity: 'wind',
    portrait: 'rowan', sprite: 'lord', battle: 'lord',
    bio: 'Heir of the Emberwatch, a border order sworn to hold the Ashenreach. Wields the Duelist Rapier of his office.',
    personality: 'Earnest, dutiful, quietly stubborn.',
  },
  brynn: {
    name: 'Brynn', classId: 'cavalier', level: 3,
    stats: { hp: 2, str: 1, mag: 0, skl: 1, spd: 1, luk: 0, def: 1, res: 0 },
    growths: { hp: 75, str: 55, mag: 5, skl: 45, spd: 40, luk: 35, def: 45, res: 20 },
    inventory: ['javelin', 'iron_lance', 'potion'],
    affinity: 'earth',
    portrait: 'brynn', sprite: 'cav', battle: 'cav',
    bio: 'A squire of the Emberwatch cavalry. Rowan’s shield-sister since childhood; rides like the wind, worries like a grandmother.',
    personality: 'Loyal, boisterous, protective.',
  },
  sela: {
    name: 'Sela', classId: 'archer', level: 2,
    stats: { hp: 1, str: 1, mag: 0, skl: 2, spd: 1, luk: 1, def: 0, res: 0 },
    growths: { hp: 70, str: 50, mag: 5, skl: 65, spd: 50, luk: 40, def: 30, res: 25 },
    inventory: ['iron_bow', 'short_bow'],
    affinity: 'wind',
    portrait: 'sela', sprite: 'arch', battle: 'arch',
    bio: 'A poacher-turned-scout from the Greenmarch who joined the Emberwatch for a hot meal and stayed for the cause.',
    personality: 'Dry-witted, watchful, unflappable.',
  },
  garrick: {
    name: 'Garrick', classId: 'brute', level: 3,
    stats: { hp: 3, str: 2, mag: 0, skl: 0, spd: 0, luk: 1, def: 1, res: 0 },
    growths: { hp: 90, str: 65, mag: 0, skl: 30, spd: 25, luk: 30, def: 35, res: 10 },
    inventory: ['iron_axe', 'hand_axe', 'potion'],
    affinity: 'fire',
    portrait: 'garrick', sprite: 'brute', battle: 'brute',
    bio: 'A retired pit-fighter who signed on with the Emberwatch the day they out-bid a bandit payroll. Sleeps with his hatchet.',
    personality: 'Loud, warm-hearted, eats a lot.',
  },
  lia: {
    name: 'Lia', classId: 'mage', level: 2,
    stats: { hp: 1, str: 0, mag: 2, skl: 1, spd: 1, luk: 0, def: 0, res: 1 },
    growths: { hp: 60, str: 5, mag: 65, skl: 55, spd: 50, luk: 40, def: 20, res: 55 },
    inventory: ['fire', 'thunder'],
    affinity: 'anima',
    portrait: 'lia', sprite: 'mage', battle: 'mage',
    bio: 'A runaway academy prodigy who prefers fieldwork to lectures. Her spellbooks are covered in doodles of the rest of the company.',
    personality: 'Curious, sharp-tongued, restless.',
  },
  mira: {
    name: 'Mira', classId: 'cleric', level: 2,
    stats: { hp: 1, str: 0, mag: 2, skl: 1, spd: 1, luk: 2, def: 0, res: 2 },
    growths: { hp: 65, str: 5, mag: 55, skl: 50, spd: 50, luk: 70, def: 20, res: 60 },
    inventory: ['heal_staff', 'potion'],
    affinity: 'light',
    portrait: 'mira', sprite: 'cleric', battle: 'cleric',
    bio: 'A lay healer of the Dawnhands who volunteered for the frontier march. Insists that bandits deserve soup, too.',
    personality: 'Gentle, brave, impossible to anger.',
  },
};
