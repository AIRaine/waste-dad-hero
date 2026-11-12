function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`;
}

export function weaponSvg(palette = {}, level = 0, type = '劍', { motif } = {}) {
  const c1 = palette.primary || '#d8dde2';
  const c2 = palette.accent || '#8a93a3';
  const edge = palette.edge || '#243040';
  const glow = level >= 6 ? `<rect x="2" y="2" width="28" height="32" fill="${c2}" opacity="0.15"/>` : '';
  const kind = motif || type;
  const shapes = {
    dao: `<path d="M10 28 L14 6 L18 6 L16 28 Z" fill="${c1}"/><rect x="12" y="28" width="4" height="6" fill="${edge}"/><rect x="8" y="30" width="12" height="2" fill="${c2}"/>`,
    jian: `<rect x="14" y="4" width="4" height="22" fill="${c1}"/><rect x="10" y="24" width="12" height="3" fill="${c2}"/><rect x="13" y="27" width="6" height="7" fill="${edge}"/>`,
    duanjian: `<rect x="13" y="10" width="6" height="16" fill="${c1}"/><rect x="10" y="24" width="12" height="3" fill="${c2}"/><rect x="14" y="27" width="4" height="6" fill="${edge}"/>`,
    bishou: `<path d="M16 6 L20 22 L16 26 L12 22 Z" fill="${c1}"/><rect x="14" y="26" width="4" height="6" fill="${edge}"/>`,
    gong: `<path d="M8 6 Q4 18 8 30" stroke="${c1}" stroke-width="3" fill="none"/><path d="M8 6 L22 18 L8 30" stroke="${c2}" stroke-width="2" fill="none"/><rect x="20" y="16" width="8" height="3" fill="${edge}"/>`,
    qiang: `<rect x="15" y="2" width="2" height="30" fill="${edge}"/><path d="M12 2 L16 10 L20 2 Z" fill="${c1}"/><rect x="13" y="18" width="6" height="2" fill="${c2}"/>`,
    dun: `<path d="M6 8 L26 8 L24 28 L16 34 L8 28 Z" fill="${c1}" stroke="${edge}"/><circle cx="16" cy="18" r="4" fill="${c2}"/>`,
    fu: `<path d="M8 8 L24 8 L22 18 L10 18 Z" fill="${c1}"/><rect x="14" y="18" width="4" height="14" fill="${edge}"/><rect x="10" y="10" width="12" height="4" fill="${c2}"/>`,
    fazhang: `<rect x="15" y="4" width="2" height="28" fill="${edge}"/><circle cx="16" cy="6" r="5" fill="${c1}"/><circle cx="16" cy="6" r="2" fill="${c2}"/>`,
    shuangdao: `<path d="M6 8 L10 28 L8 30 L4 10 Z" fill="${c1}"/><path d="M26 8 L22 28 L24 30 L28 10 Z" fill="${c2}"/><rect x="14" y="20" width="4" height="8" fill="${edge}"/>`,
  };
  const map = {
    刀: 'dao', 劍: 'jian', 短劍: 'duanjian', 匕首: 'bishou', 弓: 'gong',
    長槍: 'qiang', 盾: 'dun', 斧: 'fu', 法杖: 'fazhang', 雙刀: 'shuangdao',
  };
  const key = shapes[kind] ? kind : map[type] || 'jian';
  return svg(32, 36, `${glow}${shapes[key] || shapes.jian}`);
}

/** Standalone gear icon for catalogs / enhance list. */
export function gearSvg(slot = 'armor', palette = {}, { motif } = {}) {
  const c1 = palette.primary || '#c9a227';
  const c2 = palette.accent || '#6a5a20';
  const edge = palette.edge || '#243040';
  const m = motif || 'default';
  const shapes = {
    helmet: {
      box: `<rect x="8" y="10" width="16" height="14" fill="${c1}"/><rect x="10" y="14" width="12" height="4" fill="${edge}"/><rect x="12" y="6" width="8" height="4" fill="${c2}"/>`,
      hardhat: `<path d="M6 18 L10 10 L22 10 L26 18 Z" fill="${c1}"/><rect x="4" y="18" width="24" height="4" fill="${c2}"/>`,
      iron: `<rect x="8" y="8" width="16" height="16" fill="${c1}"/><rect x="12" y="14" width="8" height="4" fill="${edge}"/><rect x="14" y="4" width="4" height="4" fill="${c2}"/>`,
      knight: `<rect x="8" y="8" width="16" height="18" fill="${c1}"/><rect x="12" y="14" width="8" height="5" fill="${edge}"/><rect x="10" y="4" width="4" height="4" fill="${c2}"/><rect x="18" y="4" width="4" height="4" fill="${c2}"/>`,
      crown: `<rect x="8" y="14" width="16" height="10" fill="${c1}"/><path d="M8 14 L12 6 L16 12 L20 6 L24 14 Z" fill="${c2}"/>`,
    },
    armor: {
      vest: `<rect x="8" y="6" width="16" height="22" fill="${c1}"/><rect x="10" y="10" width="12" height="14" fill="${c2}" opacity="0.45"/><rect x="14" y="8" width="4" height="18" fill="${edge}"/>`,
      leather: `<rect x="7" y="6" width="18" height="22" fill="${c1}"/><rect x="10" y="10" width="12" height="3" fill="${c2}"/><rect x="10" y="16" width="12" height="3" fill="${c2}"/>`,
      mail: `<rect x="8" y="6" width="16" height="22" fill="${c1}"/><rect x="10" y="10" width="3" height="3" fill="${edge}"/><rect x="15" y="10" width="3" height="3" fill="${edge}"/><rect x="20" y="10" width="3" height="3" fill="${edge}"/><rect x="12" y="16" width="3" height="3" fill="${edge}"/><rect x="17" y="16" width="3" height="3" fill="${edge}"/>`,
      plate: `<rect x="6" y="6" width="20" height="22" fill="${c1}"/><rect x="10" y="10" width="12" height="14" fill="${c2}"/><rect x="14" y="8" width="4" height="18" fill="${edge}"/>`,
      robe: `<path d="M8 6 L24 6 L26 28 L6 28 Z" fill="${c1}"/><rect x="12" y="10" width="8" height="12" fill="${c2}" opacity="0.5"/>`,
    },
    boots: {
      slipper: `<rect x="6" y="18" width="8" height="8" fill="${c1}"/><rect x="18" y="18" width="8" height="8" fill="${c1}"/><rect x="6" y="24" width="10" height="4" fill="${c2}"/><rect x="18" y="24" width="10" height="4" fill="${c2}"/>`,
      sneaker: `<rect x="6" y="16" width="8" height="10" fill="${c1}"/><rect x="18" y="16" width="8" height="10" fill="${c1}"/><rect x="6" y="24" width="10" height="3" fill="${edge}"/><rect x="18" y="24" width="10" height="3" fill="${edge}"/>`,
      hike: `<rect x="6" y="14" width="8" height="12" fill="${c1}"/><rect x="18" y="14" width="8" height="12" fill="${c1}"/><rect x="5" y="24" width="10" height="4" fill="${c2}"/><rect x="17" y="24" width="10" height="4" fill="${c2}"/>`,
      iron: `<rect x="6" y="14" width="8" height="14" fill="${c1}"/><rect x="18" y="14" width="8" height="14" fill="${c1}"/><rect x="8" y="18" width="4" height="2" fill="${edge}"/><rect x="20" y="18" width="4" height="2" fill="${edge}"/>`,
      swift: `<rect x="6" y="16" width="8" height="10" fill="${c1}"/><rect x="18" y="16" width="8" height="10" fill="${c1}"/><path d="M6 20 L2 18 L6 16" fill="${c2}"/><path d="M26 20 L30 18 L26 16" fill="${c2}"/>`,
    },
    gloves: {
      rubber: `<rect x="6" y="10" width="8" height="14" fill="${c1}"/><rect x="18" y="10" width="8" height="14" fill="${c1}"/><rect x="6" y="22" width="3" height="4" fill="${c2}"/><rect x="23" y="22" width="3" height="4" fill="${c2}"/>`,
      cloth: `<rect x="7" y="10" width="7" height="14" fill="${c1}"/><rect x="18" y="10" width="7" height="14" fill="${c1}"/><rect x="8" y="14" width="5" height="2" fill="${c2}"/><rect x="19" y="14" width="5" height="2" fill="${c2}"/>`,
      leather: `<rect x="6" y="8" width="8" height="16" fill="${c1}"/><rect x="18" y="8" width="8" height="16" fill="${c1}"/><rect x="8" y="12" width="4" height="8" fill="${edge}"/><rect x="20" y="12" width="4" height="8" fill="${edge}"/>`,
      iron: `<rect x="6" y="8" width="8" height="16" fill="${c1}"/><rect x="18" y="8" width="8" height="16" fill="${c1}"/><rect x="7" y="10" width="6" height="3" fill="${c2}"/><rect x="19" y="10" width="6" height="3" fill="${c2}"/>`,
      crit: `<rect x="6" y="8" width="8" height="16" fill="${c1}"/><rect x="18" y="8" width="8" height="16" fill="${c1}"/><circle cx="10" cy="16" r="2" fill="${c2}"/><circle cx="22" cy="16" r="2" fill="${c2}"/>`,
    },
    shield: {
      pot: `<ellipse cx="16" cy="16" rx="12" ry="12" fill="${c1}"/><ellipse cx="16" cy="16" rx="6" ry="6" fill="${c2}"/><rect x="14" y="4" width="4" height="4" fill="${edge}"/>`,
      wood: `<path d="M6 8 L26 8 L24 28 L16 32 L8 28 Z" fill="${c1}"/><circle cx="16" cy="18" r="4" fill="${c2}"/>`,
      iron: `<path d="M6 6 L26 6 L24 26 L16 34 L8 26 Z" fill="${c1}"/><rect x="12" y="12" width="8" height="10" fill="${edge}"/><circle cx="16" cy="16" r="2" fill="${c2}"/>`,
      tower: `<rect x="8" y="4" width="16" height="28" fill="${c1}"/><rect x="11" y="8" width="10" height="20" fill="${c2}"/><rect x="14" y="12" width="4" height="12" fill="${edge}"/>`,
      guard: `<path d="M6 6 L26 6 L24 24 L16 34 L8 24 Z" fill="${c1}"/><path d="M12 12 L16 20 L20 12 Z" fill="${c2}"/>`,
    },
  };
  const slotShapes = shapes[slot] || shapes.armor;
  const body = slotShapes[m] || Object.values(slotShapes)[0];
  return svg(32, 36, body);
}

/** Pixel dad avatar. `avatar` = { hair, hairColor, face, skin, body, trait }; `gear` = equipped slot skins. */
export function playerSvg(palette = {}, avatar = {}, gear = {}) {
  const armorPal = gear.armor?.palette;
  const cloth = armorPal?.primary || palette?.primary || '#c9a227';
  const cloth2 = armorPal?.accent || palette?.accent || '#6a5a20';
  const skinMap = {
    warm: '#f0d2b0',
    fair: '#f7e4d0',
    tan: '#d0a07a',
    deep: '#8d5a3c',
    rosy: '#efc0b0',
  };
  const hairMap = {
    black: '#2a2430',
    brown: '#6b4423',
    gray: '#9aa3ad',
    blonde: '#d4b06a',
    blue: '#3a5f8a',
  };
  const skin = skinMap[avatar.skin] || skinMap.warm;
  const hair = hairMap[avatar.hairColor] || hairMap.black;
  const body = avatar.body || 'dad';
  const face = avatar.face || 'round';
  const hairStyle = avatar.hair || 'short';
  const trait = avatar.trait || 'none';

  const bootPal = gear.boots?.palette;
  const bootC = bootPal?.primary || cloth2;
  const bootC2 = bootPal?.accent || cloth2;
  const glovePal = gear.gloves?.palette;
  const gloveC = glovePal?.primary || skin;
  const helmPal = gear.helmet?.palette;
  const helmC = helmPal?.primary;
  const helmC2 = helmPal?.accent || helmC;
  const shieldPal = gear.shield?.palette;
  const shieldC = shieldPal?.primary;
  const shieldC2 = shieldPal?.accent || shieldC;
  const edge = '#243040';

  // Body / torso / legs by body type (pixel blocks)
  let torso;
  let arms;
  let legs;
  if (body === 'stocky') {
    torso = `<rect x="8" y="20" width="24" height="16" fill="${cloth}"/>`;
    arms = `<rect x="2" y="22" width="7" height="12" fill="${skin}"/><rect x="31" y="22" width="7" height="12" fill="${skin}"/>`;
    legs = `<rect x="8" y="36" width="10" height="10" fill="${bootC}"/><rect x="22" y="36" width="10" height="10" fill="${bootC}"/>`;
  } else if (body === 'slim') {
    torso = `<rect x="12" y="20" width="16" height="16" fill="${cloth}"/>`;
    arms = `<rect x="6" y="22" width="5" height="12" fill="${skin}"/><rect x="29" y="22" width="5" height="12" fill="${skin}"/>`;
    legs = `<rect x="12" y="36" width="6" height="10" fill="${bootC}"/><rect x="22" y="36" width="6" height="10" fill="${bootC}"/>`;
  } else if (body === 'tall') {
    torso = `<rect x="10" y="18" width="20" height="18" fill="${cloth}"/>`;
    arms = `<rect x="4" y="20" width="6" height="14" fill="${skin}"/><rect x="30" y="20" width="6" height="14" fill="${skin}"/>`;
    legs = `<rect x="10" y="36" width="7" height="11" fill="${bootC}"/><rect x="23" y="36" width="7" height="11" fill="${bootC}"/>`;
  } else if (body === 'round') {
    torso = `<rect x="7" y="20" width="26" height="17" fill="${cloth}"/><rect x="9" y="24" width="22" height="10" fill="${cloth2}" opacity="0.35"/>`;
    arms = `<rect x="2" y="23" width="7" height="11" fill="${skin}"/><rect x="31" y="23" width="7" height="11" fill="${skin}"/>`;
    legs = `<rect x="9" y="37" width="9" height="9" fill="${bootC}"/><rect x="22" y="37" width="9" height="9" fill="${bootC}"/>`;
  } else {
    // dad
    torso = `<rect x="10" y="20" width="20" height="16" fill="${cloth}"/>`;
    arms = `<rect x="4" y="22" width="6" height="12" fill="${skin}"/><rect x="30" y="22" width="6" height="12" fill="${skin}"/>`;
    legs = `<rect x="8" y="36" width="8" height="10" fill="${bootC}"/><rect x="24" y="36" width="8" height="10" fill="${bootC}"/>`;
  }

  // Armor motif accents on torso
  let armorAccent = '';
  const armorMotif = gear.armor?.motif;
  if (armorMotif === 'mail') {
    armorAccent = `<rect x="12" y="24" width="3" height="3" fill="${edge}"/><rect x="18" y="24" width="3" height="3" fill="${edge}"/><rect x="24" y="24" width="3" height="3" fill="${edge}"/><rect x="15" y="28" width="3" height="3" fill="${edge}"/><rect x="21" y="28" width="3" height="3" fill="${edge}"/>`;
  } else if (armorMotif === 'plate' || armorMotif === 'robe') {
    armorAccent = `<rect x="14" y="22" width="12" height="12" fill="${cloth2}" opacity="0.4"/><rect x="18" y="22" width="4" height="12" fill="${edge}" opacity="0.55"/>`;
  } else if (armorMotif === 'leather') {
    armorAccent = `<rect x="12" y="24" width="16" height="2" fill="${cloth2}"/><rect x="12" y="30" width="16" height="2" fill="${cloth2}"/>`;
  } else if (armorMotif === 'vest') {
    armorAccent = `<rect x="18" y="22" width="4" height="12" fill="${edge}" opacity="0.45"/>`;
  }

  // Boot soles
  let bootLayer = `<rect x="8" y="44" width="8" height="2" fill="${bootC2}"/><rect x="24" y="44" width="8" height="2" fill="${bootC2}"/>`;
  if (gear.boots?.motif === 'swift') {
    bootLayer += `<rect x="6" y="40" width="2" height="4" fill="${bootC2}"/><rect x="32" y="40" width="2" height="4" fill="${bootC2}"/>`;
  }

  // Gloves on arm tips
  let gloveLayer = '';
  if (gear.gloves) {
    gloveLayer = `<rect x="4" y="30" width="6" height="5" fill="${gloveC}"/><rect x="30" y="30" width="6" height="5" fill="${gloveC}"/>`;
  }

  let head;
  if (face === 'square') {
    head = `<rect x="11" y="6" width="18" height="14" fill="${skin}"/>`;
  } else if (face === 'oval') {
    head = `<rect x="12" y="5" width="16" height="15" fill="${skin}"/><rect x="13" y="4" width="14" height="2" fill="${skin}"/>`;
  } else if (face === 'cheeky') {
    head = `<rect x="10" y="7" width="20" height="13" fill="${skin}"/><rect x="9" y="12" width="3" height="6" fill="${skin}"/><rect x="28" y="12" width="3" height="6" fill="${skin}"/>`;
  } else if (face === 'slim') {
    head = `<rect x="13" y="5" width="14" height="15" fill="${skin}"/>`;
  } else {
    head = `<rect x="12" y="6" width="16" height="14" fill="${skin}"/>`;
  }

  // Eyes (common)
  const eyes = `<rect x="15" y="11" width="2" height="2" fill="#1a1010"/><rect x="23" y="11" width="2" height="2" fill="#1a1010"/>`;

  let hairLayer = '';
  if (hairStyle === 'bowl') {
    hairLayer = `<rect x="11" y="4" width="18" height="6" fill="${hair}"/><rect x="10" y="8" width="3" height="6" fill="${hair}"/><rect x="27" y="8" width="3" height="6" fill="${hair}"/>`;
  } else if (hairStyle === 'spiky') {
    hairLayer = `<rect x="12" y="5" width="16" height="4" fill="${hair}"/><rect x="11" y="2" width="3" height="4" fill="${hair}"/><rect x="16" y="1" width="3" height="5" fill="${hair}"/><rect x="21" y="1" width="3" height="5" fill="${hair}"/><rect x="26" y="2" width="3" height="4" fill="${hair}"/>`;
  } else if (hairStyle === 'bald') {
    hairLayer = `<rect x="14" y="5" width="12" height="2" fill="${hair}" opacity="0.55"/>`;
  } else if (hairStyle === 'ponytail') {
    hairLayer = `<rect x="12" y="4" width="16" height="5" fill="${hair}"/><rect x="28" y="8" width="4" height="10" fill="${hair}"/><rect x="29" y="18" width="3" height="4" fill="${hair}"/>`;
  } else {
    // short
    hairLayer = `<rect x="12" y="4" width="16" height="5" fill="${hair}"/><rect x="11" y="7" width="2" height="4" fill="${hair}"/><rect x="27" y="7" width="2" height="4" fill="${hair}"/>`;
  }

  let traitLayer = '';
  if (trait === 'glasses') {
    traitLayer = `<rect x="13" y="10" width="6" height="5" fill="none" stroke="#243040" stroke-width="1"/><rect x="21" y="10" width="6" height="5" fill="none" stroke="#243040" stroke-width="1"/><rect x="19" y="12" width="2" height="1" fill="#243040"/>`;
  } else if (trait === 'beard') {
    traitLayer = `<rect x="14" y="16" width="12" height="4" fill="${hair}"/><rect x="15" y="19" width="10" height="2" fill="${hair}"/>`;
  } else if (trait === 'mole') {
    traitLayer = `<rect x="26" y="14" width="2" height="2" fill="#5a3a28"/>`;
  } else if (trait === 'blush') {
    traitLayer = `<rect x="13" y="14" width="3" height="2" fill="#e89a9a" opacity="0.8"/><rect x="24" y="14" width="3" height="2" fill="#e89a9a" opacity="0.8"/>`;
  }

  // Helmet overlays hair
  let helmetLayer = '';
  if (gear.helmet && helmC) {
    const hm = gear.helmet.motif;
    if (hm === 'hardhat') {
      helmetLayer = `<path d="M10 8 L14 2 L26 2 L30 8 Z" fill="${helmC}"/><rect x="8" y="8" width="24" height="3" fill="${helmC2}"/>`;
    } else if (hm === 'crown') {
      helmetLayer = `<rect x="12" y="6" width="16" height="6" fill="${helmC}"/><path d="M12 6 L15 1 L20 5 L25 1 L28 6 Z" fill="${helmC2}"/>`;
    } else if (hm === 'knight') {
      helmetLayer = `<rect x="11" y="2" width="18" height="12" fill="${helmC}"/><rect x="15" y="8" width="10" height="4" fill="${edge}"/><rect x="13" y="1" width="4" height="3" fill="${helmC2}"/><rect x="23" y="1" width="4" height="3" fill="${helmC2}"/>`;
    } else if (hm === 'iron') {
      helmetLayer = `<rect x="11" y="3" width="18" height="11" fill="${helmC}"/><rect x="15" y="8" width="10" height="3" fill="${edge}"/>`;
    } else {
      // box
      helmetLayer = `<rect x="11" y="3" width="18" height="10" fill="${helmC}"/><rect x="14" y="7" width="12" height="3" fill="${edge}"/>`;
    }
  }

  // Shield on player's left (screen left)
  let shieldLayer = '';
  if (gear.shield && shieldC) {
    const sm = gear.shield.motif;
    if (sm === 'tower') {
      shieldLayer = `<rect x="0" y="18" width="8" height="18" fill="${shieldC}"/><rect x="1" y="20" width="6" height="12" fill="${shieldC2}" opacity="0.55"/>`;
    } else if (sm === 'pot') {
      shieldLayer = `<ellipse cx="4" cy="28" rx="5" ry="5" fill="${shieldC}"/><ellipse cx="4" cy="28" rx="2" ry="2" fill="${shieldC2}"/>`;
    } else {
      shieldLayer = `<path d="M1 20 L9 20 L8 34 L5 38 L2 34 Z" fill="${shieldC}"/><circle cx="5" cy="28" r="2" fill="${shieldC2}"/>`;
    }
  }

  return svg(
    40,
    48,
    `${shieldLayer}${legs}${bootLayer}${torso}${armorAccent}${arms}${gloveLayer}${head}${eyes}${hairLayer}${traitLayer}${helmetLayer}`,
  );
}

export function monsterSvg(shape = 'slime', color = '#6a7888', { scale = 1, role } = {}) {
  const c = color;
  const eye = '#1a1010';
  const bodies = {
    slime: `<ellipse cx="24" cy="30" rx="16" ry="12" fill="${c}"/><circle cx="18" cy="26" r="2" fill="${eye}"/><circle cx="28" cy="26" r="2" fill="${eye}"/>`,
    bat: `<path d="M8 24 Q24 8 40 24 Q32 20 24 28 Q16 20 8 24" fill="${c}"/><circle cx="20" cy="22" r="1.5" fill="${eye}"/><circle cx="28" cy="22" r="1.5" fill="${eye}"/>`,
    golem: `<rect x="12" y="10" width="24" height="28" fill="${c}"/><rect x="16" y="16" width="4" height="4" fill="${eye}"/><rect x="28" y="16" width="4" height="4" fill="${eye}"/><rect x="20" y="26" width="8" height="3" fill="#243040"/>`,
    dummy: `<rect x="20" y="36" width="8" height="6" fill="#5a4030"/><rect x="18" y="8" width="12" height="28" rx="2" fill="${c}"/><rect x="10" y="14" width="8" height="4" fill="${c}"/><rect x="30" y="14" width="8" height="4" fill="${c}"/><circle cx="22" cy="16" r="1.5" fill="${eye}"/><circle cx="26" cy="16" r="1.5" fill="${eye}"/><path d="M20 22 H28" stroke="#5a4030" stroke-width="2"/>`,
    wolf: `<ellipse cx="24" cy="28" rx="14" ry="10" fill="${c}"/><path d="M12 18 L18 24 L12 24 Z" fill="${c}"/><circle cx="28" cy="24" r="2" fill="${eye}"/>`,
    plant: `<rect x="22" y="22" width="4" height="16" fill="#3d6b4f"/><circle cx="24" cy="18" r="10" fill="${c}"/><circle cx="20" cy="16" r="1.5" fill="${eye}"/><circle cx="28" cy="16" r="1.5" fill="${eye}"/>`,
    skeleton: `<circle cx="24" cy="14" r="8" fill="${c}"/><rect x="20" y="22" width="8" height="16" fill="${c}"/><rect x="14" y="24" width="6" height="2" fill="${c}"/><rect x="28" y="24" width="6" height="2" fill="${c}"/><rect x="20" y="12" width="2" height="2" fill="${eye}"/><rect x="26" y="12" width="2" height="2" fill="${eye}"/>`,
    crab: `<ellipse cx="24" cy="28" rx="14" ry="8" fill="${c}"/><path d="M6 20 L14 26 L8 28 Z" fill="${c}"/><path d="M42 20 L34 26 L40 28 Z" fill="${c}"/><circle cx="18" cy="26" r="2" fill="${eye}"/><circle cx="30" cy="26" r="2" fill="${eye}"/>`,
    ghost: `<path d="M14 12 Q24 4 34 12 L34 34 L30 30 L26 34 L22 30 L18 34 L14 30 Z" fill="${c}" opacity="0.9"/><circle cx="20" cy="18" r="2" fill="${eye}"/><circle cx="28" cy="18" r="2" fill="${eye}"/>`,
    beetle: `<ellipse cx="24" cy="26" rx="14" ry="12" fill="${c}"/><line x1="24" y1="14" x2="24" y2="38" stroke="#243040" stroke-width="2"/><circle cx="18" cy="24" r="2" fill="${eye}"/><circle cx="30" cy="24" r="2" fill="${eye}"/>`,
    dragon: `<ellipse cx="24" cy="26" rx="16" ry="12" fill="${c}"/><path d="M8 16 L16 22 L8 22 Z" fill="${c}"/><path d="M40 16 L32 22 L40 22 Z" fill="${c}"/><circle cx="18" cy="24" r="2" fill="#ffe08a"/><circle cx="30" cy="24" r="2" fill="#ffe08a"/>`,
  };
  const badge =
    role === 'boss'
      ? `<rect x="1" y="1" width="10" height="6" fill="#c45c5c"/><text x="2" y="6" font-size="5" fill="#fff">B</text>`
      : role === 'elite'
        ? `<rect x="1" y="1" width="10" height="6" fill="#c9a227"/><text x="2" y="6" font-size="5" fill="#1a1408">E</text>`
        : '';
  const s = Math.max(0.85, Math.min(1.4, scale || 1));
  return svg(
    48,
    48,
    `<g transform="translate(24 24) scale(${s}) translate(-24 -24)">${bodies[shape] || bodies.slime}${badge}</g>`,
  );
}

export function itemIconSvg(id) {
  const colors = {
    bless_scroll: '#7dcea0',
    protect_scroll: '#7d9edc',
    stable_charm: '#e0b35a',
    double_loot: '#d4a24c',
  };
  const c = colors[id] || '#9bb0b8';
  return svg(32, 32, `<rect x="6" y="4" width="20" height="24" rx="2" fill="${c}"/><rect x="10" y="10" width="12" height="2" fill="#142028"/><rect x="10" y="15" width="12" height="2" fill="#142028"/>`);
}
