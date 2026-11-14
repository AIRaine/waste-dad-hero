/**
 * UI playtest (Playwright): stepped unlock — clear 1–2 tiers must NOT unlock the rest.
 * Screenshots → PLAYTEST_OUT or /opt/cursor/artifacts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.PLAYTEST_URL || 'http://127.0.0.1:5173/';
const OUT = process.env.PLAYTEST_OUT || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

function assert(cond, msg, log) {
  log.push({ ok: !!cond, msg });
  if (!cond) throw new Error(msg);
}

async function waitApi(page) {
  await page.waitForFunction(() => window.__FEICAI__?.dismissOnboard, { timeout: 20000 });
}

async function shot(page, name) {
  const path = `${OUT}/${name}`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function main() {
  const log = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitApi(page);
  await page.evaluate(() => window.__FEICAI__.dismissOnboard());
  await page.waitForTimeout(300);

  const shots = [];
  shots.push(await shot(page, 'unlock-cadence-meter-0.png'));

  for (let i = 0; i < 10; i++) {
    const r = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
    assert(r.ok, `T1 farm kill ${i + 1}`, log);
  }
  const meterFull = await page.evaluate(() => window.__FEICAI__.playtestMeter());
  assert(meterFull?.unlocked === true, 'T1 meter 應滿可挑戰', log);
  assert(meterFull?.have === 10, `T1 have=10 實得 ${meterFull?.have}`, log);
  shots.push(await shot(page, 'unlock-cadence-meter-full.png'));

  const enter1 = await page.evaluate(() => window.__FEICAI__.playtestEnterChallenge());
  assert(enter1.ok, `enter T1: ${enter1.message}`, log);
  const clear1 = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
  assert(clear1.progress?.kind === 'challenge_clear', 'T1 通關 kind', log);
  assert(clear1.progress?.nextFarmOpened === true, 'nextFarmOpened', log);
  assert(clear1.progress?.nextUnlocked === false, '不可跳農挑戰', log);

  const afterT1 = await page.evaluate(() => window.__FEICAI__.playtestMeter());
  assert(afterT1?.have < afterT1?.need, `T2 meter 應未滿 實得 ${afterT1?.have}/${afterT1?.need}`, log);
  shots.push(await shot(page, 'unlock-cadence-after-t1-farm-open.png'));

  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(true));
  await page.waitForTimeout(200);
  const pickerAfter1 = await page.evaluate(() =>
    [...document.querySelectorAll('.tier-picker .tier-option')].map((el) => ({
      text: el.querySelector('.tier-option-main')?.textContent?.trim(),
      locked: el.classList.contains('locked'),
      meta: el.querySelector('.tier-option-meta')?.textContent?.trim(),
    })),
  );
  const lockedAfter1 = pickerAfter1.filter((r) => r.locked && r.text?.startsWith('T'));
  assert(lockedAfter1.length >= 8, `清 T1 後多數階應鎖，實得鎖 ${lockedAfter1.length}`, log);
  shots.push(await shot(page, 'unlock-cadence-picker-after-t1.png'));
  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(false));

  for (let i = 0; i < 10; i++) {
    const r = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
    assert(r.ok, `T2 farm kill ${i + 1}`, log);
  }
  const enter2 = await page.evaluate(() => window.__FEICAI__.playtestEnterChallenge());
  assert(enter2.ok, `enter T2: ${enter2.message}`, log);
  const clear2 = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
  assert(clear2.progress?.kind === 'challenge_clear', 'T2 通關', log);

  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(true));
  await page.waitForTimeout(200);
  const pickerAfter2 = await page.evaluate(() =>
    [...document.querySelectorAll('.tier-picker .tier-option')].map((el) => ({
      text: el.querySelector('.tier-option-main')?.textContent?.trim(),
      locked: el.classList.contains('locked'),
      meta: el.querySelector('.tier-option-meta')?.textContent?.trim(),
    })),
  );
  const openChallengeable = pickerAfter2.filter((r) => !r.locked && r.text?.startsWith('T'));
  const t3plusLocked = pickerAfter2.filter(
    (r) => r.locked && /^T([3-9]|1\d)/.test(r.text || ''),
  );
  assert(t3plusLocked.length >= 6, `清兩階後 T3+ 應仍鎖，實得 ${t3plusLocked.length}`, log);
  shots.push(await shot(page, 'unlock-cadence-picker-after-t2.png'));
  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(false));

  // Campus multi-scene
  await page.evaluate(() =>
    window.__FEICAI__.playtestSetProgress({
      enhance: 3,
      sceneClears: { living_room: 5 },
    }),
  );
  const switched = await page.evaluate(() => window.__FEICAI__.playtestChooseScene('bathroom'));
  assert(switched.ok, `切校園：${switched.message}`, log);

  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
  }
  await page.evaluate(() => window.__FEICAI__.playtestEnterChallenge());
  const campusClear = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
  assert(campusClear.progress?.nextUnlocked === false, '校園通關後下一階仍須農', log);
  const campusMeter = await page.evaluate(() => window.__FEICAI__.playtestMeter());
  assert(campusMeter?.have < campusMeter?.need, '校園下一階 meter 未滿', log);
  shots.push(await shot(page, 'unlock-cadence-campus-after-t1.png'));

  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(true));
  await page.waitForTimeout(200);
  shots.push(await shot(page, 'unlock-cadence-campus-picker.png'));

  const report = {
    ok: true,
    shots,
    pickerAfter1Locked: lockedAfter1.length,
    pickerAfter2T3PlusLocked: t3plusLocked.length,
    openAfter2: openChallengeable.map((r) => r.text),
    campusNextMustFarm: true,
    log,
  };
  writeFileSync(`${OUT}/unlock-cadence-ui-playtest.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
