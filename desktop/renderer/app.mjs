// Keep the accessible skip action inside the trusted document URL.
document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#proposal')?.focus();
});
import {
  MODES, SEAT_STATUS, MEETING_STATUS, PHASES, EVENT_KINDS, createSession,
  emptyState, isRunning, startBlocker, reportView, actorName, formatDate, seatDisplayDetail,
} from './model.mjs';
import { renderSynthesisView } from './synthesis-view.mjs';

const $ = (id) => document.getElementById(id);
const node = (tag, className = '', text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (text, action, id, className = 'button quiet') => {
  const element = node('button', className, text);
  element.type = 'button';
  element.dataset.action = action;
  if (id !== undefined) element.dataset.id = id;
  element.dataset.focusKey = `${action}:${id || ''}`;
  return element;
};
const pill = (text, tone = 'muted') => node('span', `status-badge ${tone}`, text);
let state = emptyState();
let connected = false;
let pending = new Set();
let activeTab = 'outcome';
let eventLimit = 40;
let lastMeetingId = null;
let previousStatus = null;
let restorePreview = null;
function showRestorePreview(result) {
  restorePreview = result?.selected ? result : null;
  const label = $('restore-preview');
  const button = $('confirm-restore');
  if (!restorePreview) {
    label.textContent = '';
    label.hidden = true;
    button.hidden = true;
    button.disabled = true;
    return;
  }
  label.textContent = '备份校验通过：共 ' + restorePreview.meetingCount + ' 场会议，可新增 '
    + restorePreview.newMeetings + ' 场，跳过已有 '
    + restorePreview.existingMeetings + ' 场。忽略 '
    + restorePreview.ignoredSeatBookmarks
    + ' 个席位书签，不恢复 Cookie 或网页登录。'
    + (restorePreview.excludedDamagedInSource > 0
      ? ' 注意：源备份未包含 ' + restorePreview.excludedDamagedInSource + ' 份受损历史。' : '')
    + ' 点击确认还会出现系统确认框。';
  label.hidden = false;
  button.hidden = restorePreview.newMeetings === 0;
  button.disabled = restorePreview.newMeetings === 0 || !connected || state.busy || pending.size > 0;
}
let lastAnnouncement = '';
const fingerprints = new Map();

function changed(key, value) {
  const next = JSON.stringify(value);
  if (fingerprints.get(key) === next) return false;
  fingerprints.set(key, next);
  return true;
}

function message(text, error = true) {
  $('feedback-text').textContent = text;
  $('feedback-text').setAttribute('role', error ? 'alert' : 'status');
  $('feedback').classList.toggle('is-error', error);
  $('feedback').hidden = false;
  const backupStatus = $('backup-status');
  if (backupStatus && $('history-dialog').open && !error && /备份/.test(text)) {
    backupStatus.textContent = text;
    backupStatus.hidden = false;
  }
  for (const name of ['provider', 'history']) {
    const target = $(`${name}-error`);
    target.textContent = error && $(`${name}-dialog`).open ? text : '';
    target.hidden = !target.textContent;
  }
}

function clearMessage() {
  $('feedback').hidden = true;
  $('feedback-text').textContent = '';
  for (const name of ['provider', 'history']) $(`${name}-error`).hidden = true;
  $('backup-status').hidden = true;
  $('backup-status').textContent = '';
}

const session = createSession({
  bridge: window.chatChat,
  onChange(snapshot) {
    state = snapshot.state;
    connected = snapshot.connected;
    pending = snapshot.pending;
    render();
  },
  onError: (text) => message(text),
  onNotice: (text) => message(text, false),
  onRestorePreview: (result) => showRestorePreview(result),
});

function unavailableForRoster() { return !connected || pending.size > 0 || state.busy || isRunning(state); }
function unavailableForBrowser() { return unavailableForRoster() || !state.runtime.available; }

function makeSeat(seat, index) {
  const card = node('article', `seat-card seat-tone-${index % 4}`);
  card.tabIndex = -1;
  card.setAttribute('aria-label', `${seat.name} 席位`);
  const top = node('div', 'seat-card-top');
  const avatar = node('span', 'seat-avatar', String(seat.name || 'AI').slice(0, 2));
  avatar.setAttribute('aria-hidden', 'true');
  const heading = node('div', 'seat-identity');
  heading.append(node('h3', '', seat.name), node('span', 'seat-number', `平等席位 ${String(index + 1).padStart(2, '0')}`));
  top.append(avatar, heading);
  const [label, tone] = SEAT_STATUS[seat.status] || ['状态未知', 'warning'];
  const status = pill(label, tone);
  const detail = node('p', 'seat-detail', seatDisplayDetail(seat) || (seat.status === 'ready' ? '已通过当前连接检查。' : '在浏览器窗口完成登录，再检查状态。'));
  const actions = node('div', 'seat-actions');
  const open = button('登录 / 打开', 'openSeat', seat.id);
  const check = button('检查', 'checkSeat', seat.id);
  const remove = button('移除', 'removeSeat', seat.id, 'button quiet remove-seat');
  open.setAttribute('aria-label', `登录或打开 ${seat.name}`);
  check.setAttribute('aria-label', `检查 ${seat.name} 的就绪状态`);
  remove.setAttribute('aria-label', `移除 ${seat.name} 席位`);
  actions.append(open, check, remove);
  card.append(top, status, detail, actions);
  if (Array.isArray(state.meeting?.participatingSeatIds)
    && !state.meeting.participatingSeatIds.includes(seat.id)) {
    card.append(pill('本次未参与', 'muted'));
  }
  return card;
}

function makeEmptySeat(index) {
  const card = button('', 'invite', String(index), 'empty-seat');
  card.setAttribute('aria-label', '邀请一个独立 AI 入席');
  card.append(node('span', 'empty-seat-mark', '＋'), node('strong', '', '留一个不同的声音'), node('span', '', '邀请 AI 入席'));
  return card;
}

function renderSeats() {
  if (changed('seats', [state.seats, state.meeting?.id, state.meeting?.participatingSeatIds])) {
    const roof = document.createDocumentFragment();
    const left = document.createDocumentFragment();
    const right = document.createDocumentFragment();
    const count = Math.max(4, state.seats.length);
    for (let i = 0; i < count; i++) {
      const card = state.seats[i] ? makeSeat(state.seats[i], i) : makeEmptySeat(i);
      (i < 2 ? roof : i % 2 === 0 ? left : right).append(card);
    }
    $('seats-roof').replaceChildren(roof);
    $('seats-left').replaceChildren(left);
    $('seats-right').replaceChildren(right);
  }
  for (const element of document.querySelectorAll('.seat-card button, .empty-seat')) {
    element.disabled = element.dataset.action === 'removeSeat' ? unavailableForRoster() : unavailableForBrowser();
  }
  const ready = state.seats.filter((seat) => seat.status === 'ready').length;
  $('seat-count').textContent = `${state.seats.length} / 8 席 · ${ready} 个就绪`;
  $('step-add').classList.toggle('is-done', state.seats.length >= 2);
  $('step-login').classList.toggle('is-done', ready >= 2);
  $('step-start').classList.toggle('is-done', Boolean(state.meeting));
}

function emptyPanel(title, description, kind = '') {
  const wrap = node('div', `empty-panel ${kind}`);
  const graphic = node('div', 'table-symbol');
  graphic.setAttribute('aria-hidden', 'true');
  graphic.append(node('i'), node('i'), node('i'), node('i'), node('span', '', '聊'));
  wrap.append(graphic, node('h3', '', title), node('p', '', description));
  return wrap;
}

function positionCard(position, { failed = false, dissent = false } = {}) {
  const article = node('article', `position-card${failed ? ' failed-position' : dissent ? ' dissent-position' : ''}`);
  const top = node('div', 'position-heading');
  top.append(node('h4', '', position.participant?.name || '历史席位'));
  if (failed) top.append(pill('未取得真实最终立场', 'error'));
  else if (dissent) top.append(pill('保留不同意见', 'warning'));
  else top.append(pill('最终立场', 'muted'));
  article.append(top);
  if (failed) article.append(node('p', 'failure-explanation', '这是运行失败记录，不作为该 AI 的主张或一致意见计数。'));
  if (position.stance) article.append(node('p', 'position-stance', position.stance));
  article.append(node('p', 'model-text', position.content || '未记录内容。'));
  if (Array.isArray(position.caveats) && position.caveats.length) {
    const caveats = node('div', 'caveats');
    caveats.append(node('strong', '', '保留条件'));
    const list = node('ul');
    for (const caveat of position.caveats) list.append(node('li', '', caveat));
    caveats.append(list);
    article.append(caveats);
  }
  return article;
}

function renderOutcome() {
  const meeting = state.meeting;
  if (!changed('outcome', [meeting?.id, meeting?.status, meeting?.phase, meeting?.round, meeting?.report,
    meeting?.events?.filter((event) => event.kind === 'final_position'), state.runtime.available, connected,
    meeting?.synthesis, state.synthesisAvailable, [...pending]])) return;
  const target = $('panel-outcome');
  const report = reportView(meeting?.report);
  if (!meeting) {
    target.replaceChildren(emptyPanel(connected ? '一个提案，多种视角' : '桌面连接尚未就绪',
      connected ? '邀请不同的 AI，围绕同一个问题独立思考、相互质疑。这里将呈现真实观点与仍未解决的分歧。' : '请从已安装的 ChatChat 桌面应用打开。连接成功前无法添加席位或开始讨论。'));
    return;
  }
  const fragment = document.createDocumentFragment();
  if (!report) {
    const running = isRunning(state);
    fragment.append(emptyPanel(running ? (PHASES[meeting.phase] || '正在准备讨论') : '尚未形成完整报告',
      running ? '各方真实发言会出现在「讨论过程」。最终立场将在本次讨论结束后汇集于此。' : '已有讨论仍可回看和导出。停止或失败不会被呈现为达成一致。', running ? 'is-working' : ''));
    const finals = (meeting.events || []).filter((event) => event.kind === 'final_position');
    if (finals.length) {
      fragment.append(node('h3', 'section-title', '已记录的最终发言 · 非完整报告'));
      for (const event of finals) fragment.append(positionCard({ ...event, participant: { name: actorName(state, event.actorId) } }, { failed: event.provenance?.source === 'runtime_fallback' }));
    }
  } else {
    fragment.append(renderSynthesisView({ meeting, state, actorName, node, pill, button }));
    const summary = node('div', 'outcome-summary');
    summary.append(node('p', 'eyebrow', '本次讨论 · 实际记录'), node('h3', '', !report.authored.length ? '未取得真实最终立场' : report.stance ? '观点已汇集，判断留给你' : '本次未形成共同倾向'));
    if (report.stance) {
      summary.append(node('p', 'secondary', '报告中的共同倾向'), node('p', 'summary-stance', report.stance));
    }
    const counts = node('div', 'outcome-counts');
    counts.append(pill(`${report.authored.length} 个实际最终立场`), pill(`${report.dissent.length} 个不同意见`, report.dissent.length ? 'warning' : 'muted'));
    if (report.failed.length) counts.append(pill(`${report.failed.length} 个失败席位`, 'error'));
    summary.append(counts, node('p', 'summary-note', '一致程度描述观点分布，不代表事实正确；模型自评置信度也不是证据。'));
    fragment.append(summary);
    if (report.unanswered) fragment.append(node('p', 'unanswered-note', `仍有 ${report.unanswered} 条直接追问或质疑未记录到结构化回应。`));
    fragment.append(node('h3', 'section-title', '各方最终立场'));
    if (!report.authored.length) fragment.append(node('p', 'secondary', '本次未取得任何真实最终立场。'));
    for (const position of report.authored) fragment.append(positionCard(position, { dissent: report.isDissent(position) }));
    if (report.failed.length) {
      fragment.append(node('h3', 'section-title failure-title', '未完成的席位'));
      for (const position of report.failed) fragment.append(positionCard(position, { failed: true }));
    }
  }
  target.replaceChildren(fragment);
}

function renderDiscussion() {
  const events = state.meeting?.events || [];
  if (!changed('events', [state.meeting?.id, events, eventLimit, state.meeting?.report?.positions, state.seats.map((seat) => [seat.id, seat.name])])) return;
  const target = $('panel-discussion');
  if (!events.length) {
    target.replaceChildren(emptyPanel('每一轮，都有迹可循', isRunning(state) ? '等待首批发言。首轮保持独立，随后各方基于共同记录交流。' : '讨论开始后，这里会依次记录观点、证据、质疑和修正。'));
    return;
  }
  const wasAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 48;
  const scrollTop = target.scrollTop;
  const fragment = document.createDocumentFragment();
  if (events.length > eventLimit) fragment.append(button(`显示更早的 ${Math.min(40, events.length - eventLimit)} 条发言（共 ${events.length} 条）`, 'moreEvents', '', 'button secondary-button more-events'));
  const list = node('ol', 'discussion-list');
  for (const event of events.slice(-eventLimit)) {
    const item = node('li', `event-card${event.provenance?.source === 'runtime_fallback' ? ' failed-event' : ''}`);
    item.dataset.eventId = String(event.id);
    const heading = node('div', 'event-heading');
    heading.append(node('strong', '', actorName(state, event.actorId)), node('span', 'secondary', `第 ${event.round} 轮`), pill(EVENT_KINDS[event.kind] || '讨论记录'));
    item.append(heading);
    if (event.provenance?.source === 'runtime_fallback') item.append(node('p', 'failure-explanation', '运行失败记录 · 并非 AI 的实际观点'));
    if (event.stance) item.append(node('p', 'position-stance', event.stance));
    if (event.claim) item.append(node('p', 'evidence-claim', event.claim));
    item.append(node('p', 'model-text', event.content || '未记录内容。'));
    if (event.source) item.append(node('p', 'event-source', `提供的来源（未在此核验）：${event.source}`));
    if (Array.isArray(event.caveats) && event.caveats.length) {
      const list = node('ul', 'caveats');
      for (const caveat of event.caveats) list.append(node('li', '', caveat));
      item.append(list);
    }
    list.append(item);
  }
  fragment.append(list);
  target.replaceChildren(fragment);
  target.scrollTop = wasAtBottom ? target.scrollHeight : scrollTop;
}

function renderProviders() {
  if (changed('providers', [state.providers, state.seats.map((seat) => seat.providerId)])) {
    const fragment = document.createDocumentFragment();
    for (const provider of state.providers) {
      const added = state.seats.some((seat) => seat.providerId === provider.id);
      const option = button('', 'addProvider', provider.id, 'provider-option');
      option.dataset.added = String(added);
      const avatar = node('span', 'provider-avatar', String(provider.name).slice(0, 2));
      avatar.setAttribute('aria-hidden', 'true');
      const description = node('div', 'provider-description');
      description.append(node('strong', '', provider.name), node('span', '', provider.automation === 'experimental' ? '实验性自动操作 · 需登录检查' : '手动网站 · 自动讨论未验证'));
      option.append(avatar, description, node('span', 'provider-add', added ? '已入席' : '＋'));
      option.setAttribute('aria-label', `${added ? '已添加' : '添加'} ${provider.name}`);
      fragment.append(option);
    }
    if (!state.providers.length) fragment.append(node('p', 'secondary', '连接桌面应用后显示可选择的来源。'));
    $('provider-list').replaceChildren(fragment);
  }
  for (const option of $('provider-list').querySelectorAll('button')) option.disabled = unavailableForBrowser() || state.seats.length >= 8 || option.dataset.added === 'true';
  $('custom-add').disabled = unavailableForBrowser() || state.seats.length >= 8;
  $('custom-url').disabled = unavailableForBrowser();
}

function renderHistory() {
  const query = $('history-search').value.trim().toLocaleLowerCase();
  if (changed('history', [state.history, query, state.meeting?.id])) {
    const fragment = document.createDocumentFragment();
    const items = state.history.filter((item) => String(item.proposal || '').toLocaleLowerCase().includes(query));
    for (const item of items) {
      const article = node('article', 'history-item');
      const heading = node('div', 'history-item-heading');
      heading.append(pill(MEETING_STATUS[item.status] || '已保存'), node('time', 'secondary', formatDate(item.updatedAt)));
      if (item.id === state.meeting?.id) heading.append(node('span', 'secondary', '当前查看'));
      const title = node('h3', '', item.proposal || '未命名提案');
      const actions = node('div', 'history-actions');
      actions.append(button('加载记录', 'loadMeeting', item.id, 'button secondary-button'), button('导出', 'exportMeeting', item.id));
      article.append(heading, title, actions);
      fragment.append(article);
    }
    if (!items.length) fragment.append(node('p', 'history-empty', query ? '没有匹配的提案。' : '还没有历史记录。完成一次讨论后，可以在这里回看。'));
    $('history-list').replaceChildren(fragment);
  }
  const unavailable = !connected || pending.size > 0 || state.busy || isRunning(state);
  for (const element of $('history-list').querySelectorAll('button')) {
    element.disabled = unavailable;
  }
  $('backup-all').disabled = unavailable || (!state.history.length && !state.seats.length);
  $('verify-backup').disabled = unavailable;
  $('preview-restore').disabled = unavailable;
  $('confirm-restore').disabled = unavailable || !restorePreview || restorePreview.newMeetings === 0;
}

function renderComposer() {
  const active = isRunning(state);
  const blocker = startBlocker(state, { connected, pending: pending.size > 0, proposal: $('proposal').value });
  $('start-meeting').disabled = Boolean(blocker);
  $('start-meeting').hidden = active;
  $('stop-meeting').hidden = !active;
  $('stop-meeting').disabled = !connected || pending.has('stopMeeting');
  $('stop-meeting').textContent = pending.has('stopMeeting') ? '正在停止…'
    : ['drafting', 'reviewing'].includes(state.meeting?.synthesis?.status) ? '停止复核' : '停止讨论';
  $('proposal').disabled = active || pending.has('startMeeting');
  $('mode').disabled = active || pending.has('startMeeting');
  $('rounds').disabled = active || pending.has('startMeeting');
  const readyCount = state.seats.filter((seat) => seat.status === 'ready').length;
  const ignoredCount = state.seats.length - readyCount;
  $('start-help').textContent = blocker ||
    `${readyCount} 个就绪席位将各自打开新对话。${ignoredCount ? `其余 ${ignoredCount} 席未就绪，本次不参与且不会收到消息。` : ''}${MODES.find(([id]) => id === $('mode').value)?.[2] || ''}。`;
  $('mode').title = MODES.find(([id]) => id === $('mode').value)?.[2] || '';
}

function render() {
  const focused = document.activeElement;
  const focusKey = focused?.dataset?.focusKey;
  if (state.meeting?.id !== lastMeetingId) {
    eventLimit = 40;
    lastMeetingId = state.meeting?.id || null;
  }
  const active = isRunning(state);
  if (['running', 'preparing'].includes(previousStatus) && !active && state.meeting?.report) selectTab('outcome');
  previousStatus = state.meeting?.status || null;
  $('runtime-badge').textContent = connected ? (state.runtime.available ? '本机浏览器可用' : '浏览器不可用') : '桌面连接不可用';
  $('runtime-badge').className = `status-badge ${connected && state.runtime.available ? 'ready' : 'error'}`;
  $('runtime-message').textContent = state.runtime.message || state.runtime.label || '';
  $('history-count').textContent = String(state.history.length);
  $('history-open').disabled = !connected;
  $('data-folder').disabled = !connected || pending.size > 0;
  $('new-meeting').disabled = unavailableForRoster();
  $('add-seat').disabled = unavailableForBrowser() || state.seats.length >= 8;
  $('meeting-status').textContent = ['drafting', 'reviewing'].includes(state.meeting?.synthesis?.status)
    ? '综合答案复核中' : state.meeting ? MEETING_STATUS[state.meeting.status] || '已保存的讨论' : '等待你的第一个提案';
  $('meeting-round').textContent = state.meeting && state.meeting.round > 0 ? `第 ${state.meeting.round} 轮 · ${PHASES[state.meeting.phase] || '准备中'}` : '';
  document.querySelector('.stage').classList.toggle('is-running', active);
  $('meeting-context').hidden = !state.meeting;
  $('meeting-proposal').textContent = state.meeting?.proposal || '';
  $('meeting-error').textContent = state.meeting?.error || '';
  $('meeting-error').hidden = !state.meeting?.error;
  $('event-count').textContent = String(state.meeting?.events?.length || 0);
  $('export-current').disabled = !connected || !state.meeting || active || pending.size > 0 || state.busy;
  renderSeats();
  renderOutcome();
  renderDiscussion();
  renderProviders();
  renderHistory();
  renderComposer();
  const announcement = [state.meeting?.status, state.meeting?.phase, state.meeting?.round, state.seats.filter((seat) => seat.status === 'ready').length].join(':');
  if (announcement !== lastAnnouncement) {
    lastAnnouncement = announcement;
    $('announcement').textContent = `${$('meeting-status').textContent}。${$('meeting-round').textContent}。${$('seat-count').textContent}`;
  }
  // Live updates must not discard a keyboard user's place in the room.
  if (focusKey && !focused.isConnected) {
    const replacement = [...document.querySelectorAll('[data-focus-key]')].find((element) => element.dataset.focusKey === focusKey);
    if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    else if (replacement?.closest('.seat-card')) replacement.closest('.seat-card').focus({ preventScroll: true });
    else $('add-seat').focus({ preventScroll: true });
  }
}

function selectTab(name, focus = false) {
  activeTab = name;
  for (const id of ['outcome', 'discussion']) {
    $(`tab-${id}`).setAttribute('aria-selected', String(id === name));
    $(`tab-${id}`).tabIndex = id === name ? 0 : -1;
    $(`panel-${id}`).hidden = id !== name;
  }
  if (focus) $(`tab-${name}`).focus();
}

function openDialog(id) {
  if (!$(id).open) $(id).showModal();
}

async function command(method, argument) {
  clearMessage();
  return session.run(method, argument);
}

async function startMeeting() {
  const blocker = startBlocker(state, { connected, pending: pending.size > 0, proposal: $('proposal').value });
  if (blocker) { message(blocker); return; }
  const success = await command('startMeeting', {
    proposal: $('proposal').value.trim(), mode: $('mode').value, maxRounds: Number($('rounds').value),
  });
  if (success) {
    $('onboarding').open = false;
    selectTab(state.meeting?.report ? 'outcome' : 'discussion');
    if (isRunning(state)) $('stop-meeting').focus({ preventScroll: true });
  }
}

$('proposal-form').addEventListener('submit', (event) => { event.preventDefault(); void startMeeting(); });
$('proposal').addEventListener('input', renderComposer);
$('proposal').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
    event.preventDefault(); void startMeeting();
  }
});
$('mode').addEventListener('change', renderComposer);
$('stop-meeting').addEventListener('click', async () => {
  if (await command('stopMeeting')) $('proposal').focus({ preventScroll: true });
});
$('new-meeting').addEventListener('click', async () => {
  if (await command('newMeeting')) { selectTab('outcome'); $('proposal').focus(); }
});
$('add-seat').addEventListener('click', () => openDialog('provider-dialog'));
$('history-open').addEventListener('click', () => openDialog('history-dialog'));
$('backup-all').addEventListener('click', () => void command('backupLocalData'));
$('verify-backup').addEventListener('click', () => void command('verifyBackupFile'));
$('preview-restore').addEventListener('click', () => {
  showRestorePreview(null);
  void command('previewRestoreBackup');
});
$('confirm-restore').addEventListener('click', async () => {
  const token = restorePreview?.previewToken;
  if (!token || !restorePreview?.newMeetings) return;
  try { await command('confirmRestoreBackup', token); }
  finally { showRestorePreview(null); }
});
$('data-folder').addEventListener('click', () => void command('openDataFolder'));
$('feedback-dismiss').addEventListener('click', clearMessage);
$('export-current').addEventListener('click', () => { if (state.meeting) void command('exportMeeting', state.meeting.id); });
$('history-search').addEventListener('input', renderHistory);
for (const name of ['outcome', 'discussion']) {
  $(`tab-${name}`).addEventListener('click', () => selectTab(name));
  $(`tab-${name}`).addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      selectTab(event.key === 'Home' ? 'outcome' : event.key === 'End' ? 'discussion' : activeTab === 'outcome' ? 'discussion' : 'outcome', true);
    }
  });
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('button[data-close]');
  if (close) { $(close.dataset.close).close(); return; }
  const target = event.target.closest('button[data-action]');
  if (!target || target.disabled) return;
  const { action, id } = target.dataset;
  if (action === 'invite') { openDialog('provider-dialog'); return; }
  if (action === 'synthesizeMeeting') {
    if (state.synthesisAvailable && await command('synthesizeMeeting')) selectTab('outcome');
    return;
  }
  if (action === 'viewEvent') {
    const events = state.meeting?.events || [];
    if (!events.some((entry) => entry.id === id)) return;
    eventLimit = Math.min(500, Math.max(eventLimit, events.length));
    renderDiscussion();
    selectTab('discussion');
    const target = [...document.querySelectorAll('.event-card')]
      .find((item) => item.dataset.eventId === id);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    target?.focus?.({ preventScroll: true });
    return;
  }
  if (action === 'moreEvents') {
    const panel = $('panel-discussion');
    const oldHeight = panel.scrollHeight;
    const oldTop = panel.scrollTop;
    eventLimit += 40;
    renderDiscussion();
    panel.scrollTop = oldTop + panel.scrollHeight - oldHeight;
    panel.focus({ preventScroll: true });
    return;
  }
  if (action === 'addProvider') {
    if (await command('addSeat', { providerId: id })) {
      $('provider-dialog').close();
      message('已添加席位。请在独立浏览器窗口完成登录，然后点击席位上的「检查」。', false);
    }
  } else if (['openSeat', 'checkSeat', 'removeSeat', 'exportMeeting', 'loadMeeting'].includes(action)) {
    if (await command(action, id)) {
      if (action === 'loadMeeting') { $('history-dialog').close(); selectTab('outcome'); $('tab-outcome').focus(); }
      if (action === 'removeSeat') message('已移除席位。历史讨论中的发言仍会保留。', false);
    }
  }
});

$('custom-provider-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (unavailableForBrowser() || state.seats.length >= 8) return;
  const value = $('custom-url').value.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('请输入不含账号密码的公开 HTTPS 网址。');
  } catch { message('请输入不含账号密码的公开 HTTPS 网址。'); return; }
  if (await command('addSeat', { url: value })) {
    $('custom-url').value = '';
    $('provider-dialog').close();
    message('已添加网站。请查看席位状态；手动网站不能保证参与自动讨论。', false);
  }
});

window.addEventListener('pagehide', () => session.dispose(), { once: true });
render();
void session.connect();
