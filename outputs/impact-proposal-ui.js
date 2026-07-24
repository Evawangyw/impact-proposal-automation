const form = document.querySelector('#runForm');
const input = document.querySelector('#partnerName');
const runButton = document.querySelector('#runButton');
const stopBeforeSend = document.querySelector('#stopBeforeSend');
const health = document.querySelector('#health');
const jobStatus = document.querySelector('#jobStatus');
const stepsEl = document.querySelector('#steps');
const resultText = document.querySelector('#resultText');
const choicePanel = document.querySelector('#choicePanel');
const choiceHint = document.querySelector('#choiceHint');
const choiceOptions = document.querySelector('#choiceOptions');

const stateLabel = {
  waiting: '等待',
  running: '进行中',
  done: '完成',
  failed: '未通过',
};

let pollTimer = null;
let activeJobId = null;

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
  if (!choicePanel || !job.choiceRequest) {
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
  cancel.textContent = '都不是，停止这个任务';
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
    renderChoice({ choiceRequest: null });
    return;
  }
  choicePanel.hidden = true;
  await pollJob(jobId);
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (!data.automationConnected) {
      setBadge(health, '浏览器未连接', 'failed');
      return data;
    }
    setBadge(health, data.active ? '有任务运行中' : '已连接', data.active ? 'running' : 'done');
    return data;
  } catch {
    setBadge(health, '未连接', 'failed');
    return null;
  }
}

function finalText(job) {
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
  } else {
    setBadge(jobStatus, '失败', 'failed');
    returnToNameInput(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) {
    returnToNameInput(false);
    return;
  }

  window.clearTimeout(pollTimer);
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
  if (activeJobId) pollJob(activeJobId);
  checkHealth();
});

renderSteps();
checkHealth();
returnToNameInput(false);
