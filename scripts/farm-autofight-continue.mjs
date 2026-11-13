/**
 * Regression: farm auto-continue until pause (meter_full / farm defeat / challenge clear).
 * Headless policy + progression simulation — catches the gap hundred-persona missed.
 */
import { readFileSync } from 'fs';
import { createInitialState } from '../src/game/state.js';
import {
  applyFarmVictory,
  currentFarmOrChallengeMonster,
  ensureFarmState,
  enterChallenge,
  killsNeeded,
  makeFarmMinion,
  returnToFarm,
  shouldContinueAutofight,
  syncFarmFocus,
} from '../src/game/farm.js';
import { applyVictoryProgression } from '../src/game/run.js';
import { ensureSceneSelection, monstersInScene } from '../src/game/scenes.js';
import { ensureGearState } from '../src/game/gear.js';

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

function assert(cond, msg, fails) {
  if (!cond) fails.push(msg);
}

function main() {
  const data = loadData();
  const fails = [];
  const state = createInitialState(data);
  ensureGearState(data, state);
  ensureSceneSelection(data, state);
  ensureFarmState(state);
  syncFarmFocus(data, state);

  // --- Policy table ---
  assert(
    shouldContinueAutofight({ farmMode: 'farm', victory: true, progressKind: 'farm_kill' }),
    'farm_kill 應續掛',
    fails,
  );
  assert(
    shouldContinueAutofight({ farmMode: 'farm', victory: true, progressKind: 'meter_full' }),
    'meter_full 應續掛（不中斷）',
    fails,
  );
  assert(
    shouldContinueAutofight({ farmMode: 'farm', victory: false, progressKind: null }),
    '農區敗北應續掛',
    fails,
  );
  assert(
    !shouldContinueAutofight({ farmMode: 'challenge', victory: false }),
    '挑戰敗北應停掛（給回刷）',
    fails,
  );
  assert(
    !shouldContinueAutofight({ farmMode: 'challenge', victory: true, progressKind: 'challenge_clear' }),
    '挑戰通關不強迫推下一 T 掛機',
    fails,
  );
  assert(
    !shouldContinueAutofight({ farmMode: 'farm', victory: true, progressKind: 'scene_gate_clear' }),
    '場景閘通關應停掛',
    fails,
  );

  // --- Simulate 5+ farm wins including crossing meter_full without policy stop ---
  const chain = monstersInScene(data, state.selectedSceneId);
  const t1 = chain[0];
  const need = killsNeeded(data);
  state.farm.mode = 'farm';
  state.farm.focusId = t1.id;
  state.selectedMonsterId = makeFarmMinion(data, t1).id;

  let auto = true;
  let fights = 0;
  const targetFights = Math.max(5, need + 2);
  for (let i = 0; i < targetFights; i++) {
    const foe = currentFarmOrChallengeMonster(data, state);
    assert(foe?.isFarmMinion && foe.farmOf === t1.id, `第 ${i + 1} 場應仍為 T1 農怪`, fails);
    const prog = applyVictoryProgression(data, state, foe);
    fights += 1;
    auto = shouldContinueAutofight({
      farmMode: state.farm.mode,
      victory: true,
      progressKind: prog.kind,
    });
    assert(auto, `第 ${i + 1} 場後政策應續掛（kind=${prog.kind}）`, fails);
    if (!auto) break;
  }
  assert(fights >= 5, `應連續至少 5 場，實得 ${fights}`, fails);
  assert(state.farm.unlocked[t1.id], '跨過滿條後應已解鎖挑戰', fails);
  assert(state.farm.mode === 'farm', '滿條後仍為農區 mode', fails);

  // Farm defeat policy + rematch same tier
  auto = shouldContinueAutofight({ farmMode: 'farm', victory: false });
  assert(auto, '敗北後政策續掛', fails);
  const afterLose = currentFarmOrChallengeMonster(data, state);
  assert(afterLose?.isFarmMinion && afterLose.farmOf === t1.id, '敗北後對手仍為同階農怪', fails);

  // Challenge clear → stop auto-push
  state.farm.meters[t1.id] = need;
  state.farm.unlocked[t1.id] = true;
  enterChallenge(data, state, t1.id);
  const boss = currentFarmOrChallengeMonster(data, state);
  state.defeated[t1.id] = (state.defeated[t1.id] || 0) + 1;
  const cleared = applyFarmVictory(data, state, boss);
  assert(cleared.kind === 'challenge_clear', `挑戰勝 kind=${cleared.kind}`, fails);
  assert(
    !shouldContinueAutofight({
      farmMode: 'challenge',
      victory: true,
      progressKind: cleared.kind,
    }),
    '挑戰勝不應自動續掛推進',
    fails,
  );
  // 回刷 → 前階農區，再開無限掛
  returnToFarm(data, state);
  const retreatFoe = currentFarmOrChallengeMonster(data, state);
  assert(retreatFoe?.isFarmMinion, '回刷為農怪', fails);
  assert(
    shouldContinueAutofight({ farmMode: 'farm', victory: true, progressKind: 'return_farm' }),
    '回刷後可進無限農',
    fails,
  );

  if (fails.length) {
    console.error('FAIL', fails);
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        fights,
        meterNeed: need,
        unlockedT1: !!state.farm.unlocked[t1.id],
        checks: [
          'meter_full_continues',
          'farm_defeat_continues',
          'challenge_clear_stops',
          'return_farm_loop',
          `continuous_${fights}_fights`,
        ],
      },
      null,
      2,
    ),
  );
}

main();
