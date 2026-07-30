import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as workflow from './impact-proposal-workflow-ui.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const jobs = new Map();
let activeJobId = null;
let currentUiUrl = 'http://127.0.0.1:8787/';
let automationPage = null;
let workerTimer = null;
let queuePaused = false;
let stopRequested = false;

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function newSteps() {
  return [
    { key: 'listLookup', label: '名单匹配', state: 'waiting', message: '等待开始' },
    { key: 'impactSearch', label: 'Impact 搜索', state: 'waiting', message: '等待开始' },
    { key: 'greenCheck', label: '绿勾判断', state: 'waiting', message: '等待开始' },
    { key: 'proposalForm', label: '打开表单', state: 'waiting', message: '等待开始' },
    { key: 'templateTerm', label: 'Template Term', state: 'waiting', message: '等待开始' },
    { key: 'startDate', label: 'Start Date', state: 'waiting', message: '等待开始' },
    { key: 'partnerGroup', label: 'Partner Group', state: 'waiting', message: '等待开始' },
    { key: 'message', label: 'Message', state: 'waiting', message: '等待开始' },
    { key: 'sendProposal', label: '发送前确认', state: 'waiting', message: '等待开始' },
  ];
}

function createJob(name, options = {}) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const job = {
    id,
    name,
    options,
    batchId: options.batchId || null,
    importedName: options.importedName || null,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: newSteps(),
    events: [],
    result: null,
    error: null,
    choiceRequest: null,
    choiceResolver: null,
    cancelled: false,
  };
  jobs.set(id, job);
  return job;
}

function publicJob(job) {
  return {
    id: job.id,
    name: job.name,
    importedName: job.importedName,
    batchId: job.batchId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    steps: job.steps,
    events: job.events,
    result: job.result,
    error: job.error,
    choiceRequest: job.choiceRequest || null,
    cancelled: Boolean(job.cancelled),
  };
}

function updateJob(job, event) {
  job.updatedAt = new Date().toISOString();
  job.events.push(event);
  const step = job.steps.find((item) => item.key === event.key);
  if (step) {
    step.state = event.state;
    step.message = event.message || step.message;
    step.extra = event;
  }
}

async function returnToUiTab() {
  try {
    if (!globalThis.agent?.browsers) return false;
    const browsers = await agent.browsers.list();
    const iab = browsers.find((item) => item.type === 'iab') || browsers[0];
    if (!iab) return false;
    const browser = await agent.browsers.get(iab.id);
    const tabs = await browser.user.openTabs();
    const uiTab = tabs.find((tab) => tab.url === currentUiUrl)
      || tabs.find((tab) => tab.url?.startsWith(currentUiUrl.replace(/\/$/, '')));
    if (!uiTab) return false;
    await browser.user.claimTab(uiTab.id);
    return true;
  } catch {
    return false;
  }
}

function waitForJobChoice(job, payload) {
  const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  job.status = 'waiting_choice';
  job.choiceRequest = { id: requestId, ...payload };
  job.updatedAt = new Date().toISOString();
  return new Promise((resolve) => {
    job.choiceResolver = resolve;
  });
}

async function runJob(job) {
  activeJobId = job.id;
  job.status = 'running';
  job.updatedAt = new Date().toISOString();
  try {
    const result = await workflow.prepareByName(job.name, {
      page: automationPage || undefined,
      stopBeforeSendProposalButton: Boolean(job.options.stopBeforeSendProposalButton),
      manualType: job.options.manualType || '',
      partnerOverride: job.options.partnerOverride || null,
      shouldStop: () => stopRequested || job.cancelled,
      shouldPause: () => queuePaused && !stopRequested && !job.cancelled,
      skipWhenGreen: true,
      onStep: (event) => updateJob(job, event),
      requestChoice: (payload) => waitForJobChoice(job, payload),
    });
    job.status = 'done';
    job.choiceRequest = null;
    job.choiceResolver = null;
    job.result = result;
  } catch (error) {
    const stopped = /stopped by user/i.test(error?.message || '');
    job.status = stopped ? 'cancelled' : 'failed';
    job.choiceRequest = null;
    job.choiceResolver = null;
    job.cancelled = stopped;
    job.error = stopped ? (job.error || '已停止') : error?.message || String(error);
  } finally {
    job.updatedAt = new Date().toISOString();
    if (activeJobId === job.id) activeJobId = null;
    await returnToUiTab();
  }
}

export async function processQueuedJobs() {
  if (activeJobId) return { processed: false, activeJobId };
  if (queuePaused) return { processed: false, paused: true };
  const job = [...jobs.values()].find((item) => item.status === 'queued');
  if (!job) return { processed: false };
  await runJob(job);
  return { processed: true, jobId: job.id, status: job.status };
}

export function setAutomationPage(page) {
  automationPage = page;
  return { ok: true };
}

export async function runLiveRunner(durationMs = 600000) {
  const startedAt = Date.now();
  let processed = 0;
  while (Date.now() - startedAt < durationMs) {
    const result = await processQueuedJobs();
    if (result.processed) processed += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { ok: true, processed, durationMs };
}

export function startBackgroundWorker(intervalMs = 800) {
  if (workerTimer) return { ok: true, alreadyRunning: true };
  workerTimer = setInterval(() => {
    processQueuedJobs().catch((error) => {
      console.error('[worker]', error?.message || error);
    });
  }, intervalMs);
  workerTimer.unref?.();
  return { ok: true, intervalMs };
}

async function serveFile(res, file) {
  const body = await readFile(`${ROOT}/${file}`);
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'text/plain; charset=utf-8' });
  res.end(body);
}

function jobList(url) {
  const ids = (url.searchParams.get('ids') || '').split(',').map((id) => id.trim()).filter(Boolean);
  const source = ids.length ? ids.map((id) => jobs.get(id)).filter(Boolean) : [...jobs.values()];
  return source.map(publicJob);
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'OPTIONS') return json(res, 204, {});
      if (req.method === 'GET' && url.pathname === '/') return serveFile(res, 'impact-proposal-ui.html');
      if (req.method === 'GET' && url.pathname === '/impact-proposal-ui.css') return serveFile(res, 'impact-proposal-ui.css');
      if (req.method === 'GET' && url.pathname === '/impact-proposal-ui.js') return serveFile(res, 'impact-proposal-ui.js');

      if (req.method === 'GET' && url.pathname === '/api/health') {
        const queued = [...jobs.values()].filter((job) => job.status === 'queued').length;
        return json(res, 200, {
          ok: true,
          active: activeJobId,
          queued,
          paused: queuePaused,
          stopRequested,
          automationConnected: Boolean(automationPage),
          mappings: workflow.mappings(),
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        return json(res, 200, { jobs: jobList(url) });
      }

      if (req.method === 'POST' && url.pathname === '/api/run') {
        if (activeJobId) return json(res, 409, { error: '当前已有任务在运行，请等它结束后再开始下一个。', activeJobId });
        const body = await readBody(req);
        const name = String(body.name || '').trim();
        if (!name) return json(res, 400, { error: '请输入联盟客名字。' });
        const job = createJob(name, {
          stopBeforeSendProposalButton: body.stopBeforeSendProposalButton,
          manualType: body.manualType || '',
        });
        return json(res, 200, publicJob(job));
      }

      if (req.method === 'POST' && url.pathname === '/api/control') {
        const body = await readBody(req);
        const action = String(body.action || '').trim();
        if (action === 'pause') {
          queuePaused = true;
          return json(res, 200, { ok: true, paused: queuePaused, stopRequested });
        }
        if (action === 'resume') {
          queuePaused = false;
          stopRequested = false;
          return json(res, 200, { ok: true, paused: queuePaused, stopRequested });
        }
        if (action === 'skip') {
          queuePaused = false;
          const job = activeJobId ? jobs.get(activeJobId) : null;
          if (job) {
            job.cancelled = true;
            job.error = '已跳过';
            job.updatedAt = new Date().toISOString();
            if (typeof job.choiceResolver === 'function') {
              job.choiceResolver({ choiceIndex: -1 });
            }
          }
          return json(res, 200, { ok: true, skipped: Boolean(job), paused: queuePaused, stopRequested });
        }
        if (action === 'stop') {
          stopRequested = true;
          queuePaused = false;
          for (const job of jobs.values()) {
            if (job.status === 'queued') {
              job.status = 'cancelled';
              job.cancelled = true;
              job.error = '已停止';
              job.updatedAt = new Date().toISOString();
            }
          }
          return json(res, 200, { ok: true, paused: queuePaused, stopRequested });
        }
        return json(res, 400, { error: 'Unknown control action.' });
      }

      if (req.method === 'POST' && url.pathname === '/api/match-partners') {
        const body = await readBody(req);
        const result = await workflow.matchImportedPartnerNames(body.text || body.names || '');
        return json(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/api/run-batch') {
        if (activeJobId) return json(res, 409, { error: '当前已有任务在运行，请等它结束后再导入批量任务。', activeJobId });
        const body = await readBody(req);
        stopRequested = false;
        queuePaused = false;
        const names = Array.isArray(body.names) ? body.names : [];
        if (!names.length) return json(res, 400, { error: '没有可加入队列的匹配对象。' });
        const batchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const created = names
          .map((item) => (typeof item === 'string' ? { name: item } : item))
          .filter((item) => String(item.name || '').trim())
          .map((item) => createJob(String(item.name).trim(), {
            batchId,
            importedName: item.importedName || null,
            stopBeforeSendProposalButton: body.stopBeforeSendProposalButton,
            manualType: item.manualType || item.importedType || body.manualType || '',
            partnerOverride: {
              name: String(item.name).trim(),
              type: item.importedType || item.manualType || body.manualType || '',
              source: 'import',
              row: item.row || null,
            },
          }));
        return json(res, 200, { batchId, jobs: created.map(publicJob) });
      }

      if (req.method === 'POST' && url.pathname.match(/^\/api\/jobs\/[^/]+\/choice$/)) {
        const id = decodeURIComponent(url.pathname.split('/')[3]);
        const job = jobs.get(id);
        if (!job) return json(res, 404, { error: 'Job not found.' });
        if (job.status !== 'waiting_choice' || typeof job.choiceResolver !== 'function') {
          return json(res, 409, { error: 'This job is not waiting for a selection.' });
        }
        const body = await readBody(req);
        const choiceIndex = Number(body.choiceIndex);
        const resolver = job.choiceResolver;
        job.choiceResolver = null;
        job.choiceRequest = null;
        job.status = 'running';
        job.updatedAt = new Date().toISOString();
        resolver({ choiceIndex });
        return json(res, 200, { ok: true });
      }

      if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
        const id = decodeURIComponent(url.pathname.split('/').pop());
        const job = jobs.get(id);
        if (!job) return json(res, 404, { error: '没有找到这个任务。' });
        return json(res, 200, publicJob(job));
      }

      return json(res, 404, { error: 'Not found' });
    } catch (error) {
      return json(res, 500, { error: error?.message || String(error) });
    }
  });
}

export async function startImpactProposalUi(port = 8787) {
  if (globalThis.__impactProposalUiServer) {
    await new Promise((resolve) => globalThis.__impactProposalUiServer.close(resolve));
    globalThis.__impactProposalUiServer = null;
  }
  const server = createServer();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  globalThis.__impactProposalUiServer = server;
  currentUiUrl = `http://127.0.0.1:${port}/`;
  startBackgroundWorker();
  return { url: currentUiUrl, port };
}

export async function stopImpactProposalUi() {
  if (!globalThis.__impactProposalUiServer) return { stopped: false };
  await new Promise((resolve) => globalThis.__impactProposalUiServer.close(resolve));
  globalThis.__impactProposalUiServer = null;
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  return { stopped: true };
}
