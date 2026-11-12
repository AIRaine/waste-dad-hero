/**
 * ~100 persona logic playthroughs for waste-dad-hero.
 * Covers farm/T-boss, retreat, select monster, gacha, equip, defeat CTAs.
 * Writes JSON summary next to this script when run.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createInitialState } from '../src/game/state.js';
import {
  ensureFarmState,
  enterChallenge,
  returnToFarm,
  currentFarmOrChallengeMonster,
  farmMeterView,
  killsNeeded,
  meterCount,
  isChallengeUnlocked,
  makeFarmMinion,
  syncFarmFocus,
  applyFarmVictory,
} from '../src/game/farm.js';
import {
  applyVictoryProgression,
  retreatToPreviousScene,
  advanceToNextScene,
  canRetreat,
  ensureRunState,
} from '../src/game/run.js';
import {
  ensureSceneSelection,
  monstersInScene,
  isMonsterFightable,
  isSceneUnlocked,
} from '../src/game/scenes.js';
import { buyItem } from '../src/game/shop.js';
import {
  tryEnhance,
  ensureGearState,
  unequipGear,
  toggleGearVisualHidden,
} from '../src/game/gear.js';
import { equipSkin } from '../src/game/skins.js';
import {
  ensureGachaState,
  isGachaUnlocked,
  drawGacha,
  confirmEquipGacha,
  discardPendingGacha,
  clearGacha,
} from '../src/game/gacha.js';
import { grantIapPack, ensureIapState, listIapPacks } from '../src/game/iap.js';
import { unlockAllForAdmin } from '../src/game/admin.js';

function loadData() {
  const files = [
    'meta', 'enhance', 'monsters', 'skins', 'items', 'scenes', 'difficulty',
    'companions', 'avatar', 'combat', 'gear', 'gacha', 'iap', 'sfx', 'farm',
  ];
  const data = {};
  for (const f of files) {
    data[f] = JSON.parse(readFileSync(new URL(`../public/data/${f}.json`, import.meta.url), 'utf8'));
  }
  return data;
}

const AGES = [8, 12, 15, 18, 22, 26, 28, 32, 35, 38, 42, 45, 48, 52, 55, 60, 65];
const STYLES = ['farm', 'enhance', 'clear', 'collect', 'gacha', 'equip', 'retreat', 'defeat', 'mixed'];
const PAY = ['free', 'pay'];

function buildPersonas() {
  const list = [];
  let n = 0;
  for (const age of AGES) {
    for (const style of STYLES) {
      for (const pay of PAY) {
        if (list.length >= 100) break;
        n += 1;
        list.push({
          id: n,
          name: `P${String(n).padStart(3, '0')}-${age}-${style}-${pay}`,
          age,
          style,
          pay,
          goals: style === 'mixed' ? ['farm', 'enhance', 'gacha', 'equip', 'defeat', 'retreat'] : [style],
        });
      }
      if (list.length >= 100) break;
    }
    if (list.length >= 100) break;
  }
  while (list.length < 100) {
    const i = list.length + 1;
    list.push({
      id: i,
      name: `P${String(i).padStart(3, '0')}-pad-farm-free`,
      age: 30,
      style: 'farm',
      pay: 'free',
      goals: ['farm'],
    });
  }
  return list.slice(0, 100);
}

function assert(cond, msg, findings, persona, sev = 'P2') {
  if (!cond) {
    findings.push({ sev, persona: persona.name, msg, age: persona.age, style: persona.style, pay: persona.pay });
    return false;
  }
  return true;
}

/** Mirror of battle UI showReturnFarm after playtest fix. */
function showReturnFarmUi(meter, battle) {
  return !!meter && meter.mode === 'challenge';
}

function fresh(data) {
  const state = createInitialState(data);
  ensureFarmState(state);
  ensureGearState(data, state);
  ensureGachaState(state);
  ensureIapState(state);
  ensureRunState(state);
  ensureSceneSelection(data, state);
  return state;
}

function runPersona(data, persona, findings) {
  const state = fresh(data);
  const notes = [];
  const goals = new Set(persona.goals);

  if (persona.pay === 'pay') {
    for (const p of listIapPacks(data).slice(0, 3)) {
      grantIapPack(data, state, p.id, { force: true });
    }
    notes.push('iap:granted');
  }

  if (goals.has('enhance') || goals.has('collect') || goals.has('equip')) {
    state.gold = Math.max(state.gold, 500);
    state.material = Math.max(state.material, 80);
  }

  if (goals.has('farm') || goals.has('clear') || goals.has('defeat') || goals.has('retreat') || goals.has('mixed')) {
    const chain = monstersInScene(data, state.selectedSceneId);
    const need = killsNeeded(data);
    const t1 = chain[0];
    syncFarmFocus(data, state);
    let foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.isFarmMinion && foe.farmOf === t1.id, '開局農區 T1', findings, persona, 'P1');

    // Picker eligibility: fightable but meter empty → not challenge-open
    assert(isMonsterFightable(data, state, t1), 'T1 鏈上可打', findings, persona, 'P2');
    assert(!isChallengeUnlocked(data, state, t1.id), '開局 T1 農條未滿不可挑戰', findings, persona, 'P0');
    const pickerOpen = isMonsterFightable(data, state, t1) && isChallengeUnlocked(data, state, t1.id);
    assert(!pickerOpen, '對手選單開局不應開鎖 T1', findings, persona, 'P0');

    // Fill & challenge
    state.farm.meters[t1.id] = need;
    state.farm.unlocked[t1.id] = true;
    state.farm.focusId = t1.id;
    state.farm.mode = 'farm';
    state.selectedMonsterId = `farm__${t1.id}`;
    const meter = farmMeterView(data, state);
    assert(meter?.canChallenge, '滿條可挑戰', findings, persona, 'P1');
    const ch = enterChallenge(data, state, t1.id);
    assert(ch.ok, `挑戰 T1: ${ch.message}`, findings, persona, 'P0');
    foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.id === t1.id && !foe?.isFarmMinion, '挑戰打正式 T1', findings, persona, 'P0');

    // Sticky higher tier
    for (let i = 0; i < 3; i++) {
      state.defeated[chain[i].id] = 1;
      state.farm.unlocked[chain[i].id] = true;
      state.farm.meters[chain[i].id] = need;
    }
    const pick = chain[2];
    assert(enterChallenge(data, state, pick.id).ok, '選 T3', findings, persona, 'P0');
    foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.id === pick.id, `sticky T3 得 ${foe?.id}`, findings, persona, 'P0');
    returnToFarm(data, state);
    foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.isFarmMinion && foe.farmOf === chain[1].id, `回刷前階 ${foe?.farmOf}`, findings, persona, 'P0');
    notes.push('farm/challenge/sticky/return');
  }

  if (goals.has('defeat') || goals.has('mixed')) {
    const chain = monstersInScene(data, state.selectedSceneId);
    const need = killsNeeded(data);
    for (let i = 0; i < 4; i++) {
      state.defeated[chain[i].id] = 1;
      state.farm.unlocked[chain[i].id] = true;
      state.farm.meters[chain[i].id] = need;
    }
    state.farm.unlocked[chain[4].id] = true;
    state.farm.meters[chain[4].id] = need;
    enterChallenge(data, state, chain[4].id);
    let meter = farmMeterView(data, state);
    const battleLose = { over: true, victory: false };
    assert(showReturnFarmUi(meter, battleLose), '挑戰敗北應有回刷 CTA', findings, persona, 'P1');
    returnToFarm(data, state);
    meter = farmMeterView(data, state);
    assert(!showReturnFarmUi(meter, battleLose), '回農後敗北 CTA 應消失', findings, persona, 'P1');
    // Farm defeat must NOT promote 回刷
    state.farm.mode = 'farm';
    meter = farmMeterView(data, state);
    assert(!showReturnFarmUi(meter, battleLose), '農區敗北不應顯示回刷小怪', findings, persona, 'P0');
    const foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.isFarmMinion, '敗北回刷為農怪', findings, persona, 'P1');
    notes.push('defeat-cta');
  }

  if (goals.has('enhance') || goals.has('mixed')) {
    const weaponId = state.equipped?.weapon;
    if (weaponId) {
      state.gold = 9999;
      state.material = 999;
      const r = tryEnhance(data, state, weaponId);
      assert(r.ok || r.reason, `強化結果 ${JSON.stringify(r)}`, findings, persona, 'P1');
      state.gold = 0;
      state.material = 0;
      const broke = tryEnhance(data, state, weaponId);
      assert(!broke.ok && broke.reason, '無資源強化失敗', findings, persona, 'P1');
      notes.push('enhance');
    }
  }

  if (goals.has('collect') || goals.has('equip') || goals.has('mixed')) {
    state.gold = Math.max(state.gold, 2000);
    const item = data.items?.catalog?.[0];
    if (item) buyItem(data, state, item.id);
    assert(state.equipped.victoryFx == null, '發脾氣特效預設空槽', findings, persona, 'P1');
    const armor = data.skins.catalog.find((s) => s.slot === 'armor' && state.ownedSkins.includes(s.id));
    if (armor) {
      equipSkin(state, armor);
      toggleGearVisualHidden(state, 'armor');
      assert(state.hiddenGearVisual?.armor === true, '不顯示外觀', findings, persona, 'P2');
      unequipGear(state, 'armor');
      assert(!state.equipped.armor, '卸裝', findings, persona, 'P1');
      notes.push('equip');
    }
  }

  if (goals.has('gacha') || goals.has('mixed')) {
    state.sceneClears[state.selectedSceneId] = 99;
    state.gold = Math.max(state.gold, 5000);
    if (isGachaUnlocked(data, state)) {
      const d1 = drawGacha(data, state, state.selectedSceneId);
      assert(d1.ok, `扭蛋 ${d1.reason}`, findings, persona, 'P1');
      if (state.gacha?.pending) {
        const blocked = drawGacha(data, state, state.selectedSceneId);
        assert(!blocked.ok, 'pending 不可再抽', findings, persona, 'P1');
        assert(confirmEquipGacha(data, state).ok !== false, '上場', findings, persona, 'P1');
        clearGacha(state);
        notes.push('gacha');
      }
    }
  }

  if (goals.has('retreat') || goals.has('clear') || goals.has('mixed')) {
    unlockAllForAdmin(data, state);
    state.adminMode = false;
    const scenes = data.scenes.scenes.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const cur = scenes.find((s) => s.id === state.selectedSceneId) || scenes[0];
    state.selectedSceneId = cur.id;
    const next = scenes.find((s) => (s.order || 0) > (cur.order || 0));
    if (next && isSceneUnlocked(data, state, next.id)) {
      assert(advanceToNextScene(data, state).ok, '前往下一景', findings, persona, 'P1');
      assert(canRetreat(data, state), '可撤回', findings, persona, 'P1');
      assert(retreatToPreviousScene(data, state).ok, '撤回', findings, persona, 'P0');
      assert(state.selectedSceneId === cur.id, '撤回回原景', findings, persona, 'P0');
      const foe = currentFarmOrChallengeMonster(data, state);
      assert(foe?.isFarmMinion, '撤回後農區', findings, persona, 'P1');
      notes.push('retreat');
    }
  }

  if (goals.has('clear')) {
    unlockAllForAdmin(data, state);
    state.adminMode = false;
    const chain = monstersInScene(data, state.selectedSceneId);
    const need = killsNeeded(data);
    for (let i = 0; i < Math.min(3, chain.length); i++) {
      const c = chain[i];
      state.farm.meters[c.id] = need;
      state.farm.unlocked[c.id] = true;
      if (i > 0) state.defeated[chain[i - 1].id] = 1;
      enterChallenge(data, state, c.id);
      const mon = currentFarmOrChallengeMonster(data, state);
      state.defeated[mon.id] = (state.defeated[mon.id] || 0) + 1;
      applyVictoryProgression(data, state, mon);
    }
    notes.push('clear');
  }

  // Meter label semantics (shared UX check)
  {
    const chain = monstersInScene(data, state.selectedSceneId);
    const need = killsNeeded(data);
    state.farm.meters[chain[0].id] = need;
    state.farm.unlocked[chain[0].id] = true;
    state.defeated[chain[0].id] = 0;
    state.farm.focusId = chain[0].id;
    state.farm.mode = 'farm';
    let m = farmMeterView(data, state);
    const labelReady = m.canChallenge ? '可挑戰' : m.cleared ? '已通關' : `${m.have}/${m.need}`;
    assert(labelReady === '可挑戰', `滿條標籤 ${labelReady}`, findings, persona, 'P1');
    state.defeated[chain[0].id] = 1;
    // After clear, focus may auto-advance — force focus on cleared for label check
    state.farm.focusId = chain[0].id;
    state.selectedMonsterId = `farm__${chain[0].id}`;
    m = farmMeterView(data, state);
    const labelCleared = m.canChallenge ? '可挑戰' : m.cleared ? '已通關' : `${m.have}/${m.need}`;
    assert(labelCleared === '已通關', `已清標籤 ${labelCleared}`, findings, persona, 'P1');
  }

  return { persona: persona.name, notes, ok: true };
}

function main() {
  const data = loadData();
  const personas = buildPersonas();
  const findings = [];
  const results = [];
  for (const p of personas) {
    try {
      results.push(runPersona(data, p, findings));
    } catch (e) {
      findings.push({
        sev: 'P0',
        persona: p.name,
        msg: `模擬拋錯: ${e.message}`,
        age: p.age,
        style: p.style,
        pay: p.pay,
      });
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const f of findings) {
    const key = `${f.sev}|${f.msg}`;
    if (seen.has(key)) {
      uniq.find((u) => u.key === key).count += 1;
      uniq.find((u) => u.key === key).personas.push(f.persona);
      continue;
    }
    seen.add(key);
    uniq.push({ key, sev: f.sev, msg: f.msg, count: 1, personas: [f.persona] });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    personaCount: personas.length,
    findingCount: findings.length,
    uniqueFindings: uniq.sort((a, b) => a.sev.localeCompare(b.sev) || b.count - a.count),
    matrix: { ages: AGES, styles: STYLES, pay: PAY },
    samplePersonas: personas.slice(0, 15),
  };

  writeFileSync(new URL('./hundred-persona-playtest-report.json', import.meta.url), JSON.stringify(report, null, 2));
  const outDir = '/cursor/stores/bc-daf63a80-dede-416d-b08d-fe7498a6ee44/docs';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/hundred-persona-playtest-raw.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ personaCount: report.personaCount, unique: uniq.length, findings: findings.length, top: uniq.slice(0, 15) }, null, 2));
}

main();
