import { unlockAllForAdmin, setAdminMode } from './admin.js';
import {
  autoFightWaitMs,
  formatAs,
  monsterAttackCooldownMs,
  monsterAttackSpeed,
  playerAttackCooldownMs,
  playerAttackSpeed,
} from './attackSpeed.js';
import {
  ensureAvatarState,
  playerDisplayName,
  sanitizePlayerName,
  setAvatarPart,
} from './avatar.js';
import { armedCount, cycleBoost, ensureBoostState, ownedCount, topUpAdminBoosts } from './boosts.js';
import { createBattle, playerAttack, playerIsHit, tickBattle } from './combat.js';
import {
  clearGacha,
  drawCost,
  drawGacha,
  ensureGachaState,
  formatGachaEffectLines,
  getGachaBonuses,
  gachaUnlockHint,
  isGachaUnlocked,
  onGachaSceneChange,
  toneLabel,
} from './gacha.js';
import {
  ARMOR_SLOTS,
  ensureGearState,
  ensureHiddenGearVisual,
  equippedWeaponLevel,
  filterOwnedGear,
  formatGearStatLines,
  formatPieceSummary,
  gearSlotDefs,
  getGearLevel,
  isGearVisualHidden,
  maxGear,
  playerMitigation,
  resolveGearAffix,
  sortCatalogGear,
  successRateAt,
  toggleGearVisualHidden,
  totalBlockChance,
  totalCounterChance,
  totalGearCrit,
  totalPlayerAtk,
  totalPlayerDef,
  tryEnhance,
  enhanceCost,
  unequipGear,
  visibleGearBundle,
} from './gear.js';
import {
  difficultyUnlockHint,
  ensureSceneSelection,
  getDifficulty,
  getMonster,
  getScene,
  isDifficultyUnlocked,
  isMonsterCatalogOwned,
  isMonsterFightable,
  isSceneUnlocked,
  listUnlockedScenes,
  monsterUnlockHint,
  monstersInScene,
  scaleMonster,
  sceneUnlockHint,
} from './scenes.js';
import {
  advanceToNextScene,
  applyVictoryProgression,
  canManualAdvanceScene,
  canRetreat,
  ensureRunState,
  retreatToPreviousScene,
  runProgress,
} from './run.js';
import {
  challengeIdFromFarmId,
  currentFarmOrChallengeMonster,
  enterChallenge,
  ensureFarmState,
  farmMeterView,
  isFarmMonsterId,
  makeFarmMinion,
  migrateFarmFromDefeated,
  returnToFarm,
  syncFarmFocus,
} from './farm.js';
import { clearHitFloatDom, setPendingAttackSfxGroup, syncHitFloatDom } from './hitFloats.js';
import {
  initSfx,
  installSfxUnlock,
  isSfxMuted,
  toggleSfxMuted,
  unlockSfx,
  weaponSfxGroup,
} from './sfx.js';
import {
  TRAINING_DUMMY_ID,
  formatTrainingDefPct,
  getTrainingDummy,
  isTrainingDummy,
  trainingUiCopy,
} from './training.js';
import {
  ensureIapState,
  grantIapPack,
  iapTierLabel,
  listIapPacks,
  shopPriceMul,
} from './iap.js';
import { buyItem, buySkin } from './shop.js';
import { framedPortraitHtml } from './frameAuraArt.js';
import {
  equipSkin,
  formatAuraBonusChips,
  formatAuraBonusLines,
  formatFrameBonusChips,
  formatFrameBonusLines,
  getAuraBonuses,
  getEquippedSkin,
  getFrameBonuses,
  getGearSkin,
  isUnlocked,
  rarityClass,
  rarityMeta,
  rarityStars,
  unequipSkin,
  unlockAllSkins,
  unlockHint,
} from './skins.js';
import { appIconSvg, sceneIconHtml, tabIconSvg, TAB_META } from './icons.js';
import { gearSvg, itemIconSvg, monsterSvg, playerSvg, weaponSvg } from './sprites.js';
import { displayResource, pushLog, resetState, saveState } from './state.js';

const TABS = TAB_META;

export function createApp(root, data, state) {
  initSfx(data.sfx);
  const uninstallSfxUnlock = installSfxUnlock();
  ensureRunState(state);
  ensureFarmState(state);
  migrateFarmFromDefeated(data, state);

  function armAttackSfx() {
    const weapon = getEquippedSkin(data, state, 'weapon');
    setPendingAttackSfxGroup(weaponSfxGroup(weapon));
  }

  let tab = 'battle';
  let battle = null;
  let enhanceFlash = null;
  let victoryFx = false;
  let raf = 0;
  let autoFighting = false;
  let autoFightTimer = 0;
  /** @type {{ kind: string, message: string, blockedHint?: string } | null} */
  let lastRunProgress = null;

  function resolveFoughtMonster() {
    if (!battle?.monsterId) return null;
    if (battle.monsterId === TRAINING_DUMMY_ID) return { id: TRAINING_DUMMY_ID };
    if (isFarmMonsterId(data, battle.monsterId)) {
      const cid = challengeIdFromFarmId(data, battle.monsterId);
      const ch = getMonster(data, cid);
      return ch ? makeFarmMinion(data, ch) : null;
    }
    return getMonster(data, battle.monsterId);
  }

  function noteVictoryProgression() {
    if (!battle?.over || !battle.victory || battle.progressionApplied) return lastRunProgress;
    const fought = resolveFoughtMonster();
    const prog = applyVictoryProgression(data, state, fought, {
      training: !!battle.training || battle.monsterId === TRAINING_DUMMY_ID,
    });
    battle.progressionApplied = true;
    if (prog?.message) {
      lastRunProgress = prog;
      pushLog(state, prog.message, prog.kind === 'scene_blocked' ? 'warn' : 'good');
      if (prog.blockedHint) pushLog(state, prog.blockedHint, 'info');
    }
    return prog;
  }
  let tierPickerOpen = false;
  let scenePickerOpen = false;
  /** Ephemeral on-page banner: { tab, message, tone } — shown where the player is looking. */
  let pageNotice = null;
  let pageNoticeTimer = 0;
  const scrollMemory = Object.create(null);

  function showPageNotice(message, tone = 'bad', forTab = tab) {
    pageNotice = { tab: forTab, message, tone };
    if (pageNoticeTimer) window.clearTimeout(pageNoticeTimer);
    pageNoticeTimer = window.setTimeout(() => {
      pageNotice = null;
      pageNoticeTimer = 0;
      render();
    }, 2800);
  }

  function noticeHtml(forTab) {
    if (!pageNotice || pageNotice.tab !== forTab || !pageNotice.message) return '';
    return `<div class="page-notice tone-${pageNotice.tone || 'bad'}" role="status">${pageNotice.message}</div>`;
  }

  ensureGearState(data, state);
  ensureHiddenGearVisual(state);
  ensureBoostState(data, state);
  ensureGachaState(state);
  ensureAvatarState(data, state);
  ensureSceneSelection(data, state);

  function persist() {
    ensureGearState(data, state);
    ensureHiddenGearVisual(state);
    ensureBoostState(data, state);
    ensureGachaState(state);
    ensureAvatarState(data, state);
    ensureSceneSelection(data, state);
    saveState(data, state);
    setAdminMode(data, !!state.adminMode);
  }

  function avatarSvg(framePalette, gearOverride = null) {
    const gear = gearOverride || visibleGearBundle(data, state);
    return playerSvg(framePalette || {}, state.avatar || {}, gear);
  }

  function slotIcon(skin, lv = 0) {
    if (!skin) return '';
    if (skin.slot === 'weapon') return weaponSvg(skin.palette, lv, skin.type, { motif: skin.motif });
    return gearSvg(skin.slot, skin.palette, { motif: skin.motif });
  }

  function slotLabel(slot) {
    return gearSlotDefs(data).find((s) => s.id === slot)?.label || slot;
  }

  function applyAdmin(on, { confirmed = false } = {}) {
    const next = !!on;
    if (next && !state.adminMode && !confirmed) {
      const ok = window.confirm('開啟管理員測試？將顯示無限資源，並可解鎖全進度（原型用）。');
      if (!ok) {
        render();
        return;
      }
    }
    state.adminMode = setAdminMode(data, next);
    pushLog(state, state.adminMode ? '已開啟管理員測試（無限資源）' : '已關閉管理員測試', 'info');
    persist();
    render();
  }

  function currentMonsterRaw() {
    ensureSceneSelection(data, state);
    ensureFarmState(state);
    if (state.selectedMonsterId === TRAINING_DUMMY_ID) {
      return getTrainingDummy(data, state.selectedDifficultyId);
    }
    const farmFoe = currentFarmOrChallengeMonster(data, state);
    if (farmFoe) return farmFoe;
    syncFarmFocus(data, state);
    const focusMon = currentFarmOrChallengeMonster(data, state);
    if (focusMon) return focusMon;
    return monstersInScene(data, state.selectedSceneId)[0];
  }

  function currentMonster() {
    const raw = currentMonsterRaw();
    if (isTrainingDummy(raw)) return raw;
    if (raw?.isFarmMinion) {
      // Farm minion already stat-tuned; still apply difficulty mul.
      const diff = getDifficulty(data, state.selectedDifficultyId);
      return scaleMonster(raw, diff);
    }
    const diff = getDifficulty(data, state.selectedDifficultyId);
    return scaleMonster(raw, diff);
  }

  function stopAutoFight({ renderAfter = false } = {}) {
    autoFighting = false;
    if (autoFightTimer) {
      clearTimeout(autoFightTimer);
      autoFightTimer = 0;
    }
    if (renderAfter) render();
  }

  function ensureBattle() {
    if (!battle) {
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
    }
  }

  function handleAutoFightOutcome(res) {
    if (res?.victory) victoryFx = true;
    if (!battle?.over) {
      persist();
      render();
      scheduleAutoStrike();
      return;
    }
    if (!battle.victory) {
      autoFighting = false;
      persist();
      render();
      return;
    }
    noteVictoryProgression();
    persist();
    render();
    scheduleAutoRematch();
  }

  function scheduleAutoRematch() {
    if (!autoFighting || tab !== 'battle') {
      stopAutoFight({ renderAfter: true });
      return;
    }
    if (autoFightTimer) {
      clearTimeout(autoFightTimer);
      autoFightTimer = 0;
    }
    autoFightTimer = setTimeout(() => {
      autoFightTimer = 0;
      if (!autoFighting || tab !== 'battle') {
        stopAutoFight({ renderAfter: true });
        return;
      }
      ensureSceneSelection(data, state);
      const foe = currentMonster();
      battle = createBattle(data, state, foe);
      victoryFx = false;
      const label =
        lastRunProgress?.kind === 'meter_full'
          ? `農區已滿，續刷或手動挑戰 · ${foe?.name}`
          : lastRunProgress?.kind === 'challenge_clear' || lastRunProgress?.kind === 'scene_gate_clear'
            ? `回農區續刷「${foe?.name}」`
            : `掛機續戰「${foe?.name}」`;
      pushLog(state, label, 'info');
      persist();
      render();
      scheduleAutoStrike();
    }, 750);
  }

  function scheduleAutoStrike() {
    if (!autoFighting || tab !== 'battle' || !battle) {
      stopAutoFight({ renderAfter: true });
      return;
    }
    if (battle.over) {
      if (battle.victory) scheduleAutoRematch();
      else stopAutoFight({ renderAfter: true });
      return;
    }
    if (autoFightTimer) {
      clearTimeout(autoFightTimer);
      autoFightTimer = 0;
    }
    // Remain aligned with playerAttack CD gate: wait the leftover cooldown, not a fresh full bar.
    const cd = playerAttackCooldownMs(data, state);
    const elapsed = Date.now() - (battle.lastPlayerAttackAt || 0);
    const remain = Math.max(0, cd - elapsed);
    const paced = autoFightWaitMs(data, state, currentMonster());
    const wait = battle.lastPlayerAttackAt ? Math.min(paced, Math.max(remain, 16)) : paced;
    autoFightTimer = setTimeout(() => {
      autoFightTimer = 0;
      if (!autoFighting || tab !== 'battle' || !battle || battle.over) {
        if (battle?.over) handleAutoFightOutcome({ victory: !!battle.victory });
        else stopAutoFight({ renderAfter: true });
        return;
      }
      armAttackSfx();
      const res = playerAttack(data, state, battle, currentMonster());
      if (res.blocked) {
        scheduleAutoStrike();
        return;
      }
      handleAutoFightOutcome(res);
    }, wait);
  }

  function startAutoFight() {
    if (autoFighting) return;
    // iOS: unlock Web Audio inside this tap gesture (打怪).
    unlockSfx();
    // Never fight under an open scene/foe picker overlay.
    scenePickerOpen = false;
    tierPickerOpen = false;
    if (battle?.over) {
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
    }
    ensureBattle();
    if (!battle || battle.over) return;
    autoFighting = true;
    pushLog(state, '掛機打怪開始——勝利後會自動再戰；點「暫停」停止。', 'info');
    armAttackSfx();
    const res = playerAttack(data, state, battle, currentMonster());
    if (res.blocked) {
      render();
      scheduleAutoStrike();
      return;
    }
    handleAutoFightOutcome(res);
  }

  function toggleAutoFight() {
    if (autoFighting) {
      stopAutoFight();
      if (battle && !battle.over) {
        battle.monsterState = 'idle';
        battle.playerState = 'idle';
      }
      pushLog(state, '已停止掛機打怪。', 'info');
      render();
      return;
    }
    startAutoFight();
  }

  function mainScrollSelector(forTab = tab) {
    return forTab === 'battle' ? '.battle-scroll' : '.page-scroll';
  }

  function collectionScrollKey() {
    return `main:collection:${state.catalogJump || 'avatar'}`;
  }

  function captureScroll(forTab = tab) {
    const main = root.querySelector(mainScrollSelector(forTab));
    if (!main) return;
    if (forTab === 'collection') {
      scrollMemory[collectionScrollKey()] = main.scrollTop;
      scrollMemory['main:collection'] = main.scrollTop;
    } else {
      scrollMemory[`main:${forTab}`] = main.scrollTop;
    }
  }

  function restoreScroll(forTab = tab) {
    const el = root.querySelector(mainScrollSelector(forTab));
    if (!el) return;
    if (forTab === 'collection') {
      const key = collectionScrollKey();
      el.scrollTop = scrollMemory[key] != null ? scrollMemory[key] : 0;
    } else if (scrollMemory[`main:${forTab}`] != null) {
      el.scrollTop = scrollMemory[`main:${forTab}`];
    }
  }

  function watchScrollers() {
    const el = root.querySelector(mainScrollSelector(tab));
    if (el) {
      el.addEventListener(
        'scroll',
        () => {
          if (tab === 'collection') {
            scrollMemory[collectionScrollKey()] = el.scrollTop;
            scrollMemory['main:collection'] = el.scrollTop;
          } else {
            scrollMemory[`main:${tab}`] = el.scrollTop;
          }
        },
        { passive: true },
      );
    }
  }

  function setTab(next) {
    if (next !== 'battle') {
      stopAutoFight();
      tierPickerOpen = false;
      scenePickerOpen = false;
    }
    captureScroll(tab);
    tab = next;
    if (tab === 'battle') ensureBattle();
    render({ skipCapture: true });
  }

  function chooseMonster(id) {
    stopAutoFight();
    ensureFarmState(state);
    if (id === TRAINING_DUMMY_ID) {
      state.selectedMonsterId = id;
    } else {
      const mon = (data.monsters?.tiers || []).find((x) => x.id === id);
      if (!mon) return;
      // Manual pick of a catalog foe = enter challenge if unlocked/reachable; else ignore.
      const res = enterChallenge(data, state, mon.id);
      if (!res.ok) {
        showPageNotice(res.message, 'warn', 'battle');
        tierPickerOpen = false;
        render();
        return;
      }
    }
    battle = createBattle(data, state, currentMonster());
    victoryFx = false;
    tierPickerOpen = false;
    persist();
    render();
  }

  function chooseScene(id) {
    if (!isSceneUnlocked(data, state, id)) return;
    stopAutoFight();
    const expired = onGachaSceneChange(data, state, id);
    state.selectedSceneId = id;
    ensureFarmState(state);
    state.farm.mode = 'farm';
    state.farm.focusId = null;
    syncFarmFocus(data, state, id);
    const farm = returnToFarm(data, state);
    if (farm.monster) state.selectedMonsterId = farm.monster.id;
    else {
      state.selectedMonsterId = null;
      ensureSceneSelection(data, state);
    }
    battle = createBattle(data, state, currentMonster());
    victoryFx = false;
    scenePickerOpen = false;
    tierPickerOpen = false;
    if (expired) {
      pushLog(state, '換場景，人情退場', 'warn');
      showPageNotice('換場景，人情扭蛋退場', 'warn', 'battle');
    }
    persist();
    render();
  }

  function doGachaDraw() {
    stopAutoFight();
    const res = drawGacha(data, state, state.selectedSceneId, { autofighting: false });
    if (!res.ok) {
      pushLog(state, res.reason || '抽卡失敗', 'bad');
      showPageNotice(res.reason || '抽卡失敗', 'bad', 'battle');
      render();
      return;
    }
    battle = createBattle(data, state, currentMonster());
    pushLog(
      state,
      `扭蛋：${res.card.name}（${toneLabel(res.card.tone)} · ${res.duration}場）`,
      res.card.tone === 'debuff' ? 'warn' : 'good',
    );
    showPageNotice(`${res.card.name} · ${res.card.tagline}`, 'good', 'battle');
    persist();
    render();
  }

  function doGachaClear() {
    stopAutoFight();
    clearGacha(state);
    battle = createBattle(data, state, currentMonster());
    pushLog(state, '卸下人情效果', 'info');
    persist();
    render();
  }

  function chooseDifficulty(id) {
    const trainingSelected = state.selectedMonsterId === TRAINING_DUMMY_ID;
    // Training dummy: all difficulty tiers selectable so DEF practice is reachable.
    if (!trainingSelected && !isDifficultyUnlocked(data, state, id, state.selectedSceneId)) {
      const diff = getDifficulty(data, id);
      const tip = `尚未解鎖「${diff?.name || id}」：${difficultyUnlockHint(data, diff, state.selectedSceneId)}`;
      pushLog(state, tip, 'warn');
      showPageNotice(tip, 'warn', 'battle');
      render();
      return;
    }
    stopAutoFight();
    state.selectedDifficultyId = id;
    battle = createBattle(data, state, currentMonster());
    victoryFx = false;
    if (trainingSelected) {
      const diff = getDifficulty(data, id);
      pushLog(state, trainingUiCopy(data, id, diff?.name).switchLog, 'info');
    }
    persist();
    render();
  }

  function renderStatPills(chips, { className = '' } = {}) {
    return `<div class="stat-pills ${className}">${(chips || [])
      .map((c) => `<span class="stat-pill bonus-chip kind-${c.kind || 'none'}">${c.label}</span>`)
      .join('')}</div>`;
  }

  function affixClass(skin) {
    const a = resolveGearAffix(state, skin);
    if (a === 'bless') return 'affix-bless';
    if (a === 'curse') return 'affix-curse';
    return '';
  }

  function rarityBadge(skin) {
    const meta = rarityMeta(skin?.rarity, data);
    const rc = rarityClass(skin?.rarity);
    return `<span class="rarity-badge ${rc}" style="--rarity:${meta.color}">${meta.name}${meta.label || ''}</span>`;
  }

  function roleLabel(role) {
    if (role === 'boss') return 'Boss';
    if (role === 'elite') return '精英';
    if (role === 'training') return '訓練';
    return '雜兵';
  }

  function roleTag(role) {
    if (role === 'boss') return '【Boss】';
    if (role === 'elite') return '【精英】';
    if (role === 'training') return '【訓練】';
    return '';
  }

  function ownershipBadge(owned, eq) {
    if (eq) return `<span class="own-badge is-equipped">裝備中</span>`;
    if (owned) return `<span class="own-badge is-owned">已擁有</span>`;
    return `<span class="own-badge is-locked">未解鎖</span>`;
  }

  function renderBattle() {
    ensureBattle();
    const raw = currentMonsterRaw();
    const m = currentMonster();
    const scene = getScene(data, state.selectedSceneId);
    const diff = getDifficulty(data, state.selectedDifficultyId);
    const weapon = getEquippedSkin(data, state, 'weapon');
    const frame = getEquippedSkin(data, state, 'frame');
    const fx = getEquippedSkin(data, state, 'victoryFx');
    const shield = getEquippedSkin(data, state, 'shield');
    const wLevel = equippedWeaponLevel(state);
    const atk = totalPlayerAtk(data, state);
    const def = totalPlayerDef(data, state);
    const mit = playerMitigation(data, state);
    const block = totalBlockChance(data, state);
    const counter = totalCounterChance(data, state);
    const frameBonuses = getFrameBonuses(data, state);
    const auraBonuses = getAuraBonuses(data, state);
    const gachaBonuses = getGachaBonuses(data, state);
    const critTotal =
      totalGearCrit(data, state) + (frameBonuses.critChance || 0) + (gachaBonuses.critChance || 0);
    const displayAtk = Math.max(
      1,
      Math.round(
        atk *
          (1 +
            (frameBonuses.atkPct || 0) +
            (auraBonuses.atkPct || 0) +
            (gachaBonuses.atkPct || 0)),
      ),
    );
    const mHpPct = Math.max(0, (battle.monsterHp / battle.monsterMaxHp) * 100);
    const pHpPct = Math.max(0, (battle.playerHp / battle.playerMaxHp) * 100);
    const sceneMonsters = monstersInScene(data, state.selectedSceneId);
    const training = isTrainingDummy(m) || battle.training;
    const trainingDefPct = formatTrainingDefPct(data, state.selectedDifficultyId);
    const trainCopy = trainingUiCopy(data, state.selectedDifficultyId, diff.name);

    const playerAs = playerAttackSpeed(data, state);
    const playerCd = playerAttackCooldownMs(data, state);
    const monsterAs = training ? 0 : monsterAttackSpeed(m, data);
    const monsterCd = training ? 0 : monsterAttackCooldownMs(m, data);
    // Slim chips: HP lives on the bar; AS lives on .as-readout — do not repeat.
    const frameBonusChips = formatFrameBonusChips(frame).filter(
      (c) => c.kind !== 'none' && c.kind !== 'hp' && c.kind !== 'crit',
    );
    const auraBonusChips = formatAuraBonusChips(fx).filter((c) => c.kind !== 'none');
    const gachaEffectLines = gachaBonuses.card
      ? formatGachaEffectLines(gachaBonuses.card.effects || {})
      : [];
    const playerChips = [
      { kind: 'atk', label: `攻${displayAtk}` },
      { kind: 'def', label: `防${def}` },
      ...(mit > 0 ? [{ kind: 'mit', label: `減傷${Math.round(mit * 100)}%` }] : []),
      ...(block > 0 ? [{ kind: 'block', label: `格擋${Math.round(block * 100)}%` }] : []),
      ...(counter > 0 ? [{ kind: 'counter', label: `反擊${Math.round(counter * 100)}%` }] : []),
      ...(critTotal > 0 ? [{ kind: 'crit', label: `暴擊${Math.round(critTotal * 100)}%` }] : []),
      ...frameBonusChips,
      ...auraBonusChips,
      ...(gachaBonuses.card
        ? [{ kind: 'gacha', label: `${gachaBonuses.card.name}·${gachaBonuses.active?.battlesLeft || 0}場` }]
        : []),
    ];
    const gachaOpen = isGachaUnlocked(data, state);
    const gachaCost = drawCost(data, state, state.selectedSceneId);
    const gachaCard = gachaBonuses.card;
    const monsterChips = training
      ? [
          { kind: 'role-training', label: '訓練' },
          { kind: 'sturdy', label: trainCopy.sturdyChip },
          { kind: 'block', label: '不反擊' },
        ]
      : [
          { kind: m.role === 'boss' ? 'role-boss' : m.role === 'elite' ? 'role-elite' : 'role-trash', label: roleLabel(m.role) },
          { kind: 'atk', label: `攻${m.atk}` },
          ...(m.defChance > 0 ? [{ kind: 'block', label: `格擋${Math.round((m.defChance || 0) * 100)}%` }] : []),
          ...(m.counterChance > 0 ? [{ kind: 'counter', label: `反擊${Math.round((m.counterChance || 0) * 100)}%` }] : []),
        ];
    const recentLog = (state.log || []).slice(0, 4);
    const run = training ? null : runProgress(data, state, state.selectedSceneId);
    const meter = training ? null : farmMeterView(data, state, state.selectedSceneId);
    const runLabel = !meter
      ? ''
      : meter.mode === 'challenge'
        ? `挑戰中 · T${meter.index + 1}/${meter.total}`
        : meter.cleared
          ? `本階已過 · T${meter.index + 1}/${meter.total}`
          : `農區 T${meter.index + 1}/${meter.total}`;
    const showRetreat = canRetreat(data, state);
    const showAdvance = canManualAdvanceScene(data, state);
    const showChallengeBtn = !training && meter?.canChallenge && meter.mode === 'farm';
    const showReturnFarm = !training && meter?.mode === 'challenge';

    return `
      <section class="battle ${scenePickerOpen || tierPickerOpen ? 'is-picker-open' : ''}">
        <div class="battle-scroll">
          <div class="fight-setup">
            <button type="button" class="setup-btn setup-scene" data-action="scene-picker" aria-expanded="${scenePickerOpen}">
              <span class="setup-main">${sceneIconHtml(scene, 28)} <span>${scene.name}</span></span>
              <span class="setup-meta">${diff.name}</span>
              <span class="tier-caret">▾</span>
            </button>
            <div class="diff-chips" role="group" aria-label="難度">
              ${[...data.difficulty.levels]
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((d) => {
                  const open =
                    training || isDifficultyUnlocked(data, state, d.id, state.selectedSceneId);
                  const active = d.id === state.selectedDifficultyId;
                  const defPct = formatTrainingDefPct(data, d.id);
                  const tip = training
                    ? `${d.name} · 木頭人耐打 ${defPct}%`
                    : open
                      ? d.desc || d.name
                      : difficultyUnlockHint(data, d, state.selectedSceneId);
                  return `<button type="button" class="chip compact ${active ? 'active' : ''} ${open ? '' : 'locked'}" data-difficulty="${d.id}" title="${tip}">${d.name}${training ? ` ${defPct}%` : open ? '' : '·鎖'}</button>`;
                })
                .join('')}
            </div>
            ${noticeHtml('battle')}
            <button type="button" class="setup-btn setup-foe" data-action="tier-picker" aria-expanded="${tierPickerOpen}">
              <span class="setup-label">對手</span>
              <span class="setup-main">${
                training
                  ? `${roleTag('training')}${trainCopy.foeLabel}`
                  : `T${raw.tier} ${roleTag(raw.role)}${raw.name}`
              }</span>
              <span class="tier-caret">▾</span>
            </button>
            ${
              runLabel && meter
                ? `<div class="run-strip" aria-label="農區進度">
                    <span class="run-chip ${meter.mode === 'challenge' ? 'is-boss' : ''}">${runLabel}</span>
                    <span class="run-gate-hint">目標：${meter.focus.name}</span>
                    <div class="farm-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${meter.need}" aria-valuenow="${meter.have}" aria-label="農區擊殺進度">
                      <div class="farm-meter-fill" style="width:${meter.pct}%"></div>
                      <span class="farm-meter-label">${meter.unlocked || meter.cleared ? '可挑戰' : `${meter.have}/${meter.need}`}</span>
                    </div>
                  </div>`
                : ''
            }

            <div class="gacha-panel tone-${gachaCard?.tone || (gachaOpen ? 'idle' : 'locked')}" data-gacha-panel>
              <div class="gacha-head">
                <strong>場景扭蛋</strong>
                <span class="gacha-scene">${sceneIconHtml(scene, 22)} ${scene.name}</span>
              </div>
              ${
                !gachaOpen
                  ? `<p class="gacha-lock muted">${gachaUnlockHint(data)}</p>`
                  : gachaCard
                    ? `<div class="gacha-active">
                        <div class="gacha-name">${gachaCard.name}<span class="gacha-tone">${toneLabel(gachaCard.tone)}</span></div>
                        <p class="gacha-tag">${gachaCard.tagline}</p>
                        <div class="gacha-effects">${gachaEffectLines.map((l) => `<span>${l}</span>`).join('')}</div>
                        <p class="gacha-left muted">剩餘 ${gachaBonuses.active?.battlesLeft ?? 0} 場 · 換場景會退場</p>
                      </div>`
                    : `<p class="gacha-idle muted">抽一位本場景人情（含增益／互換／惡搞減益）</p>`
              }
              ${
                gachaOpen
                  ? `<div class="gacha-actions">
                      <button type="button" class="btn gacha-draw" data-action="gacha-draw">${
                        gachaCard ? `再抽 · ${gachaCost.label}` : `抽一次 · ${gachaCost.label}`
                      }</button>
                      ${
                        gachaCard && data.gacha?.rules?.skipAllowed !== false
                          ? `<button type="button" class="btn ghost" data-action="gacha-clear">卸下</button>`
                          : ''
                      }
                    </div>`
                  : ''
              }
              ${
                gachaOpen && state.gacha?.revealOpen && gachaCard
                  ? `<div class="gacha-reveal" role="status">
                      <p class="gacha-reveal-title">抽到：${gachaCard.name}</p>
                      <p class="gacha-reveal-flavor">${gachaCard.flavor || gachaCard.tagline}</p>
                      <button type="button" class="btn ghost compact" data-action="gacha-reveal-close">知道了</button>
                    </div>`
                  : ''
              }
            </div>
          </div>

          ${training ? `<div class="training-banner" role="status">${trainCopy.banner}</div>` : ''}

          <div class="arena ${victoryFx ? 'victory-fx' : ''} ${training ? 'is-training' : ''}" style="--fx1:${fx?.palette?.primary || '#ffe08a'};--fx2:${fx?.palette?.accent || '#ffb347'};--scene1:${scene.bg?.[0] || '#1a3340'};--scene2:${scene.bg?.[1] || '#122028'}">
            <div class="fighter monster ${battle.monsterState}" data-monster-hp="${battle.monsterHp}" data-monster-maxhp="${battle.monsterMaxHp}" data-training="${training ? '1' : '0'}">
              <div class="hp-readout" aria-label="${training ? '訓練假人' : '怪物生命'}">${
                training ? '訓練 ∞' : `${battle.monsterHp}/${battle.monsterMaxHp}`
              }</div>
              <div class="hpbar ${training ? 'is-training' : ''}" data-hp-pct="${training ? '100' : mHpPct.toFixed(1)}"><span class="hpbar-fill" style="width:${training ? 100 : mHpPct}%"></span></div>
              <div class="portrait-stage">
                <div class="portrait-box monster-portrait" style="--mob1:${m.color || '#6a7888'};--mob2:#243040">
                  ${monsterSvg(m.shape, m.color, { scale: m.scale || 1, role: training ? null : m.role })}
                </div>
              </div>
              <div class="fighter-meta">
                <div class="name">${m.name}</div>
                ${renderStatPills(monsterChips, { className: 'monster-stat-pills' })}
              </div>
              <!-- hit floats live in #hit-float-layer (persistent; not remounted here) -->
            </div>
            <div class="vs" aria-hidden="true">${training ? '練' : 'VS'}</div>
            <div class="fighter player ${battle.playerState}${playerIsHit(battle) ? ' is-hit' : ''}" data-player-hp="${battle.playerHp}">
              <div class="hp-readout" aria-label="玩家生命">${battle.playerHp}/${battle.playerMaxHp}</div>
              <div class="hpbar player" data-hp-pct="${pHpPct.toFixed(1)}"><span class="hpbar-fill" style="width:${pHpPct}%"></span></div>
              <div class="portrait-stage">
                ${framedPortraitHtml(avatarSvg(frame?.palette), frame, fx, { burst: victoryFx })}
                <div class="weapon-badge ${affixClass(weapon)}">${slotIcon(weapon, wLevel)}</div>
                <div class="shield-badge ${affixClass(shield)}">${slotIcon(shield, getGearLevel(state, shield?.id))}</div>
              </div>
              <div class="fighter-meta">
                <div class="name">${playerDisplayName(state)} · ${weapon ? `${weapon.name}+${wLevel}` : '徒手'}</div>
                ${renderStatPills(playerChips, { className: 'player-stat-pills' })}
              </div>
            </div>
          </div>

          <div
            class="as-readout ${training ? 'is-training' : ''}"
            data-player-as="${formatAs(playerAs)}"
            data-player-cd="${playerCd}"
            data-monster-as="${training ? '0' : formatAs(monsterAs)}"
            data-monster-cd="${monsterCd}"
            data-combat-base="${data.combat?.playerBaseAs ?? ''}"
            data-training="${training ? '1' : '0'}"
            data-training-def="${trainingDefPct}"
          >
            <div class="as-col as-mob-col">
              <span class="as-k">${training ? '訓練' : '怪'}</span>
              <strong class="as-mob">${
                training
                  ? trainCopy.asLine
                  : `${formatAs(monsterAs)}<span class="as-ms">（${monsterCd}ms）</span>`
              }</strong>
            </div>
            <div class="as-col as-you-col">
              <span class="as-k">你</span>
              <strong class="as-you">${formatAs(playerAs)}<span class="as-ms">（${playerCd}ms）</span></strong>
            </div>
            ${autoFighting ? `<span class="auto-live">${training ? '練功中' : '掛機中'}</span>` : ''}
          </div>

          <div class="battle-log-wrap">
            <div class="battle-log-label">最近紀錄</div>
            <ul class="log">${
              recentLog.length
                ? recentLog.map((l) => `<li class="${l.tone}">${l.message}</li>`).join('')
                : `<li class="muted-empty">${training ? '點「練功」打木頭人。' : '點「打怪」開始。'}</li>`
            }</ul>
          </div>
        </div>

        ${
          scenePickerOpen
            ? `<div class="tier-picker scene-picker" role="dialog" aria-modal="true" aria-label="選擇場景">
                <button type="button" class="tier-picker-backdrop" data-action="scene-picker-close" aria-label="關閉"></button>
                <div class="tier-picker-panel">
                  <div class="tier-picker-head"><strong>家庭場景</strong>
                    <button type="button" class="btn ghost tier-picker-x" data-action="scene-picker-close">關閉</button>
                  </div>
                  <div class="tier-picker-list">
                    ${data.scenes.scenes
                      .sort((a, b) => a.order - b.order)
                      .map((s) => {
                        const unlocked = isSceneUnlocked(data, state, s.id);
                        const clears = state.sceneClears?.[s.id] || 0;
                        return `<div role="button" tabindex="${unlocked ? 0 : -1}" class="tier-option ${s.id === state.selectedSceneId ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-scene-id="${s.id}" aria-disabled="${unlocked ? 'false' : 'true'}">
                          <span class="tier-option-body">
                            <span class="tier-option-main">${sceneIconHtml(s, 26)} ${s.name}${unlocked ? '' : ' · 鎖'}</span>
                            <span class="tier-option-meta">${unlocked ? `通關 ${clears} · ${s.flavor}` : sceneUnlockHint(data, s)}</span>
                          </span>
                        </div>`;
                      })
                      .join('')}
                  </div>
                </div>
              </div>`
            : ''
        }

        ${
          tierPickerOpen
            ? `<div class="tier-picker" role="dialog" aria-modal="true" aria-label="選擇對手">
                <button type="button" class="tier-picker-backdrop" data-action="tier-picker-close" aria-label="關閉"></button>
                <div class="tier-picker-panel" role="listbox">
                  <div class="tier-picker-head"><strong>${scene.name}對手</strong>
                    <button type="button" class="btn ghost tier-picker-x" data-action="tier-picker-close">關閉</button>
                  </div>
                  <div class="tier-picker-list">
                    <div role="button" tabindex="0" class="tier-option training-option ${training ? 'active' : ''}" data-monster-id="${TRAINING_DUMMY_ID}">
                      <span class="tier-option-body">
                        <span class="tier-option-main">${roleTag('training')}練功木頭人</span>
                        <span class="tier-option-meta">${trainCopy.pickerMeta}</span>
                      </span>
                    </div>
                    ${sceneMonsters
                      .map((t) => {
                        const open = isMonsterFightable(data, state, t);
                        const selected = t.id === state.selectedMonsterId;
                        return `<div role="button" tabindex="${open ? 0 : -1}" class="tier-option ${selected ? 'active' : ''} ${open ? '' : 'locked'}" data-monster-id="${t.id}" aria-disabled="${open ? 'false' : 'true'}">
                          <span class="tier-option-body">
                            <span class="tier-option-main">T${t.tier} ${roleTag(t.role)}${t.name}${open ? '' : ' · 鎖'}</span>
                            <span class="tier-option-meta">${
                              open
                                ? `${roleLabel(t.role)} · HP${t.hp}`
                                : monsterUnlockHint(data, t)
                            }</span>
                          </span>
                        </div>`;
                      })
                      .join('')}
                  </div>
                </div>
              </div>`
            : ''
        }

        <div class="battle-controls">
          ${
            battle.over && !autoFighting
              ? `<div class="result-box ${battle.victory ? 'win' : 'lose'}">
                  <p>${battle.victory ? '勝利！' : '敗北…'}</p>
                  ${
                    battle.rewards
                      ? `<p class="reward">+${battle.rewards.gold} 金 · +${battle.rewards.material} 材 · +${battle.rewards.exp} 經驗${battle.rewards.doubled ? '（雙倍）' : ''}</p>`
                      : ''
                  }
                  ${
                    battle.victory && lastRunProgress?.message
                      ? `<p class="run-progress-msg">${lastRunProgress.message}${
                          lastRunProgress.blockedHint
                            ? `<br><span class="muted">${lastRunProgress.blockedHint}</span>`
                            : ''
                        }</p>`
                      : ''
                  }
                  <button type="button" class="btn primary wide" data-action="rematch">再戰</button>
                  ${
                    showChallengeBtn
                      ? `<button type="button" class="btn wide" data-action="farm-challenge">挑戰「${meter.focus.name}」</button>`
                      : ''
                  }
                  ${
                    showReturnFarm
                      ? `<button type="button" class="btn wide" data-action="farm-return">回刷小怪</button>`
                      : ''
                  }
                  ${
                    battle.victory && showAdvance
                      ? `<button type="button" class="btn wide" data-action="run-advance">前往下一場景</button>`
                      : ''
                  }
                  ${
                    showRetreat
                      ? `<button type="button" class="btn ghost wide" data-action="run-retreat">撤回上一場景練功</button>`
                      : ''
                  }
                </div>`
              : `<div class="auto-fight-bar">
                  ${
                    battle.over && autoFighting && battle.victory
                      ? `<p class="auto-farm-banner">${
                          lastRunProgress?.message || '勝利！即將續戰…'
                        }</p>`
                      : ''
                  }
                  <button type="button" class="btn attack ${autoFighting ? 'is-auto' : ''}" data-action="autofight" aria-pressed="${autoFighting}">
                    ${autoFighting ? '暫停' : training ? '練功' : '打怪'}
                  </button>
                  ${
                    !autoFighting && showChallengeBtn
                      ? `<button type="button" class="btn wide" data-action="farm-challenge">挑戰「${meter.focus.name}」</button>`
                      : ''
                  }
                  ${
                    !autoFighting && showReturnFarm
                      ? `<button type="button" class="btn wide" data-action="farm-return">回刷小怪</button>`
                      : ''
                  }
                  ${
                    !autoFighting && showRetreat
                      ? `<button type="button" class="btn ghost wide run-retreat-inline" data-action="run-retreat">撤回上一場景無限農區</button>`
                      : ''
                  }
                </div>`
          }
        </div>
      </section>`;
  }

  const BOOST_STRIP = [
    { id: 'bless_scroll', short: '香火' },
    { id: 'protect_scroll', short: '平安' },
    { id: 'stable_charm', short: '金牌' },
  ];

  function renderEnhance() {
    ensureGearState(data, state);
    ensureHiddenGearVisual(state);
    ensureBoostState(data, state);
    const gearId = state.enhanceFocusId;
    const focus = getGearSkin(data, gearId) || getEquippedSkin(data, state, 'weapon');
    const level = getGearLevel(state, gearId);
    const cost = enhanceCost(data, level);
    const rate = successRateAt(data, level);
    const owned = filterOwnedGear(data, state, state.gearFilter || '');
    const focusIcon = slotIcon(focus, level);
    const focusSummary = formatPieceSummary(data, state, focus);
    const focusEquipped = !!(focus && state.equipped?.[focus.slot] === focus.id);
    const focusIsArmor = !!(focus && ARMOR_SLOTS.includes(focus.slot));
    const focusHidden = focusIsArmor && isGearVisualHidden(state, focus.slot);
    const costLine = `金 ${state.adminMode ? '∞' : cost.gold}／材 ${state.adminMode ? '∞' : cost.material}`;

    return `
      <section class="enhance page-with-cta">
        <div class="page-scroll enhance-browse">
          <div class="enhance-browse-head">
            <h2>裝備強化</h2>
            <p class="muted">點選聚焦 · 再點穿戴／卸下 · 可空槽</p>
          </div>
          <div class="gear-picker">
            <input id="gear-filter" class="gear-filter" placeholder="搜尋已擁有裝備…" value="${state.gearFilter || ''}" />
            <div class="gear-list" role="listbox">
              ${owned
                .map((skin) => {
                  const lv = getGearLevel(state, skin.id);
                  const selected = skin.id === gearId;
                  const eq = state.equipped?.[skin.slot] === skin.id;
                  const hidden = ARMOR_SLOTS.includes(skin.slot) && isGearVisualHidden(state, skin.slot);
                  const meta = rarityMeta(skin.rarity, data);
                  return `<button type="button" class="gear-row ${rarityClass(skin.rarity)} ${affixClass(skin)} ${selected ? 'selected' : ''} ${eq ? 'is-equipped' : ''}" data-select-gear="${skin.id}" title="點選聚焦 · 再點或雙擊穿戴">
                    <div class="gear-icon ${affixClass(skin)}">${slotIcon(skin, lv)}</div>
                    <div><strong class="rarity-name">${skin.name}${eq ? ' · 穿戴中' : ''}${eq && hidden ? '（隱藏）' : ''}</strong><span>${meta.name}${meta.label} · ${slotLabel(skin.slot)} · ${formatPieceSummary(data, state, skin)}</span></div>
                  </button>`;
                })
                .join('') || `<p class="muted">尚無裝備</p>`}
            </div>
          </div>
        </div>
        <div class="page-cta enhance-cta ${enhanceFlash || ''}">
          ${noticeHtml('enhance')}
          <div class="cta-summary">
            <div class="enhance-rate-icon sticky-summary-icon" aria-hidden="true">
              <div class="weapon-mini vivid">${focusIcon}</div>
            </div>
            <div class="cta-meta">
              <strong>${focus?.name || '裝備'}+${level}${focusEquipped ? ' · 穿戴中' : ''}${focusHidden ? '（隱藏）' : ''}</strong>
              <span class="cta-rate-line"><b class="rate-pct-inline">${(rate * 100).toFixed(0)}%</b> · ${costLine} · ${focusSummary}</span>
            </div>
          </div>
          <div class="enhance-action-strip" role="group" aria-label="強化操作">
            <div class="enhance-ops">
              ${BOOST_STRIP.map(({ id, short }) => {
                const item = data.items.catalog.find((i) => i.id === id);
                const n = ownedCount(state, id);
                const on = armedCount(state, id);
                const label = item?.name || short;
                return `<button type="button" class="boost-chip ${on ? 'on' : ''}" data-cycle-boost="${id}" ${n <= 0 ? 'disabled' : ''} title="${label}（持有 ${n}${on ? ` · 已套 ${on}` : ''}）" aria-pressed="${on > 0}">
                  <span class="boost-chip-ico" aria-hidden="true">${itemIconSvg(id)}</span>
                  <span class="boost-chip-text">${short}</span>
                  <span class="boost-chip-count">${on ? `已套${on}` : `×${n}`}</span>
                </button>`;
              }).join('')}
              <button type="button" class="ops-chip enhance-wear-btn ${focusEquipped ? 'is-on' : ''}" data-action="${focusEquipped ? 'unequip-focus' : 'wear-focus'}" title="${focusEquipped ? '卸下此裝（空槽）' : '穿戴此裝'}">${focusEquipped ? '卸下' : '穿戴'}</button>
              ${
                focusIsArmor
                  ? `<button type="button" class="ops-chip enhance-hide-btn ${focusHidden ? 'on' : ''}" data-action="toggle-hide-focus" aria-pressed="${focusHidden}" title="${focusHidden ? '顯示疊圖' : '隱藏疊圖'}">${focusHidden ? '顯示' : '隱藏'}</button>`
                  : ''
              }
            </div>
            <button type="button" class="btn primary wide enhance-cta-btn" data-action="enhance">嘗試強化</button>
          </div>
          ${
            state.adminMode
              ? `<div class="admin-tools compact">
                  <button type="button" class="btn wide" data-action="admin-max">一鍵滿強</button>
                  <button type="button" class="btn wide" data-action="admin-boosts">補滿輔助</button>
                </div>`
              : ''
          }
        </div>
      </section>`;
  }

  function renderShop() {
    ensureIapState(state);
    const shopSkins = data.skins.catalog.filter((s) => s.unlock?.type === 'shop');
    const priceMul = shopPriceMul(state);
    const iapPacks = data.iap?.showInShop === false ? [] : listIapPacks(data);
    return `
      <section class="shop page-with-cta">
        <div class="page-scroll">
          <h2>商店</h2>
          <p class="muted">輔助道具、外觀，以及支援老爸闖關的方案。</p>
          ${
            iapPacks.length
              ? `<h3>支援方案</h3>
                <p class="muted iap-hint">由小到大，點「試領」立刻生效（示範商店，不會真實扣款）。</p>
                <div class="shop-list iap-list">
                  ${iapPacks
                    .map((pack) => {
                      const owned = state.iapEntitlements.purchased?.includes(pack.id);
                      return `<div class="shop-row iap-row tier-${pack.tier || 'mid'}">
                        <div class="shop-ico iap-ico">${iapTierLabel(pack.tier).slice(0, 1)}</div>
                        <div class="shop-copy">
                          <h3>${pack.name} <span class="iap-tier">${iapTierLabel(pack.tier)}</span></h3>
                          <p>${pack.desc}</p>
                          <p class="price">${pack.priceHint || ''}${owned ? ' · 已試領' : ''}</p>
                        </div>
                        <button type="button" class="btn shop-buy" data-iap="${pack.id}">${owned ? '再領' : '試領'}</button>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : ''
          }
          <h3>道具</h3>
          <div class="shop-list">
            ${data.items.catalog
              .map(
                (item) => `<div class="shop-row">
                  <div class="shop-ico">${itemIconSvg(item.id)}</div>
                  <div class="shop-copy"><h3>${item.name}</h3><p>${item.desc}</p><p class="price">${state.adminMode ? '免費' : `${item.priceGold} 金`}</p></div>
                  <button type="button" class="btn shop-buy" data-buy="${item.id}">${state.adminMode ? '領' : '買'}</button>
                </div>`,
              )
              .join('')}
          </div>
          <h3>外觀${priceMul < 1 ? `（收藏家證 −${Math.round((1 - priceMul) * 100)}%）` : ''}</h3>
          <div class="shop-list">
            ${shopSkins
              .map((skin) => {
                const owned = state.ownedSkins.includes(skin.id);
                const raw = skin.unlock?.priceGold || 0;
                const price = Math.max(1, Math.round(raw * priceMul));
                return `<div class="shop-row">
                  <div class="shop-ico">${
                    skin.slot === 'weapon' || ARMOR_SLOTS.includes(skin.slot)
                      ? slotIcon(skin, 0)
                      : `<div class="swatch" style="--c1:${skin.palette.primary};--c2:${skin.palette.accent}"></div>`
                  }</div>
                  <div class="shop-copy"><h3>${skin.name}</h3><p>${skin.desc}</p><p class="price">${owned ? '已擁有' : state.adminMode ? '免費' : `${price} 金${priceMul < 1 && price !== raw ? `（原 ${raw}）` : ''}`}</p></div>
                  <button type="button" class="btn shop-buy" data-buy-skin="${skin.id}" ${owned ? 'disabled' : ''}>${owned ? '持有' : state.adminMode ? '領' : '買'}</button>
                </div>`;
              })
              .join('')}
          </div>
          <div class="banner muted">同伴盲盒即將登場，敬請期待。</div>
        </div>
        <div class="page-cta shop-cta">
          ${noticeHtml('shop')}
          <p class="cta-hint">金 ${displayResource(state, state.gold)} · 材 ${displayResource(state, state.material)}</p>
        </div>
      </section>`;
  }

  function renderCollection() {
    const CATALOG_CATS = [
      { id: 'avatar', label: '角色' },
      { id: 'weapons', label: '武器' },
      { id: 'gear', label: '防具' },
      { id: 'frames', label: '外框' },
      { id: 'fx', label: '發脾氣特效' },
      { id: 'monsters', label: '怪物' },
      { id: 'scenes', label: '場景' },
    ];
    const catIds = CATALOG_CATS.map((c) => c.id);
    const cat = catIds.includes(state.catalogJump) ? state.catalogJump : 'avatar';
    state.catalogJump = cat;

    const typeFilter = state.catalogWeaponType || '全部';
    const gearSlotFilter = state.catalogGearSlot || '全部';
    const ownedOnly = !!state.catalogOwnedOnly;
    const weaponTypes = ['全部', ...new Set(data.skins.catalog.filter((s) => s.slot === 'weapon' && s.type).map((s) => s.type))];
    const gearSlotChips = ['全部', ...ARMOR_SLOTS];
    let weapons = data.skins.catalog.filter((s) => s.slot === 'weapon' && (typeFilter === '全部' || s.type === typeFilter));
    let gearPieces = sortCatalogGear(
      data.skins.catalog.filter(
        (s) => ARMOR_SLOTS.includes(s.slot) && (gearSlotFilter === '全部' || s.slot === gearSlotFilter),
      ),
    );
    let frames = data.skins.catalog.filter((s) => s.slot === 'frame');
    let fxList = data.skins.catalog.filter((s) => s.slot === 'victoryFx');
    let monsters = data.monsters.tiers;
    const skinOwned = (skin) => isUnlocked(data, state, skin) || state.ownedSkins.includes(skin.id);
    if (ownedOnly) {
      weapons = weapons.filter(skinOwned);
      gearPieces = gearPieces.filter(skinOwned);
      frames = frames.filter(skinOwned);
      fxList = fxList.filter(skinOwned);
      monsters = monsters.filter((m) => isMonsterCatalogOwned(state, m));
    }

    const showOwnedFilter = ['weapons', 'gear', 'frames', 'fx', 'monsters'].includes(cat);
    const catMeta = CATALOG_CATS.find((c) => c.id === cat) || CATALOG_CATS[0];

    const weaponCard = (skin) => {
      const owned = skinOwned(skin);
      const eq = state.equipped.weapon === skin.id;
      const lv = owned ? getGearLevel(state, skin.id) : 0;
      const affix = resolveGearAffix(state, skin);
      const meta = rarityMeta(skin.rarity, data);
      return `<button type="button" class="skin-card weapon-card ${rarityClass(skin.rarity)} ${affixClass(skin)} ${owned ? 'owned' : 'locked'} ${eq ? 'equipped' : ''}" data-equip="${skin.id}" ${owned ? '' : 'disabled'}>
        ${ownershipBadge(owned, eq)}
        ${rarityBadge(skin)}
        <div class="card-left"><div class="mini weapon-art ${affixClass(skin)}">${slotIcon(skin, lv)}</div>
        <strong class="rarity-name">${skin.name}${owned ? ` +${lv}` : ''}</strong><span class="card-status">${owned ? (eq ? '裝備中 · 點擊卸下' : '點擊裝備') : unlockHint(skin, data)}${affix === 'bless' ? ' · 祝福' : affix === 'curse' ? ' · 詛咒' : ''}</span></div>
        <div class="card-right">
          <div class="stat-line"><span>攻擊加成</span><b>+${skin.atkBonus ?? 0}</b></div>
          <div class="stat-line"><span>爆擊</span><b>${Math.round((skin.critChance || 0) * 100)}%</b></div>
          <div class="stat-line"><span>攻速加成</span><b>+${formatAs(skin.asBonus ?? 0)}</b></div>
          <div class="stat-line"><span>類型</span><b>${skin.type || '武器'}</b></div>
          <div class="stat-line"><span>稀有</span><b class="rarity" style="color:${meta.color}">${meta.name} ${rarityStars(skin.rarity)}</b></div>
          <div class="stat-line unlock"><span>解鎖</span><b>${unlockHint(skin, data)}</b></div>
          ${skin.flavor ? `<p class="flavor">${skin.flavor}</p>` : ''}
        </div>
      </button>`;
    };

    const gearCard = (skin) => {
      const owned = skinOwned(skin);
      const eq = state.equipped[skin.slot] === skin.id;
      const hidden = eq && isGearVisualHidden(state, skin.slot);
      const lv = owned ? getGearLevel(state, skin.id) : 0;
      const affix = resolveGearAffix(state, skin);
      const meta = rarityMeta(skin.rarity, data);
      const status = !owned
        ? unlockHint(skin, data)
        : eq
          ? hidden
            ? '穿戴中 · 疊圖已隱藏 · 點擊卸下'
            : '穿戴中 · 點擊卸下'
          : '點擊裝備';
      return `<div class="skin-card gear-card ${rarityClass(skin.rarity)} ${affixClass(skin)} ${owned ? 'owned' : 'locked'} ${eq ? 'equipped' : ''} ${hidden ? 'visual-hidden' : ''}">
        ${ownershipBadge(owned, eq)}
        ${rarityBadge(skin)}
        <button type="button" class="gear-card-main" data-equip="${skin.id}" ${owned ? '' : 'disabled'}>
          <div class="card-left"><div class="mini weapon-art ${affixClass(skin)}">${slotIcon(skin, lv)}</div>
          <strong class="rarity-name">${skin.name}${owned ? ` +${lv}` : ''}</strong><span class="card-status">${status}${affix === 'bless' ? ' · 祝福' : affix === 'curse' ? ' · 詛咒' : ''}</span></div>
          <div class="card-right">
            ${formatGearStatLines(skin)
              .map((line) => `<div class="stat-line"><span>${line}</span><b></b></div>`)
              .join('')}
            <div class="stat-line"><span>部位</span><b>${slotLabel(skin.slot)}</b></div>
            <div class="stat-line"><span>稀有</span><b class="rarity" style="color:${meta.color}">${meta.name} ${rarityStars(skin.rarity)}</b></div>
            <div class="stat-line unlock"><span>解鎖</span><b>${unlockHint(skin, data)}</b></div>
            ${skin.flavor ? `<p class="flavor">${skin.flavor}</p>` : ''}
          </div>
        </button>
        ${
          eq
            ? `<div class="gear-card-actions">
                <button type="button" class="gear-unequip-btn" data-unequip-slot="${skin.slot}">卸下</button>
                <button type="button" class="gear-hide-toggle ${hidden ? 'on' : ''}" data-toggle-hide-slot="${skin.slot}" aria-pressed="${hidden}">${hidden ? '顯示疊圖' : '隱藏疊圖'}</button>
              </div>`
            : ''
        }
      </div>`;
    };

    const avatarPreviewCard = `
      <div class="avatar-preview-card is-frozen" data-avatar-sticky-preview>
        <div class="avatar-preview">
          ${framedPortraitHtml(
            avatarSvg(getEquippedSkin(data, state, 'frame')?.palette),
            getEquippedSkin(data, state, 'frame'),
            getEquippedSkin(data, state, 'victoryFx'),
            { compact: true },
          )}
        </div>
        <div class="avatar-preview-meta">
          <label class="avatar-name-field">
            <span>顯示名稱</span>
            <input
              id="player-name-input"
              type="text"
              maxlength="${data.avatar.maxNameLength || 8}"
              value="${playerDisplayName(state)}"
              placeholder="${data.avatar.defaultName || '廢材老爸'}"
              autocomplete="nickname"
            />
          </label>
          <p class="muted avatar-name-hint">最多 ${data.avatar.maxNameLength || 8} 字 · 戰鬥顯示</p>
        </div>
      </div>`;

    let paneHtml = '';
    if (cat === 'avatar') {
      paneHtml = `
        <section class="catalog-pane catalog-pane-avatar" data-catalog-pane="avatar" aria-label="角色">
          <p class="muted catalog-pane-sub">擊殺 ${state.kills} · 下方選項捲動，頭像預覽固定在分類列下</p>
          <div class="avatar-editor is-subpage">
            <div class="avatar-options-flow">
              ${(data.avatar.categories || [])
                .map((avatarCat) => {
                  return `<div class="avatar-cat" data-avatar-cat="${avatarCat.id}">
                    <div class="avatar-cat-label">${avatarCat.label}</div>
                    <div class="avatar-options" role="listbox" aria-label="${avatarCat.label}">
                      ${(avatarCat.options || [])
                        .map((opt) => {
                          const on = state.avatar?.[avatarCat.id] === opt.id;
                          const swatch = opt.color
                            ? `<i class="avatar-swatch" style="--sw:${opt.color}"></i>`
                            : `<i class="avatar-swatch is-shape" data-shape="${opt.id}"></i>`;
                          return `<button type="button" class="avatar-opt ${on ? 'active' : ''}" role="option" aria-selected="${on}" data-avatar-part="${avatarCat.id}" data-avatar-option="${opt.id}">
                            ${swatch}<span>${opt.label}</span>
                          </button>`;
                        })
                        .join('')}
                    </div>
                  </div>`;
                })
                .join('')}
            </div>
          </div>
        </section>`;
    } else if (cat === 'weapons') {
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="weapons" aria-label="武器">
          <h2 class="catalog-pane-title">${catMeta.label}</h2>
          <div class="type-chips">${weaponTypes.map((t) => `<button type="button" class="chip ${typeFilter === t ? 'active' : ''}" data-weapon-type="${t}">${t}</button>`).join('')}</div>
          <div class="skin-grid weapons">${weapons.map(weaponCard).join('') || '<p class="muted catalog-empty">無</p>'}</div>
        </section>`;
    } else if (cat === 'gear') {
      ensureHiddenGearVisual(state);
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="gear" aria-label="防具">
          <h2 class="catalog-pane-title">${catMeta.label}</h2>
          <p class="muted">頭盔／護甲／手套／靴子／盾牌 · 穿戴後可隱藏疊圖（數值仍生效）</p>
          <div class="type-chips">${gearSlotChips
            .map((t) => {
              const label = t === '全部' ? '全部' : slotLabel(t);
              return `<button type="button" class="chip ${gearSlotFilter === t ? 'active' : ''}" data-gear-slot="${t}">${label}</button>`;
            })
            .join('')}</div>
          <div class="type-chips gear-hide-chips" role="group" aria-label="隱藏防具疊圖">
            ${ARMOR_SLOTS.map((slot) => {
              const on = isGearVisualHidden(state, slot);
              return `<button type="button" class="chip hide-chip ${on ? 'active' : ''}" data-toggle-hide-slot="${slot}" aria-pressed="${on}" title="${on ? '點擊顯示疊圖' : '點擊隱藏疊圖'}">隱·${slotLabel(slot)}</button>`;
            }).join('')}
          </div>
          <div class="skin-grid weapons">${gearPieces.map(gearCard).join('') || '<p class="muted catalog-empty">無</p>'}</div>
        </section>`;
    } else if (cat === 'frames') {
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="frames" aria-label="外框">
          <h2 class="catalog-pane-title">${catMeta.label}</h2>
          <div class="skin-grid frames">${frames
            .map((skin) => {
              const owned = skinOwned(skin);
              const eq = state.equipped.frame === skin.id;
              return `<button type="button" class="skin-card frame-card ${owned ? 'owned' : 'locked'} ${eq ? 'equipped' : ''}" data-equip="${skin.id}" ${owned ? '' : 'disabled'}>
                ${ownershipBadge(owned, eq)}
                <div class="card-left"><div class="frame-preview">${framedPortraitHtml(avatarSvg(skin.palette), skin, null, { compact: true })}</div>
                <strong>${skin.name}</strong></div>
                <div class="card-right">${formatFrameBonusLines(skin).map((l) => `<div class="stat-line bonus"><b>${l}</b></div>`).join('')}
                <div class="stat-line unlock"><span>解鎖</span><b>${unlockHint(skin, data)}</b></div></div>
              </button>`;
            })
            .join('') || '<p class="muted catalog-empty">無</p>'}</div>
        </section>`;
    } else if (cat === 'fx') {
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="fx" aria-label="發脾氣特效">
          <h2 class="catalog-pane-title">發脾氣特效</h2>
          <p class="muted">裝備後戰鬥頭像持續可見；可卸下留空（無焰）· 攻％／攻速</p>
          <div class="skin-grid frames">${fxList
            .map((skin) => {
              const owned = skinOwned(skin);
              const eq = state.equipped.victoryFx === skin.id;
              const frame = getEquippedSkin(data, state, 'frame');
              return `<div class="skin-card frame-card fx-card ${owned ? 'owned' : 'locked'} ${eq ? 'equipped' : ''}">
                ${ownershipBadge(owned, eq)}
                <button type="button" class="gear-card-main" data-equip="${skin.id}" ${owned ? '' : 'disabled'}>
                  <div class="card-left"><div class="frame-preview">${framedPortraitHtml(avatarSvg(frame?.palette), frame, skin, { compact: true })}</div>
                  <strong>${skin.name}</strong><span class="card-status">${owned ? (eq ? '裝備中 · 點擊卸下' : '點擊裝備') : unlockHint(skin, data)}</span></div>
                  <div class="card-right">${formatAuraBonusLines(skin).map((l) => `<div class="stat-line bonus"><b>${l}</b></div>`).join('')}
                  <div class="stat-line unlock"><span>解鎖</span><b>${unlockHint(skin, data)}</b></div></div>
                </button>
                ${
                  eq
                    ? `<button type="button" class="gear-unequip-btn" data-unequip-slot="victoryFx">卸下特效</button>`
                    : ''
                }
              </div>`;
            })
            .join('') || '<p class="muted catalog-empty">無</p>'}</div>
        </section>`;
    } else if (cat === 'monsters') {
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="monsters" aria-label="怪物">
          <h2 class="catalog-pane-title">${catMeta.label}</h2>
          <p class="muted">解鎖看場景條件，不只擊殺</p>
          <div class="skin-grid monsters">${monsters
            .map((m) => {
              const n = state.defeated[m.id] || 0;
              const owned = n > 0;
              const sc = getScene(data, m.sceneId);
              return `<div class="skin-card monster-card ${owned ? 'owned' : 'locked'} role-${m.role || 'trash'}">
                ${ownershipBadge(owned, false)}
                <div class="mini">${monsterSvg(m.shape, m.color, { scale: m.scale || 1, role: m.role })}</div>
                <strong>${m.name}</strong>
                <span>${sc ? sceneIconHtml(sc, 18) : ''}${sc?.name || m.sceneId} · T${m.tier} · ${roleLabel(m.role)} · 攻速${formatAs(monsterAttackSpeed(m, data))}</span>
                <span class="unlock-req">${owned ? `擊敗 ${n}` : monsterUnlockHint(data, m)}</span>
              </div>`;
            })
            .join('') || '<p class="muted catalog-empty">無</p>'}</div>
        </section>`;
    } else {
      paneHtml = `
        <section class="catalog-pane" data-catalog-pane="scenes" aria-label="場景">
          <h2 class="catalog-pane-title">${catMeta.label}</h2>
          <p class="muted">場景通關總計 ${Object.values(state.sceneClears || {}).reduce((a, b) => a + b, 0)}</p>
          <div class="scene-progress-list">
            ${data.scenes.scenes
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => {
                const unlocked = isSceneUnlocked(data, state, s.id);
                const clears = state.sceneClears?.[s.id] || 0;
                return `<div class="scene-progress-row ${unlocked ? 'open' : 'locked'}">
                  <div><strong>${sceneIconHtml(s, 24)} ${s.name}</strong><p>${s.flavor}</p>
                  <p class="muted">${unlocked ? `已解鎖 · 通關 ${clears}` : `未解鎖 · ${sceneUnlockHint(data, s)}`}</p></div>
                </div>`;
              })
              .join('')}
          </div>
        </section>`;
    }

    return `
      <section class="collection page-with-cta catalog-subpages" data-catalog-current="${cat}">
        <div class="page-scroll">
          <div class="catalog-sticky ${cat === 'avatar' ? 'has-avatar-freeze' : ''}" role="navigation" aria-label="圖鑑分類">
            <nav class="catalog-jump catalog-jump-7" role="tablist">
              ${CATALOG_CATS.map(
                (c) =>
                  `<button type="button" role="tab" aria-selected="${cat === c.id}" class="catalog-jump-btn ${cat === c.id ? 'active' : ''}" data-catalog-cat="${c.id}" aria-label="${c.label}"><span class="jump-label">${c.label}</span></button>`,
              ).join('')}
            </nav>
            ${
              showOwnedFilter
                ? `<div class="catalog-filter-row">
              <button type="button" class="chip owned-filter ${ownedOnly ? 'active' : ''}" data-catalog-owned-only aria-pressed="${ownedOnly}">僅擁有</button>
              <span class="muted catalog-filter-hint">只看已解鎖／已擊敗</span>
            </div>`
                : ''
            }
            ${cat === 'avatar' ? avatarPreviewCard : ''}
          </div>
          ${paneHtml}
        </div>
        <div class="page-cta">
          ${noticeHtml('collection')}
          ${state.adminMode ? `<button type="button" class="btn wide" data-action="admin-skins">解鎖全部外觀／場景進度</button>` : ''}
          <button type="button" class="btn ghost wide" data-action="reset">重置存檔（原型用）</button>
        </div>
      </section>`;
  }

  function render({ skipCapture = false } = {}) {
    if (!skipCapture) captureScroll(tab);
    ensureSceneSelection(data, state);
    armAttackSfx();
    root.innerHTML = `
      <div class="shell ${state.adminMode ? 'admin-on' : ''}">
        <header class="topbar">
          <div class="brand-row">
            <div class="brand" data-brand-hold title="長按標題可切換管理員測試">
              <div class="brand-mark" aria-hidden="true">${appIconSvg(36)}</div>
              <div>
                <h1>${data.meta.title}</h1>
                <p>${data.meta.subtitle}</p>
              </div>
            </div>
            <div class="topbar-actions">
              <button
                type="button"
                class="sfx-toggle ${isSfxMuted() ? 'is-muted' : ''}"
                data-action="sfx-toggle"
                aria-pressed="${isSfxMuted()}"
                title="${isSfxMuted() ? '開啟戰鬥音效' : '關閉戰鬥音效'}"
              >${isSfxMuted() ? '音效關' : '音效開'}</button>
              ${
                state.adminMode
                  ? `<button type="button" class="admin-badge" data-action="admin-off" title="點擊關閉管理員">管理員測試中 · 點此關閉</button>`
                  : ''
              }
            </div>
          </div>
          <div class="hud-strip" aria-label="資源與戰力">
            <div class="hud-wallet" role="group" aria-label="資源">
              <span class="res-chip gold"><i class="res-ico" aria-hidden="true"></i><span class="res-k">金</span><b class="res-v">${displayResource(state, state.gold)}</b></span>
              <span class="res-chip mat"><i class="res-ico" aria-hidden="true"></i><span class="res-k">材</span><b class="res-v">${displayResource(state, state.material)}</b></span>
            </div>
            <div class="hud-power" role="group" aria-label="戰力" title="戰力">
              <span class="pow-meter atk"><span class="pow-k">攻</span><b class="pow-v">${totalPlayerAtk(data, state)}</b></span>
              <span class="pow-meter def"><span class="pow-k">防</span><b class="pow-v">${totalPlayerDef(data, state)}</b></span>
            </div>
          </div>
        </header>
        <main class="panel" data-tab="${tab}">
          ${tab === 'battle' ? renderBattle() : ''}
          ${tab === 'enhance' ? renderEnhance() : ''}
          ${tab === 'shop' ? renderShop() : ''}
          ${tab === 'collection' ? renderCollection() : ''}
        </main>
        <footer class="tabbar" role="tablist">
          ${TABS.map(
            (t) =>
              `<button type="button" class="tab ${tab === t.id ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${tab === t.id}" aria-label="${t.label}"><span class="tab-ico">${tabIconSvg(t.id, 22)}</span><span class="tab-label">${t.label}</span></button>`,
          ).join('')}
        </footer>
        ${
          !state.firstRunGuideSeen
            ? `<div class="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
                <div class="onboard-card">
                  <h2 id="onboard-title">歡迎踏上英雄路</h2>
                  <p class="onboard-lead">四步上手——站樁扛事的廢材老爸教學。</p>
                  <ol class="onboard-steps">
                    <li><strong>戰鬥</strong>：選場景與對手，點「打怪」掛機連攻；雙方各自冷卻。</li>
                    <li><strong>強化</strong>：衝裝是主軸，無安定區；失敗可能降階／炸裝，輔助道具可護體。</li>
                    <li><strong>穿戴</strong>：新手裝備只在背包；到強化或圖鑑「穿戴」，也可「卸下」留空槽。</li>
                    <li><strong>場景</strong>：戰鬥頁上方選家庭場景；解鎖後往下一站人生推進。</li>
                  </ol>
                  <button type="button" class="btn primary wide" data-action="onboard-dismiss">知道了，開始</button>
                </div>
              </div>`
            : ''
        }
      </div>`;
    bind();
    restoreScroll(tab);
    watchScrollers();
    // Float VFX lives outside wiped HTML — sync after every paint, never remount existing nodes.
    if (tab === 'battle' && battle) syncHitFloatDom(root, battle);
    else clearHitFloatDom();
  }

  function bind() {
    root.querySelector('[data-action="sfx-toggle"]')?.addEventListener('click', () => {
      // Gesture unlock even when turning sound on/off.
      unlockSfx();
      toggleSfxMuted();
      render({ skipCapture: true });
    });
    root.querySelector('[data-action="onboard-dismiss"]')?.addEventListener('click', () => {
      unlockSfx();
      state.firstRunGuideSeen = true;
      persist();
      render();
    });

    // Admin: no always-visible checkbox (mis-tap risk). Long-press title to toggle; badge closes it.
    root.querySelector('[data-action="admin-off"]')?.addEventListener('click', () => applyAdmin(false));

    const brand = root.querySelector('[data-brand-hold]');
    if (brand) {
      let holdTimer = 0;
      const startHold = () => {
        holdTimer = window.setTimeout(() => applyAdmin(!state.adminMode, { confirmed: state.adminMode }), 900);
      };
      const clearHold = () => window.clearTimeout(holdTimer);
      brand.addEventListener('pointerdown', startHold);
      brand.addEventListener('pointerup', clearHold);
      brand.addEventListener('pointerleave', clearHold);
      brand.addEventListener('pointercancel', clearHold);
    }

    root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab')));
    });

    root.querySelectorAll('[data-difficulty]').forEach((btn) => {
      btn.addEventListener('click', () => chooseDifficulty(btn.getAttribute('data-difficulty')));
    });

    root.querySelector('[data-action="scene-picker"]')?.addEventListener('click', () => {
      stopAutoFight();
      scenePickerOpen = !scenePickerOpen;
      tierPickerOpen = false;
      render();
    });
    root.querySelectorAll('[data-action="scene-picker-close"]').forEach((b) =>
      b.addEventListener('click', () => {
        scenePickerOpen = false;
        render();
      }),
    );
    root.querySelectorAll('[data-scene-id]').forEach((b) =>
      b.addEventListener('click', () => chooseScene(b.getAttribute('data-scene-id'))),
    );

    root.querySelector('[data-action="gacha-draw"]')?.addEventListener('click', () => doGachaDraw());
    root.querySelector('[data-action="gacha-clear"]')?.addEventListener('click', () => doGachaClear());
    root.querySelector('[data-action="gacha-reveal-close"]')?.addEventListener('click', () => {
      ensureGachaState(state);
      state.gacha.revealOpen = false;
      persist();
      render();
    });

    root.querySelector('[data-action="tier-picker"]')?.addEventListener('click', () => {
      stopAutoFight();
      tierPickerOpen = !tierPickerOpen;
      scenePickerOpen = false;
      render();
    });
    root.querySelectorAll('[data-action="tier-picker-close"]').forEach((b) =>
      b.addEventListener('click', () => {
        tierPickerOpen = false;
        render();
      }),
    );
    root.querySelectorAll('[data-monster-id]').forEach((b) =>
      b.addEventListener('click', () => chooseMonster(b.getAttribute('data-monster-id'))),
    );

    root.querySelector('[data-action="autofight"]')?.addEventListener('pointerdown', () => unlockSfx());
    root.querySelector('[data-action="autofight"]')?.addEventListener('click', () => {
      unlockSfx();
      toggleAutoFight();
    });
    root.querySelector('[data-action="rematch"]')?.addEventListener('click', () => {
      unlockSfx();
      stopAutoFight();
      if (battle?.over && battle.victory) noteVictoryProgression();
      ensureSceneSelection(data, state);
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
      persist();
      render();
    });
    root.querySelectorAll('[data-action="run-retreat"]').forEach((btn) =>
      btn.addEventListener('click', () => {
        stopAutoFight();
        const res = retreatToPreviousScene(data, state);
        if (!res.ok) {
          showPageNotice(res.message, 'warn', 'battle');
          render();
          return;
        }
        battle = createBattle(data, state, currentMonster());
        victoryFx = false;
        lastRunProgress = { kind: 'retreat', message: res.message };
        pushLog(state, res.message, 'info');
        showPageNotice(res.message, 'info', 'battle');
        persist();
        render();
      }),
    );
    root.querySelector('[data-action="run-advance"]')?.addEventListener('click', () => {
      stopAutoFight();
      const res = advanceToNextScene(data, state);
      if (!res.ok) {
        showPageNotice(res.message, 'warn', 'battle');
        render();
        return;
      }
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
      lastRunProgress = { kind: 'next_scene', message: res.message };
      pushLog(state, res.message, 'good');
      persist();
      render();
    });
    root.querySelector('[data-action="farm-challenge"]')?.addEventListener('click', () => {
      stopAutoFight();
      const focusId = state.farm?.focusId;
      const res = enterChallenge(data, state, focusId);
      if (!res.ok) {
        showPageNotice(res.message, 'warn', 'battle');
        render();
        return;
      }
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
      lastRunProgress = { kind: 'enter_challenge', message: res.message };
      pushLog(state, res.message, 'info');
      persist();
      render();
    });
    root.querySelector('[data-action="farm-return"]')?.addEventListener('click', () => {
      stopAutoFight();
      const res = returnToFarm(data, state);
      battle = createBattle(data, state, currentMonster());
      victoryFx = false;
      lastRunProgress = { kind: 'return_farm', message: res.message };
      pushLog(state, res.message, 'info');
      persist();
      render();
    });

    root.querySelector('[data-action="enhance"]')?.addEventListener('click', () => {
      const res = tryEnhance(data, state, state.enhanceFocusId);
      if (!res.ok) {
        const reason = res.reason || '無法強化';
        pushLog(state, reason, 'bad');
        enhanceFlash = 'flash-bad';
        showPageNotice(reason, 'bad', 'enhance');
      } else if (res.success) {
        pushLog(state, `強化成功！→ +${res.level}`, 'good');
        enhanceFlash = 'flash-good';
        showPageNotice(`強化成功！→ +${res.level}`, 'good', 'enhance');
        battle = null;
      } else {
        const msg = `強化失敗（${res.outcome}）→ +${res.level}`;
        pushLog(state, msg, 'warn');
        enhanceFlash = 'flash-bad';
        showPageNotice(msg, 'warn', 'enhance');
        battle = null;
      }
      persist();
      render();
      setTimeout(() => {
        enhanceFlash = null;
      }, 500);
    });

    const wearGearById = (gearId, { announce = true } = {}) => {
      const skin = getGearSkin(data, gearId);
      if (!skin || !(skin.slot === 'weapon' || ARMOR_SLOTS.includes(skin.slot))) {
        return { ok: false, reason: '無法穿戴' };
      }
      if (!equipSkin(state, skin)) return { ok: false, reason: '尚未擁有' };
      state.enhanceFocusId = skin.id;
      stopAutoFight();
      battle = null;
      if (announce) pushLog(state, `穿戴「${skin.name}」`, 'info');
      return { ok: true, skin };
    };

    const unequipGearById = (gearId, { announce = true } = {}) => {
      const skin = getGearSkin(data, gearId);
      if (!skin || !(skin.slot === 'weapon' || ARMOR_SLOTS.includes(skin.slot))) {
        return { ok: false, reason: '無法卸下' };
      }
      if (state.equipped?.[skin.slot] !== skin.id) {
        return { ok: false, reason: '此裝未穿戴' };
      }
      const res = unequipGear(state, skin.slot);
      if (!res.ok) return res;
      stopAutoFight();
      battle = null;
      if (announce) pushLog(state, `卸下「${skin.name}」`, 'info');
      return { ok: true, skin };
    };

    root.querySelectorAll('[data-select-gear]').forEach((btn) => {
      const wearFromRow = (id) => {
        const res = wearGearById(id);
        if (!res.ok) showPageNotice(res.reason || '無法穿戴', 'bad', 'enhance');
        else showPageNotice(`已穿戴「${res.skin.name}」`, 'good', 'enhance');
        persist();
        render();
      };
      const unequipFromRow = (id) => {
        const res = unequipGearById(id);
        if (!res.ok) showPageNotice(res.reason || '無法卸下', 'bad', 'enhance');
        else showPageNotice(`已卸下「${res.skin.name}」`, 'good', 'enhance');
        persist();
        render();
      };
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-select-gear');
        // Re-tap focused row = wear / unequip toggle.
        if (id && id === state.enhanceFocusId) {
          const skin = getGearSkin(data, id);
          if (skin && state.equipped?.[skin.slot] === skin.id) unequipFromRow(id);
          else wearFromRow(id);
          return;
        }
        state.enhanceFocusId = id;
        render();
      });
      btn.addEventListener('dblclick', (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute('data-select-gear');
        const skin = getGearSkin(data, id);
        if (skin && state.equipped?.[skin.slot] === skin.id) unequipFromRow(id);
        else wearFromRow(id);
      });
    });
    root.querySelector('[data-action="wear-focus"]')?.addEventListener('click', () => {
      const res = wearGearById(state.enhanceFocusId);
      if (!res.ok) showPageNotice(res.reason || '無法穿戴', 'bad', 'enhance');
      else showPageNotice(`已穿戴「${res.skin.name}」`, 'good', 'enhance');
      persist();
      render();
    });
    root.querySelector('[data-action="unequip-focus"]')?.addEventListener('click', () => {
      const res = unequipGearById(state.enhanceFocusId);
      if (!res.ok) showPageNotice(res.reason || '無法卸下', 'bad', 'enhance');
      else showPageNotice(`已卸下「${res.skin.name}」`, 'good', 'enhance');
      persist();
      render();
    });
    root.querySelector('[data-action="toggle-hide-focus"]')?.addEventListener('click', () => {
      const focus = getGearSkin(data, state.enhanceFocusId);
      if (!focus || !ARMOR_SLOTS.includes(focus.slot)) return;
      const hidden = toggleGearVisualHidden(state, focus.slot);
      pushLog(state, hidden ? `隱藏「${slotLabel(focus.slot)}」疊圖` : `顯示「${slotLabel(focus.slot)}」疊圖`, 'info');
      showPageNotice(hidden ? `${slotLabel(focus.slot)}疊圖已隱藏（數值仍在）` : `${slotLabel(focus.slot)}疊圖已顯示`, 'good', 'enhance');
      stopAutoFight();
      battle = null;
      persist();
      render();
    });
    root.querySelectorAll('[data-toggle-hide-slot]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const slot = btn.getAttribute('data-toggle-hide-slot');
        if (!slot || !ARMOR_SLOTS.includes(slot)) return;
        const hidden = toggleGearVisualHidden(state, slot);
        pushLog(state, hidden ? `隱藏「${slotLabel(slot)}」疊圖` : `顯示「${slotLabel(slot)}」疊圖`, 'info');
        stopAutoFight();
        battle = null;
        persist();
        render();
      });
    });
    const gearFilter = root.querySelector('#gear-filter');
    if (gearFilter) {
      gearFilter.addEventListener('input', () => {
        state.gearFilter = gearFilter.value;
        const pos = gearFilter.selectionStart;
        render();
        const again = root.querySelector('#gear-filter');
        if (again) {
          again.focus();
          again.setSelectionRange(pos, pos);
        }
      });
    }
    root.querySelectorAll('[data-cycle-boost]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cycleBoost(data, state, btn.getAttribute('data-cycle-boost'));
        persist();
        render();
      });
    });

    root.querySelectorAll('[data-iap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = grantIapPack(data, state, btn.getAttribute('data-iap'), { force: true });
        if (!res.ok) {
          showPageNotice(res.reason || '無法試領', 'bad', 'shop');
        } else {
          showPageNotice(`已試領「${res.pack.name}」`, 'good', 'shop');
          pushLog(state, `支援方案試領：${res.pack.name}`, 'info');
        }
        persist();
        render();
      });
    });

    root.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = buyItem(data, state, btn.getAttribute('data-buy'));
        if (!res?.ok) showPageNotice(res?.reason || '無法購買', 'bad', 'shop');
        else showPageNotice(res.message || '購入成功', 'good', 'shop');
        persist();
        render();
      });
    });
    root.querySelectorAll('[data-buy-skin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = buySkin(data, state, btn.getAttribute('data-buy-skin'));
        if (!res?.ok) showPageNotice(res?.reason || '無法購買', 'bad', 'shop');
        else showPageNotice(res.message || '取得外觀', 'good', 'shop');
        persist();
        render();
      });
    });
    root.querySelectorAll('[data-weapon-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.catalogWeaponType = btn.getAttribute('data-weapon-type') || '全部';
        render();
      });
    });
    root.querySelectorAll('[data-gear-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.catalogGearSlot = btn.getAttribute('data-gear-slot') || '全部';
        render();
      });
    });
    root.querySelectorAll('[data-catalog-owned-only]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.catalogOwnedOnly = !state.catalogOwnedOnly;
        render();
      });
    });

    const nameInput = root.querySelector('#player-name-input');
    if (nameInput) {
      // Always mirror sanitized save back into the field (fixes empty/emoji desync).
      const commitName = () => {
        const next = sanitizePlayerName(data, nameInput.value);
        nameInput.value = next;
        if (next === state.playerName) return;
        state.playerName = next;
        persist();
        render();
      };
      nameInput.addEventListener('change', commitName);
      nameInput.addEventListener('blur', commitName);
      nameInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          nameInput.blur();
        }
      });
    }

    root.querySelectorAll('[data-avatar-part]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const part = btn.getAttribute('data-avatar-part');
        const option = btn.getAttribute('data-avatar-option');
        if (setAvatarPart(data, state, part, option)) {
          persist();
          render();
        }
      });
    });
    root.querySelectorAll('button[data-catalog-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-catalog-cat');
        if (!id || id === state.catalogJump) return;
        // Save current pane scroll under the OLD category key, then open next from top.
        captureScroll('collection');
        state.catalogJump = id;
        scrollMemory[collectionScrollKey()] = 0;
        scrollMemory['main:collection'] = 0;
        persist();
        // skipCapture: otherwise render() would re-read the old DOM scroll into the new key.
        render({ skipCapture: true });
        const scroller = root.querySelector('.collection .page-scroll');
        if (scroller) scroller.scrollTop = 0;
      });
    });
    root.querySelectorAll('[data-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skin = data.skins.catalog.find((s) => s.id === btn.getAttribute('data-equip'));
        if (!skin) return;
        const isGear = skin.slot === 'weapon' || ARMOR_SLOTS.includes(skin.slot);
        const isTemperFx = skin.slot === 'victoryFx';
        // Gear / 發脾氣特效: tap equipped again to fully unequip (empty slot).
        if ((isGear || isTemperFx) && state.equipped?.[skin.slot] === skin.id) {
          let ok = false;
          if (isGear) {
            const res = unequipGear(state, skin.slot);
            ok = !!res.ok;
            if (!ok) {
              showPageNotice(res.reason || '無法卸下', 'bad', 'collection');
              return;
            }
          } else {
            ok = unequipSkin(state, skin.slot);
            if (!ok) {
              showPageNotice('無法卸下', 'bad', 'collection');
              return;
            }
          }
          pushLog(state, `卸下「${skin.name}」`, 'info');
          stopAutoFight();
          battle = null;
          persist();
          render();
          return;
        }
        if (equipSkin(state, skin)) {
          if (isGear) {
            state.enhanceFocusId = skin.id;
            stopAutoFight();
            battle = null;
          } else if (skin.slot === 'frame' || isTemperFx) {
            stopAutoFight();
            battle = null;
          }
          pushLog(state, `裝備「${skin.name}」`, 'info');
          persist();
          render();
        }
      });
    });
    root.querySelectorAll('[data-unequip-slot]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const slot = btn.getAttribute('data-unequip-slot');
        const skin = getEquippedSkin(data, state, slot);
        let ok = false;
        if (slot === 'victoryFx') {
          ok = unequipSkin(state, slot);
        } else {
          const res = unequipGear(state, slot);
          ok = !!res.ok;
          if (!ok) {
            showPageNotice(res.reason || '無法卸下', 'bad', 'collection');
            return;
          }
        }
        if (!ok) {
          showPageNotice('無法卸下', 'bad', 'collection');
          return;
        }
        pushLog(
          state,
          skin ? `卸下「${skin.name}」` : slot === 'victoryFx' ? '卸下發脾氣特效' : `卸下${slotLabel(slot)}`,
          'info',
        );
        stopAutoFight();
        battle = null;
        persist();
        render();
      });
    });

    root.querySelector('[data-action="admin-max"]')?.addEventListener('click', () => {
      maxGear(data, state);
      battle = null;
      persist();
      render();
    });
    root.querySelector('[data-action="admin-boosts"]')?.addEventListener('click', () => {
      topUpAdminBoosts(state);
      persist();
      render();
    });
    root.querySelector('[data-action="admin-skins"]')?.addEventListener('click', () => {
      unlockAllSkins(data, state);
      unlockAllForAdmin(data, state);
      persist();
      render();
    });
    root.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      if (!confirm('確定重置本地存檔？')) return;
      const admin = state.adminMode;
      const fresh = resetState(data);
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, fresh);
      state.adminMode = admin;
      battle = null;
      persist();
      setTab('battle');
    });

    // Scene / foe picker: trap overscroll so gestures don't scroll the battle page behind.
    root.querySelectorAll('.tier-picker').forEach((picker) => {
      const list = picker.querySelector('.tier-picker-list');
      const panel = picker.querySelector('.tier-picker-panel');
      const stopChain = (ev) => {
        // Only block when the gesture would bubble into .battle-scroll.
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
      };
      picker.addEventListener(
        'wheel',
        (ev) => {
          if (!list) {
            stopChain(ev);
            return;
          }
          const atTop = list.scrollTop <= 0;
          const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
          const goingUp = ev.deltaY < 0;
          const goingDown = ev.deltaY > 0;
          if ((atTop && goingUp) || (atBottom && goingDown) || !list.contains(ev.target)) {
            stopChain(ev);
          } else {
            ev.stopPropagation();
          }
        },
        { passive: false },
      );
      let touchY = 0;
      picker.addEventListener(
        'touchstart',
        (ev) => {
          touchY = ev.touches[0]?.clientY || 0;
        },
        { passive: true },
      );
      picker.addEventListener(
        'touchmove',
        (ev) => {
          const y = ev.touches[0]?.clientY || 0;
          const dy = y - touchY;
          const onList = list && (list === ev.target || list.contains(ev.target));
          if (!onList) {
            stopChain(ev);
            return;
          }
          const atTop = list.scrollTop <= 0;
          const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
          if ((atTop && dy > 0) || (atBottom && dy < 0)) stopChain(ev);
          else ev.stopPropagation();
        },
        { passive: false },
      );
      panel?.addEventListener('click', (ev) => ev.stopPropagation());
    });
  }

  let lastBattlePaint = 0;
  let hitPaintLockUntil = 0;
  function loop(now = performance.now()) {
    if (tab === 'battle' && battle) {
      // Monsters only swing while 掛機打怪 is on — same gate as player strikes.
      const tick = tickBattle(data, state, battle, currentMonster(), Date.now(), {
        allowMonsterSwing: autoFighting,
      });
      if (tick.monsterHit) {
        const flashMs = Number(data.combat?.monsterAttack?.hitFlashMs) || 420;
        hitPaintLockUntil = now + flashMs - 40;
        lastBattlePaint = now;
        if (battle.over) {
          if (autoFighting) handleAutoFightOutcome({ victory: !!battle.victory });
          else {
            persist();
            render();
          }
        } else {
          persist();
          render({ skipCapture: true });
        }
      } else if (tick.dirty && now > hitPaintLockUntil && now - lastBattlePaint > 180) {
        lastBattlePaint = now;
        render({ skipCapture: true });
      } else {
        // Reposition persistent floats without remounting (scroll / layout).
        syncHitFloatDom(root, battle);
      }
    }
    raf = requestAnimationFrame(loop);
  }

  ensureBattle();
  render();
  raf = requestAnimationFrame(loop);

  const api = {
    destroy() {
      stopAutoFight();
      cancelAnimationFrame(raf);
      clearHitFloatDom();
      uninstallSfxUnlock();
    },
    getState: () => state,
    getBattle: () => battle,
    attackOnce: () => {
      ensureBattle();
      armAttackSfx();
      const res = playerAttack(data, state, battle, currentMonster());
      syncHitFloatDom(root, battle);
      return res;
    },
  };
  if (typeof window !== 'undefined') window.__FEICAI__ = api;
  return api;
}
