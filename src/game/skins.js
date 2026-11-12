export function grantSkin(state, skinId) {
  if (!state.ownedSkins.includes(skinId)) state.ownedSkins.push(skinId);
}

export function isUnlocked(data, state, skin) {
  if (state.ownedSkins.includes(skin.id)) return true;
  const u = skin.unlock || {};
  switch (u.type) {
    case 'default':
      return true;
    case 'shop':
      return state.ownedSkins.includes(skin.id);
    case 'defeat':
      return (state.defeated[u.monsterId] || 0) > 0;
    case 'kills':
      return state.kills >= (u.count || 0);
    case 'enhance':
      return state.highestEnhance >= (u.level || 0);
    default:
      return false;
  }
}

export function unlockSkinsFromProgress(data, state) {
  for (const skin of data.skins.catalog) {
    if (state.ownedSkins.includes(skin.id)) continue;
    const u = skin.unlock || {};
    let ok = false;
    if (u.type === 'defeat' && (state.defeated[u.monsterId] || 0) > 0) ok = true;
    if (u.type === 'kills' && state.kills >= u.count) ok = true;
    if (u.type === 'enhance' && state.highestEnhance >= u.level) ok = true;
    if (ok) grantSkin(state, skin.id);
  }
}

const EQUIP_SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'shield', 'frame', 'victoryFx'];

export function equipSkin(state, skin) {
  if (!state.ownedSkins.includes(skin.id)) return false;
  if (!EQUIP_SLOTS.includes(skin.slot)) return false;
  state.equipped[skin.slot] = skin.id;
  return true;
}

/** Unequip gear or 發脾氣特效 to empty. Frame stays (portrait needs a frame). */
export function unequipSkin(state, slot) {
  const CLEARABLE = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'shield', 'victoryFx'];
  if (!CLEARABLE.includes(slot)) return false;
  if (!state.equipped) state.equipped = {};
  if (!state.equipped[slot]) return false;
  state.equipped[slot] = null;
  return true;
}

export function getEquippedSkin(data, state, slot) {
  const id = state.equipped[slot];
  return data.skins.catalog.find((s) => s.id === id) || null;
}

export function getGearSkin(data, id) {
  return data.skins.catalog.find((s) => s.id === id) || null;
}

export function unlockHint(skin, data) {
  const u = skin.unlock || {};
  switch (u.type) {
    case 'default':
      return '初始擁有';
    case 'shop':
      return `商店 ${u.priceGold} 金`;
    case 'kills':
      return `擊殺 ${u.count}`;
    case 'enhance':
      return `強化達 +${u.level}`;
    case 'defeat':
      return '擊敗指定怪';
    default:
      return '特殊';
  }
}

export function rarityStars(n = 1) {
  const r = Math.max(1, Math.min(6, n || 1));
  return '★'.repeat(r) + '☆'.repeat(Math.max(0, 6 - r));
}

export const RARITY_META = {
  1: { name: '白', color: '#d8dde2', label: '一階' },
  2: { name: '綠', color: '#6fbf7a', label: '二階' },
  3: { name: '藍', color: '#7d9edc', label: '三階' },
  4: { name: '紫', color: '#a07dcc', label: '四階' },
  5: { name: '橘', color: '#e09a4a', label: '五階' },
  6: { name: '黃', color: '#f0d45c', label: '六階' },
};

export function rarityMeta(n = 1, data) {
  const r = Math.max(1, Math.min(6, Number(n) || 1));
  const fromData = data?.gear?.rarityTiers?.[String(r)];
  return fromData || RARITY_META[r] || RARITY_META[1];
}

export function rarityClass(n = 1) {
  return `rarity-${Math.max(1, Math.min(6, Number(n) || 1))}`;
}

export function getFrameBonuses(data, state) {
  const frame = getEquippedSkin(data, state, 'frame');
  const b = frame?.bonuses || {};
  return {
    hp: b.hp || 0,
    atkPct: b.atkPct || 0,
    critChance: b.critChance || 0,
  };
}

/** Equipped 發脾氣特效（slot victoryFx）— ATK% + AS; balanced in skins.json. */
export function getAuraBonuses(data, state) {
  const fx = getEquippedSkin(data, state, 'victoryFx');
  const b = fx?.bonuses || {};
  return {
    atkPct: Number(b.atkPct) || 0,
    asBonus: Number(b.asBonus) || 0,
  };
}

/** Map retired victoryFx ids → new aura ids (save migration). */
export const LEGACY_AURA_MAP = {
  fx_spark: 'fx_aura_white',
  fx_confetti: 'fx_aura_red',
  fx_steam: 'fx_aura_blue',
  fx_receipt: 'fx_aura_yellow',
};

export function migrateEquippedAura(state) {
  if (!state?.equipped) return state;
  const id = state.equipped.victoryFx;
  if (id && LEGACY_AURA_MAP[id]) state.equipped.victoryFx = LEGACY_AURA_MAP[id];
  if (Array.isArray(state.ownedSkins)) {
    state.ownedSkins = state.ownedSkins.map((sid) => LEGACY_AURA_MAP[sid] || sid);
    state.ownedSkins = Array.from(new Set(state.ownedSkins));
  }
  return state;
}

export function formatFrameBonusLines(skin) {
  const b = skin?.bonuses || {};
  const lines = [];
  if (b.hp) lines.push(`HP+${b.hp}`);
  if (b.atkPct) lines.push(`攻+${Math.round(b.atkPct * 100)}%`);
  if (b.critChance) lines.push(`暴擊+${Math.round(b.critChance * 100)}%`);
  if (!lines.length) lines.push('無加成');
  return lines;
}

export function formatFrameBonusChips(frame) {
  return formatFrameBonusLines(frame).map((label) => {
    if (label.startsWith('HP')) return { kind: 'hp', label };
    if (label.startsWith('攻')) return { kind: 'atk', label };
    if (label.startsWith('暴')) return { kind: 'crit', label };
    return { kind: 'none', label };
  });
}

export function formatAuraBonusLines(skin) {
  const b = skin?.bonuses || {};
  const lines = [];
  if (b.atkPct) lines.push(`攻+${Math.round(b.atkPct * 100)}%`);
  if (b.asBonus) lines.push(`攻速+${Number(b.asBonus).toFixed(2)}`);
  if (!lines.length) lines.push('無加成');
  return lines;
}

export function formatAuraBonusChips(fx) {
  return formatAuraBonusLines(fx).map((label) => {
    if (label.startsWith('攻速')) return { kind: 'as', label };
    if (label.startsWith('攻')) return { kind: 'atk', label };
    return { kind: 'none', label };
  });
}

export function unlockAllSkins(data, state) {
  for (const s of data.skins.catalog) grantSkin(state, s.id);
}
