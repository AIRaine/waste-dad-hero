import {
  monsterAttackCooldownMs,
  playerAttackCooldownMs,
} from './attackSpeed.js';
import {
  applyGachaLootBonus,
  getGachaBonuses,
  tickGachaAfterBattle,
} from './gacha.js';
import {
  equippedWeaponLevel,
  mitigateDamage,
  totalBlockChance,
  totalCounterChance,
  totalGearCrit,
  totalGearHp,
  totalPlayerAtk,
  totalPlayerDef,
  playerMitigation,
} from './gear.js';
import { recordSceneClear } from './scenes.js';
import { getAuraBonuses, getFrameBonuses, unlockSkinsFromProgress } from './skins.js';
import { applyFlatDefenseReduce, rollCrit } from './combatFormulas.js';
import { pruneHitFloats, pushHitResultFloat } from './hitFloats.js';
import { playerMaxHp, pushLog, randInt } from './state.js';
import { isTrainingDummy, trainingDefReduce } from './training.js';

function playerAtkMul(data, state) {
  const frame = getFrameBonuses(data, state);
  const aura = getAuraBonuses(data, state);
  const gacha = getGachaBonuses(data, state);
  return 1 + (frame.atkPct || 0) + (aura.atkPct || 0) + (gacha.atkPct || 0);
}

function hitFlashMs(data) {
  return Number(data.combat?.monsterAttack?.hitFlashMs) || 420;
}

function openingDelayFrac(data) {
  const f = Number(data.combat?.monsterAttack?.openingDelayFrac);
  return Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0.55;
}

export function createBattle(data, state, monster) {
  const wLevel = equippedWeaponLevel(state);
  const frame = getFrameBonuses(data, state);
  const gearHp = totalGearHp(data, state);
  const gacha = getGachaBonuses(data, state);
  let maxHp = playerMaxHp(data, wLevel, frame.hp, gearHp);
  if (gacha.hpPct) {
    maxHp = Math.max(1, Math.round(maxHp * (1 + gacha.hpPct)));
  }
  const now = Date.now();
  const training = isTrainingDummy(monster);
  const mCd = training ? 999999 : monsterAttackCooldownMs(monster, data);
  if (typeof globalThis !== 'undefined') {
    globalThis.__FEICAI_CREATE_BATTLE_COUNT__ = (globalThis.__FEICAI_CREATE_BATTLE_COUNT__ || 0) + 1;
    globalThis.__FEICAI_LAST_CREATE_BATTLE__ = { id: monster?.id, hp: monster?.hp, at: now, training };
  }
  return {
    monsterId: monster.id,
    monsterName: monster.name,
    sceneId: monster.sceneId,
    monsterMaxHp: monster.hp,
    monsterHp: monster.hp,
    playerMaxHp: maxHp,
    playerHp: maxHp,
    monsterState: 'idle',
    playerState: 'idle',
    lastPlayerAttackAt: 0,
    // Training: pin last swing to "now" so AS loop never opens a free hit.
    lastMonsterAttackAt: training ? now : now - Math.round(mCd * (1 - openingDelayFrac(data))),
    lastActionAt: 0,
    playerHitUntil: 0,
    floatTexts: [],
    over: false,
    victory: false,
    rewards: null,
    training,
  };
}

export function pruneFloats(battle, now = Date.now()) {
  return pruneHitFloats(battle, now);
}

function applyPlayerHit(data, state, battle, monster, raw, { source = 'attack' } = {}) {
  const now = Date.now();
  battle.playerHitUntil = now + hitFlashMs(data);
  battle.playerState = 'hurt';

  if (Math.random() < totalBlockChance(data, state)) {
    pushHitResultFloat(battle, 'player', 0, { block: true });
    pushLog(state, source === 'counter' ? `怪物反擊被格擋` : `怪物攻擊被格擋`, 'warn');
    return { dmg: 0, blocked: true, playerCountered: false };
  }

  const dmg = mitigateDamage(data, state, raw);
  battle.playerHp = Math.max(0, battle.playerHp - dmg);
  // Monster-sourced counter is labeled on the damage the player takes.
  pushHitResultFloat(battle, 'player', dmg, { counter: source === 'counter' });
  pushLog(
    state,
    source === 'counter' ? `怪物反擊 −${dmg}` : `怪物攻擊 −${dmg}`,
    'bad',
  );

  // Player gear counter: strike back (training dummy never takes real HP / never swings).
  let playerCountered = false;
  let playerCounterDmg = 0;
  if (!battle.training && !isTrainingDummy(monster) && battle.playerHp > 0) {
    const chance = totalCounterChance(data, state);
    if (chance > 0 && Math.random() < chance) {
      playerCountered = true;
      const base = Math.max(
        1,
        Math.round(
          totalPlayerAtk(data, state) *
            playerAtkMul(data, state) *
            (data.gear?.formulas?.counterDmgMul ?? 0.55),
        ),
      );
      const applied = applyDamageToMonster(battle, base + randInt(0, 2));
      playerCounterDmg = applied.dealt;
      pushHitResultFloat(battle, 'monster', playerCounterDmg, { counter: true });
      pushLog(state, `你的反擊 −${playerCounterDmg} · 怪HP ${applied.after}/${battle.monsterMaxHp}`, 'good');
    }
  }

  return { dmg, blocked: false, playerCountered, playerCounterDmg };
}

function checkPlayerDefeat(data, state, battle, monster) {
  if (battle.playerHp > 0) return null;
  battle.over = true;
  battle.victory = false;
  battle.monsterState = 'idle';
  battle.playerState = 'dead';
  pushLog(state, `敗給 ${monster.name}…`, 'bad');
  const gachaTick = tickGachaAfterBattle(data, state, {
    training: !!battle.training,
    victory: false,
  });
  if (gachaTick?.expired && gachaTick.card) {
    pushLog(state, `人情退場：${gachaTick.card.name}`, 'warn');
  }
  return { ok: true, victory: false };
}

/** Apply player→monster damage. Always writes monsterHp; returns dealt amount. */
export function applyDamageToMonster(battle, amount) {
  const before = Number(battle.monsterHp);
  const safeBefore = Number.isFinite(before) ? before : Number(battle.monsterMaxHp) || 0;
  const dealt = Math.max(1, Math.floor(Number(amount) || 0));
  battle.monsterHp = Math.max(0, safeBefore - dealt);
  if (typeof globalThis !== 'undefined') {
    globalThis.__FEICAI_LAST_MONSTER_DMG__ = {
      before: safeBefore,
      dealt,
      after: battle.monsterHp,
      max: battle.monsterMaxHp,
      at: Date.now(),
    };
  }
  return { dealt, before: safeBefore, after: battle.monsterHp };
}

export function playerAttack(data, state, battle, monster, now = Date.now()) {
  if (battle.over) return { blocked: true, reason: '戰鬥已結束' };
  const cooldownMs =
    playerAttackCooldownMs(data, state) || data.monsters.attackCooldownMs || 420;
  const last = battle.lastPlayerAttackAt || battle.lastActionAt || 0;
  if (now - last < cooldownMs) {
    return { blocked: true, reason: '攻擊冷卻中' };
  }
  battle.lastPlayerAttackAt = now;
  battle.lastActionAt = now;
  if (typeof globalThis !== 'undefined') {
    const swings = (globalThis.__FEICAI_SWINGS__ ||= { player: [], monster: [] });
    swings.player.push(now);
    if (swings.player.length > 40) swings.player.shift();
  }

  const training = isTrainingDummy(monster) || battle.training;
  battle.training = !!training;

  const frame = getFrameBonuses(data, state);
  const gacha = getGachaBonuses(data, state);
  const critMul = Number(data.gear?.formulas?.critMul) || 1.5;
  const baseAtk = Math.max(
    1,
    Math.round(totalPlayerAtk(data, state) * playerAtkMul(data, state)),
  );
  let dmg = baseAtk + randInt(0, 3);
  const critCap = Number(data.gear?.formulas?.critChanceCap) || 0.55;
  const critChance = Math.min(
    critCap,
    (frame.critChance || 0) + totalGearCrit(data, state) + (gacha.critChance || 0),
  );
  const rolled = rollCrit(critChance, dmg, critMul);
  let crit = rolled.crit;
  dmg = rolled.dmg;

  if (training) {
    const defReduce =
      monster.defReduce != null
        ? Number(monster.defReduce)
        : trainingDefReduce(data, state.selectedDifficultyId);
    const beforeDef = dmg;
    dmg = applyFlatDefenseReduce(dmg, defReduce);
    battle.monsterState = 'hit';
    battle.playerState = 'attacking';
    // Never mutate real HP in training.
    battle.monsterHp = battle.monsterMaxHp;
    battle.playerHp = battle.playerMaxHp;
    // Exactly one float; no 防/防禦 wording (reduction is silent).
    pushHitResultFloat(battle, 'monster', dmg, { crit });
    pushLog(
      state,
      `練功命中 −${dmg}${crit ? '（暴擊）' : ''} · 訓練不扣血`,
      'good',
    );
    if (typeof globalThis !== 'undefined') {
      globalThis.__FEICAI_LAST_TRAINING_HIT__ = {
        dmg,
        beforeDef,
        defReduce,
        crit,
        at: now,
        monsterHp: battle.monsterHp,
        playerHp: battle.playerHp,
        floats: (battle.floatTexts || []).map((f) => f.text),
      };
    }
    return {
      ok: true,
      training: true,
      defeated: false,
      dmg,
      beforeDef,
      defReduce,
      crit,
      countered: false,
      defended: true,
      blocked: false,
      counterDmg: 0,
    };
  }

  let stance = 'idle';
  const roll = Math.random();
  if (roll < monster.defChance) stance = 'defending';
  else if (roll < monster.defChance + monster.counterChance) stance = 'countering';

  battle.monsterState = stance === 'idle' ? 'hit' : stance;
  battle.playerState = 'attacking';

  let countered = false;
  let defended = false;
  let blocked = false;
  let counterDmg = 0;

  if (stance === 'defending') {
    defended = true;
    dmg = Math.max(1, Math.floor(dmg * (1 - (monster.defendReduce || 0.35))));
  }

  if (stance === 'countering') {
    countered = true;
    battle.monsterState = 'attacking';
    const raw = Math.max(1, monster.atk + randInt(0, 2));
    const hit = applyPlayerHit(data, state, battle, monster, raw, { source: 'counter' });
    blocked = hit.blocked;
    counterDmg = hit.dmg;
    if (battle.monsterHp <= 0) {
      return finishVictory(data, state, battle, monster, { dmg, countered, defended, blocked });
    }
  }

  // Always apply monster HP damage on a connected player swing (before outcome checks).
  const applied = applyDamageToMonster(battle, dmg);
  dmg = applied.dealt;
  // One float only: 暴擊 and/or 格擋 as tags on the same damage number (never 防).
  pushHitResultFloat(battle, 'monster', dmg, { crit, block: defended });
  pushLog(
    state,
    `你的攻擊 −${dmg}${crit ? '（暴擊）' : ''}${defended ? '（被格擋）' : ''} · 怪HP ${applied.after}/${battle.monsterMaxHp}`,
    defended ? 'warn' : 'good',
  );

  if (battle.monsterHp <= 0) {
    return finishVictory(data, state, battle, monster, { dmg, countered, defended, blocked });
  }

  const defeat = checkPlayerDefeat(data, state, battle, monster);
  if (defeat) return { ...defeat, dmg, countered, defended, blocked, counterDmg };

  return { ok: true, defeated: false, dmg, countered, defended, blocked, counterDmg };
}

/** Independent monster swing driven by monster AS cooldown. */
export function monsterAttack(data, state, battle, monster, now = Date.now()) {
  if (battle.over) return { blocked: true, reason: '戰鬥已結束' };
  if (isTrainingDummy(monster) || battle.training) {
    return { blocked: true, reason: '訓練模式不攻擊' };
  }
  const cd = monsterAttackCooldownMs(monster, data);
  if (now - (battle.lastMonsterAttackAt || 0) < cd) {
    return { blocked: true, reason: '攻擊冷卻中' };
  }
  battle.lastMonsterAttackAt = now;
  battle.monsterState = 'attacking';
  if (typeof globalThis !== 'undefined') {
    const swings = (globalThis.__FEICAI_SWINGS__ ||= { player: [], monster: [] });
    swings.monster.push(now);
    if (swings.monster.length > 40) swings.monster.shift();
  }

  const raw = Math.max(1, monster.atk + randInt(0, 2));
  const hit = applyPlayerHit(data, state, battle, monster, raw, { source: 'attack' });

  if (battle.monsterHp <= 0) {
    return finishVictory(data, state, battle, monster);
  }

  const defeat = checkPlayerDefeat(data, state, battle, monster);
  if (defeat) return { ...defeat, dmg: hit.dmg, blocked: hit.blocked, monsterSwing: true };

  return {
    ok: true,
    dmg: hit.dmg,
    blocked: hit.blocked,
    playerCountered: !!hit.playerCountered,
    monsterSwing: true,
  };
}

function finishVictory(data, state, battle, monster) {
  battle.over = true;
  battle.victory = true;
  battle.monsterState = 'dead';
  battle.playerState = 'idle';

  let gold = monster.rewards?.gold || 1;
  let material = monster.rewards?.material || 1;
  let exp = monster.rewards?.exp || 1;
  let doubled = false;
  if (state.boosts.doubleLootBattles > 0) {
    material *= 2;
    doubled = true;
    state.boosts.doubleLootBattles -= 1;
  }
  ({ gold, material } = applyGachaLootBonus(data, state, { gold, material }));
  if (!state.adminMode) {
    state.gold += gold;
    state.material += material;
  }
  state.exp += exp;
  state.kills += 1;
  // Farm minions are synthetic — meter lives in state.farm; do not mark catalog defeated.
  if (!monster.isFarmMinion) {
    state.defeated[monster.id] = (state.defeated[monster.id] || 0) + 1;
  }
  recordSceneClear(state, monster, state.selectedDifficultyId);
  battle.rewards = { gold, material, exp, doubled };
  const gachaTick = tickGachaAfterBattle(data, state, {
    training: !!battle.training,
    victory: true,
  });
  pushLog(
    state,
    `擊敗 ${monster.name}！+${gold} 金、+${material} 素材${doubled ? '（雙倍）' : ''}`,
    'good',
  );
  if (gachaTick?.expired && gachaTick.card) {
    pushLog(state, `人情退場：${gachaTick.card.name}`, 'warn');
  }
  unlockSkinsFromProgress(data, state);
  return { ok: true, victory: true, rewards: battle.rewards };
}

export function tickIdle(battle, now = Date.now()) {
  pruneFloats(battle, now);
  if (battle.over) return false;
  let dirty = false;
  if (battle.monsterState === 'hit' && now - (battle.lastPlayerAttackAt || 0) > 280) {
    battle.monsterState = 'idle';
    dirty = true;
  }
  // pose expiry uses default flash window; tickBattle passes data via monsterAttack only —
  // keep a stable visual beat here
  if (
    battle.monsterState === 'attacking' &&
    now - Math.max(battle.lastMonsterAttackAt || 0, battle.lastPlayerAttackAt || 0) > 340
  ) {
    battle.monsterState = 'idle';
    dirty = true;
  }
  if (
    (battle.monsterState === 'defending' || battle.monsterState === 'countering') &&
    now - (battle.lastPlayerAttackAt || battle.lastActionAt || 0) > 500
  ) {
    battle.monsterState = 'idle';
    dirty = true;
  }
  if (battle.playerState === 'attacking' && now - (battle.lastPlayerAttackAt || 0) > 280) {
    battle.playerState = 'idle';
    dirty = true;
  }
  if (battle.playerState === 'hurt' && now >= (battle.playerHitUntil || 0)) {
    battle.playerState = 'idle';
    dirty = true;
  }
  return dirty;
}

/**
 * Advance battle poses/floats.
 * Monster AS swings ONLY when opts.allowMonsterSwing is true (掛機打怪中).
 * Root cause of "T1 takes no damage": monsters used to swing while the player
 * did not, so HP looked one-sided until 打怪 was pressed — and idle watchers
 * never saw monsterHp drop.
 */
export function tickBattle(data, state, battle, monster, now = Date.now(), opts = {}) {
  if (!battle) return { dirty: false };
  const allowMonsterSwing = opts.allowMonsterSwing === true;
  let dirty = pruneFloats(battle, now);
  if (tickIdle(battle, now)) dirty = true;
  if (battle.over) return { dirty, over: true, victory: battle.victory };

  if (!allowMonsterSwing) return { dirty, over: false };
  if (isTrainingDummy(monster) || battle.training) return { dirty, over: false };

  const swing = monsterAttack(data, state, battle, monster, now);
  if (swing?.ok || swing?.victory === false) {
    dirty = true;
    return {
      dirty: true,
      monsterHit: true,
      over: !!battle.over,
      victory: battle.victory,
      result: swing,
    };
  }
  return { dirty, over: false };
}

export function playerIsHit(battle, now = Date.now()) {
  return !!battle && !battle.over && now < (battle.playerHitUntil || 0);
}

export function playerDefenseSummary(data, state) {
  return {
    def: totalPlayerDef(data, state),
    mitigation: playerMitigation(data, state),
    block: totalBlockChance(data, state),
  };
}
