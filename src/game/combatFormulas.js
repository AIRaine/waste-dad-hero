/**
 * Combat formula helpers only (crit / block / counter math).
 * No DOM, no float VFX, no training-dummy presentation.
 */

export function rollCrit(chance, dmg, critMul = 1.5) {
  const hit = chance > 0 && Math.random() < chance;
  if (!hit) return { crit: false, dmg };
  return { crit: true, dmg: Math.max(1, Math.floor(dmg * critMul)) };
}

export function applyFlatDefenseReduce(dmg, defReduce) {
  const r = Math.max(0, Math.min(0.9, Number(defReduce) || 0));
  return Math.max(1, Math.floor(dmg * (1 - r)));
}

export function counterDamageFromAtk(atk, mul = 0.55, jitter = 0) {
  return Math.max(1, Math.floor(Number(atk) || 1) * Number(mul || 0.55) + (jitter || 0));
}
