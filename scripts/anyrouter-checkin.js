const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { chromium } = require('/root/automation/node_modules/playwright');

const STATE_PATH = '/root/.openclaw/workspace/memory/anyrouter-checkin-state.json';
const CONSOLE_URL = 'https://anyrouter.top/console';
const CDP_ENDPOINT = 'http://127.0.0.1:9222';
const CHROMIUM_SCRIPT = '/root/automation/bin/chromium-manual.sh';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { site: CONSOLE_URL, notes: 'Auto-created.', history: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function isCdpUp() {
  try {
    execSync(`curl -fsS ${CDP_ENDPOINT}/json/version >/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureChromiumCdp() {
  if (isCdpUp()) return;
  const child = spawn(CHROMIUM_SCRIPT, [], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DISPLAY: ':1',
      XAUTHORITY: '/root/.Xauthority',
      CDP_PORT: '9222',
      PROFILE_DIR: '/root/browser-data/chromium-main'
    }
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    if (isCdpUp()) return;
  }
  throw new Error('CDP endpoint did not come up in time');
}

function parseNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[,，\s]/g, '').match(/-?\$?([0-9]+(?:\.[0-9]+)?)/);
  return cleaned ? Number(cleaned[1]) : null;
}

async function captureConsole() {
  await ensureChromiumCdp();
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    let page = context.pages().find(p => /anyrouter\.top/.test(p.url()));
    if (!page) page = context.pages()[0] || await context.newPage();
    await page.goto(CONSOLE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const data = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
      const title = document.title;
      const url = location.href;
      const getAfterLabel = (label) => {
        const idx = lines.findIndex(x => x === label);
        if (idx >= 0 && idx + 1 < lines.length) return lines[idx + 1];
        return null;
      };
      const balanceText = getAfterLabel('当前余额');
      const totalSpentText = getAfterLabel('历史消耗');
      const requestCountText = getAfterLabel('请求次数');
      const statQuotaText = getAfterLabel('统计额度');
      const statTokensText = getAfterLabel('统计Tokens');
      const rewardLine = lines.find(x => /每日奖励|今日已获得|\+\$?25(?:\.00)?/.test(x)) || null;
      const loginHints = lines.filter(x => /Log In|Sign in|Continue with GitHub|Continue with LinuxDO|Sign in with Email or Username/i.test(x));
      return { title, url, text: txt, balanceText, totalSpentText, requestCountText, statQuotaText, statTokensText, rewardLine, loginHints };
    });
    return data;
  } finally {
    await browser.close();
  }
}

(async () => {
  const state = ensureState();
  const today = new Date().toISOString().slice(0, 10);
  const existingToday = state.history.find(x => x.date === today);
  const previous = [...state.history].reverse().find(x => x.date !== today) || null;

  const data = await captureConsole();
  const balance = parseNumber(data.balanceText);
  const totalSpent = parseNumber(data.totalSpentText);
  const requestCount = parseNumber(data.requestCountText);
  const statQuota = parseNumber(data.statQuotaText);
  const statTokens = parseNumber(data.statTokensText);

  if (!/anyrouter\.top/.test(data.url)) {
    throw new Error(`Unexpected URL: ${data.url}`);
  }
  if (!/\/console/.test(data.url) || balance == null || totalSpent == null) {
    const hint = data.loginHints?.length ? `Login page hints found: ${data.loginHints.join(' | ')}` : 'Console values missing.';
    throw new Error(`No usable logged-in console data. Current URL: ${data.url}. ${hint}`);
  }

  const balancePlusSpent = Number((balance + totalSpent).toFixed(2));
  let delta = null;
  let success = null;
  let reason = '';

  if (previous) {
    const byBalance = Number((balance - previous.balance).toFixed(2));
    const byTotal = Number((balancePlusSpent - previous.balancePlusSpent).toFixed(2));
    if (byBalance > 0) {
      success = true;
      delta = byBalance;
      reason = 'balance';
    } else if (byTotal > 0) {
      success = true;
      delta = byTotal;
      reason = 'balancePlusSpent';
    } else {
      success = false;
      delta = byBalance;
      reason = 'noIncrease';
    }
  }

  const snapshot = {
    date: today,
    balance,
    totalSpent,
    balancePlusSpent,
    requestCount,
    statQuota,
    statTokens,
    source: 'playwright-persistent-profile',
    checkinDetected: success,
    note: 'Captured via Playwright persistent Chromium profile.'
  };

  if (existingToday) {
    Object.assign(existingToday, snapshot);
  } else {
    state.history.push(snapshot);
  }
  saveState(state);

  if (!previous) {
    console.log(`已记录 AnyRouter 基线：余额 $${balance.toFixed(2)}，历史消耗 $${totalSpent.toFixed(2)}。`);
    return;
  }

  if (success) {
    const rewardText = data.rewardLine ? `（页面显示${data.rewardLine}）` : (reason === 'balancePlusSpent' ? '（按“余额 + 历史消耗”较昨日增加判断签到成功）' : '');
    console.log(`签到成功！余额 $${balance.toFixed(2)}，较昨日 +$${delta.toFixed(2)}${rewardText}`);
  } else {
    console.log(`签到未确认成功：当前余额 $${balance.toFixed(2)}，历史消耗 $${totalSpent.toFixed(2)}，较昨日无增长；请检查登录状态或页面变化。`);
  }
})().catch(err => {
  console.log(`AnyRouter 签到失败：${err.message}`);
  process.exit(1);
});
