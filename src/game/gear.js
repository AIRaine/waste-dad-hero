import { getGachaBonuses } from './gacha.js';
import { getEquippedSkin, getGearSkin } from './skins.js';

export const ARMOR_SLOTS = ['helmet', 'armor', 'gloves', 'boots', 'shield'];
export const ENHANCEABLE_SLOTS = ['weapon', ...ARMOR_SLOTS];

export function gearSlotDefs(data) {
  return data.gear?.slots || [
    { id: 'weapon', label: '武器' },
    { id: 'helmet', label: '頭盔' },
    { id: 'armor', label: '護甲' },
    { id: 'gloves', label: '手套' },
    { id: 'boots', label: '靴子' },
    { id: 'shield', label: '盾牌' },
  ];
}

export function ensureGearState(data, state) {
  if (!state.gearLevels) state.gearLevels = {};
  if (!state.equipped) state.equipped = {};
  for (const slot of ENHANCEABLE_SLOTS) {
    if (!state.equipped[slot]) {
      const def = data.skins.catalog.find(
        (s) => s.slot === slot && s.unlock?.type === 'default',
      );
      if (def) {
        state.equipped[slot] = def.id;
        if (!state.ownedSkins.includes(def.id)) state.ownedSkins.push(def.id);
      }
    }
  }
  const owned = ownedEnhanceableSkins(data, state);
  for (const skin of owned) {
    if (state.gearLevels[skin.id] == null) state.gearLevels[skin.id] = 0;
  }
  const eq = state.equipped.weapon;
  if (!state.enhanceFocusId || !state.ownedSkins.includes(state.enhanceFocusId)) {
    state.enhanceFocusId = eq || owned[0]?.id || 'blade_default';
  }
}

export function ownedEnhanceableSkins(data, state) {
  return data.skins.catalog.filter(
    (s) => ENHANCEABLE_SLOTS.includes(s.slot) && state.ownedSkins.includes(s.id),
  );
}

export function ownedWeaponSkins(data, state) {
  return data.skins.catalog.filter((s) => s.slot === 'weapon' && state.ownedSkins.includes(s.id));
}

export function ownedSlotSkins(data, state, slot) {
  return data.skins.catalog.filter((s) => s.slot === slot && state.ownedSkins.includes(s.id));
}

export function filterOwnedWeapons(data, state, q = '') {
  return filterOwnedGear(data, state, q, 'weapon');
}

/** Catalog / list order: slot (盔→甲→手套→靴→盾) → rarity → name. */
export function sortCatalogGear(list) {
  const order = Object.fromEntries(ARMOR_SLOTS.map((id, i) => [id, i]));
  return list
    .slice()
    .sort(
      (a, b) =>
        (order[a.slot] ?? 99) - (order[b.slot] ?? 99) ||
        (Number(a.rarity) || 0) - (Number(b.rarity) || 0) ||
        (a.name || '').localeCompare(b.name || '', 'zh-Hant'),
    );
}

export function filterOwnedGear(data, state, q = '', slot = null) {
  const query = (q || '').trim();
  const order = Object.fromEntries(ENHANCEABLE_SLOTS.map((id, i) => [id, i]));
  let list = ownedEnhanceableSkins(data, state);
  if (slot) list = list.filter((s) => s.slot === slot);
  if (query) {
    list = list.filter(
      (s) =>
        s.name.includes(query) ||
        (s.type || '').includes(query) ||
        (s.slot || '').includes(query),
    );
  }
  return list.sort(
    (a, b) =>
      (order[a.slot] ?? 99) - (order[b.slot] ?? 99) ||
      (Number(a.rarity) || 0) - (Number(b.rarity) || 0) ||
      a.name.localeCompare(b.name, 'zh-Hant'),
  );
}

export function ensureHiddenGearVisual(state) {
  if (!state.hiddenGearVisual || typeof state.hiddenGearVisual !== 'object') {
    state.hiddenGearVisual = {};
  }
  for (const slot of ARMOR_SLOTS) {
    if (typeof state.hiddenGearVisual[slot] !== 'boolean') {
      state.hiddenGearVisual[slot] = !!state.hiddenGearVisual[slot];
    }
  }
  return state.hiddenGearVisual;
}

export function isGearVisualHidden(state, slot) {
  ensureHiddenGearVisual(state);
  return !!state.hiddenGearVisual[slot];
}

export function setGearVisualHidden(state, slot, hidden) {
  if (!ARMOR_SLOTS.includes(slot)) return false;
  ensureHiddenGearVisual(state);
  state.hiddenGearVisual[slot] = !!hidden;
  return state.hiddenGearVisual[slot];
}

export function toggleGearVisualHidden(state, slot) {
  if (!ARMOR_SLOTS.includes(slot)) return false;
  ensureHiddenGearVisual(state);
  state.hiddenGearVisual[slot] = !state.hiddenGearVisual[slot];
  return state.hiddenGearVisual[slot];
}

/** Equipped gear for avatar drawing — armor slots can be worn but visually hidden. */
export function visibleGearBundle(data, state) {
  const bundle = equippedGearBundle(data, state);
  ensureHiddenGearVisual(state);
  for (const slot of ARMOR_SLOTS) {
    if (state.hiddenGearVisual[slot]) bundle[slot] = null;
  }
  return bundle;
}

export function getGearLevel(state, gearId) {
  return state.gearLevels?.[gearId] ?? 0;
}

export function equippedWeaponLevel(state) {
  return getGearLevel(state, state.equipped.weapon);
}

/** Per-piece enhanced ATK contribution (weapon uses enhance table; armor uses flat atkBonus + tiny enhance). */
export function pieceAtk(data, state, skin) {
  if (!skin) return 0;
  const lv = getGearLevel(state, skin.id);
  if (skin.slot === 'weapon') {
    const base = data.enhance.baseAtk + lv * data.enhance.atkPerLevel;
    return base + (skin.atkBonus || 0);
  }
  const per = data.gear?.formulas?.atkPerEnhanceArmor ?? 0;
  return (skin.atkBonus || 0) + lv * per;
}

export function pieceDef(data, state, skin) {
  if (!skin) return 0;
  const lv = getGearLevel(state, skin.id);
  const per = data.gear?.formulas?.defPerEnhance ?? 1;
  return (skin.def || 0) + lv * per;
}

export function gearAtk(data, state, gearId) {
  // Back-compat: when called with weapon id, return weapon piece atk only
  const skin = getGearSkin(data, gearId);
  return pieceAtk(data, state, skin);
}

export function totalPlayerAtk(data, state) {
  let atk = 0;
  for (const slot of ENHANCEABLE_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    atk += pieceAtk(data, state, skin);
  }
  return atk;
}

export function totalPlayerDef(data, state) {
  let def = 0;
  for (const slot of ARMOR_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    def += pieceDef(data, state, skin);
  }
  return def;
}

export function totalMitigationBonus(data, state) {
  let mit = 0;
  for (const slot of ARMOR_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    mit += skin?.mitigation || 0;
  }
  return mit;
}

export function totalBlockChance(data, state) {
  let b = 0;
  for (const slot of ARMOR_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    b += skin?.blockChance || 0;
  }
  const cap = data.gear?.formulas?.blockChanceCap ?? 0.35;
  return Math.min(cap, b);
}

/** Armor-driven counter chance after taking a hit (not on training dummy). */
export function totalCounterChance(data, state) {
  let c = 0;
  for (const slot of ARMOR_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    c += skin?.counterChance || 0;
  }
  const cap = data.gear?.formulas?.counterChanceCap ?? 0.35;
  return Math.min(cap, c);
}

/** Crit mainly from weapons (+ gloves / frame). */
export function totalGearCrit(data, state) {
  let c = 0;
  for (const slot of ENHANCEABLE_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    c += skin?.critChance || 0;
  }
  const cap = data.gear?.formulas?.critChanceCap ?? 0.55;
  return Math.min(cap, c);
}

export function totalGearAsBonus(data, state) {
  let as = 0;
  for (const slot of ENHANCEABLE_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    as += skin?.asBonus || 0;
  }
  return as;
}

export function totalGearHp(data, state) {
  let hp = 0;
  const per = data.gear?.formulas?.hpPerEnhanceArmor ?? 0;
  for (const slot of ARMOR_SLOTS) {
    const skin = getEquippedSkin(data, state, slot);
    if (!skin) continue;
    const lv = getGearLevel(state, skin.id);
    hp += (skin.hp || 0) + lv * per;
  }
  return hp;
}

export function equippedGearBundle(data, state) {
  const bundle = {};
  for (const slot of [...ENHANCEABLE_SLOTS]) {
    bundle[slot] = getEquippedSkin(data, state, slot);
  }
  return bundle;
}

export function formatPieceSummary(data, state, skin) {
  if (!skin) return '—';
  const lv = getGearLevel(state, skin.id);
  const atk = pieceAtk(data, state, skin);
  const def = pieceDef(data, state, skin);
  const bits = [`+${lv}`];
  if (atk) bits.push(`攻 ${atk}`);
  if (def) bits.push(`防 ${def}`);
  if (skin.asBonus) bits.push(`攻速+${Number(skin.asBonus).toFixed(2)}`);
  if (skin.mitigation) bits.push(`減傷+${Math.round(skin.mitigation * 100)}%`);
  if (skin.blockChance) bits.push(`格擋+${Math.round(skin.blockChance * 100)}%`);
  if (skin.counterChance) bits.push(`反擊+${Math.round(skin.counterChance * 100)}%`);
  if (skin.critChance) bits.push(`暴擊+${Math.round(skin.critChance * 100)}%`);
  {
    const per = skin.slot !== 'weapon' ? data.gear?.formulas?.hpPerEnhanceArmor ?? 0 : 0;
    const hp = (skin.hp || 0) + lv * per;
    if (hp) bits.push(`HP+${hp}`);
  }
  if (skin.affix === 'bless') bits.push('祝福');
  if (skin.affix === 'curse') bits.push('詛咒');
  return bits.join(' · ');
}

/** Mitigation fraction 0..cap from DEF softcap + flat mitigation (+ scene gacha). */
export function playerMitigation(data, state) {
  const gacha = getGachaBonuses(data, state);
  const def = totalPlayerDef(data, state) * (1 + (gacha.defPct || 0));
  const soft = data.gear?.formulas?.defSoftCap ?? 80;
  const cap = data.gear?.formulas?.mitigationCap ?? 0.55;
  const fromDef = Math.max(0, def) / (Math.max(0, def) + soft);
  const flat = totalMitigationBonus(data, state) + (gacha.mitigation || 0);
  return Math.max(0, Math.min(cap, fromDef + flat));
}

export function mitigateDamage(data, state, raw) {
  const mit = playerMitigation(data, state);
  return Math.max(1, Math.floor(raw * (1 - mit)));
}

export function formatGearStatLines(skin) {
  const lines = [];
  if (skin.atkBonus) lines.push(`攻+${skin.atkBonus}`);
  if (skin.def) lines.push(`防+${skin.def}`);
  if (skin.hp) lines.push(`HP+${skin.hp}`);
  if (skin.mitigation) lines.push(`減傷+${Math.round(skin.mitigation * 100)}%`);
  if (skin.blockChance) lines.push(`格擋+${Math.round(skin.blockChance * 100)}%`);
  if (skin.counterChance) lines.push(`反擊+${Math.round(skin.counterChance * 100)}%`);
  if (skin.asBonus) lines.push(`攻速+${Number(skin.asBonus).toFixed(2)}`);
  if (skin.critChance) lines.push(`暴擊+${Math.round(skin.critChance * 100)}%`);
  if (skin.affix === 'bless') lines.push('祝福');
  if (skin.affix === 'curse') lines.push('詛咒');
  if (!lines.length) lines.push('無素質');
  return lines;
}

export function enhanceCost(data, level) {
  return data.enhance.costs.find((c) => c.level === level) || data.enhance.costs.at(-1);
}

export function successRateAt(data, level) {
  return data.enhance.successRate[Math.min(level, data.enhance.successRate.length - 1)] || 0.1;
}

export function tryEnhance(data, state, gearId) {
  ensureGearState(data, state);
  if (!state.ownedSkins.includes(gearId)) return { ok: false, reason: '尚未擁有' };
  const skin = getGearSkin(data, gearId);
  if (!skin || !ENHANCEABLE_SLOTS.includes(skin.slot)) return { ok: false, reason: '無法強化' };
  const level = getGearLevel(state, gearId);
  if (level >= data.enhance.maxLevel) return { ok: false, reason: '已達上限' };
  const cost = enhanceCost(data, level);
  if (!state.adminMode) {
    if (state.gold < cost.gold || state.material < cost.material) {
      return { ok: false, reason: '資源不足' };
    }
    state.gold -= cost.gold;
    state.material -= cost.material;
  }

  let rate = successRateAt(data, level);
  const bless = Math.min(state.boostArmed?.bless_scroll || 0, state.inventory?.bless_scroll || 0);
  if (bless > 0) {
    const item = data.items.catalog.find((i) => i.id === 'bless_scroll');
    rate = Math.min(0.95, rate + bless * (item?.effect?.perStack || 0.08));
  }

  const roll = Math.random();
  const consumeBoosts = () => {
    if (bless > 0) {
      state.inventory.bless_scroll = Math.max(0, (state.inventory.bless_scroll || 0) - bless);
      state.boostArmed.bless_scroll = 0;
    }
  };

  if (roll < rate) {
    state.gearLevels[gearId] = level + 1;
    state.highestEnhance = Math.max(state.highestEnhance, level + 1);
    if (state.equipped.weapon === gearId) state.weaponLevel = level + 1;
    state.gearAffixes = state.gearAffixes || {};
    if (bless > 0) state.gearAffixes[gearId] = 'bless';
    else if (state.gearAffixes[gearId] === 'curse') delete state.gearAffixes[gearId];
    consumeBoosts();
    return { ok: true, success: true, level: level + 1, affix: state.gearAffixes[gearId] || skin.affix || null };
  }

  const weights = data.enhance.failWeights[Math.min(level, data.enhance.failWeights.length - 1)];
  let stay = weights.stay;
  let down = weights.downgrade;
  let destroy = weights.destroy;
  const useProtect = (state.boostArmed?.protect_scroll || 0) > 0 && (state.inventory?.protect_scroll || 0) > 0;
  const useStable = (state.boostArmed?.stable_charm || 0) > 0 && (state.inventory?.stable_charm || 0) > 0;
  if (useProtect) destroy = 0;
  if (useStable) {
    stay += down;
    down = 0;
  }
  const sum = stay + down + destroy || 1;
  const r2 = Math.random() * sum;
  let outcome = 'stay';
  if (r2 < stay) outcome = 'stay';
  else if (r2 < stay + down) outcome = 'downgrade';
  else outcome = 'destroy';

  if (useProtect) {
    state.inventory.protect_scroll = Math.max(0, (state.inventory.protect_scroll || 0) - 1);
    state.boostArmed.protect_scroll = 0;
  }
  if (useStable) {
    state.inventory.stable_charm = Math.max(0, (state.inventory.stable_charm || 0) - 1);
    state.boostArmed.stable_charm = 0;
  }
  consumeBoosts();

  if (outcome === 'downgrade' && level > 0) {
    state.gearLevels[gearId] = level - 1;
    if (state.equipped.weapon === gearId) state.weaponLevel = level - 1;
  }
  if (outcome === 'destroy') {
    state.gearLevels[gearId] = 0;
    if (state.equipped.weapon === gearId) state.weaponLevel = 0;
  }
  // Failed enhance without protect can leave a curse mark (visual only unless data affix).
  state.gearAffixes = state.gearAffixes || {};
  if (!useProtect && (outcome === 'downgrade' || outcome === 'destroy')) {
    state.gearAffixes[gearId] = 'curse';
  }
  return {
    ok: true,
    success: false,
    outcome,
    level: state.gearLevels[gearId],
    affix: state.gearAffixes[gearId] || skin.affix || null,
  };
}

export function resolveGearAffix(state, skin) {
  if (!skin) return null;
  const fromState = state?.gearAffixes?.[skin.id];
  if (fromState === 'bless' || fromState === 'curse') return fromState;
  if (skin.affix === 'bless' || skin.affix === 'curse') return skin.affix;
  return null;
}

export function maxGear(data, state) {
  ensureGearState(data, state);
  for (const s of ownedEnhanceableSkins(data, state)) {
    state.gearLevels[s.id] = data.enhance.maxLevel;
  }
  state.highestEnhance = data.enhance.maxLevel;
  state.weaponLevel = data.enhance.maxLevel;
}
