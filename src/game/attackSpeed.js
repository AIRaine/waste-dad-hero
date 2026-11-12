import { getGachaBonuses } from './gacha.js';
import { totalGearAsBonus } from './gear.js';
import { getAuraBonuses, getGearSkin } from './skins.js';

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** Paid boost: data flag OR player entitlement from IAP stub. */
export function paidSpeedBoostBonus(data, state) {
  const stub = data.combat?.paidSpeedBoost;
  if (!stub) return 0;
  const entitled =
    stub.implemented === true || state?.iapEntitlements?.speedBoost === true;
  if (!entitled) return 0;
  return Number(stub.asBonus) || 0;
}

export function weaponAsBonus(data, weaponId) {
  const skin = getGearSkin(data, weaponId) || data.skins.catalog.find((s) => s.id === weaponId);
  return Number(skin?.asBonus) || 0;
}

export function playerAttackSpeed(data, state) {
  const base = Number(data.combat?.playerBaseAs) || 1;
  const bonus = totalGearAsBonus(data, state);
  const auraAs = getAuraBonuses(data, state).asBonus || 0;
  const gachaAs = getGachaBonuses(data, state).asBonus || 0;
  // Future IAP: only applied when paidSpeedBoost.implemented === true
  return Math.max(0.4, base + bonus + auraAs + gachaAs + paidSpeedBoostBonus(data, state));
}

export function monsterAttackSpeed(monster, data) {
  if (monster?.as != null) return Number(monster.as) || 1;
  const role = monster?.role || 'trash';
  return Number(data.combat?.monsterAsDefaults?.[role]) || 1;
}

export function cooldownMsFromAs(data, as) {
  const min = Number(data.combat?.minCooldownMs) || 280;
  const max = Number(data.combat?.maxCooldownMs) || 900;
  const raw = 1000 / Math.max(0.35, as || 1);
  return Math.round(clamp(raw, min, max));
}

export function playerAttackCooldownMs(data, state) {
  return cooldownMsFromAs(data, playerAttackSpeed(data, state));
}

export function monsterAttackCooldownMs(monster, data) {
  return cooldownMsFromAs(data, monsterAttackSpeed(monster, data));
}

/**
 * Auto-fight wait follows **player** AS only.
 * Monster AS drives independent monsterAttack ticks — do not couple the two cadences.
 */
export function autoFightWaitMs(data, state, _monster) {
  const playerCd = playerAttackCooldownMs(data, state);
  const bias = Number(data.combat?.autoFight?.paceBias) || 1;
  const wait = Math.round(playerCd * bias);
  const minW = Number(data.combat?.autoFight?.minWaitMs) || 260;
  const maxW = Number(data.combat?.autoFight?.maxWaitMs) || 880;
  return clamp(wait, minW, maxW);
}

export function formatAs(as) {
  return `${(Number(as) || 0).toFixed(2)}`;
}
