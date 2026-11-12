/**
 * Farm meter → manual Tier challenge.
 * Spec: docs/farm-tier-gate-progression.md (agent store).
 */

import { monstersInScene } from './scenes.js';

export function farmConfig(data) {
  return data.farm || {
    killsToUnlock: 3,
    statMul: { hp: 0.82, atk: 0.85 },
    defMul: 0.9,
    counterMul: 0.9,
    rewardMul: { gold: 0.7, material: 0.75, exp: 0.7 },
    labelPrefix: '農區·',
    farmIdPrefix: 'farm__',
  };
}

export function farmIdPrefix(data) {
  return farmConfig(data).farmIdPrefix || 'farm__';
}

export function isFarmMonsterId(data, id) {
  if (!id) return false;
  return String(id).startsWith(farmIdPrefix(data));
}

export function challengeIdFromFarmId(data, farmId) {
  const p = farmIdPrefix(data);
  if (!farmId || !String(farmId).startsWith(p)) return null;
  return String(farmId).slice(p.length);
}

export function ensureFarmState(state) {
  if (!state.farm || typeof state.farm !== 'object') {
    state.farm = { mode: 'farm', focusId: null, meters: {}, unlocked: {} };
  }
  if (state.farm.mode !== 'farm' && state.farm.mode !== 'challenge') state.farm.mode = 'farm';
  if (!state.farm.meters || typeof state.farm.meters !== 'object') state.farm.meters = {};
  if (!state.farm.unlocked || typeof state.farm.unlocked !== 'object') state.farm.unlocked = {};
  return state.farm;
}

export function challengeChain(data, sceneId) {
  return monstersInScene(data, sceneId);
}

export function isChallengeCleared(state, challengeId) {
  return (state.defeated?.[challengeId] || 0) > 0;
}

/** Previous in chain cleared (or first). */
export function isChallengeReachable(data, state, challenge) {
  if (!challenge) return false;
  const chain = challengeChain(data, challenge.sceneId);
  const idx = chain.findIndex((m) => m.id === challenge.id);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return isChallengeCleared(state, chain[idx - 1].id);
}

export function killsNeeded(data) {
  const n = Number(farmConfig(data).killsToUnlock);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

export function meterCount(state, challengeId) {
  ensureFarmState(state);
  return Math.max(0, Math.floor(Number(state.farm.meters[challengeId]) || 0));
}

export function isChallengeUnlocked(data, state, challengeId) {
  ensureFarmState(state);
  if (state.farm.unlocked[challengeId]) return true;
  if (isChallengeCleared(state, challengeId)) return true;
  return meterCount(state, challengeId) >= killsNeeded(data);
}

export function makeFarmMinion(data, challenge) {
  if (!challenge) return null;
  const cfg = farmConfig(data);
  const sm = cfg.statMul || {};
  const rm = cfg.rewardMul || {};
  const prefix = cfg.labelPrefix || '農區·';
  const id = `${farmIdPrefix(data)}${challenge.id}`;
  return {
    ...challenge,
    id,
    name: `${prefix}${challenge.name}`,
    role: 'trash',
    farmOf: challenge.id,
    isFarmMinion: true,
    hp: Math.max(1, Math.round(challenge.hp * (sm.hp ?? 0.82))),
    atk: Math.max(1, Math.round(challenge.atk * (sm.atk ?? 0.85))),
    defChance: Math.min(0.6, (challenge.defChance || 0) * (cfg.defMul ?? 0.9)),
    counterChance: Math.min(0.5, (challenge.counterChance || 0) * (cfg.counterMul ?? 0.9)),
    rewards: {
      gold: Math.max(1, Math.round((challenge.rewards?.gold || 1) * (rm.gold ?? 0.7))),
      material: Math.max(1, Math.round((challenge.rewards?.material || 1) * (rm.material ?? 0.75))),
      exp: Math.max(1, Math.round((challenge.rewards?.exp || 1) * (rm.exp ?? 0.7))),
    },
    unlock: { type: 'default' },
    catalogHint: `農區小怪（弱於「${challenge.name}」）· 刷滿可挑戰`,
  };
}

/**
 * Resolve farm/challenge focus.
 * Sticky: honor focusId when reachable — even if already cleared (manual rematch / prior farm).
 * Only auto-advance when focusId is missing or unreachable.
 */
export function resolveFocusChallenge(data, state, sceneId = state.selectedSceneId) {
  ensureFarmState(state);
  const chain = challengeChain(data, sceneId);
  if (!chain.length) return null;
  if (state.farm.focusId) {
    const cur = chain.find((m) => m.id === state.farm.focusId);
    if (cur && isChallengeReachable(data, state, cur)) {
      return cur;
    }
  }
  // First uncleared reachable challenge; else last in chain for endless farm.
  for (const m of chain) {
    if (isChallengeReachable(data, state, m) && !isChallengeCleared(state, m.id)) return m;
  }
  return chain[chain.length - 1];
}

export function syncFarmFocus(data, state, sceneId = state.selectedSceneId) {
  ensureFarmState(state);
  const chain = challengeChain(data, sceneId);
  // In challenge mode, selectedMonsterId is source of truth when it names a chain foe.
  if (state.farm.mode === 'challenge') {
    const selected = chain.find((m) => m.id === state.selectedMonsterId);
    if (selected && isChallengeReachable(data, state, selected) && isChallengeUnlocked(data, state, selected.id)) {
      state.farm.focusId = selected.id;
      return selected;
    }
    // Invalid / locked selection — drop back to farm focus.
    state.farm.mode = 'farm';
  }
  const focus = resolveFocusChallenge(data, state, sceneId);
  state.farm.focusId = focus?.id || null;
  return focus;
}

/** Active combat foe for UI / createBattle (farm minion or real challenge). */
export function currentFarmOrChallengeMonster(data, state) {
  ensureFarmState(state);
  if (state.selectedMonsterId === 'training_dummy') return null;
  const sceneId = state.selectedSceneId;
  const chain = challengeChain(data, sceneId);
  if (state.farm.mode === 'challenge') {
    // Prefer explicit picker / enterChallenge selection; do not let stale focusId win.
    const selected = chain.find((m) => m.id === state.selectedMonsterId);
    if (selected) return selected;
    const focus = syncFarmFocus(data, state, sceneId);
    return focus || null;
  }
  // Farm: if selectedMonsterId is farm__X, keep that stage (sticky), else sync focus.
  if (isFarmMonsterId(data, state.selectedMonsterId)) {
    const cid = challengeIdFromFarmId(data, state.selectedMonsterId);
    const ch = chain.find((m) => m.id === cid);
    if (ch && isChallengeReachable(data, state, ch)) {
      state.farm.focusId = ch.id;
      return makeFarmMinion(data, ch);
    }
  }
  const focus = syncFarmFocus(data, state, sceneId);
  return focus ? makeFarmMinion(data, focus) : null;
}

export function farmMeterView(data, state, sceneId = state.selectedSceneId) {
  const focus = syncFarmFocus(data, state, sceneId);
  if (!focus) return null;
  const need = killsNeeded(data);
  const have = Math.min(need, meterCount(state, focus.id));
  const unlocked = isChallengeUnlocked(data, state, focus.id);
  const cleared = isChallengeCleared(state, focus.id);
  const chain = challengeChain(data, sceneId);
  const idx = chain.findIndex((m) => m.id === focus.id);
  return {
    focus,
    index: idx,
    total: chain.length,
    have,
    need,
    pct: Math.min(100, Math.round((have / need) * 100)),
    unlocked,
    cleared,
    mode: state.farm.mode,
    canChallenge: unlocked && !cleared && isChallengeReachable(data, state, focus),
  };
}

export function enterChallenge(data, state, challengeId) {
  ensureFarmState(state);
  const chain = challengeChain(data, state.selectedSceneId);
  const ch = chain.find((m) => m.id === challengeId);
  if (!ch) return { ok: false, message: '找不到挑戰目標' };
  if (!isChallengeReachable(data, state, ch)) {
    return { ok: false, message: '需先通過前一階挑戰' };
  }
  if (!isChallengeUnlocked(data, state, ch.id)) {
    return { ok: false, message: `農區進度未滿（${meterCount(state, ch.id)}/${killsNeeded(data)}）` };
  }
  state.farm.mode = 'challenge';
  state.farm.focusId = ch.id;
  state.selectedMonsterId = ch.id;
  return { ok: true, message: `挑戰「${ch.name}」`, monster: ch };
}

export function returnToFarm(data, state) {
  ensureFarmState(state);
  const chain = challengeChain(data, state.selectedSceneId);
  const wasChallenge = state.farm.mode === 'challenge';
  const fromId =
    (wasChallenge && state.selectedMonsterId && chain.some((m) => m.id === state.selectedMonsterId)
      ? state.selectedMonsterId
      : null) ||
    state.farm.focusId ||
    challengeIdFromFarmId(data, state.selectedMonsterId);
  state.farm.mode = 'farm';
  // Leaving a T-challenge → farm the prior stage's minions (easier grind). T1 stays T1.
  let focus = null;
  if (wasChallenge && fromId) {
    const idx = chain.findIndex((m) => m.id === fromId);
    if (idx > 0) {
      focus = chain[idx - 1];
      state.farm.focusId = focus.id;
    } else if (idx === 0) {
      focus = chain[0];
      state.farm.focusId = focus.id;
    }
  }
  if (!focus) {
    focus = syncFarmFocus(data, state);
  }
  if (focus) state.selectedMonsterId = makeFarmMinion(data, focus).id;
  return {
    ok: true,
    message: focus ? `回刷農區（目標：${focus.name}）` : '回刷農區',
    focus,
    monster: focus ? makeFarmMinion(data, focus) : null,
  };
}

/**
 * After victory against farm minion or challenge (non-training).
 * Never auto-enters next challenge or next scene.
 */
export function applyFarmVictory(data, state, monster) {
  ensureFarmState(state);
  if (!monster || monster.id === 'training_dummy') {
    return { kind: 'skip', message: '' };
  }

  if (monster.isFarmMinion || isFarmMonsterId(data, monster.id)) {
    const cid = monster.farmOf || challengeIdFromFarmId(data, monster.id);
    if (!cid) return { kind: 'stay', message: '農區再戰' };
    const need = killsNeeded(data);
    const next = meterCount(state, cid) + 1;
    state.farm.meters[cid] = next;
    state.farm.focusId = cid;
    state.farm.mode = 'farm';
    state.selectedMonsterId = `${farmIdPrefix(data)}${cid}`;
    if (next >= need) {
      state.farm.unlocked[cid] = true;
      return {
        kind: 'meter_full',
        message: `農區已滿！可手動挑戰「${monster.name.replace(farmConfig(data).labelPrefix || '農區·', '')}」`,
        challengeId: cid,
      };
    }
    return {
      kind: 'farm_kill',
      message: `農區進度 ${Math.min(next, need)}/${need}`,
      challengeId: cid,
      have: next,
      need,
    };
  }

  // Real challenge win — do not auto-push next T or scene.
  const sceneId = monster.sceneId;
  const chain = challengeChain(data, sceneId);
  const idx = chain.findIndex((m) => m.id === monster.id);
  state.farm.unlocked[monster.id] = true;
  const nextCh = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
  if (nextCh) {
    state.farm.focusId = nextCh.id;
    state.farm.mode = 'farm';
    state.selectedMonsterId = `${farmIdPrefix(data)}${nextCh.id}`;
    return {
      kind: 'challenge_clear',
      message: `「${monster.name}」通過！回農區累積下一階「${nextCh.name}」`,
      nextChallenge: nextCh,
      fromSceneId: sceneId,
    };
  }
  state.farm.focusId = monster.id;
  state.farm.mode = 'farm';
  state.selectedMonsterId = `${farmIdPrefix(data)}${monster.id}`;
  return {
    kind: 'scene_gate_clear',
    message: `「${monster.name}」通過！本場景通關閘已破——下一場景請手動前往（條件夠才可）`,
    fromSceneId: sceneId,
    monster,
  };
}

/** Seed unlocked flags from existing defeated for migration comfort. */
export function migrateFarmFromDefeated(data, state) {
  ensureFarmState(state);
  for (const m of data.monsters?.tiers || []) {
    if ((state.defeated?.[m.id] || 0) > 0) {
      state.farm.unlocked[m.id] = true;
      const need = killsNeeded(data);
      if ((state.farm.meters[m.id] || 0) < need) state.farm.meters[m.id] = need;
    }
  }
  syncFarmFocus(data, state);
  if (state.farm.mode !== 'challenge') {
    const focus = resolveFocusChallenge(data, state);
    if (focus) state.selectedMonsterId = makeFarmMinion(data, focus).id;
  }
}
