export function getScene(data, sceneId) {
  return data.scenes.scenes.find((s) => s.id === sceneId) || data.scenes.scenes[0];
}

export function getDifficulty(data, id) {
  return (
    data.difficulty.levels.find((d) => d.id === id) ||
    data.difficulty.levels.find((d) => d.id === data.difficulty.defaultId)
  );
}

export function getMonster(data, monsterId) {
  return data.monsters.tiers.find((m) => m.id === monsterId) || null;
}

function sceneDiffClears(state, sceneId, difficultyId) {
  return state.difficultyClears?.[sceneId]?.[difficultyId] || 0;
}

function evalRule(data, state, rule, ctx = {}) {
  if (!rule) return false;
  const sceneId = ctx.sceneId || state.selectedSceneId;
  switch (rule.type) {
    case 'default':
      return true;
    case 'kills':
      return state.kills >= (rule.count || 0);
    case 'sceneClears':
      return (state.sceneClears?.[rule.sceneId] || 0) >= (rule.count || 1);
    case 'sceneAccess':
      return isSceneUnlocked(data, state, rule.sceneId);
    case 'defeat':
      return (state.defeated?.[rule.monsterId] || 0) > 0;
    case 'enhance':
      return (state.highestEnhance || 0) >= (rule.level || 1);
    case 'sceneDifficultyClear': {
      const sid = rule.sceneId || sceneId;
      const need = rule.count || 1;
      return sceneDiffClears(state, sid, rule.difficultyId) >= need;
    }
    case 'allOf':
      return (rule.rules || []).every((r) => evalRule(data, state, r, ctx));
    case 'anyOf':
      return (rule.rules || []).some((r) => evalRule(data, state, r, ctx));
    default:
      return false;
  }
}

export function isSceneUnlocked(data, state, sceneId) {
  const scene = getScene(data, sceneId);
  if (!scene) return false;
  return evalRule(data, state, scene.unlock, { sceneId });
}

export function isDifficultyUnlocked(data, state, difficultyId, sceneId = state.selectedSceneId) {
  const diff = getDifficulty(data, difficultyId);
  if (!diff) return false;
  return evalRule(data, state, diff.unlock || { type: 'default' }, { sceneId });
}

export function unlockHintRule(data, rule, ctx = {}) {
  if (!rule) return '未知條件';
  switch (rule.type) {
    case 'default':
      return '初始開放';
    case 'kills':
      return `累積擊殺 ${rule.count}`;
    case 'sceneClears': {
      const sc = getScene(data, rule.sceneId);
      return `${sc?.name || rule.sceneId}通關 ${rule.count} 次`;
    }
    case 'sceneAccess': {
      const sc = getScene(data, rule.sceneId);
      return `解鎖場景「${sc?.name || rule.sceneId}」`;
    }
    case 'defeat': {
      const m = getMonster(data, rule.monsterId);
      return m ? `先擊敗「${m.name}」` : '先擊敗前置怪物';
    }
    case 'enhance':
      return `任一裝備強化達 +${rule.level || 1}`;
    case 'sceneDifficultyClear': {
      const sid = rule.sceneId || ctx.sceneId;
      const sc = getScene(data, sid);
      const d = getDifficulty(data, rule.difficultyId);
      const where = sc ? `${sc.name}` : '本場景';
      return `${where}以「${d?.name || rule.difficultyId}」通關 ${rule.count || 1} 次`;
    }
    case 'allOf':
      return (rule.rules || []).map((r) => unlockHintRule(data, r, ctx)).join(' 且 ');
    case 'anyOf':
      return (rule.rules || []).map((r) => unlockHintRule(data, r, ctx)).join(' 或 ');
    default:
      return '特殊條件';
  }
}

export function sceneUnlockHint(data, scene) {
  return unlockHintRule(data, scene.unlock, { sceneId: scene.id });
}

export function difficultyUnlockHint(data, difficulty, sceneId) {
  return unlockHintRule(data, difficulty.unlock || { type: 'default' }, { sceneId });
}

export function listUnlockedScenes(data, state) {
  return [...data.scenes.scenes]
    .sort((a, b) => a.order - b.order)
    .filter((s) => isSceneUnlocked(data, state, s.id));
}

export function monstersInScene(data, sceneId) {
  return data.monsters.tiers
    .filter((m) => m.sceneId === sceneId)
    .slice()
    .sort((a, b) => a.tier - b.tier);
}

export function isMonsterFightable(data, state, monster) {
  if (!monster) return false;
  if (!isSceneUnlocked(data, state, monster.sceneId)) return false;
  return evalRule(
    data,
    state,
    monster.unlock || { type: 'sceneAccess', sceneId: monster.sceneId },
    { sceneId: monster.sceneId },
  );
}

export function monsterUnlockHint(data, monster) {
  if (monster.catalogHint) return monster.catalogHint;
  return unlockHintRule(
    data,
    monster.unlock || { type: 'sceneAccess', sceneId: monster.sceneId },
    { sceneId: monster.sceneId },
  );
}

export function isMonsterCatalogOwned(state, monster) {
  return (state.defeated?.[monster.id] || 0) > 0;
}

export function scaleMonster(monster, difficulty) {
  const sm = difficulty?.statMul || { hp: 1, atk: 1 };
  const rm = difficulty?.rewardMul || { gold: 1, material: 1, exp: 1 };
  return {
    ...monster,
    hp: Math.max(1, Math.round(monster.hp * (sm.hp || 1))),
    atk: Math.max(1, Math.round(monster.atk * (sm.atk || 1))),
    defChance: Math.min(0.6, (monster.defChance || 0) * (difficulty?.defMul || 1)),
    counterChance: Math.min(0.5, (monster.counterChance || 0) * (difficulty?.counterMul || 1)),
    rewards: {
      gold: Math.max(1, Math.round((monster.rewards?.gold || 1) * (rm.gold || 1))),
      material: Math.max(1, Math.round((monster.rewards?.material || 1) * (rm.material || 1))),
      exp: Math.max(1, Math.round((monster.rewards?.exp || 1) * (rm.exp || 1))),
    },
  };
}

export function ensureSceneSelection(data, state) {
  if (!isSceneUnlocked(data, state, state.selectedSceneId)) {
    state.selectedSceneId = listUnlockedScenes(data, state)[0]?.id || data.scenes.defaultId;
  }
  // Training dummy: keep any difficulty (DEF practice) and keep the dummy selected.
  // Must run BEFORE difficulty unlock clamp, or hard/normal get snapped back to easy.
  if (state.selectedMonsterId === 'training_dummy') return;

  if (!isDifficultyUnlocked(data, state, state.selectedDifficultyId, state.selectedSceneId)) {
    const ordered = [...data.difficulty.levels].sort((a, b) => (a.order || 0) - (b.order || 0));
    const open = ordered.find((d) => isDifficultyUnlocked(data, state, d.id, state.selectedSceneId));
    state.selectedDifficultyId = open?.id || data.difficulty.defaultId;
  }

  const pool = monstersInScene(data, state.selectedSceneId).filter((m) =>
    isMonsterFightable(data, state, m),
  );
  if (!pool.length) {
    state.selectedMonsterId = null;
    return;
  }
  if (!pool.some((m) => m.id === state.selectedMonsterId)) {
    state.selectedMonsterId = pool[0].id;
  }
}

export function recordSceneClear(state, monster, difficultyId) {
  if (!monster?.sceneId) return;
  state.sceneClears = state.sceneClears || {};
  state.sceneClears[monster.sceneId] = (state.sceneClears[monster.sceneId] || 0) + 1;
  if (difficultyId) {
    state.difficultyClears = state.difficultyClears || {};
    const bag = state.difficultyClears[monster.sceneId] || {};
    bag[difficultyId] = (bag[difficultyId] || 0) + 1;
    state.difficultyClears[monster.sceneId] = bag;
  }
}
