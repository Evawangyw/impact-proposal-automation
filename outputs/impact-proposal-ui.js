const form = document.querySelector('#runForm');
const input = document.querySelector('#partnerName');
const manualType = document.querySelector('#manualType');
const runButton = document.querySelector('#runButton');
const stopBeforeSend = document.querySelector('#stopBeforeSend');
const health = document.querySelector('#health');
const jobStatus = document.querySelector('#jobStatus');
const stepsEl = document.querySelector('#steps');
const resultText = document.querySelector('#resultText');
const choicePanel = document.querySelector('#choicePanel');
const choiceHint = document.querySelector('#choiceHint');
const choiceOptions = document.querySelector('#choiceOptions');
const partnerListText = document.querySelector('#partnerListText');
const partnerListFile = document.querySelector('#partnerListFile');
const matchButton = document.querySelector('#matchButton');
const queueMatchedButton = document.querySelector('#queueMatchedButton');
const skipQueueButton = document.querySelector('#skipQueueButton');
const pauseQueueButton = document.querySelector('#pauseQueueButton');
const resumeQueueButton = document.querySelector('#resumeQueueButton');
const stopQueueButton = document.querySelector('#stopQueueButton');
const batchStatus = document.querySelector('#batchStatus');
const matchSummary = document.querySelector('#matchSummary');
const matchResults = document.querySelector('#matchResults');

const stateLabel = {
  waiting: '等待',
  running: '进行中',
  done: '完成',
  failed: '未通过',
};

let pollTimer = null;
let activeJobId = null;
let batchJobIds = [];
let latestMatch = null;
let queuePaused = false;

const defaultSteps = [
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

function setBadge(el, text, cls) {
  el.className = `badge ${cls || 'muted'}`;
  el.textContent = text;
}

function setControlButtons({ active = false, paused = queuePaused } = {}) {
  if (!pauseQueueButton || !resumeQueueButton || !stopQueueButton) return;
  if (skipQueueButton) skipQueueButton.disabled = !active;
  pauseQueueButton.disabled = !active || paused;
  resumeQueueButton.disabled = !active || !paused;
  stopQueueButton.disabled = !active;
}

function renderSteps(steps = defaultSteps) {
  stepsEl.innerHTML = '';
  steps.forEach((step) => {
    const item = document.createElement('article');
    item.className = `step ${step.state || 'waiting'}`;
    item.innerHTML = `
      <div class="step-head">
        <div class="step-title"></div>
        <div class="dot" aria-hidden="true"></div>
      </div>
      <p class="step-message"></p>
    `;
    item.querySelector('.step-title').textContent = `${step.label} · ${stateLabel[step.state] || step.state}`;
    item.querySelector('.step-message').textContent = step.message || '等待开始';
    stepsEl.appendChild(item);
  });
}

function returnToNameInput(clearValue = false) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (clearValue) input.value = '';
  window.setTimeout(() => input.focus(), 250);
}

function renderChoice(job) {
  if (!choicePanel || !job?.choiceRequest) {
    if (choicePanel) choicePanel.hidden = true;
    return;
  }

  const request = job.choiceRequest;
  choicePanel.hidden = false;
  choiceHint.textContent = `Impact 搜到了多个结果，请选择和「${request.partnerName || job.name}」对应的联盟客。选完后任务会继续。`;
  choiceOptions.innerHTML = '';

  (request.candidates || []).forEach((candidate) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-option';
    button.dataset.choiceIndex = candidate.index;

    const name = document.createElement('strong');
    name.textContent = candidate.name || `结果 ${candidate.index + 1}`;
    const meta = document.createElement('span');
    meta.textContent = candidate.green ? '右上角有绿色勾' : '没有检测到绿色勾';
    button.append(name, meta);
    button.addEventListener('click', () => submitChoice(job.id, candidate.index));
    choiceOptions.appendChild(button);
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'choice-option cancel';
  cancel.textContent = '跳过当前，继续下一个';
  cancel.addEventListener('click', () => submitChoice(job.id, -1));
  choiceOptions.appendChild(cancel);
}

async function submitChoice(jobId, choiceIndex) {
  [...choiceOptions.querySelectorAll('button')].forEach((button) => {
    button.disabled = true;
  });
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/choice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ choiceIndex }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    resultText.textContent = data.error || '选择失败，请重试。';
    renderChoice(null);
    return;
  }
  choicePanel.hidden = true;
  if (batchJobIds.length) await pollBatch();
  else await pollJob(jobId);
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    queuePaused = Boolean(data.paused);
    const queueActive = batchJobIds.length > 0;
    setControlButtons({ active: queueActive, paused: queuePaused });

    if (!data.automationConnected) {
      setBadge(health, '浏览器未连接', 'failed');
      return data;
    }
    if (data.paused) {
      setBadge(health, `已暂停 · 队列 ${data.queued || 0}`, 'running');
      return data;
    }
    const text = data.active ? '有任务运行中' : data.queued ? `已连接 · 队列 ${data.queued}` : '已连接';
    setBadge(health, text, data.active ? 'running' : 'done');
    return data;
  } catch {
    setBadge(health, '未连接', 'failed');
    setControlButtons({ active: false });
    return null;
  }
}

function finalText(job) {
  if (job.status === 'cancelled') return `任务${job.error || '已停止'}。`;
  if (job.status === 'failed') return `任务失败：${job.error}`;
  if (job.status === 'waiting_choice') return '任务已暂停，请在上方选择正确的搜索结果。';
  if (job.status !== 'done') return '任务运行中，请看上面的步骤状态。';
  return JSON.stringify(job.result, null, 2);
}

async function pollJob(id) {
  const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`);
  const job = await res.json();
  renderSteps(job.steps);
  renderChoice(job);
  resultText.textContent = finalText(job);

  if (job.status === 'queued') {
    setBadge(jobStatus, '排队中', 'running');
    pollTimer = window.setTimeout(() => pollJob(id), 1200);
    return;
  }

  if (job.status === 'running') {
    setBadge(jobStatus, '运行中', 'running');
    pollTimer = window.setTimeout(() => pollJob(id), 1200);
    return;
  }

  if (job.status === 'waiting_choice') {
    setBadge(jobStatus, '等待你选择结果', 'running');
    pollTimer = window.setTimeout(() => pollJob(id), 1800);
    return;
  }

  activeJobId = null;
  runButton.disabled = false;
  await checkHealth();

  if (job.status === 'done') {
    setBadge(jobStatus, '已完成，可输入下一个', 'done');
    returnToNameInput(true);
  } else if (job.status === 'cancelled') {
    setBadge(jobStatus, '已停止', 'failed');
    returnToNameInput(false);
  } else {
    setBadge(jobStatus, '失败', 'failed');
    returnToNameInput(false);
  }
}

function renderBatchJobs(jobs) {
  const total = jobs.length;
  const done = jobs.filter((job) => job.status === 'done').length;
  const failed = jobs.filter((job) => job.status === 'failed').length;
  const cancelled = jobs.filter((job) => job.status === 'cancelled').length;
  const queued = jobs.filter((job) => job.status === 'queued').length;
  const completed = done + failed + cancelled;
  const active = jobs.find((job) => job.status === 'waiting_choice')
    || jobs.find((job) => job.status === 'running')
    || jobs.find((job) => job.status === 'queued')
    || jobs[jobs.length - 1];

  const badgeClass = failed || cancelled ? 'failed' : total === done ? 'done' : 'running';
  setBadge(batchStatus, `队列 ${completed}/${total}`, badgeClass);
  const headline = active?.status === 'waiting_choice'
    ? '等待你选择结果'
    : queuePaused
      ? `批量已暂停 · 待处理 ${queued}`
      : total === completed
        ? '批量完成'
        : `批量运行中 · 待处理 ${queued}`;
  setBadge(jobStatus, headline, total === completed ? (failed || cancelled ? 'failed' : 'done') : 'running');
  renderSteps(active?.steps || defaultSteps);
  renderChoice(active);

  const lines = jobs.map((job, index) => {
    const status = job.status === 'done' ? '完成'
      : job.status === 'failed' ? `失败：${job.error || ''}`
        : job.status === 'cancelled' ? (job.error || '已停止')
          : job.status === 'running' ? '运行中'
            : job.status === 'waiting_choice' ? '等待选择'
              : '排队中';
    return `${index + 1}. ${job.name} - ${status}`;
  });
  resultText.textContent = lines.join('\n');
}

async function pollBatch() {
  if (!batchJobIds.length) return;
  const res = await fetch(`/api/jobs?ids=${encodeURIComponent(batchJobIds.join(','))}`);
  const data = await res.json();
  const jobs = data.jobs || [];
  await checkHealth();
  renderBatchJobs(jobs);

  const stillRunning = jobs.some((job) => ['queued', 'running', 'waiting_choice'].includes(job.status));
  if (stillRunning) {
    pollTimer = window.setTimeout(pollBatch, 1500);
    return;
  }

  activeJobId = null;
  batchJobIds = [];
  setControlButtons({ active: false });
  runButton.disabled = false;
  queueMatchedButton.disabled = !latestMatch?.matched?.length;
  setBadge(jobStatus, '批量完成', jobs.some((job) => job.status === 'failed' || job.status === 'cancelled') ? 'failed' : 'done');
  returnToNameInput(false);
}

function renderMatch(result) {
  latestMatch = result;
  const matched = result.matched || [];
  const skippedRecruited = result.skippedRecruited || 0;
  const skippedPreview = (result.skippedRecruitedRows || [])
    .slice(0, 5)
    .map((item) => `${item.name} (行 ${item.row})`)
    .join('、');
  matchSummary.textContent = `导入后可邀约 ${result.importedCount} 个；已入驻/已发送跳过 ${skippedRecruited} 个；将加入队列 ${matched.length} 个。${skippedPreview ? ` 已跳过：${skippedPreview}${skippedRecruited > 5 ? ' 等' : ''}` : ''}`;
  queueMatchedButton.disabled = matched.length === 0;
  setBadge(batchStatus, matched.length ? `匹配 ${matched.length} 个` : '没有匹配项', matched.length ? 'done' : 'failed');

  matchResults.innerHTML = '';
  const matchedList = document.createElement('div');
  matchedList.className = 'match-list';
  matched.slice(0, 80).forEach((item) => {
    const row = document.createElement('article');
    row.className = 'match-item';
    row.innerHTML = `
      <strong></strong>
      <span></span>
    `;
    row.querySelector('strong').textContent = item.name;
    row.querySelector('span').textContent = `导入名：${item.importedName} · 类型：${item.importedType || item.type || '未提供'} · 匹配度 ${Math.round(item.score * 100)}% · ${item.source || ''} 行 ${item.row || ''}`;
    matchedList.appendChild(row);
  });
  matchResults.appendChild(matchedList);

  if (matched.length > 80) {
    const more = document.createElement('p');
    more.textContent = `还有 ${matched.length - 80} 个匹配项未显示，但会一起加入队列。`;
    matchResults.appendChild(more);
  }
}

async function sendControl(action) {
  const res = await fetch('/api/control', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '控制失败');
  await checkHealth();
  if (batchJobIds.length) await pollBatch();
  return data;
}

partnerListFile.addEventListener('change', async () => {
  const file = partnerListFile.files?.[0];
  if (!file) return;
  setBadge(batchStatus, '正在读取文件', 'running');
  partnerListText.value = await file.text();
  setBadge(batchStatus, '文件已读取', 'done');
});

matchButton.addEventListener('click', async () => {
  const text = partnerListText.value.trim();
  if (!text) {
    setBadge(batchStatus, '请先粘贴或选择名单', 'failed');
    return;
  }

  matchButton.disabled = true;
  queueMatchedButton.disabled = true;
  setControlButtons({ active: false });
  setBadge(batchStatus, '匹配中', 'running');
  matchSummary.textContent = '正在按导入名单本身判断待邀约对象。';
  matchResults.innerHTML = '';
  try {
    const res = await fetch('/api/match-partners', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '匹配失败');
    renderMatch(data);
  } catch (error) {
    setBadge(batchStatus, '匹配失败', 'failed');
    matchSummary.textContent = error.message || String(error);
  } finally {
    matchButton.disabled = false;
  }
});

queueMatchedButton.addEventListener('click', async () => {
  const matched = latestMatch?.matched || [];
  if (!matched.length) return;
  window.clearTimeout(pollTimer);
  queueMatchedButton.disabled = true;
  runButton.disabled = true;
  setControlButtons({ active: true, paused: false });
  setBadge(batchStatus, '加入队列中', 'running');
  resultText.textContent = '正在创建批量任务。';

  try {
    const healthState = await checkHealth();
    if (!healthState?.automationConnected) {
      throw new Error('独立 Chrome 没有连接。请先启动 runner，并在弹出的 Chrome 里登录 Impact。');
    }
    const res = await fetch('/api/run-batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        names: matched.map((item) => ({
          name: item.name,
          importedName: item.importedName,
          importedType: item.importedType || '',
          row: item.row || null,
          manualType: item.importedType || manualType.value.trim(),
        })),
        stopBeforeSendProposalButton: stopBeforeSend.checked,
        manualType: manualType.value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '批量任务启动失败');
    batchJobIds = (data.jobs || []).map((job) => job.id);
    activeJobId = batchJobIds[0] || null;
    setControlButtons({ active: true, paused: false });
    await pollBatch();
  } catch (error) {
    setBadge(batchStatus, '启动失败', 'failed');
    resultText.textContent = error.message || String(error);
    runButton.disabled = false;
    queueMatchedButton.disabled = !latestMatch?.matched?.length;
    setControlButtons({ active: false });
  }
});

pauseQueueButton?.addEventListener('click', async () => {
  setControlButtons({ active: true, paused: true });
  setBadge(batchStatus, '暂停中', 'running');
  try {
    await sendControl('pause');
    resultText.textContent = `${resultText.textContent}\n\n已暂停：当前正在跑的这个会先停在下一个检查点，后面的队列暂不继续。`;
  } catch (error) {
    resultText.textContent = error.message || String(error);
  }
});

resumeQueueButton?.addEventListener('click', async () => {
  setControlButtons({ active: true, paused: false });
  setBadge(batchStatus, '继续中', 'running');
  try {
    await sendControl('resume');
  } catch (error) {
    resultText.textContent = error.message || String(error);
  }
});

skipQueueButton?.addEventListener('click', async () => {
  setControlButtons({ active: true, paused: false });
  setBadge(batchStatus, '跳过当前中', 'running');
  try {
    await sendControl('skip');
    resultText.textContent = `${resultText.textContent}\n\n已发送跳过：当前联盟客会标记为已跳过，队列会继续下一个。`;
  } catch (error) {
    resultText.textContent = error.message || String(error);
  }
});

stopQueueButton?.addEventListener('click', async () => {
  setControlButtons({ active: true, paused: false });
  setBadge(batchStatus, '停止中', 'running');
  try {
    await sendControl('stop');
    resultText.textContent = `${resultText.textContent}\n\n已发送停止：排队中的任务会立即取消，正在跑的任务会在下一个检查点停下。`;
  } catch (error) {
    resultText.textContent = error.message || String(error);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) {
    returnToNameInput(false);
    return;
  }

  window.clearTimeout(pollTimer);
  batchJobIds = [];
  setControlButtons({ active: false });
  choicePanel.hidden = true;
  runButton.disabled = true;
  setBadge(jobStatus, '启动中', 'running');
  resultText.textContent = '正在启动任务。';
  renderSteps();

  try {
    const healthState = await checkHealth();
    if (!healthState?.automationConnected) {
      throw new Error('独立 Chrome 没有连接。请先从 Windows 本地启动 start-impact-proposal-runner.cmd，并在弹出的 Chrome 里登录 Impact。');
    }
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        stopBeforeSendProposalButton: stopBeforeSend.checked,
        manualType: manualType.value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '启动失败');
    activeJobId = data.id;
    await pollJob(data.id);
  } catch (error) {
    activeJobId = null;
    setBadge(jobStatus, '失败', 'failed');
    resultText.textContent = error.message || String(error);
    runButton.disabled = false;
    returnToNameInput(false);
  }
});

window.addEventListener('focus', () => {
  if (batchJobIds.length) pollBatch();
  else if (activeJobId) pollJob(activeJobId);
  checkHealth();
});

renderSteps();
setControlButtons({ active: false });
checkHealth();
returnToNameInput(false);
