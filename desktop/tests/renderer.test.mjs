import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRIDGE_METHODS, SEAT_STATUS, createSession, emptyState, isState, isRunning, startBlocker,
  reportView, readableError, actorName, formatDate, seatDisplayDetail,
} from '../renderer/model.mjs';

function readyState() {
  return {
    ...emptyState(), runtime: { available: true, label: '测试浏览器', message: '可用' },
    seats: [
      { id: 'a', providerId: 'a', name: '测试甲', url: 'https://a.example/', status: 'ready', detail: '' },
      { id: 'b', providerId: 'b', name: '测试乙', url: 'https://b.example/', status: 'ready', detail: '' },
    ],
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}) {
  let listener;
  let unsubscribed = false;
  const calls = [];
  const bridge = Object.fromEntries(BRIDGE_METHODS.map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    if (method === 'exportMeeting' || method === 'backupLocalData') return { saved: true };
    if (method === 'openDataFolder') return { opened: true };
    if (method === 'verifyBackupFile') return { verified: true, meetingCount: 2, seatBookmarkCount: 2, skippedDamagedArchives: 0 };
    if (method === 'previewRestoreBackup') return {
      selected: true, previewToken: 'b'.repeat(36), meetingCount: 2,
      newMeetings: 1, existingMeetings: 1, ignoredSeatBookmarks: 2, excludedDamagedInSource: 0,
    };
    if (method === 'confirmRestoreBackup') return { restored: true, imported: 1, existingMeetings: 1 };
    return readyState();
  }]));
  bridge.onState = (callback) => { listener = callback; return () => { unsubscribed = true; }; };
  Object.assign(bridge, overrides);
  return { bridge, calls, push: (state) => listener(state), unsubscribed: () => unsubscribed };
}

test('missing desktop bridge fails closed and never provides a demo state', async () => {
  let snapshot;
  const errors = [];
  const session = createSession({ onChange: (value) => { snapshot = value; }, onError: (error) => errors.push(error) });
  assert.equal(await session.connect(), false);
  assert.equal(snapshot.connected, false);
  assert.deepEqual(snapshot.state.seats, []);
  assert.equal(snapshot.state.meeting, null);
  assert.match(errors[0], /无法独立运行/);
  assert.equal(await session.run('startMeeting', {}), false);
  assert.match(errors.at(-1), /桌面连接不可用/);
});

test('incomplete bridge cannot connect', async () => {
  const source = fixture();
  delete source.bridge.stopMeeting;
  const session = createSession({ bridge: source.bridge });
  assert.equal(await session.connect(), false);
  assert.equal(source.calls.length, 0);
});

test('state shape is checked without requiring non-contract fields', () => {
  assert.equal(isState(emptyState()), true);
  assert.equal(isState(null), false);
  assert.equal(isState({ ...emptyState(), seats: {} }), false);
  assert.equal(isState({ ...emptyState(), runtime: {} }), false);
  assert.equal(isState({ ...emptyState(), meeting: { id: 'saved' } }), true);
});

test('meeting readiness, whole roster, and proposal bounds match controller requirements', () => {
  const state = readyState();
  const context = { proposal: '检验一个方案' };
  assert.equal(startBlocker(state, context), '');
  assert.match(startBlocker(state, { ...context, connected: false }), /桌面连接不可用/);
  assert.match(startBlocker({ ...state, runtime: { available: false, message: '缺少浏览器' } }, context), /缺少浏览器/);
  assert.match(startBlocker(state, { ...context, pending: true }), /正在处理/);
  assert.match(startBlocker({ ...state, busy: true }, context), /正在处理/);
  assert.match(startBlocker({ ...state, seats: [state.seats[0]] }, context), /还需 1 个/);
  assert.equal(startBlocker({ ...state, seats: [...state.seats, { id: 'c', status: 'needs_login' }] }, context), '',
    'Extra pending/manual seats must not block two ready providers');
  assert.match(startBlocker({ ...state, seats: Array.from({ length: 9 }, (_, id) => ({ id, status: 'ready' })) }, context), /最多 8 个/);
  assert.match(startBlocker(state, { proposal: '   ' }), /写下/);
  assert.equal(startBlocker(state, { proposal: '问'.repeat(8000) }), '');
  assert.match(startBlocker(state, { proposal: '问'.repeat(8001) }), /8,000/);
});

test('preparing and running can be cancelled while terminal history can be reviewed', () => {
  for (const status of ['preparing', 'running']) {
    const state = { ...readyState(), meeting: { id: 'm', status } };
    assert.equal(isRunning(state), true);
    assert.match(startBlocker(state, { proposal: '问题' }), /可以随时停止/);
  }
  for (const status of ['completed', 'cancelled', 'failed']) assert.equal(isRunning({ meeting: { status } }), false);
});

test('all bridge commands forward the exact contract payload and expose pending state', async () => {
  const source = fixture();
  const snapshots = [];
  const notices = [];
  const session = createSession({ bridge: source.bridge, onChange: (value) => snapshots.push(value), onNotice: (value) => notices.push(value) });
  assert.equal(await session.connect(), true);
  const commands = [
    ['addSeat', { providerId: 'a' }], ['addSeat', { url: 'https://custom.example/' }],
    ['openSeat', 'a'], ['checkSeat', 'a'], ['removeSeat', 'a'],
    ['startMeeting', { proposal: '问题', mode: 'verify', maxRounds: 3 }],
    ['stopMeeting'], ['newMeeting'], ['loadMeeting', 'saved'], ['exportMeeting', 'saved'], ['openDataFolder'],
  ];
  for (const [method, argument] of commands) {
    assert.equal(await session.run(method, argument), true);
    assert(snapshots.some((snapshot) => snapshot.pending.has(method)));
    assert.equal(snapshots.at(-1).pending.size, 0);
  }
  assert.deepEqual(source.calls, [['getState'], ...commands]);
  assert.deepEqual(notices, ['讨论记录已导出。', '已打开本机数据文件夹。']);
  session.dispose();
  assert.equal(source.unsubscribed(), true);
});

test('full local backup bridge only acknowledges a completed user-selected file', async () => {
  const source = fixture();
  const notices = [];
  const session = createSession({bridge:source.bridge,onNotice:(value)=>notices.push(value)});
  assert.equal(await session.connect(), true);
  assert.equal(await session.run('backupLocalData'), true);
  assert.equal(source.calls.at(-1)[0], 'backupLocalData');
  assert.match(notices.at(-1), /备份/);
  assert.match(notices.at(-1), /登录/);
  session.dispose();
});

test('cancelled full backup does not claim a file was written', async () => {
  const source = fixture({ backupLocalData: async () => ({ saved: false }) });
  const notices = [];
  const session = createSession({bridge:source.bridge,onNotice:(value)=>notices.push(value)});
  await session.connect();
  assert.equal(await session.run('backupLocalData'), true);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /取消/);
  session.dispose();
});

test('read-only backup verification reports count and cannot import stored sessions', async () => {
  const source = fixture();
  const notices = [];
  const session = createSession({bridge:source.bridge,onNotice:(value)=>notices.push(value)});
  await session.connect();
  assert.equal(await session.run('verifyBackupFile'), true);
  assert.equal(source.calls.at(-1)[0], 'verifyBackupFile');
  assert.match(notices.at(-1), /2 场会议/);
  assert.match(notices.at(-1), /未修改本地数据/);
  session.dispose();
});

test('backup notice warns when damaged archives cannot be included', async () => {
  const source = fixture({
    backupLocalData: async () => ({ saved: true, meetingCount: 1, skippedDamagedArchives: 2 }),
    verifyBackupFile: async () => ({ verified: true, meetingCount: 1, skippedDamagedArchives: 2 }),
  });
  const notices = [];
  const session = createSession({ bridge: source.bridge, onNotice: (notice) => notices.push(notice) });
  await session.connect();
  assert.equal(await session.run('backupLocalData'), true);
  assert.match(notices.at(-1), /2 份受损历史/);
  assert.equal(await session.run('verifyBackupFile'), true);
  assert.match(notices.at(-1), /未包含 2 份受损历史/);
  session.dispose();
});

test('two-step local restore preview uses only opaque ticket, never a filesystem path or model call', async () => {
  const source = fixture();
  const previews = [];
  const notices = [];
  const session = createSession({
    bridge:source.bridge, onNotice:(msg)=>notices.push(msg),
    onRestorePreview:(value)=>previews.push(value),
  });
  await session.connect();
  assert.equal(await session.run('previewRestoreBackup'),true);
  assert.equal(previews.at(-1).previewToken,'b'.repeat(36));
  assert.equal(previews.at(-1).newMeetings,1);
  assert.equal(await session.run('confirmRestoreBackup','b'.repeat(36)),true);
  assert.equal(source.calls.at(-1)[0],'confirmRestoreBackup');
  assert.equal(source.calls.at(-1)[1],'b'.repeat(36));
  assert.equal(previews.at(-1),null);
  assert.match(notices.at(-1),/已恢复 1 场/);
  assert.equal(source.calls.filter((x)=>x[0]==='startMeeting').length,0);
  session.dispose();
});

test('restore bridge refuses malformed preview and never claims a completed import', async () => {
  const source=fixture({previewRestoreBackup:async()=>({selected:true,previewToken:'../secret'})});
  const errors=[],previews=[];
  const session=createSession({bridge:source.bridge,onError:(value)=>errors.push(value),
    onRestorePreview:(value)=>previews.push(value)});
  await session.connect();
  assert.equal(await session.run('previewRestoreBackup'),false);
  assert.equal(previews.length,0);
  assert.ok(errors.length>0);
  session.dispose();
});

test('manual provider status remains distinct from readiness and shows actionable seat guidance', () => {
  assert.deepEqual(SEAT_STATUS.manual, ['手动席位', 'muted']);
  const state=readyState();
  state.seats.push({ id:'manual-seat',providerId:'minimax-chat',name:'MiniMax',status:'manual',
    detail:'Manual-only seat. This website can be opened and used by you, but ChatChat will not send prompts or count it as an automatic council participant.' });
  assert.equal(state.seats.filter((seat)=>seat.status==='ready').length,2);
  assert.equal(startBlocker(state,{ proposal:'Test manual observer with two active models' }), '');
  assert.match(seatDisplayDetail(state.seats.at(-1)),/暂未通过自动协商|手动/);
});

test('initial getState does not overwrite a newer subscription state', async () => {
  const response = deferred();
  const source = fixture({ getState: () => response.promise });
  let snapshot;
  const session = createSession({ bridge: source.bridge, onChange: (value) => { snapshot = value; } });
  const connection = session.connect();
  const newer = { ...readyState(), meeting: { id: 'newer', status: 'running' } };
  source.push(newer);
  response.resolve(readyState());
  assert.equal(await connection, true);
  assert.equal(snapshot.state.meeting.id, 'newer');
});

test('late action responses cannot roll back pushed events or completion', async () => {
  const response = deferred();
  const source = fixture({ startMeeting: () => response.promise });
  let snapshot;
  const session = createSession({ bridge: source.bridge, onChange: (value) => { snapshot = value; } });
  await session.connect();
  const request = session.run('startMeeting', { proposal: '问题', mode: 'balanced', maxRounds: 3 });
  source.push({ ...readyState(), meeting: { id: 'm', status: 'completed', events: [{ content: '真实事件' }] } });
  response.resolve({ ...readyState(), meeting: { id: 'm', status: 'preparing', events: [] } });
  await request;
  assert.equal(snapshot.state.meeting.status, 'completed');
  assert.equal(snapshot.state.meeting.events[0].content, '真实事件');
});

test('duplicate commands are fenced but cancellation is not trapped behind a start request', async () => {
  const response = deferred();
  let starts = 0;
  let stops = 0;
  const source = fixture({
    startMeeting: () => { starts++; return response.promise; },
    stopMeeting: async () => { stops++; return { ...readyState(), meeting: { id: 'm', status: 'cancelled' } }; },
  });
  let snapshot;
  const session = createSession({ bridge: source.bridge, onChange: (value) => { snapshot = value; } });
  await session.connect();
  const request = session.run('startMeeting', {});
  assert.equal(await session.run('startMeeting', {}), false);
  assert.equal(await session.run('removeSeat', 'a'), false);
  assert.equal(await session.run('stopMeeting'), true);
  response.resolve({ ...readyState(), meeting: { id: 'm', status: 'running' } });
  await request;
  assert.equal(starts, 1);
  assert.equal(stops, 1);
  assert.equal(snapshot.state.meeting.status, 'cancelled');
});

test('rejections surface safe text, release pending, and allow a deliberate retry', async () => {
  let attempt = 0;
  const source = fixture({ checkSeat: async () => {
    if (++attempt === 1) throw new Error('网站要求完成验证 <script>unsafe()</script>');
    return readyState();
  } });
  const errors = [];
  let snapshot;
  const session = createSession({ bridge: source.bridge, onError: (value) => errors.push(value), onChange: (value) => { snapshot = value; } });
  await session.connect();
  assert.equal(await session.run('checkSeat', 'a'), false);
  assert.match(errors[0], /完成验证/);
  assert.equal(snapshot.pending.size, 0);
  assert.equal(await session.run('checkSeat', 'a'), true);
});

test('export cancellation and failed folder opening are represented honestly', async () => {
  const source = fixture({ exportMeeting: async () => ({ saved: false }), openDataFolder: async () => ({ opened: false }) });
  const notices = [];
  const errors = [];
  const session = createSession({ bridge: source.bridge, onNotice: (value) => notices.push(value), onError: (value) => errors.push(value) });
  await session.connect();
  assert.equal(await session.run('exportMeeting', 'm'), true);
  assert.deepEqual(notices, ['已取消导出。']);
  assert.equal(await session.run('openDataFolder'), false);
  assert.match(errors[0], /未能打开/);
});

test('malformed bridge responses cannot replace the visible state', async () => {
  const source = fixture({ checkSeat: async () => ({ seats: [] }) });
  const errors = [];
  let snapshot;
  const session = createSession({ bridge: source.bridge, onError: (value) => errors.push(value), onChange: (value) => { snapshot = value; } });
  await session.connect();
  assert.equal(await session.run('checkSeat', 'a'), false);
  assert.match(errors[0], /无法读取的状态/);
  assert.equal(snapshot.state.seats.length, 2);
  assert.equal(await session.run('evaluate', 'anything'), false);
  assert.equal(source.calls.some(([name]) => name === 'evaluate'), false);
});

test('disposed sessions stop rendering, unregister, and do not issue new actions', async () => {
  const response = deferred();
  const source = fixture({ checkSeat: () => response.promise });
  const snapshots = [];
  const session = createSession({ bridge: source.bridge, onChange: (value) => snapshots.push(value) });
  await session.connect();
  const action = session.run('checkSeat', 'a');
  session.dispose();
  const count = snapshots.length;
  response.resolve(readyState());
  assert.equal(await action, false);
  source.push(readyState());
  assert.equal(snapshots.length, count);
  assert.equal(source.unsubscribed(), true);
  assert.equal(await session.run('openSeat', 'a'), false);
});

test('actual positions retain dissent and distinguish runtime fallback failures', () => {
  const authored = { participant: { id: 'a', name: '甲' }, stance: '支持', content: '有条件支持', caveats: ['样本有限'], confidence: .99 };
  const dissent = { participant: { id: 'b', name: '乙' }, stance: '反对', content: '仍有证据缺口', caveats: ['需要复核'], confidence: .1 };
  const failed = { participant: { id: 'c', name: '丙' }, stance: 'unavailable', content: '连接失败', caveats: [], confidence: 0, provenance: { source: 'runtime_fallback' } };
  const report = { consensusStance: '支持', positions: [authored, dissent, failed], disagreements: [dissent, failed], unansweredDirectRequestEventIds: ['q1'] };
  const original = structuredClone(report);
  const view = reportView(report);
  assert.deepEqual(view.authored, [authored, dissent]);
  assert.deepEqual(view.dissent, [dissent]);
  assert.deepEqual(view.failed, [failed]);
  assert.equal(view.unanswered, 1);
  assert.deepEqual(report, original);
  assert.equal(reportView(null), null);
});

test('old archive dissent remains visible even when omitted from positions', () => {
  const dissent = { participant: { id: 'b', name: '乙' }, stance: '保持异议', content: '缺少独立证据' };
  const view = reportView({ positions: [], disagreements: [dissent], consensusStance: null });
  assert.deepEqual(view.authored, [dissent]);
  assert.deepEqual(view.dissent, [dissent]);
  assert.equal(view.stance, null);
});

test('historical actor names prefer saved report over the current room', () => {
  const state = readyState();
  state.meeting = { report: { positions: [{ participant: { id: 'a', name: '历史甲' } }] } };
  assert.equal(actorName(state, 'a'), '历史甲');
  assert.equal(actorName(state, 'missing'), '历史席位');
  state.meeting.events = [{ actorId: 'removed-a' }, { actorId: 'removed-b' }];
  assert.equal(actorName(state, 'removed-a'), '历史席位 1');
  assert.equal(actorName(state, 'removed-b'), '历史席位 2');
  assert.equal(formatDate('invalid'), '时间未记录');
  assert.equal(readableError({}), '操作未完成，请重试。');
  assert.equal(readableError(new Error('x'.repeat(2000))).length, 1200);
});

test('shipping renderer uses external scripts, restrictive CSP, and safe text sinks only', async () => {
  const html = await readFile(new URL('../renderer/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../renderer/app.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../renderer/styles.css', import.meta.url), 'utf8');
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /unsafe-inline|\son\w+=|<script(?![^>]*\bsrc=)/i);
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|chrome\.|fetch\s*\(/);
  assert.doesNotMatch(html + js + css, /https?:\/\/[^'"\s]*\.(?:woff|png|jpg)|@import/);
  assert.match(js, /textContent = text/);
  assert.match(html, /maxlength="8000"/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'all element ids are unique');
  for (const [, id] of js.matchAll(/\$\('([a-z-]+)'\)/g)) assert(ids.includes(id), `missing element #${id}`);
});

test('seat connection failures show actionable Chinese help without pretending a Provider replied', () => {
  const examples = [
    ['This site requires manual use. No reviewed automatic chat recipe is available.', /暂未通过自动协商/],
    ['Sign in manually in the managed browser, return to the chat page, and check the seat.', /自行登录/],
    ['The page contains an existing or unexpected conversation. A fresh, empty chat is required.', /新的空白 Chat/],
    ['Submission may have reached the provider. It will not be retried.', /不会自动重发/],
    ['The page contains multiple possible chat controls. Automatic sending is paused.', /暂停自动发送/],
    ['Bundled Chromium is unavailable. Repair or reinstall the desktop application.', /重新安装/],
    ['Secure browser network tunnel could not start. Check your local firewall, then restart ChatChat.', /防火墙/],
    ['Fresh chat prepared. Automation remains experimental.', /实验性/],
  ];
  for (const [detail, expression] of examples) {
    assert.match(seatDisplayDetail({ status: 'attention', detail }), expression);
  }
  assert.match(seatDisplayDetail({ status: 'ready', detail: '' }), /发送前/);
  assert.equal(seatDisplayDetail({ status: 'error', detail: 'Unknown future provider fault' }),
    'Unknown future provider fault');
});
