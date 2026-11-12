import { ensureIapState, shopPriceMul } from './iap.js';
import { grantSkin } from './skins.js';
import { pushLog } from './state.js';

export function buyItem(data, state, itemId) {
  const item = data.items.catalog.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: '查無此道具' };
  if (!state.adminMode) {
    if (state.gold < item.priceGold) {
      pushLog(state, '金幣不足', 'bad');
      return { ok: false, reason: '金幣不足' };
    }
    state.gold -= item.priceGold;
  }
  state.inventory = state.inventory || {};
  if (item.effect?.type === 'doubleLoot') {
    state.boosts.doubleLootBattles += item.effect.battles || 5;
  } else {
    state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
  }
  const owned = state.inventory[item.id] ? `（持有 ${state.inventory[item.id]}）` : '';
  const msg = state.adminMode ? `【管理員】免費取得「${item.name}」${owned}` : `購入「${item.name}」${owned}`;
  pushLog(state, msg, 'info');
  return { ok: true, message: msg };
}

export function buySkin(data, state, skinId) {
  const skin = data.skins.catalog.find((s) => s.id === skinId);
  if (!skin || skin.unlock?.type !== 'shop') return { ok: false, reason: '查無此外觀' };
  if (state.ownedSkins.includes(skinId)) {
    pushLog(state, '已擁有此外觀', 'warn');
    return { ok: false, reason: '已擁有此外觀' };
  }
  ensureIapState(state);
  const raw = skin.unlock.priceGold || 0;
  const price = Math.max(1, Math.round(raw * shopPriceMul(state)));
  if (!state.adminMode) {
    if (state.gold < price) {
      pushLog(state, '金幣不足', 'bad');
      return { ok: false, reason: '金幣不足' };
    }
    state.gold -= price;
  }
  grantSkin(state, skinId);
  const disc = shopPriceMul(state) < 1 ? `（收藏家證 ${price} 金）` : '';
  const msg = `取得外觀「${skin.name}」${disc}`;
  pushLog(state, msg, 'good');
  return { ok: true, message: msg, price };
}
