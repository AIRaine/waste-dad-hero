export function ensureBoostState(data, state) {
  if (!state.inventory) state.inventory = {};
  if (!state.boostArmed) {
    state.boostArmed = { bless_scroll: 0, protect_scroll: 0, stable_charm: 0 };
  }
  if (!state.boosts) {
    state.boosts = {
      successBoostStacks: 0,
      destroyProtect: 0,
      downgradeProtect: 0,
      doubleLootBattles: 0,
    };
  }
  for (const id of Object.keys(state.boostArmed)) {
    const owned = ownedCount(state, id);
    const item = data.items.catalog.find((i) => i.id === id);
    const max = item?.effect?.maxStack || 1;
    state.boostArmed[id] = Math.max(0, Math.min(state.boostArmed[id] || 0, owned, max));
  }
}

export function ownedCount(state, id) {
  return state.inventory?.[id] || 0;
}

export function armedCount(state, id) {
  return state.boostArmed?.[id] || 0;
}

export function cycleBoost(data, state, itemId) {
  ensureBoostState(data, state);
  const item = data.items.catalog.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: '無此道具' };
  const owned = ownedCount(state, itemId);
  if (owned <= 0) return { ok: false, reason: '數量不足' };
  if (item.effect?.type === 'successBoost') {
    const max = Math.min(owned, item.effect.maxStack ?? 3);
    const cur = state.boostArmed[itemId] || 0;
    state.boostArmed[itemId] = cur >= max ? 0 : cur + 1;
  } else {
    state.boostArmed[itemId] = state.boostArmed[itemId] ? 0 : 1;
  }
  return { ok: true };
}

export function topUpAdminBoosts(state) {
  state.inventory = state.inventory || {};
  for (const id of ['bless_scroll', 'protect_scroll', 'stable_charm', 'double_loot']) {
    state.inventory[id] = Math.max(state.inventory[id] || 0, 99);
  }
}
