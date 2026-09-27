/* =============================================================
   CHAR ART — procedural original pixel art.
   - unit(kind, frame, side): 16x16 map/battle sprite
   - portrait(id): 32x32 dialogue portrait
   Everything is drawn once into cached canvases.
   ============================================================= */
'use strict';

const CharArt = (() => {

  const PAL = {
    skin: '#e8b088', skinDark: '#c08858',
    hair: '#403020', metal: '#b8c0c8', metalDark: '#687078',
    wood: '#8a6a40', red: '#c84040', blue: '#4068c8', green: '#40a050',
    dark: '#282830', white: '#e8e8e0', gold: '#e8c850',
  };

  /* per-kind spec (teamColor used for weapon-band/team-pip accents) */
  const KINDS = {
    lord:      { armor: '#3a5cb0', trim: '#e8c850', hair: '#704828', weapon: 'sword', cape: true, teamColor: '#4c78e8' },
    pvanguard: { armor: '#2c4898', trim: '#e8c850', hair: '#704828', weapon: 'sword', cape: true, helm: true, teamColor: '#4c78e8' },
    cav:       { armor: '#a04830', trim: '#c8c8d0', hair: '#503820', weapon: 'lance', mount: true, teamColor: '#4c78e8' },
    pcav:      { armor: '#883820', trim: '#e8c850', hair: '#503820', weapon: 'lance', mount: true, helm: true, teamColor: '#4c78e8' },
    arch:      { armor: '#3a7848', trim: '#8a6840', hair: '#386038', weapon: 'bow', teamColor: '#4c78e8' },
    parch:     { armor: '#2c5c38', trim: '#e8c850', hair: '#386038', weapon: 'bow', hood: true, teamColor: '#4c78e8' },
    brute:     { armor: '#8a5830', trim: '#c8c8d0', hair: '#402818', weapon: 'axe', big: true, teamColor: '#4c78e8' },
    pbrute:    { armor: '#6a4426', trim: '#e8c850', hair: '#402818', weapon: 'axe', big: true, helm: true, teamColor: '#4c78e8' },
    mage:      { armor: '#7048a0', trim: '#c8c8d0', hair: '#c87838', weapon: 'tome', teamColor: '#4c78e8' },
    pmage:     { armor: '#583688', trim: '#e8c850', hair: '#c87838', weapon: 'tome', hat: true, teamColor: '#4c78e8' },
    cleric:    { armor: '#d8d8e0', trim: '#e8c850', hair: '#a86c38', weapon: 'staff', teamColor: '#4c78e8' },
    pcleric:   { armor: '#e8e8f0', trim: '#e8c850', hair: '#a86c38', weapon: 'staff', hood: true, teamColor: '#4c78e8' },
    esoldier:  { armor: '#606870', trim: '#903838', hair: '#282828', weapon: 'lance', helm: true, teamColor: '#d84040' },
    ebrigand:  { armor: '#6a5038', trim: '#903838', hair: '#282828', weapon: 'axe', big: true, band: true, teamColor: '#d84040' },
    earcher:   { armor: '#506038', trim: '#903838', hair: '#282828', weapon: 'bow', hood: true, teamColor: '#d84040' },
    earmor:    { armor: '#585868', trim: '#903838', hair: '#282828', weapon: 'lance', big: true, helm: true, teamColor: '#d84040' },
    eshaman:   { armor: '#3a3050', trim: '#705090', hair: '#181820', weapon: 'tome', hood: true, teamColor: '#d84040' },
    epriest:   { armor: '#c8c0b0', trim: '#903838', hair: '#181820', weapon: 'staff', hood: true, teamColor: '#d84040' },
    ecav:      { armor: '#704838', trim: '#903838', hair: '#282828', weapon: 'lance', mount: true, helm: true, teamColor: '#d84040' },
    npc:       { armor: '#7a6a50', trim: '#8a7858', hair: '#5a4830', weapon: 'none', teamColor: '#4ca85c' },
  };

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function drawUnit(g, k, frame, side) {
    const s = KINDS[k] || KINDS.npc;
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const M = PAL.metal, MD = PAL.metalDark, SK = PAL.skin, DK = PAL.dark;

    /* ---- mount first (behind rider) ---- */
    if (s.mount) {
      const bodyC = '#6a4a30', legC = '#4a3420';
      /* horse body */
      p(2, 10, 12, 4, bodyC);
      p(3, 9, 9, 1, bodyC);
      /* legs */
      const l1 = frame === 1 ? 1 : 0;
      p(3, 14 - l1, 2, 1 + l1, legC);
      p(11, 14 - (1 - l1), 2, 2 - l1, legC);
      /* head/neck */
      p(11, 8, 2, 3, bodyC);
      p(12, 7, 3, 2, bodyC);
      p(14, 8, 1, 1, DK);
      p(1, 9, 1, 3, legC); /* tail */
      p(2, 12, 12, 1, '#7a5638');
      /* caparison in team color + saddle */
      p(4, 10, 8, 2, s.teamColor);
      p(4, 10, 8, 1, '#3a5aa8');
      p(6, 12, 4, 2, '#4a3420');
      p(12, 9, 2, 1, '#8a6844');
    }

    const top = s.mount ? 0 : 12;      /* leg start */
    const legY = s.mount ? 5 : 12;
    /* ---- legs ---- */
    if (!s.mount) {
      const lift = frame === 1 ? 1 : 0;
      p(5, legY + lift, 2, 3 - lift, '#2c2c34');
      p(9, legY + (1 - lift), 2, 2 + (1 - lift), '#2c2c34');
    } else {
      p(5, legY, 2, 5, s.armor);   /* rider legs */
      p(9, legY, 2, 5, s.armor);
    }

    /* ---- torso ---- */
    const ty = s.mount ? 4 : 7;
    const th = s.mount ? 4 : 4;
    if (s.cape) { p(4, ty, 8, th + 1, '#283048'); p(4, ty, 8, 1, '#34405e'); }
    p(4, ty, 8, th, s.armor);
    p(4, ty, 8, 1, s.hiArmor);                      /* top-light */
    p(4, ty + th - 1, 8, 1, MD);                    /* belt */
    p(4, ty + th - 1, 2, 1, s.gold);                /* buckle */
    p(6, ty + 1, 4, 1, s.trim);                     /* tabard */
    p(3, ty, 1, 2, MD); p(12, ty, 1, 2, MD);        /* shoulders */
    if (s.big) { p(3, ty, 10, th, s.armor); p(2, ty, 2, 2, M); p(12, ty, 2, 2, M); }
    p(3, ty + 2, 1, 1, s.teamColor);                /* team badge */
    p(12, ty + 2, 1, 1, s.teamColor);

    /* ---- arms ---- */
    const ay = ty + 1;
    p(3, ay, 1, 2, s.armor);
    p(12, ay, 1, 2, s.armor);
    p(3, ay + 2, 1, 1, SK); p(12, ay + 2, 1, 1, SK); /* hands */

    /* ---- head ---- */
    const hy = s.mount ? 0 : 2;
    if (s.hood) {
      p(5, hy, 6, 5, s.armor);
      p(5, hy, 6, 1, s.hiArmor);
      p(4, hy + 1, 1, 4, s.armor);
      p(11, hy + 1, 1, 4, s.armor);
      p(6, hy + 2, 4, 3, '#181820');                 /* shadowed face */
      p(7, hy + 3, 1, 1, '#f8e858'); p(9, hy + 3, 1, 1, '#f8e858'); /* glint eyes */
    } else if (s.helm) {
      p(5, hy, 6, 4, M);
      p(5, hy, 6, 1, '#dce4ec');                     /* crown light */
      p(5, hy + 4, 6, 1, SK);
      p(7, hy + 1, 2, 1, DK);                        /* visor slit */
      p(6, hy + 3, 1, 1, DK); p(9, hy + 3, 1, 1, DK);
      if (s.big) { p(4, hy - 1, 8, 2, M); p(5, hy + 1, 6, 3, M); p(7, hy + 1, 2, 2, DK); }
      p(7, hy - 1, 2, 1, s.trim);                    /* crest */
      p(7, hy + 4, 2, 1, s.teamColor);               /* team band */
    } else {
      p(5, hy + 1, 6, 4, SK);
      p(6, hy + 4, 4, 1, SK);
      p(7, hy + 2, 3, 1, '#f0c8a0');                 /* cheek light */
      p(6, hy + 3, 1, 1, DK); p(9, hy + 3, 1, 1, DK);
      /* hair */
      p(5, hy, 6, 2, s.hair);
      p(5, hy, 6, 1, '#5a4232');                     /* hair light */
      p(4, hy + 1, 1, 2, s.hair);
      p(11, hy + 1, 1, 2, s.hair);
      if (s.band) p(5, hy + 1, 6, 1, '#903838');
      if (s.hat) { p(4, hy - 1, 8, 2, s.armor); p(6, hy - 3, 4, 2, s.armor); p(7, hy - 4, 2, 1, s.trim); }
    }

    /* ---- weapon (drawn on right side; mirrored with sprite when facing left) ---- */
    const wx = s.big ? 13 : 12;
    switch (s.weapon) {
      case 'sword':
        p(wx, ty - 2, 1, 6, M);
        p(wx, ty - 2, 1, 1, '#eef4f8');
        p(wx, ty + 4, 3, 1, s.trim);
        p(wx + 3, ty + 4, 1, 1, s.teamColor);
        break;
      case 'lance':
        p(wx, hy, 1, 10, PAL.wood);
        p(wx, hy - 1, 1, 2, M);
        p(wx, hy - 1, 1, 1, '#eef4f8');
        break;
      case 'axe':
        p(wx, ty - 2, 1, 9, PAL.wood);
        p(wx - 1, ty - 3, 3, 2, M);
        p(wx - 1, ty - 3, 3, 1, '#dce4ec');
        break;
      case 'bow':
        p(wx, ty - 1, 1, 2, '#8a6840');
        p(wx + 1, ty + 1, 1, 3, '#8a6840');
        p(wx, ty + 4, 1, 2, '#8a6840');
        p(wx, ty - 1, 1, 6, '#d8d8c8');
        p(wx, ty - 1, 1, 1, '#f4f4e0');
        break;
      case 'staff':
        p(wx, ty - 2, 1, 10, PAL.wood);
        p(wx, ty - 3, 1, 1, '#f8e858');
        p(wx, ty - 3, 1, 1, '#fff8c0');
        break;
      case 'tome':
        p(wx, ty + 2, 2, 2, s.trim);
        p(wx, ty + 2, 1, 2, PAL.white);
        p(wx, ty + 2, 2, 1, '#ffffff');
        break;
    }
  }

  const imageSprites = {}; /* kind -> [frame0Img, frame1Img], used by the fever remix */
  function setImageSprite(kind, frames) { imageSprites[kind] = frames || null; }

  const cache = new Map();
  function unit(kind, frame, side) {
    const key = kind + '|' + frame + '|' + (side ? 1 : 0);
    if (cache.has(key)) return cache.get(key);
    const c = cv(16, 16);
    const g = c.getContext('2d');
    if (imageSprites[kind]) {
      const im = imageSprites[kind][frame % imageSprites[kind].length];
      if (side) { g.translate(16, 0); g.scale(-1, 1); }
      if (im) {
        const scale = Math.min(16 / im.width, 16 / im.height);
        const w = im.width * scale, h = im.height * scale;
        g.imageSmoothingEnabled = false;
        g.drawImage(im, (16 - w) / 2, 16 - h, w, h);
      }
      cache.set(key, c);
      return c;
    }
    if (side) { g.translate(16, 0); g.scale(-1, 1); }
    drawUnit(g, kind, frame, side);
    cache.set(key, c);
    return c;
  }

  /* ================= PORTRAITS (32x32) ================= */

  function drawPortrait(g, id) {
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

    const SPEC = {
      rowan:  { hair: '#704828', armor: '#3a5cb0', trim: '#e8c850', style: 'swept' },
      brynn:  { hair: '#8a5c30', armor: '#a04830', trim: '#c8c8d0', style: 'pony' },
      sela:   { hair: '#386038', armor: '#3a7848', trim: '#8a6840', style: 'braid' },
      garrick:{ hair: '#402818', armor: '#8a5830', trim: '#c8c8d0', style: 'bald' },
      lia:    { hair: '#c87838', armor: '#7048a0', trim: '#c8c8d0', style: 'buns' },
      mira:   { hair: '#a86c38', armor: '#d8d8e0', trim: '#e8c850', style: 'bob' },
      vosk:   { hair: '#282830', armor: '#484858', trim: '#903838', style: 'scar' },
      npc:    { hair: '#5a4830', armor: '#7a6a50', trim: '#8a7858', style: 'plain' },
      villain:{ hair: '#181820', armor: '#3a3050', trim: '#705090', style: 'hood' },
    };
    const s = SPEC[id] || SPEC.npc;
    const SK = PAL.skin, SKD = PAL.skinDark, DK = '#181818', W_ = PAL.white;

    /* backdrop: radial-ish glow behind the head */
    p(0, 0, 32, 32, '#1c2a44');
    p(0, 0, 32, 16, '#28406a');
    p(8, 4, 16, 18, '#30507c');
    p(10, 6, 12, 14, '#3a5c8e');
    for (let i = 0; i < 32; i += 4) p(i, 28, 2, 1, '#2a4060');

    /* shoulders */
    p(4, 26, 24, 6, s.armor);
    p(2, 27, 4, 5, s.armor);
    p(26, 27, 4, 5, s.armor);
    p(4, 26, 24, 1, s.trim);
    p(13, 28, 6, 4, '#283048'); /* collar */

    /* neck + face */
    p(13, 22, 6, 5, SKD);
    p(10, 7, 12, 16, SK);
    p(9, 10, 1, 9, SK);
    p(22, 10, 1, 9, SK);
    p(11, 22, 10, 2, SK);
    p(12, 23, 8, 1, SKD);

    /* ears */
    p(8, 14, 2, 3, SK); p(22, 14, 2, 3, SK);

    /* eyes */
    p(11, 14, 3, 3, W_); p(18, 14, 3, 3, W_);
    p(12, 15, 2, 2, '#3050a0'); p(19, 15, 2, 2, '#3050a0');
    p(11, 13, 3, 1, s.hair); p(18, 13, 3, 1, s.hair); /* brows */
    p(12, 12, 2, 1, s.hair); p(19, 12, 2, 1, s.hair);

    /* nose + mouth */
    p(15, 16, 1, 3, SKD);
    p(13, 20, 6, 1, '#904838');
    p(14, 21, 4, 1, SKD);

    /* hairstyles */
    const H = s.hair;
    switch (s.style) {
      case 'swept':
        p(9, 5, 14, 4, H); p(8, 8, 3, 5, H); p(21, 8, 3, 3, H);
        p(10, 4, 8, 1, H); p(20, 9, 2, 1, H);
        break;
      case 'pony':
        p(9, 5, 14, 4, H); p(8, 8, 2, 4, H); p(22, 8, 2, 4, H);
        p(23, 6, 3, 12, H); p(23, 18, 2, 4, H);
        break;
      case 'braid':
        p(8, 6, 16, 4, H); p(7, 9, 3, 14, H); p(22, 9, 3, 5, H);
        p(8, 23, 2, 2, H);
        break;
      case 'bald':
        p(10, 6, 12, 2, SK);
        p(11, 19, 10, 4, H); /* beard */
        p(10, 17, 1, 5, H); p(21, 17, 1, 5, H);
        p(13, 23, 6, 1, H);
        break;
      case 'buns':
        p(9, 5, 14, 4, H); p(8, 8, 2, 6, H); p(22, 8, 2, 6, H);
        p(5, 6, 4, 4, H); p(23, 6, 4, 4, H);
        p(10, 9, 2, 2, H);
        break;
      case 'bob':
        p(8, 5, 16, 5, H); p(7, 9, 3, 10, H); p(22, 9, 3, 10, H);
        p(10, 9, 2, 1, H);
        p(9, 12, 1, 1, s.trim); p(22, 12, 1, 1, s.trim); /* circlet */
        break;
      case 'scar':
        p(9, 5, 14, 4, H); p(8, 8, 2, 4, H); p(22, 8, 2, 4, H);
        p(16, 9, 1, 6, '#a03030'); /* scar */
        p(11, 19, 10, 3, '#383028'); /* stubble */
        p(12, 22, 8, 1, '#383028');
        break;
      case 'hood':
        p(7, 3, 18, 6, s.armor); p(6, 8, 3, 12, s.armor); p(23, 8, 3, 12, s.armor);
        p(9, 9, 14, 12, '#181820');
        p(12, 14, 2, 2, '#c040c0'); p(18, 14, 2, 2, '#c040c0');
        break;
      default:
        p(9, 5, 14, 4, H); p(8, 8, 2, 5, H); p(22, 8, 2, 5, H);
    }
  }

  const imagePortraits = {}; /* id -> HTMLImageElement, used by the fever remix */
  function setImagePortrait(id, imgEl) { imagePortraits[id] = imgEl || null; }

  function portrait(id) {
    if (imagePortraits[id]) {
      const key = 'PIMG' + id;
      if (cache.has(key)) return cache.get(key);
      const c = cv(32, 32);
      const g = c.getContext('2d');
      g.fillStyle = '#0a0a0a';
      g.fillRect(0, 0, 32, 32);
      const im = imagePortraits[id];
      const scale = Math.min(32 / im.width, 32 / im.height);
      const w = im.width * scale, h = im.height * scale;
      g.imageSmoothingEnabled = false;
      g.drawImage(im, (32 - w) / 2, (32 - h) / 2, w, h);
      cache.set(key, c);
      return c;
    }
    const key = 'P' + id;
    if (cache.has(key)) return cache.get(key);
    const c = cv(32, 32);
    drawPortrait(c.getContext('2d'), id);
    cache.set(key, c);
    return c;
  }

  return { unit, portrait, setImagePortrait, setImageSprite, KINDS };
})();
