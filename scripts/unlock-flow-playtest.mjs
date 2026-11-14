/**
 * Headless unlock-cadence playtest:
 * - meter=10 per tier
 * - challenge clear opens ONLY next farm stage (must re-farm)
 * - clearing first 1–2 tiers must NOT unlock the rest of the chain
 * - multi-scene + scene/weapon gate samples
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createInitialState } from '../src/game/state.js';
import {
  applyFarmVictory,
  currentFarmOrChallengeMonster,
  ensureFarmState,
  enterChallenge,
  isChallengeReachable,
  isChallengeUnlocked,
  killsNeeded,
  makeFarmMinion,
  meterCount,
  shouldContinueAutofight,
  syncFarmFocus,
} from '../src/game/farm.js';
import { applyVictoryProgression } from '../src/game/run.js';
import {
  ensureSceneSelection,
  isMonsterFightable,
  isSceneUnlocked,
  monstersInScene,
  sceneUnlockHint,
} from '../src/game/scenes.js';
import { ensureGearState } from '../src/game/gear.js';
import { unlockSkinsFromProgress } from '../src/game/skins.js';

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

function assert(cond, msg, log) {
  log.push({ ok: !!cond, msg });
  if (!cond) throw new Error(msg);
}

function farmUntilUnlocked(data, state, challengeId, log) {
  const need = killsNeeded(data);
  const mon = monstersInScene(data, state.selectedSceneId).find((m) => m.id === challengeId);
  state.farm.mode = 'farm';
  state.farm.focusId = challengeId;
  state.selectedMonsterId = makeFarmMinion(data, mon).id;
  let fights = 0;
  while (!isChallengeUnlocked(data, state, challengeId)) {
    const foe = currentFarmOrChallengeMonster(data, state);
    state.kills += 1;
    // Farm does NOT increment sceneClears (aligned with combat.js).
    const prog = applyVictoryProgression(data, state, foe);
    fights += 1;
    const cont = shouldContinueAutofight({
      farmMode: state.farm.mode,
      victory: true,
      progressKind: prog.kind,
    });
    if (!cont) break;
    if (fights > need + 5) break;
  }
  log.push({
    step: 'farm',
    challengeId,
    fights,
    unlocked: isChallengeUnlocked(data, state, challengeId),
    meter: meterCount(state, challengeId),
  });
  return fights;
}

function clearChallenge(data, state, challengeId, log) {
  const enter = enterChallenge(data, state, challengeId);
  assert(enter.ok, `enterChallenge ${challengeId}: ${enter.message}`, log);
  const boss = currentFarmOrChallengeMonster(data, state);
  assert(boss && !boss.isFarmMinion && boss.id === challengeId, '挑戰對手應為正式怪', log);
  state.kills += 1;
  state.defeated[challengeId] = (state.defeated[challengeId] || 0) + 1;
  state.sceneClears[state.selectedSceneId] = (state.sceneClears[state.selectedSceneId] || 0) + 1;
  unlockSkinsFromProgress(data, state);
  const prog = applyFarmVictory(data, state, boss);
  log.push({
    step: 'challenge_clear',
    challengeId,
    kind: prog.kind,
    nextId: prog.nextChallenge?.id || null,
    nextFarmOpened: !!prog.nextFarmOpened,
    nextUnlocked: !!prog.nextUnlocked,
    message: prog.message,
  });
  return prog;
}

function countChallengeReady(data, state, sceneId) {
  return monstersInScene(data, sceneId).filter(
    (m) =>
      isMonsterFightable(data, state, m) &&
      isChallengeUnlocked(data, state, m.id) &&
      !(state.defeated?.[m.id] > 0),
  ).length;
}

function main() {
  const data = loadData();
  const log = [];
  const state = createInitialState(data);
  ensureGearState(data, state);
  ensureSceneSelection(data, state);
  ensureFarmState(state);
  syncFarmFocus(data, state);

  const need = killsNeeded(data);
  assert(need === 10, `killsToUnlock 應為 10，實得 ${need}`, log);

  const scene1 = 'living_room';
  const chain1 = monstersInScene(data, scene1);
  assert(chain1.length >= 5, '巷口鏈至少 5 階', log);

  // T1 farm → challenge → next farm open, NOT challenge-ready
  farmUntilUnlocked(data, state, chain1[0].id, log);
  assert(isChallengeUnlocked(data, state, chain1[0].id), 'T1 應可挑戰', log);
  const c1 = clearChallenge(data, state, chain1[0].id, log);
  assert(c1.kind === 'challenge_clear', 'T1 通關 kind', log);
  assert(c1.nextFarmOpened === true, '應標記 nextFarmOpened', log);
  assert(c1.nextUnlocked === false, '下一階不可跳農直接挑戰', log);
  assert(isChallengeReachable(data, state, chain1[1]), 'T2 農區應可達', log);
  assert(!isChallengeUnlocked(data, state, chain1[1].id), 'T1 通關後 T2 仍須農滿', log);
  assert(meterCount(state, chain1[1].id) < need, 'T2 meter 不應被灌滿', log);
  const enterT2Early = enterChallenge(data, state, chain1[1].id);
  assert(!enterT2Early.ok, 'T2 未農滿不可挑戰', log);

  // Prior farm still available
  state.farm.mode = 'farm';
  state.farm.focusId = chain1[0].id;
  state.selectedMonsterId = makeFarmMinion(data, chain1[0]).id;
  const priorFarm = currentFarmOrChallengeMonster(data, state);
  assert(priorFarm?.farmOf === chain1[0].id, '可回 T1 農材料', log);

  // Farm T2 → clear → T3 still locked for challenge
  farmUntilUnlocked(data, state, chain1[1].id, log);
  clearChallenge(data, state, chain1[1].id, log);
  assert(!isChallengeUnlocked(data, state, chain1[2].id), 'T2 通關後 T3 仍須農滿', log);
  assert(!isChallengeUnlocked(data, state, chain1[3].id), 'T4 不可挑戰', log);
  assert(!isChallengeUnlocked(data, state, chain1[4].id), 'T5 不可挑戰', log);
  assert(!isMonsterFightable(data, state, chain1[3]), '未清 T3 時 T4 鏈鎖', log);

  const readyAfterTwo = countChallengeReady(data, state, scene1);
  assert(
    readyAfterTwo === 0,
    `清前兩階後未農滿時可挑戰數應為 0，實得 ${readyAfterTwo}`,
    log,
  );

  // Prove cannot one-shot unlock rest of chain
  for (let i = 2; i < chain1.length; i++) {
    assert(
      !isChallengeUnlocked(data, state, chain1[i].id),
      `清 T1+T2 後 ${chain1[i].id} 不可挑戰`,
      log,
    );
  }

  // Bathroom still gated by enhance + real clears (simulate)
  state.highestEnhance = 3;
  state.sceneClears.living_room = Math.max(state.sceneClears.living_room || 0, 5);
  assert(
    isSceneUnlocked(data, state, 'bathroom'),
    `校園應解鎖：${sceneUnlockHint(data, data.scenes.scenes.find((s) => s.id === 'bathroom'))}`,
    log,
  );

  // Switch to bathroom — same stepped farm cadence
  state.selectedSceneId = 'bathroom';
  ensureFarmState(state);
  syncFarmFocus(data, state);
  const chain2 = monstersInScene(data, 'bathroom');
  farmUntilUnlocked(data, state, chain2[0].id, log);
  clearChallenge(data, state, chain2[0].id, log);
  assert(!isChallengeUnlocked(data, state, chain2[1].id), '校園 T1 通關後 T2 仍須農滿', log);
  farmUntilUnlocked(data, state, chain2[1].id, log);
  assert(isChallengeUnlocked(data, state, chain2[1].id), '校園 T2 農滿後可挑戰', log);
  clearChallenge(data, state, chain2[1].id, log);
  assert(!isChallengeUnlocked(data, state, chain2[2].id), '校園清兩階後 T3 仍鎖', log);

  // Scene kill gates
  const study = data.scenes.scenes.find((s) => s.id === 'study');
  const mall = data.scenes.scenes.find((s) => s.id === 'mall');
  assert(study.unlock.count === 160, '當兵擊殺門檻 160', log);
  assert(mall.unlock.rules.some((r) => r.type === 'kills' && r.count === 320), '成家擊殺門檻 320', log);

  // Weapon sample
  const w = data.skins.catalog.find((s) => s.id === 'w_刀_3');
  assert(w.unlock.count === 110, '工廠美工刀擊殺 110', log);
  const armor = data.skins.catalog.find((s) => s.id === 'helmet_2');
  assert(armor.unlock.count === 120, '二階防具擊殺 120', log);

  const report = {
    ok: true,
    meterNeed: need,
    scene1TiersCleared: [chain1[0].id, chain1[1].id],
    challengeReadyAfterTwoClears: readyAfterTwo,
    cannotUnlockRestAfterTwo: true,
    bathroomSteppedFarm: true,
    studyKills: study.unlock.count,
    mallKills: 320,
    weaponSampleKills: w.unlock.count,
    log,
  };
  console.log(JSON.stringify(report, null, 2));

  const outDir = process.env.PLAYTEST_OUT;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/unlock-cadence-headless.json`, JSON.stringify(report, null, 2));
  }
}

try {
  main();
} catch (e) {
  console.error('FAIL', e.message);
  process.exit(1);
}
