import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');

export const JMGO_MESSAGE = `Join the JMGO Affiliate Program | No.1 Home Laser projector
Hi Partner,
We’re pleased to invite you to join the JMGO Affiliate Program on Impact.
JMGO is a smart projector brand focused on redefining home entertainment through premium projection technology, portable viewing experiences, and immersive big-screen scenarios. 
Over the past fifteen years, JMGO has refined a full stack of home-entertainment technology ：the MALC™ triple-color laser engine, the  Dual Dynamic Iris system, and an AI-powered gimbal. Backed by 500+ patents, we've stayed devoted to a single pursuit: making true cinema effortless and accurate in every home.


Why join the JMGO Affiliate Program? ✨
- Competitive commission: up to 10% 
- High-value conversions: average order value is around $1,200, giving partners stronger revenue potential per sale 
- Proven performance: $0.85 EPC and 2.06% conversion rate
- Strong promotional potential: product launches, seasonal campaigns, major shopping events, and limited-time offers 
- Broad audience fit: tech enthusiasts, home entertainment shoppers, gamers, families, outdoor users, and deal-seeking consumers 
- Partner support: product information, creatives, deal details, campaign updates, and promotional materials


👉 Apply here：
https://global.jmgo.com/pages/affiliate-program
We’d be happy to share more details and support your upcoming placements once you join.

Best regards,
JMGO Affiliate Team`;

const TYPE_MAP = {
  'Creators': { term: 'Content Term', groupQuery: 'Creators' },
  'Content / Reviews': { term: 'Content Term', groupQuery: 'Content/Reviews' },
  'Content/Reviews': { term: 'Content Term', groupQuery: 'Content/Reviews' },
  'Email / Newsletter': { term: 'Content Term', groupQuery: 'Email/Newsletter' },
  'Email/Newsletter': { term: 'Content Term', groupQuery: 'Email/Newsletter' },
  'Deal / Coupons': { term: 'Discount Term', groupQuery: 'Deal/Coupons' },
  'Deal/Coupons': { term: 'Discount Term', groupQuery: 'Deal/Coupons' },
  'Loyalty / Rewards': { term: 'Discount Term', groupQuery: 'Loyalty/Rewards' },
  'Loyalty/Rewards': { term: 'Discount Term', groupQuery: 'Loyalty/Rewards' },
  'Search / Comparison': { term: 'Discount Term', groupQuery: 'Search/Comparison' },
  'Search/Comparison': { term: 'Discount Term', groupQuery: 'Search/Comparison' },
  'Network': { term: 'Network Term', groupQuery: 'Network' },
  'Cross Audience Monetization': { term: 'Tech Term', groupQuery: 'Cross Audience Monetization' },
  'Technology Solution': { term: 'Tech Term', groupQuery: 'Technology Solution' },
  'Technology Solutions': { term: 'Tech Term', groupQuery: 'Technology Solution' },
};

const NORMALIZED_TYPE_MAP = Object.fromEntries(
  Object.entries(TYPE_MAP).map(([key, value]) => [normalizeType(key), value]),
);

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactName(value) {
  return normalizeName(value).replace(/\s+/g, '');
}

function impactSearchName(value) {
  return String(value || '')
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatchScore(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const compactA = compactName(left);
  const compactB = compactName(right);
  if (compactA && compactA === compactB) return 0.98;
  if (a.includes(b) || b.includes(a)) return 0.92;
  if (compactA.includes(compactB) || compactB.includes(compactA)) return 0.9;

  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let hits = 0;
  for (const token of tokensA) if (tokensB.has(token)) hits += 1;
  return hits / Math.max(tokensA.size, tokensB.size);
}

function findBestPartnerMatch(partners, name, threshold = 0.75) {
  let best = null;
  for (const partner of partners) {
    const score = nameMatchScore(partner.name, name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { partner, score };
    }
  }
  return best;
}

export function parsePartnerNames(text) {
  const names = new Set();
  const raw = String(text || '').replace(/^\uFEFF/, '');
  for (const line of raw.split(/\r?\n/)) {
    const cells = line.split(/\t|,/).map((cell) => cell.replace(/^"|"$/g, '').trim()).filter(Boolean);
    if (cells.length === 0) continue;
    if (cells.length === 1) {
      if (!/^(name|partner|partner name|publisher|publisher name)$/i.test(cells[0])) names.add(cells[0]);
      continue;
    }
    for (const cell of cells) {
      if (/^(name|partner|partner name|publisher|publisher name)$/i.test(cell)) continue;
      if (/[a-z0-9]/i.test(cell) && cell.length <= 120) names.add(cell);
    }
  }
  return [...names];
}

function normalizeType(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bsolutions\b/g, 'solution');
}

function resolveTypeConfig(type) {
  return TYPE_MAP[type] || NORMALIZED_TYPE_MAP[normalizeType(type)];
}

function marketplaceUrl(query) {
  return 'https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml'
    + '?page=marketplace&slideout_id_type=partner&_codexTs=' + Date.now()
    + '#businessModels=all&q=' + encodeURIComponent(query)
    + '&partnerStatuses=1&relationshipInclusions=prospecting%2Cjoined&sortBy=reachRating&sortOrder=DESC';
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')) };
}

async function emit(options, key, state, message, extra = {}) {
  if (typeof options.onStep === 'function') {
    await options.onStep({ key, state, message, at: new Date().toISOString(), ...extra });
  }
}

async function wait(page, ms) {
  await page.playwright.waitForTimeout(ms);
}

async function findBrowserClient() {
  const fs = await import('node:fs/promises');
  const candidates = [
    'C:/Users/eva.wang/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/browser/scripts/browser-client.mjs',
    'C:/Users/eva.wang/.codex/plugins/cache/openai-bundled/browser/26.527.31326/scripts/browser-client.mjs',
  ];
  for (const path of candidates) {
    try {
      await fs.access(path);
      return 'file:///' + path.replace(/\\/g, '/');
    } catch {}
  }
  throw new Error('找不到 Codex 浏览器控制模块，请确认内置浏览器可用。');
}

export async function connectImpactTab() {
  if (!globalThis.agent?.browsers) {
    const browserClient = await findBrowserClient();
    const mod = await import(browserClient);
    await mod.setupBrowserRuntime({ globals: globalThis });
  }
  const browsers = await agent.browsers.list();
  const iab = browsers.find((b) => b.type === 'iab') || browsers[0];
  if (!iab) throw new Error('没有找到已打开的 Codex 内置浏览器。');
  const browser = await agent.browsers.get(iab.id);
  const openTabs = await browser.user.openTabs();
  const impact = openTabs.find((t) => /impact\.com/i.test(t.url)) || openTabs[0];
  if (impact) return browser.user.claimTab(impact.id);

  for (let id = 20; id >= 1; id -= 1) {
    try {
      const tab = await browser.tabs.get(String(id));
      const url = await tab.playwright.evaluate(() => location.href).catch(() => '');
      if (/impact\.com/i.test(url)) return tab;
    } catch {}
  }
  throw new Error('没有找到 Impact 浏览器标签页。');
}

export async function loadUnsentPartners() {
  const fs = await import('node:fs/promises');
  const paths = [`${ROOT}/work/impact-prospect-results.json`, `${ROOT}/work/eu-impact-prospect-results.json`];
  const all = [];
  for (const path of paths) {
    try {
      const rows = JSON.parse((await fs.readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
      all.push(...rows.map((row) => ({ ...row, source: path.includes('/eu-') ? 'EU' : 'US' })));
    } catch {}
  }
  return all.filter((row) => row && row.name && row.foundProspect !== true);
}

export async function findPartnerInList(name) {
  const partners = await loadUnsentPartners();
  return findBestPartnerMatch(partners, name, 0.7)?.partner || null;
}

export async function matchImportedPartnerNames(textOrNames) {
  const importedNames = Array.isArray(textOrNames) ? textOrNames : parsePartnerNames(textOrNames);
  const partners = await loadUnsentPartners();
  const usedImported = new Set();
  const matched = [];
  const unmatchedNeeded = [];

  for (const partner of partners) {
    let best = null;
    for (let index = 0; index < importedNames.length; index += 1) {
      if (usedImported.has(index)) continue;
      const importedName = importedNames[index];
      const score = nameMatchScore(partner.name, importedName);
      if (score >= 0.75 && (!best || score > best.score)) {
        best = { index, importedName, score };
      }
    }
    if (best) {
      usedImported.add(best.index);
      matched.push({
        name: partner.name,
        importedName: best.importedName,
        score: Number(best.score.toFixed(3)),
        row: partner.row,
        source: partner.source,
        type: partner.type,
      });
    } else {
      unmatchedNeeded.push({
        name: partner.name,
        row: partner.row,
        source: partner.source,
        type: partner.type,
      });
    }
  }

  return {
    importedCount: importedNames.length,
    neededCount: partners.length,
    matched,
    unmatchedNeeded,
  };
}

async function clearMarketplaceFilters(page) {
  const clear = page.playwright.getByText('Clear all').first();
  if (await clear.isVisible().catch(() => false)) {
    await clear.click({ timeout: 5000 }).catch(() => {});
    await wait(page, 2500);
  }
}

async function searchPartnerCard(page, partner, options = {}) {
  const searchName = impactSearchName(partner.name) || partner.name;
  await emit(options, 'impactSearch', 'running', 'Searching Impact for ' + searchName);
  await page.goto(marketplaceUrl(searchName), { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(async (error) => {
    await emit(options, 'impactSearch', 'running', 'Impact is loading slowly; continuing to inspect results: ' + (error?.message || error));
  });
  await page.playwright.waitForLoadState({ state: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(page, 6500);

  const input = page.playwright.locator('input[placeholder="Search"]').first();
  await input.click({ timeout: 30000 });
  await input.fill(searchName);
  await input.press('Enter');
  await page.playwright.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return document.querySelectorAll('.iui-card').length > 0
      || /\b0 items\b|\b1 item\b|\d+\s+items|Sorry! There's no data to show/i.test(text);
  }, { timeout: 60000 }).catch(() => {});
  await wait(page, 2500);

  const targetName = normalizeName(partner.name);
  const targetCompact = compactName(partner.name);
  const searchResult = await page.playwright.evaluate(({ targetName, targetCompact }) => {
    const norm = (value) => String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
    const compact = (value) => norm(value).replace(/\s+/g, '');
    const tokenScore = (left, right) => {
      const a = new Set(norm(left).split(/\s+/).filter(Boolean));
      const b = new Set(norm(right).split(/\s+/).filter(Boolean));
      if (!a.size || !b.size) return 0;
      let hits = 0;
      for (const token of a) if (b.has(token)) hits += 1;
      return hits / Math.max(a.size, b.size);
    };
    const isGreenValue = (value) => {
      const text = String(value || '').toLowerCase();
      const rgb = text.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgb) {
        const r = Number(rgb[1]);
        const g = Number(rgb[2]);
        const b = Number(rgb[3]);
        return g >= 110 && r <= 140 && b <= 150;
      }
      return /green|success/.test(text);
    };
    const cardHasGreenCheck = (card) => {
      const topRight = Array.from(card.querySelectorAll('svg, path, circle, [class*="check"], [class*="success"], [style]'));
      return topRight.some((el) => {
        const style = getComputedStyle(el);
        return isGreenValue(style.color)
          || isGreenValue(style.fill)
          || isGreenValue(style.stroke)
          || isGreenValue(el.getAttribute('fill'))
          || isGreenValue(el.getAttribute('stroke'));
      });
    };
    const cards = Array.from(document.querySelectorAll('.iui-card'));
    const rows = cards.map((card, index) => {
      const lines = String(card.innerText || '').split('\n').map((line) => line.trim()).filter(Boolean);
      const name = lines[0] || '';
      const normalized = norm(name);
      const compacted = compact(name);
      const likely = Boolean(normalized && (
        normalized.includes(targetName)
        || targetName.includes(normalized)
        || compacted.includes(targetCompact)
        || targetCompact.includes(compacted)
        || tokenScore(name, targetName) >= 0.75
      ));
      return { index, name, text: card.innerText || '', green: cardHasGreenCheck(card), likely };
    });
    const likely = rows.filter((row) => row.likely);
    return { found: rows.length > 0, cards: rows.slice(0, 12), likely: likely.slice(0, 12), itemCount: rows.length };
  }, { targetName, targetCompact });

  if (!searchResult.found) {
    await emit(options, 'impactSearch', 'failed', 'No Impact results were found.', { cards: searchResult.cards || [] });
    await emit(options, 'greenCheck', 'failed', 'No matching partner was found, so the green check cannot be judged.', { greenCheck: null });
    return { found: false, cards: searchResult.cards || [] };
  }

  let match = null;
  if (searchResult.cards.length === 1) {
    match = searchResult.cards[0];
  } else {
    const candidates = searchResult.cards;
    await emit(options, 'impactSearch', 'waiting', 'Found ' + candidates.length + ' possible results. Please choose the right partner in the control panel.', { candidates });
    const choice = typeof options.requestChoice === 'function'
      ? await options.requestChoice({
        type: 'impact-search-result',
        partnerName: partner.name,
        candidates,
      })
      : null;
    const chosenIndex = Number(choice?.choiceIndex);
    if (!Number.isInteger(chosenIndex) || chosenIndex < 0) {
      await emit(options, 'impactSearch', 'failed', 'No search result was selected.', { cards: searchResult.cards });
      await emit(options, 'greenCheck', 'failed', 'Selection was cancelled before green-check judging.', { greenCheck: null });
      return { found: false, cards: searchResult.cards, cancelled: true };
    }
    match = candidates.find((row) => row.index === chosenIndex) || searchResult.cards.find((row) => row.index === chosenIndex) || null;
  }

  if (!match) {
    await emit(options, 'impactSearch', 'failed', 'No matching partner was selected.', { cards: searchResult.cards });
    await emit(options, 'greenCheck', 'failed', 'No partner was selected, so the green check cannot be judged.', { greenCheck: null });
    return { found: false, cards: searchResult.cards };
  }

  await page.playwright.evaluate((index) => {
    document.querySelectorAll('.iui-card')[index]?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, match.index).catch(() => {});

  await emit(options, 'impactSearch', 'done', 'Selected: ' + (match.name || partner.name), { match, cards: searchResult.cards });
  await emit(
    options,
    'greenCheck',
    match.green ? 'done' : 'failed',
    match.green ? 'Green check found; this partner is already prospects.' : 'No green check found; continuing to fill the proposal.',
    { greenCheck: Boolean(match.green) },
  );
  return { found: true, match, cards: searchResult.cards };
}
async function openProposalForm(page, cardIndex, options = {}) {
  await emit(options, 'proposalForm', 'running', '正在打开邀约表单');
  const card = page.playwright.locator('.iui-card').nth(cardIndex);
  if (typeof card.scrollIntoViewIfNeeded === 'function') {
    await card.scrollIntoViewIfNeeded({ timeout: 30000 }).catch(() => {});
  }
  if (typeof card.hover === 'function') {
    await card.hover({ timeout: 30000 }).catch(() => {});
    await wait(page, 800);
  }
  await card.click({ timeout: 30000 }).catch(() => {});
  await wait(page, 800);

  const clicked = await page.playwright.evaluate(() => {
    const isSendProposal = (el) => /Send Proposal/i.test(el?.innerText || el?.textContent || '');
    const candidates = [];

    for (const btn of document.querySelectorAll('button[data-testid="uicl-button"]')) {
      if (isSendProposal(btn)) candidates.push(btn);
    }
    for (const btn of document.querySelectorAll('button, [role="button"], a')) {
      if (isSendProposal(btn) && !candidates.includes(btn)) candidates.push(btn);
    }
    for (const node of Array.from(document.querySelectorAll('*')).filter(isSendProposal)) {
      let cur = node;
      for (let depth = 0; cur && depth < 8; depth += 1) {
        const tag = String(cur.tagName || '').toLowerCase();
        const role = String(cur.getAttribute?.('role') || '').toLowerCase();
        if ((tag === 'button' || tag === 'a' || role === 'button') && !candidates.includes(cur)) {
          candidates.push(cur);
          break;
        }
        cur = cur.parentElement;
      }
    }

    for (const target of candidates) {
      try {
        const scrollTarget = target.parentElement || target;
        scrollTarget.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      } catch {}
      try {
        target.click();
        return true;
      } catch {}
    }
    return false;
  }).catch(() => false);

  if (!clicked) {
    await emit(options, 'proposalForm', 'waiting', '已找到联盟客，请手动向下滚动并点击蓝色 Send Proposal');
  }

  let formSrc = '';
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await wait(page, 1000);
    formSrc = await page.playwright.evaluate(() => (
      Array.from(document.querySelectorAll('iframe'))
        .map((frame) => frame.src)
        .find((src) => /send-proposal-new-partner-flow/.test(src))
    ));
    if (formSrc) break;
    if (attempt === 10 && clicked) {
      await emit(options, 'proposalForm', 'waiting', '还没进入表单，请手动点击蓝色 Send Proposal');
    }
  }
  if (!formSrc) throw new Error('已打开 partner 卡片，但没有找到 Propose Contract 表单。');
  await page.goto(formSrc, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(async (error) => {
    await emit(options, 'proposalForm', 'running', `表单加载较慢，继续检查表单内容：${error?.message || error}`);
  });
  await page.playwright.waitForLoadState({ state: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(page, 4500);
  await emit(options, 'proposalForm', 'done', '邀约表单已打开');
}

async function chooseTemplateTerm(page, term, options = {}) {
  await emit(options, 'templateTerm', 'running', `Selecting ${term}`);
  const selected = await page.playwright.evaluate(async (term) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const wanted = normalize(term);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1
        && rect.height > 1
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0;
    };
    const clickElement = (el) => {
      if (!el) return false;
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
      try { el.click(); return true; } catch {}
      return false;
    };

    const hidden = document.querySelector('input[name="insertionOrderId"]');
    if (hidden) {
      let cur = hidden.parentElement;
      for (let depth = 0; cur && depth < 8; depth += 1, cur = cur.parentElement) {
        const select = cur.querySelector?.('select[data-testid="uicl-select"], select');
        if (select) {
          const option = Array.from(select.options || []).find((opt) => normalize(opt.text || opt.label || opt.value) === wanted);
          if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, method: 'native-select' };
          }
        }
      }
    }

    const findTrigger = () => {
      if (hidden) {
        let cur = hidden.parentElement;
        for (let depth = 0; cur && depth < 8; depth += 1, cur = cur.parentElement) {
          if (cur.getAttribute?.('data-testid') === 'uicl-multiselect-input') {
            const btn = cur.querySelector('button[data-testid="uicl-multi-select-input-button"], button');
            if (btn && isVisible(btn)) return btn;
          }
          const scoped = cur.querySelector?.('button[data-testid="uicl-multi-select-input-button"]');
          if (scoped && isVisible(scoped)) return scoped;
        }
      }

      const labelNode = Array.from(document.querySelectorAll('*')).find((el) => normalize(el.textContent) === 'template term');
      if (labelNode) {
        let cur = labelNode.parentElement;
        for (let depth = 0; cur && depth < 8; depth += 1, cur = cur.parentElement) {
          const btn = cur.querySelector?.('button[data-testid="uicl-multi-select-input-button"], button');
          if (btn && isVisible(btn) && !/date|calendar/i.test(btn.getAttribute('aria-label') || '')) return btn;
        }
      }

      return Array.from(document.querySelectorAll('button[data-testid="uicl-multi-select-input-button"]'))
        .find((btn) => isVisible(btn) && /select|term|tech|content|discount|network/i.test(btn.innerText || btn.textContent || ''));
    };

    const trigger = findTrigger();
    if (!trigger) return { ok: false, reason: 'trigger-not-found' };
    clickElement(trigger);
    await sleep(700);

    const dropdowns = [
      ...document.querySelectorAll('div[data-testid="uicl-multi-select-dropdown"]'),
      ...document.querySelectorAll('div[data-testid="uicl-dropdown"]'),
      ...document.querySelectorAll('ul[role="listbox"], [role="listbox"]'),
    ].filter(isVisible);

    const optionNodes = [];
    for (const dropdown of dropdowns) {
      optionNodes.push(...dropdown.querySelectorAll('li[role="option"], li, [role="option"], div.text-ellipsis, span'));
    }
    if (!optionNodes.length) {
      optionNodes.push(...document.querySelectorAll('li[role="option"], [role="option"], div.text-ellipsis'));
    }

    const visibleOptions = optionNodes.filter(isVisible);
    const textOf = (el) => String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    const targetTextNode = visibleOptions.find((el) => normalize(textOf(el)) === wanted)
      || visibleOptions.find((el) => normalize(textOf(el)).includes(wanted));
    if (!targetTextNode) {
      return {
        ok: false,
        reason: 'option-not-found',
        options: visibleOptions.map(textOf).filter(Boolean).slice(0, 30),
      };
    }

    let target = targetTextNode;
    for (let depth = 0; target && depth < 5; depth += 1) {
      const role = target.getAttribute?.('role');
      const tag = String(target.tagName || '').toLowerCase();
      if (role === 'option' || tag === 'li' || tag === 'button') break;
      target = target.parentElement;
    }
    target = target || targetTextNode;
    if (!clickElement(target) && !clickElement(targetTextNode)) {
      return { ok: false, reason: 'click-failed' };
    }
    await sleep(500);
    return { ok: true, method: 'dropdown-js-click' };
  }, term);

  if (!selected?.ok) {
    await page.playwright.locator('button[data-testid="uicl-multi-select-input-button"]').first().click({ timeout: 30000 }).catch(() => {});
    await wait(page, 700);
    await page.playwright
      .locator('[role="listbox"] li, [role="option"], div[data-testid="uicl-multi-select-dropdown"] li, div.text-ellipsis')
      .filter({ hasText: term })
      .first()
      .click({ timeout: 30000 });
  }

  await wait(page, 1000);
  const confirmed = await page.playwright.waitForFunction((term) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const wanted = normalize(term);
    const visibleTermButton = Array.from(document.querySelectorAll('button[data-testid="uicl-multi-select-input-button"], [data-testid="uicl-multiselect-input"]'))
      .find((el) => {
        const text = normalize(el.innerText || el.textContent || '');
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return text.includes(wanted)
          && rect.width > 1
          && rect.height > 1
          && style.display !== 'none'
          && style.visibility !== 'hidden';
      });
    if (visibleTermButton) return true;
    const hidden = document.querySelector('input[name="insertionOrderId"]');
    const select = hidden?.closest?.('div, section, form')?.querySelector?.('select')
      || document.querySelector('select[name="insertionOrderId"], select[data-testid="uicl-select"]');
    if (select) {
      const option = select.options?.[select.selectedIndex];
      if (normalize(option?.text || option?.label || '').includes(wanted)) return true;
    }
    if (!hidden?.value) return false;
    let cur = hidden.parentElement;
    for (let depth = 0; cur && depth < 8; depth += 1, cur = cur.parentElement) {
      const text = normalize(cur.innerText || cur.textContent || '');
      if (text.includes(wanted)) return true;
    }
    return false;
  }, term, { timeout: 2500 }).then(() => true).catch(() => false);

  if (!confirmed) {
    await emit(options, 'templateTerm', 'running', `Confirming ${term}`);
    const confirmedByClick = await page.playwright.evaluate(async (term) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const wanted = normalize(term);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const isVisible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 1
          && rect.height > 1
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0;
      };
      const isSelected = () => {
        const visibleTermButton = Array.from(document.querySelectorAll('button[data-testid="uicl-multi-select-input-button"], [data-testid="uicl-multiselect-input"]'))
          .find((el) => {
            const text = normalize(el.innerText || el.textContent || '');
            return isVisible(el) && text.includes(wanted);
          });
        if (visibleTermButton) return true;
        const hidden = document.querySelector('input[name="insertionOrderId"]');
        if (hidden) {
          if (hidden.value) return true;
          let cur = hidden.parentElement;
          for (let depth = 0; cur && depth < 8; depth += 1, cur = cur.parentElement) {
            const text = normalize(cur.innerText || cur.textContent || '');
            if (text.includes(wanted)) return true;
          }
        }
        return false;
      };
      const clickLikeUser = (el) => {
        if (!el) return false;
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          const EventClass = type.startsWith('pointer') ? PointerEvent : MouseEvent;
          el.dispatchEvent(new EventClass(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
          }));
        }
        return true;
      };
      const hidden = document.querySelector('input[name="insertionOrderId"]');
      let trigger = null;
      if (hidden) {
        let cur = hidden.parentElement;
        for (let depth = 0; cur && depth < 8 && !trigger; depth += 1, cur = cur.parentElement) {
          trigger = cur.querySelector?.('button[data-testid="uicl-multi-select-input-button"], button');
          if (trigger && !isVisible(trigger)) trigger = null;
        }
      }
      trigger ||= Array.from(document.querySelectorAll('button[data-testid="uicl-multi-select-input-button"]')).find(isVisible);
      const hasOpenDropdown = () => Array.from(document.querySelectorAll('div[data-testid="uicl-multi-select-dropdown"], div[data-testid="uicl-dropdown"], [role="listbox"]')).some(isVisible);
      if (trigger && !hasOpenDropdown()) {
        clickLikeUser(trigger);
        await sleep(800);
      }
      const optionNodes = Array.from(document.querySelectorAll(
        'div[data-testid="uicl-multi-select-dropdown"] li, div[data-testid="uicl-dropdown"] li, [role="listbox"] li, [role="option"], div.text-ellipsis',
      )).filter(isVisible);
      const textOf = (el) => String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      const textNode = optionNodes.find((el) => normalize(textOf(el)) === wanted)
        || optionNodes.find((el) => normalize(textOf(el)).includes(wanted));
      if (!textNode) return { ok: false, reason: 'option-not-found' };
      let target = textNode;
      for (let depth = 0; target && depth < 6; depth += 1) {
        const role = target.getAttribute?.('role');
        const tag = String(target.tagName || '').toLowerCase();
        if (role === 'option' || tag === 'li' || tag === 'button') break;
        target = target.parentElement;
      }
      target ||= textNode;
      clickLikeUser(target);
      await sleep(700);
      if (!isSelected()) {
        clickLikeUser(textNode);
        await sleep(700);
      }
      try {
        document.activeElement?.blur?.();
        document.body.click();
      } catch {}
      await sleep(500);
      return { ok: isSelected(), clicked: true };
    }, term).catch((error) => ({ ok: false, reason: error?.message || String(error) }));

    if (!confirmedByClick?.ok && !confirmedByClick?.clicked) {
      throw new Error(`Template Term was clicked but did not become selected: ${term}`);
    }
  }

  await page.playwright.keyboard.press('Tab').catch(() => {});
  await wait(page, 800);
  await emit(options, 'templateTerm', 'done', `Selected ${term}`);
}
async function chooseStartDate(page, date, options = {}) {
  await emit(options, 'startDate', 'running', '正在选择今天作为 Start Date');
  await page.playwright.locator('button[data-testid="uicl-date-input"]').first().click({ timeout: 30000 });
  await wait(page, 1000);
  await page.playwright.locator('td').filter({ hasText: new RegExp(`^${date.day}$`) }).first().click({ timeout: 30000 });
  await wait(page, 1000);
  await emit(options, 'startDate', 'done', `Start Date 已选择 ${date.year}-${date.month}-${date.day}`);
}

async function choosePartnerGroup(page, groupQuery, options = {}) {
  await emit(options, 'partnerGroup', 'running', `正在选择 ${groupQuery}`);
  const input = page.playwright.locator('input[data-testid="uicl-tag-input-text-input"]').first();
  await input.click({ timeout: 30000 });
  await input.fill(groupQuery);
  await wait(page, 1200);
  await input.press('ArrowDown');
  await wait(page, 300);
  await input.press('Enter');
  await wait(page, 1200);
  const hidden = await page.playwright.evaluate(() => document.querySelector('input[name="publisherIdsGroups"]')?.value || '');
  if (!/\["/.test(hidden)) throw new Error(`Partner Group 没有成功选中：${groupQuery}`);
  await emit(options, 'partnerGroup', 'done', `已选择 ${groupQuery}`);
}

async function fillMessage(page, message, options = {}) {
  await emit(options, 'message', 'running', '正在填写邀约消息');
  await page.playwright.locator('textarea[name="comment"], textarea').first().fill(message);
  await wait(page, 700);
  await emit(options, 'message', 'done', '邀约消息已填写');
}

async function clickToLegalConfirm(page, options = {}) {
  await emit(options, 'sendProposal', 'running', '正在点击 Send Proposal');
  await page.playwright.getByText('Send Proposal').click({ timeout: 30000 });
  await wait(page, 5000);
  const snapshot = typeof page.playwright.domSnapshot === 'function'
    ? await page.playwright.domSnapshot()
    : await page.playwright.locator('body').innerText({ timeout: 30000 }).catch(() => '');
  if (!/I understand/.test(snapshot)) throw new Error('没有出现 I understand 确认弹窗，请人工检查当前页面。');
  await emit(options, 'sendProposal', 'done', '已停在 I understand 最终确认前');
}

export async function prepareByName(name, options = {}) {
  await emit(options, 'listLookup', 'running', '正在匹配表格里的未绿勾名单');
  const partner = await findPartnerInList(name);
  if (!partner) {
    await emit(options, 'listLookup', 'failed', `未绿勾名单里找不到：${name}`);
    throw new Error(`未绿勾名单里找不到：${name}`);
  }

  const config = resolveTypeConfig(partner.type);
  if (!config) throw new Error(`没有 Type 映射：${partner.type}`);
  await emit(options, 'listLookup', 'done', `名单匹配成功：${partner.name}`, { partner });

  const page = options.page || await connectImpactTab();
  const search = await searchPartnerCard(page, partner, options);
  if (!search.found) {
    return { partner: partner.name, found: false, greenCheck: null, filled: false, status: 'Impact 未找到匹配对象' };
  }
  if (search.match.green && options.skipWhenGreen !== false) {
    return { partner: partner.name, matchedName: search.match.name, found: true, greenCheck: true, filled: false, status: '已是 prospects，不发送邀约' };
  }

  await openProposalForm(page, search.match.index, options);
  await chooseTemplateTerm(page, config.term, options);
  await chooseStartDate(page, todayInShanghai(), options);
  await choosePartnerGroup(page, config.groupQuery, options);
  await fillMessage(page, options.message || JMGO_MESSAGE, options);
  if (options.stopBeforeSendProposalButton !== true) {
    await clickToLegalConfirm(page, options);
  } else {
    await emit(options, 'sendProposal', 'waiting', '已填表，停在 Send Proposal 前');
  }

  return {
    partner: partner.name,
    matchedName: search.match.name,
    row: partner.row,
    source: partner.source,
    type: partner.type,
    found: true,
    greenCheck: false,
    filled: true,
    templateTerm: config.term,
    partnerGroupSearch: config.groupQuery,
    status: options.stopBeforeSendProposalButton === true ? '已填表，停在 Send Proposal 前' : '已填表，停在 I understand 最终确认前',
  };
}

export function mappings() {
  return TYPE_MAP;
}
