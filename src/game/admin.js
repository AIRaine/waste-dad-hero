import { unlockAllSkins } from './skins.js';

const KEY = 'feicai-admin-mode';

export function loadAdminMode() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setAdminMode(data, on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  return !!on;
}

export function applyAdminFromQuery(data, state) {
  const q = new URLSearchParams(location.search);
  if (q.get('admin') === '1') {
    state.adminMode = setAdminMode(data, true);
  } else {
    state.adminMode = loadAdminMode(data);
  }
}

export function unlockAllForAdmin(data, state) {
  unlockAllSkins(data, state);
  for (const m of data.monsters.tiers) {
    if (!state.defeated[m.id]) state.defeated[m.id] = 1;
  }
  state.kills = Math.max(state.kills || 0, data.monsters.tiers.length * 2);
  state.sceneClears = state.sceneClears || {};
  state.difficultyClears = state.difficultyClears || {};
  for (const s of data.scenes.scenes) {
    state.sceneClears[s.id] = Math.max(state.sceneClears[s.id] || 0, 10);
    const bag = state.difficultyClears[s.id] || {};
    for (const d of data.difficulty.levels) {
      bag[d.id] = Math.max(bag[d.id] || 0, 3);
    }
    state.difficultyClears[s.id] = bag;
  }
  state.highestEnhance = Math.max(state.highestEnhance || 0, data.enhance?.maxLevel || 12);
}
