/**
 * Hit float / VFX layer — isolated from combat math and training rules.
 * Floats live in a persistent DOM layer so battle `render()` remounts cannot replay animations.
 *
 * Color contract (must not look like topbar 攻/防 pills):
 * - normal dmg: soft gold numeral only
 * - crit: hot amber + 「爆擊」 badge, large pop
 * - block: ice cyan + 「格擋」 badge
 * - counter: magenta + 「反擊」 badge
 *
 * SFX: playHitSfx runs here (side-effect only; no combat math).
 */

import { playHitSfx } from './sfx.js';

/** Optional: set before a player swing so attack SFX uses weapon group. */
let pendingWeaponGroup = 'improvised';

export function setPendingAttackSfxGroup(group) {
  pendingWeaponGroup = group || 'improvised';
}

const FLOAT_TTL_MS = 900;
const SPECIAL_TTL_MS = 1100;
const mounted = new Map(); // id -> HTMLElement
let layerEl = null;
let flashEl = null;
let flashTimer = 0;

/** @typedef {'dmg'|'bad'|'crit'|'block'|'counter'|'warn'|'good'} HitTone */

export function pushHitFloat(battle, text, side, tone = 'dmg', meta = {}) {
  if (!battle) return null;
  const special = tone === 'crit' || tone === 'block' || tone === 'counter';
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text),
    side: side === 'player' ? 'player' : 'monster',
    tone: tone || 'dmg',
    born: Date.now(),
    ttl: special ? SPECIAL_TTL_MS : FLOAT_TTL_MS,
    kind: meta.kind || (special ? tone : 'dmg'),
    label: meta.label || null,
    amount: meta.amount != null ? meta.amount : null,
  };
  battle.floatTexts = [...(battle.floatTexts || []), entry].slice(-8);
  return entry;
}

/**
 * Build the single on-screen float for one hit.
 * Allowed status words: 暴擊 / 格擋 / 反擊 only — never 防 / 防禦 / 中招.
 * (UI copy uses 暴擊 to match gear pills; visual tone is still 「爆擊」emphasis.)
 */
export function pushHitResultFloat(battle, side, dmg, { crit = false, block = false, counter = false, tone } = {}) {
  const labels = [];
  if (block) labels.push('格擋');
  if (crit) labels.push('暴擊');
  if (counter) labels.push('反擊');
  const showDmg = !block || Number(dmg) > 0;
  const amount = Math.max(0, Math.floor(Number(dmg) || 0));
  const label = labels.length ? labels.join('·') : null;
  // Prefer strongest visual tone when multiple tags (crit > counter > block).
  const resolvedTone =
    tone ||
    (crit ? 'crit' : counter ? 'counter' : block ? 'block' : side === 'player' ? 'bad' : 'dmg');
  const text = showDmg ? (label ? `${label} −${amount}` : `−${amount}`) : label || '格擋';
  const entry = pushHitFloat(battle, text, side, resolvedTone, {
    kind: resolvedTone,
    label,
    amount: showDmg ? amount : null,
  });
  if (resolvedTone === 'crit' || resolvedTone === 'block' || resolvedTone === 'counter') {
    triggerSpecialFlash(resolvedTone);
  }
  // Audio side-effect only — formulas unchanged.
  playHitSfx({
    side: side === 'player' ? 'player' : 'monster',
    crit: !!crit,
    block: !!block,
    counter: !!counter,
    dmg: amount,
    weaponGroup: pendingWeaponGroup,
  });
  return entry;
}

export function pruneHitFloats(battle, now = Date.now()) {
  if (!battle?.floatTexts) return false;
  const before = battle.floatTexts.length;
  battle.floatTexts = battle.floatTexts.filter((f) => now - f.born < (f.ttl || FLOAT_TTL_MS));
  const changed = battle.floatTexts.length !== before;
  if (changed) syncHitFloatDom(null, battle);
  return changed;
}

function ensureLayer() {
  if (layerEl && document.body.contains(layerEl)) return layerEl;
  layerEl = document.createElement('div');
  layerEl.id = 'hit-float-layer';
  layerEl.className = 'hit-float-layer';
  layerEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layerEl);
  return layerEl;
}

function ensureFlash() {
  if (flashEl && document.body.contains(flashEl)) return flashEl;
  flashEl = document.createElement('div');
  flashEl.id = 'hit-special-flash';
  flashEl.className = 'hit-special-flash';
  flashEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flashEl);
  return flashEl;
}

/** Brief full-screen rim flash + data-kind for CSS; sound hook placeholder. */
export function triggerSpecialFlash(kind) {
  const el = ensureFlash();
  el.dataset.kind = kind;
  el.classList.remove('is-on');
  // retrigger animation
  void el.offsetWidth;
  el.classList.add('is-on');
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    el.classList.remove('is-on');
    delete el.dataset.kind;
  }, 420);
  if (typeof window !== 'undefined') {
    window.__FEICAI_HIT_SFX__ = { kind, at: Date.now() };
    window.dispatchEvent(new CustomEvent('feicai-special-hit', { detail: { kind } }));
  }
}

function anchorRect(appRoot, side) {
  const root = appRoot || document.getElementById('app');
  const sel = side === 'player' ? '.fighter.player' : '.fighter.monster';
  const el = root?.querySelector(sel);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function placeFloat(node, side, appRoot) {
  const rect = anchorRect(appRoot, side);
  if (!rect) {
    node.style.left = side === 'player' ? '70%' : '30%';
    node.style.top = '28%';
    return;
  }
  node.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  node.style.top = `${Math.round(rect.top + 6)}px`;
}

function buildFloatNode(f) {
  const special = f.tone === 'crit' || f.tone === 'block' || f.tone === 'counter';
  const node = document.createElement('div');
  node.className = `float float-overlay hit-${f.tone || 'dmg'}${special ? ' is-special' : ''}`;
  node.dataset.floatId = f.id;
  node.dataset.kind = f.kind || f.tone || 'dmg';

  if (special && f.label) {
    const badge = document.createElement('span');
    badge.className = 'hit-badge';
    badge.textContent = f.label;
    node.appendChild(badge);
    if (f.amount != null) {
      const num = document.createElement('span');
      num.className = 'hit-num';
      num.textContent = `−${f.amount}`;
      node.appendChild(num);
    }
  } else {
    node.textContent = f.text;
  }
  return node;
}

/** Append only new floats; never recreate existing nodes (prevents double-jump). */
export function syncHitFloatDom(appRoot, battle) {
  const layer = ensureLayer();
  const list = battle?.floatTexts || [];
  const live = new Set(list.map((f) => f.id));

  for (const [id, node] of mounted) {
    if (!live.has(id)) {
      node.remove();
      mounted.delete(id);
    }
  }

  for (const f of list) {
    if (mounted.has(f.id)) {
      placeFloat(mounted.get(f.id), f.side, appRoot);
      continue;
    }
    const node = buildFloatNode(f);
    placeFloat(node, f.side, appRoot);
    layer.appendChild(node);
    mounted.set(f.id, node);
  }
}

export function clearHitFloatDom() {
  for (const [, node] of mounted) node.remove();
  mounted.clear();
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = 0;
  if (flashEl) {
    flashEl.remove();
    flashEl = null;
  }
  if (layerEl) {
    layerEl.remove();
    layerEl = null;
  }
}

export function assertNoDefenseFloatText(text) {
  return !/[防]/.test(String(text || '')) && !/防禦/.test(String(text || ''));
}
