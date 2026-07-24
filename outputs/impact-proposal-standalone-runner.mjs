import * as uiServer from './impact-proposal-ui-server.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const PORT = Number(process.env.IMPACT_PROPOSAL_PORT || 8798);
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PLAYWRIGHT_ENTRY = 'file:///C:/Users/eva.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js';
const USER_DATA_DIR = process.env.IMPACT_PROPOSAL_PROFILE
  || `${ROOT}/work/impact-automation-chrome-profile-${PORT}`;
const MARKETPLACE_URL = 'https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=all&partnerStatuses=1&relationshipInclusions=prospecting%2Cjoined&sortBy=reachRating&sortOrder=DESC';

function adaptPage(page) {
  return {
    playwright: page,
    goto: (...args) => page.goto(...args),
  };
}

async function findOrCreatePage(context, predicate, fallbackUrl) {
  let page = context.pages().find(predicate);
  if (!page) {
    page = await context.newPage();
    await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((error) => {
      console.warn('[runner] Page did not finish loading:', error?.message || error);
    });
  }
  return page;
}

async function main() {
  const playwright = await import(PLAYWRIGHT_ENTRY);
  const { chromium } = playwright.default || playwright;
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    executablePath: CHROME_PATH,
    headless: false,
    viewport: { width: 1180, height: 820 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const ui = await uiServer.startImpactProposalUi(PORT);
  const impactPage = context.pages().find((page) => /impact\.com/i.test(page.url()))
    || await context.newPage();
  uiServer.setAutomationPage(adaptPage(impactPage));
  await impactPage.goto(MARKETPLACE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((error) => {
    console.warn('[runner] Impact page did not finish loading. Log in or refresh the Chrome tab if needed:', error?.message || error);
  });
  await findOrCreatePage(context, (page) => page.url().startsWith(ui.url), ui.url);
  uiServer.setAutomationPage(adaptPage(impactPage));

  console.log(`Impact proposal UI: ${ui.url}`);
  console.log('Chrome profile:', USER_DATA_DIR);
  console.log('Keep this window open. Log in to Impact in the Chrome window if needed.');

  setInterval(() => {
    uiServer.processQueuedJobs().catch((error) => {
      console.error('[runner]', error?.message || error);
    });
  }, 800);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
