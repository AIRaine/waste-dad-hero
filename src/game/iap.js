/**
 * IAP / monetization stub — no real payments.
 * Shop can preview ladder; grantPack simulates purchase into state.iapEntitlements.
 */

export function ensureIapState(state) {
  if (!state.iapEntitlements) {
    state.iapEntitlements = {
      gachaTickets: 0,
      speedBoost: false,
      shopDiscount: 0,
      purchased: [],
    };
  }
  if (!Array.isArray(state.iapEntitlements.purchased)) state.iapEntitlements.purchased = [];
}

export function listIapPacks(data) {
  return data.iap?.ladder || [];
}

export function iapTierLabel(tier) {
  if (tier === 'small') return '小額';
  if (tier === 'mid') return '中額';
  if (tier === 'large') return '大額';
  return '方案';
}

/** Apply a stub purchase. Always ok in adminMode; otherwise still grants (prototype). */
export function grantIapPack(data, state, packId, { force = false } = {}) {
  ensureIapState(state);
  const pack = listIapPacks(data).find((p) => p.id === packId);
  if (!pack) return { ok: false, reason: '查無方案' };
  if (!force && pack.implemented === false && !state.adminMode) {
    // Prototype: still allow tap to preview grant with watermark log
  }
  const g = pack.grants || {};
  if (g.gold) state.gold = (state.gold || 0) + g.gold;
  if (g.material) state.material = (state.material || 0) + g.material;
  if (g.gachaTickets) {
    state.iapEntitlements.gachaTickets =
      (state.iapEntitlements.gachaTickets || 0) + g.gachaTickets;
  }
  if (g.speedBoost) {
    state.iapEntitlements.speedBoost = true;
  }
  if (g.shopDiscount) {
    state.iapEntitlements.shopDiscount = Math.max(
      state.iapEntitlements.shopDiscount || 0,
      g.shopDiscount,
    );
  }
  if (g.items) {
    state.inventory = state.inventory || {};
    for (const [id, n] of Object.entries(g.items)) {
      if (id === 'double_loot') {
        state.boosts = state.boosts || {};
        const item = data.items.catalog.find((i) => i.id === id);
        const battles = (item?.effect?.battles || 5) * n;
        state.boosts.doubleLootBattles = (state.boosts.doubleLootBattles || 0) + battles;
      } else {
        state.inventory[id] = (state.inventory[id] || 0) + n;
      }
    }
  }
  if (!state.iapEntitlements.purchased.includes(packId)) {
    state.iapEntitlements.purchased.push(packId);
  }
  return { ok: true, pack, stub: true };
}

export function shopPriceMul(state) {
  ensureIapState(state);
  const d = Number(state.iapEntitlements.shopDiscount) || 0;
  return Math.max(0.5, 1 - d);
}
