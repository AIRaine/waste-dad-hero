/**
 * Scene gacha: draw a themed character buff/debuff for the current scene.
 * Data-driven from data/gacha.json. Light satire archetypes only.
 *
 * Pricing is draw-count based per scene (not whether a buff is currently equipped).
 * Draws land in `pending` until the player confirms 「上場／實裝」.
 */

export function ensureGachaState(state) {
  if (!state.gacha) {
    state.gacha = {
      active: null,
      pending: null,
      freeUsedByScene: {},
      drawsByScene: {},
      lastDrawId: null,
      revealOpen: false,
    };
  }
  if (!state.gacha.freeUsedByScene) state.gacha.freeUsedByScene = {};
  if (!state.gacha.drawsByScene) state.gacha.drawsByScene = {};
  if (state.gacha.active === undefined) state.gacha.active = null;
  if (state.gacha.pending === undefined) state.gacha.pending = null;
  // Migrate: free used ⇒ at least one draw counted for that scene.
  for (const [sid, used] of Object.entries(state.gacha.freeUsedByScene)) {
    if (used && !(state.gacha.drawsByScene[sid] > 0)) {
      state.gacha.drawsByScene[sid] = 1;
    }
  }
}

export function isGachaUnlocked(data, state) {
  const rule = data.gacha?.rules?.unlock || { type: 'default' };
  if (rule.type === 'default') return true;
  if (rule.type === 'sceneClears') {
    return (state.sceneClears?.[rule.sceneId] || 0) >= (rule.count || 1);
  }
  if (rule.type === 'kills') return (state.kills || 0) >= (rule.count || 0);
  return true;
}

export function gachaUnlockHint(data) {
  const rule = data.gacha?.rules?.unlock;
  if (!rule || rule.type === 'default') return '初始開放';
  if (rule.type === 'sceneClears') {
    const sc = data.scenes.scenes.find((s) => s.id === rule.sceneId);
    return `${sc?.name || rule.sceneId}通關 ${rule.count || 1} 次後開放`;
  }
  if (rule.type === 'kills') return `累積擊殺 ${rule.count} 後開放`;
  return '達成條件後開放';
}

export function poolForScene(data, sceneId) {
  return data.gacha?.pools?.[sceneId] || [];
}

export function findGachaCard(data, cardId) {
  if (!cardId || !data.gacha?.pools) return null;
  for (const list of Object.values(data.gacha.pools)) {
    const hit = list.find((c) => c.id === cardId);
    if (hit) return hit;
  }
  return null;
}

function sceneDrawCount(state, sceneId) {
  ensureGachaState(state);
  return Math.max(0, Math.floor(Number(state.gacha.drawsByScene?.[sceneId]) || 0));
}

/**
 * Cost by how many times the player has drawn in this scene — not by empty slot.
 * Draw #0: free (if firstFreePerScene) else drawGold (14).
 * Draw #1+: always rerollGold (22), even after unequip/clear.
 */
export function drawCost(data, state, sceneId) {
  ensureGachaState(state);
  const rules = data.gacha?.rules || {};
  const draws = sceneDrawCount(state, sceneId);
  if (draws === 0 && rules.firstFreePerScene && !state.gacha.freeUsedByScene?.[sceneId]) {
    return { gold: 0, free: true, ticket: false, label: '免費' };
  }
  const tickets = state.iapEntitlements?.gachaTickets || 0;
  if (tickets > 0) return { gold: 0, free: false, ticket: true, label: '扭蛋券×1' };
  if (draws === 0) {
    const gold = Number(rules.drawGold) || 14;
    return { gold, free: false, ticket: false, label: `${gold} 金` };
  }
  const gold = Number(rules.rerollGold) || 22;
  return { gold, free: false, ticket: false, label: `${gold} 金` };
}

function weightedPick(cards) {
  const bag = cards.filter((c) => (c.weight || 1) > 0);
  if (!bag.length) return null;
  const total = bag.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of bag) {
    r -= c.weight || 1;
    if (r <= 0) return c;
  }
  return bag[bag.length - 1];
}

export function getGachaBonuses(data, state) {
  ensureGachaState(state);
  const active = state.gacha.active;
  if (!active?.cardId) return emptyBonuses();
  if ((active.battlesLeft || 0) <= 0) return emptyBonuses();
  const card = findGachaCard(data, active.cardId);
  if (!card) return emptyBonuses();
  const e = card.effects || {};
  return {
    atkPct: Number(e.atkPct) || 0,
    asBonus: Number(e.asBonus) || 0,
    critChance: Number(e.critChance) || 0,
    defPct: Number(e.defPct) || 0,
    mitigation: Number(e.mitigation) || 0,
    hpPct: Number(e.hpPct) || 0,
    goldFindPct: Number(e.goldFindPct) || 0,
    materialFindPct: Number(e.materialFindPct) || 0,
    card,
    active,
  };
}

export function getGachaPending(data, state) {
  ensureGachaState(state);
  const pending = state.gacha.pending;
  if (!pending?.cardId) return null;
  const card = findGachaCard(data, pending.cardId);
  if (!card) return null;
  return { pending, card };
}

function emptyBonuses() {
  return {
    atkPct: 0,
    asBonus: 0,
    critChance: 0,
    defPct: 0,
    mitigation: 0,
    hpPct: 0,
    goldFindPct: 0,
    materialFindPct: 0,
    card: null,
    active: null,
  };
}

export function formatGachaEffectLines(effects = {}) {
  const lines = [];
  const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (effects.atkPct) lines.push(`攻${pct(effects.atkPct)}`);
  if (effects.defPct) lines.push(`防${pct(effects.defPct)}`);
  if (effects.hpPct) lines.push(`HP${pct(effects.hpPct)}`);
  if (effects.asBonus) lines.push(`攻速${effects.asBonus > 0 ? '+' : ''}${Number(effects.asBonus).toFixed(2)}`);
  if (effects.critChance) lines.push(`暴擊${pct(effects.critChance)}`);
  if (effects.mitigation) lines.push(`減傷${pct(effects.mitigation)}`);
  if (effects.goldFindPct) lines.push(`金幣${pct(effects.goldFindPct)}`);
  if (effects.materialFindPct) lines.push(`素材${pct(effects.materialFindPct)}`);
  return lines;
}

export function toneLabel(tone) {
  if (tone === 'buff') return '增益';
  if (tone === 'debuff') return '減益';
  if (tone === 'mixed') return '互換';
  return '效果';
}

/**
 * Draw a card into `pending` — does NOT equip. Player must confirmEquipGacha.
 */
export function drawGacha(data, state, sceneId, opts = {}) {
  ensureGachaState(state);
  if (!isGachaUnlocked(data, state)) {
    return { ok: false, reason: gachaUnlockHint(data) };
  }
  if (opts.autofighting && data.gacha?.rules?.blockDuringAutofight !== false) {
    return { ok: false, reason: '掛機中先暫停再抽' };
  }
  if (state.gacha.pending) {
    return { ok: false, reason: '請先上場或放棄目前抽到的人情' };
  }
  const pool = poolForScene(data, sceneId);
  if (!pool.length) return { ok: false, reason: '此場景尚無扭蛋池' };

  const cost = drawCost(data, state, sceneId);
  if (!state.adminMode && !cost.free && !cost.ticket && state.gold < cost.gold) {
    return { ok: false, reason: `金幣不足（需 ${cost.gold}）` };
  }

  let card = weightedPick(pool);
  if (card && pool.length > 1 && card.id === state.gacha.lastDrawId) {
    const alt = weightedPick(pool.filter((c) => c.id !== card.id));
    if (alt) card = alt;
  }
  if (!card) return { ok: false, reason: '抽卡失敗' };

  if (cost.ticket) {
    state.iapEntitlements = state.iapEntitlements || { gachaTickets: 0 };
    state.iapEntitlements.gachaTickets = Math.max(
      0,
      (state.iapEntitlements.gachaTickets || 0) - 1,
    );
  } else if (!state.adminMode && !cost.free) {
    state.gold -= cost.gold;
  }
  if (cost.free) state.gacha.freeUsedByScene[sceneId] = true;

  state.gacha.drawsByScene[sceneId] = sceneDrawCount(state, sceneId) + 1;

  const duration =
    card.durationBattles ?? data.gacha?.rules?.defaultDurationBattles ?? 5;

  state.gacha.pending = {
    cardId: card.id,
    sceneId,
    duration,
    drawnAt: Date.now(),
  };
  state.gacha.lastDrawId = card.id;
  state.gacha.revealOpen = true;

  return { ok: true, card, cost, duration, pending: true };
}

/** Move pending → active (replaces any current active). */
export function confirmEquipGacha(data, state) {
  ensureGachaState(state);
  const pending = state.gacha.pending;
  if (!pending?.cardId) return { ok: false, reason: '沒有待上場的人情' };
  const card = findGachaCard(data, pending.cardId);
  if (!card) {
    state.gacha.pending = null;
    state.gacha.revealOpen = false;
    return { ok: false, reason: '人情資料遺失' };
  }
  const duration = pending.duration ?? data.gacha?.rules?.defaultDurationBattles ?? 5;
  state.gacha.active = {
    cardId: pending.cardId,
    sceneId: pending.sceneId,
    battlesLeft: duration,
    drawnAt: pending.drawnAt || Date.now(),
  };
  state.gacha.pending = null;
  state.gacha.revealOpen = false;
  return { ok: true, card, duration };
}

/** Discard pending without equipping (draw already paid). */
export function discardPendingGacha(state) {
  ensureGachaState(state);
  state.gacha.pending = null;
  state.gacha.revealOpen = false;
  return { ok: true };
}

/** Unequip active buff only — does not reset draw-count pricing. */
export function clearGacha(state) {
  ensureGachaState(state);
  state.gacha.active = null;
  // Keep pending / drawsByScene / freeUsedByScene.
  return { ok: true };
}

export function onGachaSceneChange(data, state, nextSceneId) {
  ensureGachaState(state);
  let cleared = false;
  if (data.gacha?.rules?.expireOnSceneChange) {
    if (state.gacha.active && state.gacha.active.sceneId !== nextSceneId) {
      state.gacha.active = null;
      cleared = true;
    }
    if (state.gacha.pending && state.gacha.pending.sceneId !== nextSceneId) {
      state.gacha.pending = null;
      state.gacha.revealOpen = false;
      cleared = true;
    }
  }
  return cleared;
}

export function tickGachaAfterBattle(data, state, { training = false, victory = false } = {}) {
  ensureGachaState(state);
  const active = state.gacha.active;
  if (!active) return false;
  if (training && data.gacha?.rules?.trainingIgnoresTick !== false) return false;
  active.battlesLeft = Math.max(0, (active.battlesLeft || 0) - 1);
  if (active.battlesLeft <= 0) {
    const card = findGachaCard(data, active.cardId);
    state.gacha.active = null;
    return { expired: true, card };
  }
  return { expired: false, battlesLeft: active.battlesLeft, victory };
}

export function applyGachaLootBonus(data, state, rewards) {
  const g = getGachaBonuses(data, state);
  if (!rewards) return rewards;
  const gold = Math.max(1, Math.round((rewards.gold || 1) * (1 + (g.goldFindPct || 0))));
  const material = Math.max(
    1,
    Math.round((rewards.material || 1) * (1 + (g.materialFindPct || 0))),
  );
  return { ...rewards, gold, material };
}
