/**
 * Hundred-playtest UI monitor: sample key battle/shop/enhance/bag states
 * against live or local, screenshot + DOM anomaly checks.
 *
 * PLAYTEST_URL=https://waste-dad-hero.apps.grok.bot
 * PLAYTEST_OUT=/cursor/stores/.../media
 */
import { mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.PLAYTEST_URL || 'https://waste-dad-hero.apps.grok.bot/';
const OUT = process.env.PLAYTEST_OUT || '/cursor/stores/bc-daf63a80-dede-416d-b08d-fe7498a6ee44/media';
const ART = process.env.PLAYTEST_ART || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });
mkdirSync(ART, { recursive: true });

const PREFIX = 'hundred-ui';

function assert(cond, msg, findings, sev = 'P1') {
  if (!cond) findings.push({ sev, msg });
  return !!cond;
}

async function waitApi(page) {
  await page.waitForFunction(() => window.__FEICAI__?.dismissOnboard, { timeout: 30000 });
}

async function shot(page, name) {
  const file = `${PREFIX}-${name}.png`;
  const path = `${OUT}/${file}`;
  await page.screenshot({ path, fullPage: false });
  try {
    copyFileSync(path, `${ART}/${file}`);
  } catch {
    /* ignore */
  }
  return file;
}

/** Detect overlapping / clipped / multi-primary CTA issues in sticky + cards. */
async function scanAnomalies(page, label) {
  return page.evaluate((label) => {
    const issues = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    }

    function overlaps(a, b, pad = 2) {
      return !(
        a.right <= b.x + pad ||
        b.right <= a.x + pad ||
        a.bottom <= b.y + pad ||
        b.bottom <= a.y + pad
      );
    }

    // Tab bar must stay fixed at bottom
    const tab = document.querySelector('.tab-bar, nav.tabs, [data-tab-bar]');
    if (tab) {
      const tr = rectOf(tab);
      if (tr.bottom < vh - 4 || tr.y > vh - 20) {
        issues.push({ sev: 'P1', msg: `${label}: 底欄未貼底 bottom=${tr.bottom} vh=${vh}` });
      }
      if (tr.w < vw * 0.9) {
        issues.push({ sev: 'P2', msg: `${label}: 底欄寬度偏窄 w=${tr.w} vw=${vw}` });
      }
    } else {
      issues.push({ sev: 'P1', msg: `${label}: 找不到底欄` });
    }

    // Primary CTAs in battle-controls — ideally one .primary
    const controls = document.querySelector('.battle-controls');
    if (controls) {
      const primaries = [...controls.querySelectorAll('button.primary, .btn.primary, [data-primary="1"]')];
      if (primaries.length > 1) {
        issues.push({
          sev: 'P1',
          msg: `${label}: sticky 多顆 primary (${primaries.length})「${primaries.map((b) => b.textContent.trim().slice(0, 12)).join(' / ')}」`,
        });
      }
      // Buttons clipped by viewport
      for (const btn of controls.querySelectorAll('button')) {
        const r = rectOf(btn);
        if (r.w > 0 && r.h > 0 && (r.x < -2 || r.right > vw + 2 || r.bottom > vh + 2)) {
          issues.push({
            sev: 'P1',
            msg: `${label}: CTA「${btn.textContent.trim().slice(0, 16)}」裁切/出界`,
          });
        }
      }
      // Sticky overlapping tab bar
      if (tab) {
        const cr = rectOf(controls);
        const tr = rectOf(tab);
        if (overlaps(cr, tr, 0)) {
          issues.push({ sev: 'P0', msg: `${label}: 戰鬥 sticky 與底欄重疊` });
        }
      }
    }

    // VS cards symmetry (player vs foe)
    const cards = [...document.querySelectorAll('.fighter-card, .vs-card, .combat-card')];
    if (cards.length >= 2) {
      const a = rectOf(cards[0]);
      const b = rectOf(cards[1]);
      const hDiff = Math.abs(a.h - b.h);
      const wDiff = Math.abs(a.w - b.w);
      if (hDiff > 28) {
        issues.push({ sev: 'P1', msg: `${label}: 對戰卡高度不對稱 Δh=${hDiff.toFixed(0)}` });
      }
      if (wDiff > 24) {
        issues.push({ sev: 'P2', msg: `${label}: 對戰卡寬度差 Δw=${wDiff.toFixed(0)}` });
      }
      // Overflow clip check
      for (const c of cards) {
        if (c.scrollWidth > c.clientWidth + 4 || c.scrollHeight > c.clientHeight + 8) {
          issues.push({
            sev: 'P1',
            msg: `${label}: 卡片內容溢出 scroll=${c.scrollWidth}x${c.scrollHeight} client=${c.clientWidth}x${c.clientHeight}`,
          });
        }
      }
    }

    // Horizontal page scroll = bad on mobile
    const de = document.documentElement;
    if (de.scrollWidth > vw + 2) {
      issues.push({ sev: 'P0', msg: `${label}: 頁面橫向溢出 scrollWidth=${de.scrollWidth} vw=${vw}` });
    }

    // Modal / onboard should not linger after dismiss
    const modal = document.querySelector('.onboard, .welcome-modal, .modal.open, [data-onboard]');
    if (modal) {
      const style = getComputedStyle(modal);
      if (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.05) {
        const r = rectOf(modal);
        if (r.w > 10 && r.h > 10) {
          issues.push({ sev: 'P1', msg: `${label}: 歡迎/模態層仍可見` });
        }
      }
    }

    // Result panel multi-primary
    const result = document.querySelector('.battle-result, .result-panel, .outcome');
    if (result) {
      const primaries = [...result.querySelectorAll('button.primary, .btn.primary')];
      if (primaries.length > 1) {
        issues.push({
          sev: 'P1',
          msg: `${label}: 結果框多顆 primary (${primaries.length})`,
        });
      }
    }

    return issues;
  }, label);
}

async function clickTab(page, name) {
  // Prefer data-tab or text
  const clicked = await page.evaluate((name) => {
    const tabs = [...document.querySelectorAll('.tab-bar button, nav.tabs button, [data-tab], .tab')];
    const el =
      tabs.find((t) => (t.dataset.tab || '').includes(name)) ||
      tabs.find((t) => (t.textContent || '').includes(name));
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, name);
  await page.waitForTimeout(350);
  return clicked;
}

async function expandCardDetail(page) {
  return page.evaluate(() => {
    const btn =
      document.querySelector('.fighter-card button.detail, .vs-card .expand, [data-expand-card]') ||
      [...document.querySelectorAll('button')].find((b) => /詳情|展開|細節/.test(b.textContent || ''));
    // Often tap the card itself / chevron
    const card = document.querySelector('.fighter-card, .vs-card, .combat-card');
    const toggle =
      card?.querySelector('.card-toggle, .expand-btn, .detail-toggle, summary') ||
      card?.querySelector('[aria-expanded]');
    const target = btn || toggle || card;
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
}

async function main() {
  const findings = [];
  const shots = [];
  const log = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await waitApi(page);

  // Meta check — unlock cadence on live
  const meta = await page.evaluate(async () => {
    const r = await fetch('/data/meta.json');
    return r.json();
  });
  const farm = await page.evaluate(async () => {
    const r = await fetch('/data/farm.json');
    return r.json();
  });
  assert(farm.killsToUnlock === 10, `meter 應為 10，實得 ${farm.killsToUnlock}`, findings, 'P0');
  assert(
    String(meta.dataVersion || '').includes('unlock-cadence') ||
      String(meta.dataVersion || '').includes('20261114'),
    `正式站 dataVersion=${meta.dataVersion}`,
    findings,
    'P1',
  );
  log.push({ meta: meta.dataVersion, killsToUnlock: farm.killsToUnlock });

  await page.evaluate(() => window.__FEICAI__.dismissOnboard());
  await page.waitForTimeout(400);

  // 1) 開局
  shots.push(await shot(page, '01-start'));
  findings.push(...(await scanAnomalies(page, '開局')));
  const meter0 = await page.evaluate(() => window.__FEICAI__.playtestMeter());
  assert(meter0?.have === 0 || meter0?.have < meter0?.need, '開局量條未滿', findings, 'P0');
  assert(!meter0?.canChallenge, '開局不可挑戰', findings, 'P0');
  log.push({ step: 'start', meter: meter0 });

  // 2) 掛機（點主 CTA）
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.battle-controls button, button')].find((b) =>
      /掛機|打怪|練功/.test(b.textContent || ''),
    );
    btn?.click();
  });
  await page.waitForTimeout(900);
  shots.push(await shot(page, '02-autofight'));
  findings.push(...(await scanAnomalies(page, '掛機')));
  // Pause if running
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.battle-controls button')].find((b) =>
      /暫停/.test(b.textContent || ''),
    );
    btn?.click();
  });
  await page.waitForTimeout(300);

  // 3) 量條滿（instant 10 kills）
  for (let i = 0; i < 10; i++) {
    const r = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
    assert(r.ok, `農殺 ${i + 1}`, findings, 'P0');
  }
  const meterFull = await page.evaluate(() => window.__FEICAI__.playtestMeter());
  assert(meterFull?.have === 10 && meterFull?.canChallenge, `量條滿可挑戰 have=${meterFull?.have}`, findings, 'P0');
  shots.push(await shot(page, '03-meter-full'));
  findings.push(...(await scanAnomalies(page, '量條滿')));
  log.push({ step: 'meter-full', meter: { have: meterFull?.have, need: meterFull?.need, canChallenge: meterFull?.canChallenge } });

  // CTA primary should be 挑戰 when meter full (idle)
  const ctaFull = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.battle-controls button')].map((b) => ({
      text: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 24),
      primary: b.classList.contains('primary'),
    }));
    return buttons;
  });
  log.push({ step: 'meter-full-cta', ctaFull });
  const challengePrimary = ctaFull.some((b) => b.primary && /挑戰/.test(b.text));
  if (!challengePrimary && ctaFull.some((b) => /挑戰/.test(b.text))) {
    findings.push({ sev: 'P2', msg: '量條滿時挑戰鈕存在但非 primary（視覺權重）' });
  }
  assert(ctaFull.some((b) => /挑戰/.test(b.text)), '量條滿應出現挑戰 CTA', findings, 'P0');

  // 4) 挑戰
  const enter = await page.evaluate(() => window.__FEICAI__.playtestEnterChallenge());
  assert(enter.ok, `進入挑戰: ${enter.message}`, findings, 'P0');
  await page.waitForTimeout(400);
  shots.push(await shot(page, '04-challenge'));
  findings.push(...(await scanAnomalies(page, '挑戰')));
  log.push({ step: 'challenge', enter });

  // 5) 展開詳情
  const expanded = await expandCardDetail(page);
  await page.waitForTimeout(350);
  shots.push(await shot(page, '05-card-expand'));
  findings.push(...(await scanAnomalies(page, '展開詳情')));
  if (!expanded) {
    // Try clicking player card area
    await page.evaluate(() => {
      const card = document.querySelector('.fighter-card, .vs-card, .combat-card');
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const det = card?.querySelector('.detail, .stats, .more');
      if (det) det.classList.add('open');
    });
    await page.waitForTimeout(200);
    shots.push(await shot(page, '05b-card-expand-retry'));
  }
  log.push({ step: 'expand', expanded });

  // Clear challenge for clean tab nav
  const clear = await page.evaluate(() => window.__FEICAI__.playtestInstantVictory());
  log.push({ step: 'challenge-clear', progress: clear.progress });
  assert(clear.progress?.nextFarmOpened === true, '通關應開下一階農區', findings, 'P0');
  assert(clear.progress?.nextUnlocked === false, '通關不可跳農解鎖挑戰', findings, 'P0');
  await page.waitForTimeout(300);
  shots.push(await shot(page, '06-after-clear-next-farm'));
  findings.push(...(await scanAnomalies(page, '通關後農區')));

  // Tier picker unlock check
  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(true));
  await page.waitForTimeout(250);
  const picker = await page.evaluate(() =>
    [...document.querySelectorAll('.tier-picker .tier-option')].map((el) => ({
      text: el.querySelector('.tier-option-main')?.textContent?.trim(),
      locked: el.classList.contains('locked'),
      meta: el.querySelector('.tier-option-meta')?.textContent?.trim(),
    })),
  );
  const lockedT = picker.filter((r) => r.locked && r.text?.startsWith('T'));
  assert(lockedT.length >= 8, `清 T1 後多數階應鎖，實得 ${lockedT.length}`, findings, 'P0');
  shots.push(await shot(page, '07-tier-picker-after-t1'));
  await page.evaluate(() => window.__FEICAI__.playtestOpenTierPicker(false));
  log.push({ step: 'picker', locked: lockedT.length, open: picker.filter((p) => !p.locked).map((p) => p.text) });

  // 6) 強化
  const tabEnhance = await clickTab(page, '強化');
  assert(tabEnhance, '切到強化分頁', findings, 'P1');
  await page.waitForTimeout(400);
  shots.push(await shot(page, '08-enhance'));
  findings.push(...(await scanAnomalies(page, '強化')));
  // sticky enhance CTA
  const enhanceCta = await page.evaluate(() => {
    const sticky = document.querySelector('.enhance-controls, .sticky-action, .tab-sticky, .primary-sticky');
    const btn = [...document.querySelectorAll('button')].find((b) => /強化|嘗試強化/.test(b.textContent || ''));
    return {
      hasBtn: !!btn,
      text: btn?.textContent?.trim()?.slice(0, 20),
      stickyBottom: sticky ? sticky.getBoundingClientRect().bottom : null,
      vh: window.innerHeight,
    };
  });
  log.push({ step: 'enhance', enhanceCta });
  assert(enhanceCta.hasBtn, '強化頁應有主 CTA', findings, 'P1');

  // 7) 商店
  const tabShop = await clickTab(page, '商店');
  assert(tabShop, '切到商店分頁', findings, 'P1');
  await page.waitForTimeout(400);
  shots.push(await shot(page, '09-shop'));
  findings.push(...(await scanAnomalies(page, '商店')));

  // 8) 背包
  const tabBag = (await clickTab(page, '背包')) || (await clickTab(page, '圖鑑'));
  assert(tabBag, '切到背包圖鑑', findings, 'P1');
  await page.waitForTimeout(400);
  shots.push(await shot(page, '10-bag'));
  findings.push(...(await scanAnomalies(page, '背包')));

  // Narrow phone pass (360)
  await page.setViewportSize({ width: 360, height: 740 });
  await clickTab(page, '戰鬥');
  await page.waitForTimeout(400);
  shots.push(await shot(page, '11-battle-360'));
  findings.push(...(await scanAnomalies(page, '戰鬥360')));

  // Deduplicate findings
  const uniq = [];
  const seen = new Set();
  for (const f of findings) {
    const key = `${f.sev}|${f.msg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(f);
  }
  uniq.sort((a, b) => a.sev.localeCompare(b.sev) || a.msg.localeCompare(b.msg));

  const report = {
    ok: uniq.filter((f) => f.sev === 'P0' || f.sev === 'P1').length === 0,
    generatedAt: new Date().toISOString(),
    base: BASE,
    metaVersion: meta.dataVersion,
    killsToUnlock: farm.killsToUnlock,
    shots,
    findingCount: uniq.length,
    findings: uniq,
    log,
  };
  writeFileSync(`${OUT}/${PREFIX}-report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${ART}/${PREFIX}-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, findingCount: report.findingCount, findings: uniq, shots }, null, 2));
  await browser.close();
  if (!report.ok) process.exitCode = 2;
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
