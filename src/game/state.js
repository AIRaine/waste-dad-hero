import { defaultAvatar, ensureAvatarState } from './avatar.js';
import { migrateEquippedAura } from './skins.js';

const DEFAULT_BOOSTS = {
  successBoostStacks: 0,
  destroyProtect: 0,
  downgradeProtect: 0,
  doubleLootBattles: 0,
};

export function createInitialState(data) {
  const defaults = data.skins.catalog.filter((s) => s.unlock?.type === 'default').map((s) => s.id);
  const defaultWeapon =
    defaults.find((id) => data.skins.catalog.find((x) => x.id === id)?.slot === 'weapon') ||
    'blade_default';
  const starterGearIds = defaults.filter((id) => {
    const slot = data.skins.catalog.find((x) => x.id === id)?.slot;
    return slot === 'weapon' || ['helmet', 'armor', 'gloves', 'boots', 'shield'].includes(slot);
  });

  return {
    gold: data.meta.startingGold,
    material: data.meta.startingMaterial,
    exp: 0,
    kills: 0,
    weaponLevel: 0,
    highestEnhance: 0,
    // Starter gear is owned/inventory only — slots stay empty until the player equips.
    gearLevels: Object.fromEntries(starterGearIds.map((id) => [id, 0])),
    gearAffixes: {},
    enhanceFocusId: defaultWeapon,
    defeated: {},
    sceneClears: {},
    difficultyClears: {},
    ownedSkins: [...defaults],
    equipped: {
      weapon: null,
      helmet: null,
      armor: null,
      gloves: null,
      boots: null,
      shield: null,
      frame: defaults.find((id) => id.startsWith('frame_')) || 'frame_default',
      // 發脾氣特效：與新手裝備相同，預設空槽（可稍後在圖鑑穿戴）。
      victoryFx: null,
    },
    boosts: { ...DEFAULT_BOOSTS },
    inventory: {},
    boostArmed: { bless_scroll: 0, protect_scroll: 0, stable_charm: 0 },
    _boostMigrated: true,
    gacha: {
      active: null,
      pending: null,
      freeUsedByScene: {},
      drawsByScene: {},
      lastDrawId: null,
      revealOpen: false,
    },
    iapEntitlements: {
      gachaTickets: 0,
      speedBoost: false,
      shopDiscount: 0,
      purchased: [],
    },
    selectedSceneId: data.scenes.defaultId,
    selectedDifficultyId: data.difficulty.defaultId,
    selectedMonsterId: null,
    /** Farm meter → manual T challenge; auto-push off. */
    run: { autoAdvance: false },
    farm: { mode: 'farm', focusId: null, meters: {}, unlocked: {} },
    playerName: data.avatar?.defaultName || '廢材老爸',
    avatar: defaultAvatar(data),
    adminMode: false,
    gearFilter: '',
    catalogWeaponType: '全部',
    catalogGearSlot: '全部',
    catalogOwnedOnly: false,
    catalogJump: 'avatar',
    /** Per armor slot: equipped stats stay on, avatar overlay hidden. */
    hiddenGearVisual: {
      helmet: false,
      armor: false,
      gloves: false,
      boots: false,
      shield: false,
    },
    /** First-run guide dismissed — do not show again after persist. */
    firstRunGuideSeen: false,
    /** Battle sticky “go equip” nudge dismissed. */
    equipHintDismissed: false,
    log: [],
  };
}

export function loadState(data) {
  try {
    const raw = localStorage.getItem(data.meta.storageKey);
    if (!raw) return createInitialState(data);
    const parsed = JSON.parse(raw);
    const base = createInitialState(data);
    const merged = {
      ...base,
      ...parsed,
      boosts: { ...DEFAULT_BOOSTS, ...(parsed.boosts || {}) },
      equipped: { ...base.equipped, ...(parsed.equipped || {}) },
      inventory: { ...(parsed.inventory || {}) },
      boostArmed: { ...base.boostArmed, ...(parsed.boostArmed || {}) },
      gacha: {
        ...base.gacha,
        ...(parsed.gacha || {}),
        freeUsedByScene: {
          ...(base.gacha?.freeUsedByScene || {}),
          ...(parsed.gacha?.freeUsedByScene || {}),
        },
        drawsByScene: {
          ...(base.gacha?.drawsByScene || {}),
          ...(parsed.gacha?.drawsByScene || {}),
        },
        pending: parsed.gacha?.pending ?? null,
      },
      iapEntitlements: {
        ...base.iapEntitlements,
        ...(parsed.iapEntitlements || {}),
        purchased: [
          ...(parsed.iapEntitlements?.purchased || base.iapEntitlements.purchased || []),
        ],
      },
      sceneClears: { ...(parsed.sceneClears || {}) },
      difficultyClears: { ...(parsed.difficultyClears || {}) },
      defeated: parsed.defeated || {},
      gearLevels: { ...(parsed.gearLevels || {}) },
      gearAffixes: { ...(parsed.gearAffixes || {}) },
      ownedSkins: Array.from(new Set([...(base.ownedSkins || []), ...(parsed.ownedSkins || [])])),
      playerName: parsed.playerName || base.playerName,
      avatar: { ...base.avatar, ...(parsed.avatar || {}) },
      hiddenGearVisual: {
        ...base.hiddenGearVisual,
        ...(parsed.hiddenGearVisual || {}),
      },
      firstRunGuideSeen: !!(parsed.firstRunGuideSeen ?? base.firstRunGuideSeen),
      equipHintDismissed: !!(parsed.equipHintDismissed ?? base.equipHintDismissed),
      run: {
        autoAdvance: false,
        ...(parsed.run && typeof parsed.run === 'object' ? parsed.run : {}),
      },
      farm: {
        mode: 'farm',
        focusId: null,
        meters: {},
        unlocked: {},
        ...(parsed.farm && typeof parsed.farm === 'object' ? parsed.farm : {}),
      },
      gearFilter: '',
      log: [],
    };
    // Farm-tier gate supersedes PR #13 forced auto-advance.
    merged.run.autoAdvance = false;
    if (merged.farm.mode !== 'farm' && merged.farm.mode !== 'challenge') merged.farm.mode = 'farm';
    if (!merged.farm.meters || typeof merged.farm.meters !== 'object') merged.farm.meters = {};
    if (!merged.farm.unlocked || typeof merged.farm.unlocked !== 'object') merged.farm.unlocked = {};
    migrateEquippedAura(merged);
    // Drop retired aura ids from owned list after remap
    merged.ownedSkins = merged.ownedSkins.filter((id) => data.skins.catalog.some((s) => s.id === id));
    // Allow victoryFx: null (fully unequipped). Only remap unknown non-null ids —
    // never auto-fill a default aura for new/empty slots.
    if (
      merged.equipped.victoryFx != null &&
      !data.skins.catalog.some((s) => s.id === merged.equipped.victoryFx)
    ) {
      merged.equipped.victoryFx = null;
    }
    return merged;
  } catch {
    return createInitialState(data);
  }
}

export function saveState(data, state) {
  const payload = {
    gold: state.gold,
    material: state.material,
    exp: state.exp,
    kills: state.kills,
    weaponLevel: state.weaponLevel,
    highestEnhance: state.highestEnhance,
    gearLevels: state.gearLevels || {},
    gearAffixes: state.gearAffixes || {},
    enhanceFocusId: state.enhanceFocusId,
    defeated: state.defeated,
    sceneClears: state.sceneClears || {},
    difficultyClears: state.difficultyClears || {},
    ownedSkins: state.ownedSkins,
    equipped: state.equipped,
    hiddenGearVisual: state.hiddenGearVisual || {
      helmet: false,
      armor: false,
      gloves: false,
      boots: false,
      shield: false,
    },
    boosts: state.boosts,
    inventory: state.inventory,
    boostArmed: state.boostArmed,
    _boostMigrated: state._boostMigrated,
    gacha: state.gacha || {
      active: null,
      pending: null,
      freeUsedByScene: {},
      drawsByScene: {},
      lastDrawId: null,
      revealOpen: false,
    },
    iapEntitlements: state.iapEntitlements || {
      gachaTickets: 0,
      speedBoost: false,
      shopDiscount: 0,
      purchased: [],
    },
    selectedSceneId: state.selectedSceneId,
    selectedDifficultyId: state.selectedDifficultyId,
    selectedMonsterId: state.selectedMonsterId,
    run: state.run || { autoAdvance: false },
    farm: state.farm || { mode: 'farm', focusId: null, meters: {}, unlocked: {} },
    playerName: state.playerName,
    avatar: state.avatar,
    firstRunGuideSeen: !!state.firstRunGuideSeen,
    equipHintDismissed: !!state.equipHintDismissed,
  };
  localStorage.setItem(data.meta.storageKey, JSON.stringify(payload));
}

export { ensureAvatarState };

export function resetState(data) {
  localStorage.removeItem(data.meta.storageKey);
  return createInitialState(data);
}

export function pushLog(state, message, tone = 'info') {
  state.log = [{ id: Date.now() + Math.random(), message, tone, at: Date.now() }, ...state.log].slice(0, 8);
}

export function displayResource(state, n) {
  return state.adminMode ? '∞' : String(n);
}

export function playerMaxHp(data, wLevel, frameHp = 0, gearHp = 0) {
  return (
    (data.meta.playerBaseHp || 48) +
    (wLevel || 0) * (data.meta.playerHpPerEnhance || 3) +
    (frameHp || 0) +
    (gearHp || 0)
  );
}

export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function pickRange(table, key) {
  return table?.[key];
}
