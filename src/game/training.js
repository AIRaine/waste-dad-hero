/** Training dummy — practice swings, no real HP loss, no monster offense. */

export const TRAINING_DUMMY_ID = 'training_dummy';

export function isTrainingDummy(monsterOrId) {
  if (!monsterOrId) return false;
  if (typeof monsterOrId === 'string') return monsterOrId === TRAINING_DUMMY_ID;
  return monsterOrId.id === TRAINING_DUMMY_ID || monsterOrId.training === true;
}

/** Flat damage reduction 0–0.9 by difficulty id (editable in combat.json). */
export function trainingDefReduce(data, difficultyId) {
  const table = data.combat?.trainingDummy?.defByDifficulty || {};
  const raw = Number(table[difficultyId]);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(0.9, raw));
  const fallback = Number(data.combat?.trainingDummy?.defReduce) || 0.25;
  return Math.max(0, Math.min(0.9, fallback));
}

export function getTrainingDummy(data, difficultyId) {
  const cfg = data.combat?.trainingDummy || {};
  const defReduce = trainingDefReduce(data, difficultyId);
  return {
    id: TRAINING_DUMMY_ID,
    tier: 0,
    name: cfg.name || '練功木頭人',
    role: 'training',
    sceneId: null,
    shape: cfg.shape || 'dummy',
    color: cfg.color || '#a67c3a',
    scale: cfg.scale || 1.05,
    training: true,
    unlock: { type: 'default' },
    catalogHint: cfg.hint || '訓練用 · 不扣血、不反擊',
    hp: Number(cfg.displayHp) || 9999,
    atk: 0,
    defChance: 0,
    counterChance: 0,
    defendReduce: defReduce,
    defReduce,
    rewards: { gold: 0, material: 0, exp: 0 },
    as: 0,
    noMonsterSwing: true,
  };
}

export function formatTrainingDefPct(data, difficultyId) {
  return Math.round(trainingDefReduce(data, difficultyId) * 100);
}

/**
 * Training UI copy — must NOT contain 防 / 防禦 (user-facing ban).
 * Reduction still applies silently via trainingDefReduce.
 */
export function trainingUiCopy(data, difficultyId, diffName = '') {
  const pct = formatTrainingDefPct(data, difficultyId);
  return {
    pct,
    /** Chip under dummy — no 防 glyph */
    sturdyChip: `耐打${pct}%`,
    /** Difficulty chip suffix */
    diffSuffix: `${pct}%`,
    /** Opponent row */
    foeLabel: `練功木頭人 · ${diffName || '訓練'}`,
    /** AS readout line */
    asLine: `木頭人不出手 · ${diffName || '訓練'}`,
    /** Banner */
    banner: '訓練模式 · 傷害只顯示數字 · 雙方都不扣血',
    /** Picker meta */
    pickerMeta: `不扣血 · 不反擊 · 耐打隨難度（現 ${pct}%）`,
    /** Log when switching difficulty */
    switchLog: `木頭人耐打切到 ${pct}%（${diffName || difficultyId}）`,
  };
}
