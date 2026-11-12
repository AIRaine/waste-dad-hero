/**
 * Run → Boss → next scene progression helpers.
 * Pure selection/state helpers — does not change combat math.
 * Spec: docs/run-boss-progression.md (agent store).
 */

import {
  getScene,
  isMonsterFightable,
  isSceneUnlocked,
  monstersInScene,
  sceneUnlockHint,
} from './scenes.js';
import { onGachaSceneChange } from './gacha.js';

export function ensureRunState(state) {
  if (!state.run || typeof state.run !== 'object') {
    state.run = { autoAdvance: true };
  }
  if (typeof state.run.autoAdvance !== 'boolean') state.run.autoAdvance = true;
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
  return !!gate && gate.id === monster.id;
}

export function runProgress(data, state, sceneId = state.selectedSceneId) {
  const chain = getRunChain(data, sceneId);
  const idx = chain.findIndex((m) => m.id === state.selectedMonsterId);
  const gate = getGateMonster(data, sceneId);
  return {
    chain,
    index: idx,
    total: chain.length,
    current: idx >= 0 ? chain[idx] : null,
    gate,
    atGate: !!gate && state.selectedMonsterId === gate.id,
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

/** First fightable monster in a scene (training excluded — not in tiers). */
export function firstFightableInScene(data, state, sceneId) {
  return getRunChain(data, sceneId).find((m) => isMonsterFightable(data, state, m)) || null;
}

export function getNextMonsterInRun(data, state, monster) {
  if (!monster?.sceneId) return null;
  const chain = getRunChain(data, monster.sceneId);
  const idx = chain.findIndex((m) => m.id === monster.id);
  if (idx < 0) return null;
  for (let i = idx + 1; i < chain.length; i++) {
    if (isMonsterFightable(data, state, chain[i])) return chain[i];
  }
  return null;
}

/**
 * After a real (non-training) victory: advance monster and/or scene.
 * @returns {{ kind: string, message: string, fromSceneId?: string, toSceneId?: string, monster?: object, nextScene?: object, blockedHint?: string }}
 */
export function applyVictoryProgression(data, state, monster, { training = false } = {}) {
  ensureRunState(state);
  if (training || !monster || monster.id === 'training_dummy') {
    return { kind: 'skip', message: '' };
  }
  if (!state.run.autoAdvance) {
    return { kind: 'disabled', message: '自動推進已關閉' };
  }

  const fromSceneId = monster.sceneId;
  const nextMon = getNextMonsterInRun(data, state, monster);

  if (nextMon) {
    state.selectedMonsterId = nextMon.id;
    const gate = getGateMonster(data, fromSceneId);
    const bossSoon = gate && nextMon.id === gate.id;
    return {
      kind: 'next_monster',
      message: bossSoon
        ? `本關進度：Boss「${nextMon.name}」登場`
        : `本關進度：下一隻「${nextMon.name}」`,
      monster: nextMon,
      fromSceneId,
    };
  }

  // End of run (typically gate boss just cleared).
  if (isGateMonster(data, monster) || !getNextMonsterInRun(data, state, monster)) {
    const nextScene = getNextScene(data, fromSceneId);
    if (!nextScene) {
      return {
        kind: 'campaign_clear',
        message: `人生線通關：「${getScene(data, fromSceneId)?.name || fromSceneId}」已是最終站`,
        fromSceneId,
        monster,
      };
    }
    if (isSceneUnlocked(data, state, nextScene.id)) {
      state.selectedSceneId = nextScene.id;
      onGachaSceneChange(data, state, nextScene.id);
      const first = firstFightableInScene(data, state, nextScene.id);
      if (first) state.selectedMonsterId = first.id;
      return {
        kind: 'next_scene',
        message: `場景通關！前往「${nextScene.name}」`,
        fromSceneId,
        toSceneId: nextScene.id,
        nextScene,
        monster: first,
      };
    }
    return {
      kind: 'scene_blocked',
      message: `Boss 已破，但下一站「${nextScene.name}」尚未解鎖`,
      blockedHint: sceneUnlockHint(data, nextScene),
      fromSceneId,
      nextScene,
      monster,
    };
  }

  return { kind: 'stay', message: '可再戰刷素材', fromSceneId, monster };
}

/**
 * Retreat to previous unlocked scene for farming.
 * @returns {{ ok: boolean, message: string, scene?: object, monster?: object }}
 */
export function retreatToPreviousScene(data, state) {
  ensureRunState(state);
  const prev = getPrevScene(data, state.selectedSceneId);
  if (!prev) {
    return { ok: false, message: '已在第一場景，無處可退' };
  }
  if (!isSceneUnlocked(data, state, prev.id)) {
    return { ok: false, message: `上一場景「${prev.name}」未解鎖` };
  }
  state.selectedSceneId = prev.id;
  onGachaSceneChange(data, state, prev.id);
  const mon = firstFightableInScene(data, state, prev.id);
  if (mon) state.selectedMonsterId = mon.id;
  return {
    ok: true,
    message: `撤回「${prev.name}」練功／刷素材`,
    scene: prev,
    monster: mon,
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

/** Manual jump to next unlocked scene (same as auto next_scene without requiring gate). */
export function advanceToNextScene(data, state) {
  const next = getNextScene(data, state.selectedSceneId);
  if (!next || !isSceneUnlocked(data, state, next.id)) {
    return { ok: false, message: next ? `「${next.name}」尚未解鎖` : '已無下一場景' };
  }
  const from = state.selectedSceneId;
  state.selectedSceneId = next.id;
  onGachaSceneChange(data, state, next.id);
  const mon = firstFightableInScene(data, state, next.id);
  if (mon) state.selectedMonsterId = mon.id;
  return {
    ok: true,
    message: `前往「${next.name}」`,
    fromSceneId: from,
    scene: next,
    monster: mon,
  };
}
