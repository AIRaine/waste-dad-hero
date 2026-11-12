/**
 * Scene gacha: draw a themed character buff/debuff for the current scene.
 * Data-driven from data/gacha.json. Light satire archetypes only.
 */

export function ensureGachaState(state) {
  if (!state.gacha) {
    state.gacha = {
      active: null,
      freeUsedByScene: {},
      lastDrawId: null,
      revealOpen: false,
    };
  }
  if (!state.gacha.freeUsedByScene) state.gacha.freeUsedByScene = {};
  if (state.gacha.active === undefined) state.gacha.active = null;
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

export function drawCost(data, state, sceneId) {
  ensureGachaState(state);
  const rules = data.gacha?.rules || {};
  const hasActive = !!state.gacha.active;
  // First free only for an empty slot in this scene (never for reroll/replace).
  const free =
    !hasActive &&
    rules.firstFreePerScene &&
    !state.gacha.freeUsedByScene?.[sceneId];
  if (free) return { gold: 0, free: true, ticket: false, label: '免費' };
  const tickets = state.iapEntitlements?.gachaTickets || 0;
  if (tickets > 0) return { gold: 0, free: false, ticket: true, label: '扭蛋券×1' };
  const gold = hasActive ? Number(rules.rerollGold) || 28 : Number(rules.drawGold) || 18;
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
 * Draw (or reroll) a card for the current scene.
 * @param {{ autofighting?: boolean }} opts
 */
export function drawGacha(data, state, sceneId, opts = {}) {
  ensureGachaState(state);
  if (!isGachaUnlocked(data, state)) {
    return { ok: false, reason: gachaUnlockHint(data) };
  }
  if (opts.autofighting && data.gacha?.rules?.blockDuringAutofight !== false) {
    return { ok: false, reason: '掛機中先暫停再抽' };
  }
  const pool = poolForScene(data, sceneId);
  if (!pool.length) return { ok: false, reason: '此場景尚無扭蛋池' };

  const cost = drawCost(data, state, sceneId);
  if (!state.adminMode && !cost.free && !cost.ticket && state.gold < cost.gold) {
    return { ok: false, reason: `金幣不足（需 ${cost.gold}）` };
  }

  let card = weightedPick(pool);
  // Mild anti-repeat: if same as last and pool > 1, reroll once
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

  const duration =
    card.durationBattles ??
    data.gacha?.rules?.defaultDurationBattles ??
    5;

  state.gacha.active = {
    cardId: card.id,
    sceneId,
    battlesLeft: duration,
    drawnAt: Date.now(),
  };
  state.gacha.lastDrawId = card.id;
  state.gacha.revealOpen = true;

  return { ok: true, card, cost, duration };
}

export function clearGacha(state) {
  ensureGachaState(state);
  state.gacha.active = null;
  state.gacha.revealOpen = false;
  return { ok: true };
}

/** Call when player leaves a scene if rules.expireOnSceneChange. */
export function onGachaSceneChange(data, state, nextSceneId) {
  ensureGachaState(state);
  const active = state.gacha.active;
  if (!active) return false;
  if (!data.gacha?.rules?.expireOnSceneChange) return false;
  if (active.sceneId === nextSceneId) return false;
  state.gacha.active = null;
  state.gacha.revealOpen = false;
  return true;
}

/**
 * Tick duration after a real fight ends (not training).
 * Returns true if buff expired this tick.
 */
export function tickGachaAfterBattle(data, state, { training = false, victory = false } = {}) {
  ensureGachaState(state);
  const active = state.gacha.active;
  if (!active) return false;
  if (training && data.gacha?.rules?.trainingIgnoresTick !== false) return false;
  // Tick on both win and loss — time on the field still counts
  active.battlesLeft = Math.max(0, (active.battlesLeft || 0) - 1);
  if (active.battlesLeft <= 0) {
    const card = findGachaCard(data, active.cardId);
    state.gacha.active = null;
    return { expired: true, card };
  }
  return { expired: false, battlesLeft: active.battlesLeft, victory };
}

/** Apply gold/material find bonuses to reward numbers. */
export function applyGachaLootBonus(data, state, rewards) {
  const g = getGachaBonuses(data, state);
  if (!rewards) return rewards;
  const gold = Math.max(
    1,
    Math.round((rewards.gold || 1) * (1 + (g.goldFindPct || 0))),
  );
  const material = Math.max(
    1,
    Math.round((rewards.material || 1) * (1 + (g.materialFindPct || 0))),
  );
  return { ...rewards, gold, material };
}
