/* =============================================================
   CHAPTER DATA — "The Ashenreach Gate"
   The whole chapter is data: map string, spawns, events, dialogue.
   Adding a chapter = adding another file like this one.

   MAP LEGEND:
     p=plain  r=road  f=forest  m=mountain  R=river  B=bridge
     W=wall  T=throne  H=house  V=village  C=chest  D=door
     c=carpet (keep floor)
   Each map row is written as eight 4-tile chunks joined with '+'.
   ============================================================= */
'use strict';

const ChapterDB = {
  ch1: {
    id: 'ch1',
    number: 'Chapter 1',
    title: 'The Ashenreach Gate',
    objective: { type: 'boss', label: 'DEFEAT: WARDEN VOSK' },
    playerStart: { x: 4, y: 21 },
    playerDeploy: [
      { charId: 'rowan' }, { charId: 'brynn' }, { charId: 'sela' },
      { charId: 'garrick' }, { charId: 'lia' }, { charId: 'mira' },
    ],
    gold: 1500,

    map: [
      'mmmm' + 'pppp' + 'ppRR' + 'ppff' + 'fppp' + 'pppp' + 'pppp' + 'pppp',
      'mmmm' + 'pppp' + 'ppRR' + 'ppff' + 'fppp' + 'pppp' + 'pppp' + 'pppp',
      'mmmm' + 'pppp' + 'ppRR' + 'ppff' + 'fppp' + 'pppp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'CpRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pVpp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'ppFp' + 'pppp' + 'pppp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'WWWW' + 'WWpp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'Wccc' + 'cWpp',
      'pppp' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'Wccc' + 'TWpp',
      'pppr' + 'rrrr' + 'rrBB' + 'rrrr' + 'rrrr' + 'rrrr' + 'Dccc' + 'cWpp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'Wccc' + 'CWpp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'Wccc' + 'cWpp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'WWWW' + 'WWpp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pVpp' + 'pppp' + 'pppp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pHpp' + 'pppp' + 'pppp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppr' + 'ppff' + 'ppRR' + 'pppp' + 'pppp' + 'pppp' + 'pppp' + 'pppp',
      'pppr' + 'ppff' + 'ppRR' + 'pppp' + 'ppff' + 'fppp' + 'pppp' + 'pppp',
      'pppr' + 'pppp' + 'ppRR' + 'pppp' + 'ppff' + 'fppp' + 'pppp' + 'pppp',
    ],

    /* ---- ENEMIES ---- */
    units: [
      /* bridge watch */
      { id: 'e_arch1',  team: 'enemy', classId: 'archer_enemy', name: 'Watchman', x: 13, y: 11, level: 1, inventory: ['iron_bow'], ai: 'guard' },
      { id: 'e_lancer1', team: 'enemy', classId: 'knight_enemy', name: 'Patrol', x: 16, y: 13, level: 2, inventory: ['iron_lance'], ai: 'patrol' },
      { id: 'e_lancer2', team: 'enemy', classId: 'knight_enemy', name: 'Patrol', x: 18, y: 10, level: 2, inventory: ['iron_lance'], ai: 'patrol' },
      /* roving raiders */
      { id: 'e_brig1', team: 'enemy', classId: 'brigand', name: 'Raider', x: 7,  y: 15, level: 2, inventory: ['iron_axe'], ai: 'aggro' },
      { id: 'e_brig2', team: 'enemy', classId: 'brigand', name: 'Raider', x: 5,  y: 20, level: 2, inventory: ['iron_axe'], ai: 'aggro' },
      { id: 'e_brig3', team: 'enemy', classId: 'brigand', name: 'Raider', x: 14, y: 16, level: 2, inventory: ['iron_axe'], ai: 'aggro' },
      { id: 'e_brig4', team: 'enemy', classId: 'brigand', name: 'Raider', x: 15, y: 20, level: 1, inventory: ['iron_axe'], ai: 'aggro' },
      { id: 'e_arch2', team: 'enemy', classId: 'archer_enemy', name: 'Poacher', x: 21, y: 10, level: 2, inventory: ['iron_bow'], ai: 'guard' },
      /* door garrison */
      { id: 'e_armor1', team: 'enemy', classId: 'armor_enemy', name: 'Gate Armor', x: 23, y: 12, level: 2, inventory: ['iron_lance'], ai: 'guard' },
      { id: 'e_armor2', team: 'enemy', classId: 'armor_enemy', name: 'Keep Armor', x: 26, y: 13, level: 3, inventory: ['steel_lance'], ai: 'guard' },
      /* keep interior */
      { id: 'e_hex1',   team: 'enemy', classId: 'shaman_enemy', name: 'Hexer',  x: 26, y: 11, level: 3, inventory: ['flux'], ai: 'guard' },
      { id: 'e_priest1', team: 'enemy', classId: 'priest_enemy', name: 'Cantor', x: 27, y: 13, level: 2, inventory: ['heal_staff'], ai: 'healer' },
      /* boss on the throne */
      {
        id: 'boss', team: 'enemy', classId: 'armor_enemy', name: 'Warden Vosk', x: 28, y: 11, level: 5,
        inventory: ['silver_lance', 'potion'],
        ai: 'boss',
        aggroWhen: 'zone',
        bossZone: { x1: 24, y1: 10, x2: 28, y2: 14 },
        bossKey: 'vosk',
        portrait: 'vosk', sprite: 'armor', battle: 'armor',
        bossQuote: 'The gate is closed. Your order is ash. Siege me if you dare.',
      },
    ],

    /* ---- MAP INTERACTIONS ----
       Contents for visitable / openable tiles. The map string places
       the tile art; these entries carry rewards + dialogue scripts. */
    interactions: [
      { x: 21, y: 6,  kind: 'village', script: 'village_ashford',    reward: { item: 'chest_key' } },
      { x: 21, y: 17, kind: 'village', script: 'village_willowmere', reward: { gold: 2000 } },
      { x: 21, y: 18, kind: 'house',   script: 'house_gateward',     reward: { item: 'door_key' } },
      { x: 8,  y: 3,  kind: 'chest',   contents: 'killer_sword' },
      { x: 28, y: 13, kind: 'chest',   contents: 'master_seal' },
    ],

    /* ---- DIALOGUE ---- */
    dialogue: {
      intro: [
        { speaker: 'ROWAN', portrait: 'rowan', side: 'left',  text: 'There it is. The Ashenreach Gate — and the Ironmark’s banner flying over it.' },
        { speaker: 'BRYNN', portrait: 'brynn', side: 'right', text: 'After what they did to the villages on the march? Close it behind us.' },
        { speaker: 'ROWAN', portrait: 'rowan', side: 'left',  text: 'Mira, Lia — stay behind Garrick and Brynn. Sela, watch the riverbank for bowmen.' },
        { speaker: 'SELA',  portrait: 'sela',  side: 'left',  text: 'Already counting a dozen of them. There will be more inside the keep.' },
        { speaker: 'MIRA',  portrait: 'mira',  side: 'right', text: 'Then let’s finish this before nightfall, Commander.' },
      ],
      vosk_intro: [
        { speaker: 'VOSK', portrait: 'vosk', side: 'right', text: 'So the Emberwatch crawls back. I salted your beacon-towers myself.' },
        { speaker: 'ROWAN', portrait: 'rowan', side: 'left', text: 'And the families at Willowmere? The granaries?' },
        { speaker: 'VOSK', portrait: 'vosk', side: 'right', text: 'Kindling. Now you’re here to be buried with the rest.' },
      ],
      vosk_death: [
        { speaker: 'VOSK', portrait: 'vosk', side: 'right', text: 'Impossible... a beacon relit... by children...' },
        { speaker: 'ROWAN', portrait: 'rowan', side: 'left', text: 'The watch never went out, Vosk. We only banked it.' },
      ],
      boss_range: [
        { speaker: 'VOSK', portrait: 'vosk', side: 'right', text: 'Steel and sorcery against my gate? Come, then. The Ashenreach buries heroes.' },
      ],
      village_ashford: [
        { speaker: 'HERDER', portrait: null, side: 'right', text: 'Emberwatch! We hid a chest key from the raiders. You’ll be needing one, I wager.' },
      ],
      village_willowmere: [
        { speaker: 'VILLAGER', portrait: null, side: 'right', text: 'Thank the lights you’ve come! Take these coins — everything we buried before the raid.' },
      ],
      house_gateward: [
        { speaker: 'GATEWARD’S WIDOW', portrait: null, side: 'right', text: 'My husband held this gatehouse for the watch. His key is yours. Close that gate, soldier.' },
      ],
    },

    /* ---- EVENTS ---- */
    events: [
      { trigger: 'chapterStart', type: 'dialogue', script: 'intro' },
      { trigger: 'bossAggro',    type: 'dialogue', script: 'boss_range' },
      { trigger: 'bossDeath',    type: 'dialogue', script: 'vosk_death' },
    ],

    /* ---- REINFORCEMENTS (turn-count based) ---- */
    reinforcements: [
      { id: 'e_rein1', turn: 5, team: 'enemy', classId: 'brigand',      name: 'Raider', x: 12, y: 0, level: 2, inventory: ['iron_axe'],   ai: 'aggro' },
      { id: 'e_rein2', turn: 5, team: 'enemy', classId: 'brigand',      name: 'Raider', x: 14, y: 1, level: 2, inventory: ['iron_axe'],   ai: 'aggro' },
      { id: 'e_rein3', turn: 7, team: 'enemy', classId: 'knight_enemy', name: 'Scout',  x: 13, y: 2, level: 1, inventory: ['iron_lance'], ai: 'aggro' },
    ],
  },
};
