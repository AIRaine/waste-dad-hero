/**
 * Headless unlock-flow playtest: meter=10, challenge clear unlocks next, multi-scene.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createInitialState } from '../src/game/state.js';
import {
  applyFarmVictory,
  currentFarmOrChallengeMonster,
  ensureFarmState,
  enterChallenge,
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
  state.farm.mode = 'farm';
  state.farm.focusId = challengeId;
  state.selectedMonsterId = makeFarmMinion(data, monstersInScene(data, state.selectedSceneId).find((m) => m.id === challengeId)).id;
  let fights = 0;
  while (!isChallengeUnlocked(data, state, challengeId)) {
    const foe = currentFarmOrChallengeMonster(data, state);
    // simulate finishVictory side effects for farm
    state.kills += 1;
    state.sceneClears[state.selectedSceneId] = (state.sceneClears[state.selectedSceneId] || 0) + 1;
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
  log.push({ step: 'farm', challengeId, fights, unlocked: isChallengeUnlocked(data, state, challengeId), meter: meterCount(state, challengeId) });
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
    nextUnlocked: prog.nextUnlocked || false,
    message: prog.message,
  });
  return prog;
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
  assert(chain1.length >= 3, '巷口鏈至少 3 階', log);

  // T1 farm → challenge → T2 unlocked without farm
  farmUntilUnlocked(data, state, chain1[0].id, log);
  assert(isChallengeUnlocked(data, state, chain1[0].id), 'T1 應可挑戰', log);
  const c1 = clearChallenge(data, state, chain1[0].id, log);
  assert(c1.kind === 'challenge_clear', 'T1 通關 kind', log);
  assert(isChallengeUnlocked(data, state, chain1[1].id), 'T1 通關後 T2 應立刻解鎖', log);
  assert(meterCount(state, chain1[1].id) >= need, 'T2 meter 應滿', log);
  const enterT2 = enterChallenge(data, state, chain1[1].id);
  assert(enterT2.ok, `T2 應可不農直接挑戰：${enterT2.message}`, log);
  // stay able to farm prior: return focus manually
  state.farm.mode = 'farm';
  state.farm.focusId = chain1[0].id;
  state.selectedMonsterId = makeFarmMinion(data, chain1[0]).id;
  const priorFarm = currentFarmOrChallengeMonster(data, state);
  assert(priorFarm?.farmOf === chain1[0].id, '可回 T1 農材料', log);

  // Clear T2 → T3 unlocked
  clearChallenge(data, state, chain1[1].id, log);
  assert(isChallengeUnlocked(data, state, chain1[2].id), 'T2 通關後 T3 立刻解鎖', log);

  // Simulate enough clears + enhance for bathroom
  state.highestEnhance = 3;
  state.sceneClears.living_room = Math.max(state.sceneClears.living_room || 0, 5);
  assert(isSceneUnlocked(data, state, 'bathroom'), `校園應解鎖：${sceneUnlockHint(data, data.scenes.scenes.find((s) => s.id === 'bathroom'))}`, log);

  // Switch to bathroom and verify meter + unlock-next again
  state.selectedSceneId = 'bathroom';
  ensureFarmState(state);
  syncFarmFocus(data, state);
  const chain2 = monstersInScene(data, 'bathroom');
  farmUntilUnlocked(data, state, chain2[0].id, log);
  clearChallenge(data, state, chain2[0].id, log);
  assert(isChallengeUnlocked(data, state, chain2[1].id), '校園 T1 通關後 T2 立刻解鎖', log);

  // Scene kill gates
  const study = data.scenes.scenes.find((s) => s.id === 'study');
  const mall = data.scenes.scenes.find((s) => s.id === 'mall');
  assert(study.unlock.count === 45, '當兵擊殺門檻 45', log);
  assert(mall.unlock.rules.some((r) => r.type === 'kills' && r.count === 70), '成家擊殺門檻 70', log);

  // Weapon sample
  const w = data.skins.catalog.find((s) => s.id === 'w_刀_3');
  assert(w.unlock.count === 48, '工廠美工刀擊殺 48', log);

  const report = {
    ok: true,
    meterNeed: need,
    scene1TiersCleared: [chain1[0].id, chain1[1].id],
    scene2NextUnlocked: chain2[1].id,
    bathroomUnlocked: true,
    log,
  };
  console.log(JSON.stringify(report, null, 2));

  const outDir = process.env.PLAYTEST_OUT;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/unlock-flow-headless.json`, JSON.stringify(report, null, 2));
  }
}

try {
  main();
} catch (e) {
  console.error('FAIL', e.message);
  process.exit(1);
}
