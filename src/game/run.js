/**
 * Scene retreat / manual advance + victory hook into farm-tier gates.
 * Spec: docs/farm-tier-gate-progression.md (supersedes auto-push in run-boss-progression.md).
 */

import {
  getScene,
  isSceneUnlocked,
  monstersInScene,
  sceneUnlockHint,
} from './scenes.js';
import { onGachaSceneChange } from './gacha.js';
import {
  applyFarmVictory,
  ensureFarmState,
  makeFarmMinion,
  resolveFocusChallenge,
  returnToFarm,
  syncFarmFocus,
} from './farm.js';

export function ensureRunState(state) {
  if (!state.run || typeof state.run !== 'object') {
    state.run = { autoAdvance: false };
  }
  // Farm-tier model: never force-push next T / next scene on victory.
  state.run.autoAdvance = false;
  return state.run;
}

export function getRunChain(data, sceneId) {
  return monstersInScene(data, sceneId);
}

export function getGateMonster(data, sceneId) {
  const scene = getScene(data, sceneId);
  const overrideId = scene?.run?.gateMonsterId;
  const chain = getRunChain(data, sceneId);
  if (overrideId) {
    const hit = chain.find((m) => m.id === overrideId);
    if (hit) return hit;
  }
  return chain.length ? chain[chain.length - 1] : null;
}

export function isGateMonster(data, monster) {
  if (!monster?.sceneId) return false;
  const gate = getGateMonster(data, monster.sceneId);
  const id = monster.farmOf || monster.id;
  return !!gate && gate.id === id;
}

export function runProgress(data, state, sceneId = state.selectedSceneId) {
  const chain = getRunChain(data, sceneId);
  const focus = resolveFocusChallenge(data, state, sceneId);
  const gate = getGateMonster(data, sceneId);
  const idx = focus ? chain.findIndex((m) => m.id === focus.id) : -1;
  return {
    chain,
    index: idx,
    total: chain.length,
    current: focus,
    gate,
    atGate: !!gate && focus?.id === gate.id,
  };
}

export function orderedScenes(data) {
  return [...(data.scenes?.scenes || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getNextScene(data, sceneId) {
  const list = orderedScenes(data);
  const i = list.findIndex((s) => s.id === sceneId);
  if (i < 0 || i >= list.length - 1) return null;
  return list[i + 1];
}

export function getPrevScene(data, sceneId) {
  const list = orderedScenes(data);
  const i = list.findIndex((s) => s.id === sceneId);
  if (i <= 0) return null;
  return list[i - 1];
}

export function firstFightableInScene(data, state, sceneId) {
  const focus = resolveFocusChallenge(data, state, sceneId);
  return focus ? makeFarmMinion(data, focus) : null;
}

/**
 * Victory progression: farm meter / challenge clear only — no forced next T or scene.
 */
export function applyVictoryProgression(data, state, monster, { training = false } = {}) {
  ensureRunState(state);
  ensureFarmState(state);
  if (training || !monster || monster.id === 'training_dummy') {
    return { kind: 'skip', message: '' };
  }

  const result = applyFarmVictory(data, state, monster);

  if (result.kind === 'scene_gate_clear') {
    const nextScene = getNextScene(data, monster.sceneId);
    if (!nextScene) {
      return {
        ...result,
        message: `${result.message}（已是最終站）`,
      };
    }
    if (!isSceneUnlocked(data, state, nextScene.id)) {
      return {
        ...result,
        kind: 'scene_blocked',
        message: `通關閘已破，但「${nextScene.name}」尚未解鎖`,
        blockedHint: sceneUnlockHint(data, nextScene),
        nextScene,
      };
    }
    return {
      ...result,
      message: `${result.message}可點「前往下一場景」。`,
      nextScene,
      canAdvanceScene: true,
    };
  }

  return result;
}

export function retreatToPreviousScene(data, state) {
  ensureRunState(state);
  ensureFarmState(state);
  const prev = getPrevScene(data, state.selectedSceneId);
  if (!prev) {
    return { ok: false, message: '已在第一場景，無處可退' };
  }
  if (!isSceneUnlocked(data, state, prev.id)) {
    return { ok: false, message: `上一場景「${prev.name}」未解鎖` };
  }
  state.selectedSceneId = prev.id;
  onGachaSceneChange(data, state, prev.id);
  const farm = returnToFarm(data, state);
  return {
    ok: true,
    message: `撤回「${prev.name}」無限農區`,
    scene: prev,
    monster: farm.monster,
  };
}

export function canRetreat(data, state) {
  const prev = getPrevScene(data, state.selectedSceneId);
  return !!prev && isSceneUnlocked(data, state, prev.id);
}

export function canManualAdvanceScene(data, state) {
  const next = getNextScene(data, state.selectedSceneId);
  return !!next && isSceneUnlocked(data, state, next.id);
}

export function advanceToNextScene(data, state) {
  const next = getNextScene(data, state.selectedSceneId);
  if (!next || !isSceneUnlocked(data, state, next.id)) {
    return { ok: false, message: next ? `「${next.name}」尚未解鎖` : '已無下一場景' };
  }
  const from = state.selectedSceneId;
  state.selectedSceneId = next.id;
  onGachaSceneChange(data, state, next.id);
  ensureFarmState(state);
  state.farm.mode = 'farm';
  syncFarmFocus(data, state, next.id);
  const mon = firstFightableInScene(data, state, next.id);
  if (mon) state.selectedMonsterId = mon.id;
  return {
    ok: true,
    message: `前往「${next.name}」農區`,
    fromSceneId: from,
    scene: next,
    monster: mon,
  };
}
