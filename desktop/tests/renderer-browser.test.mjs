import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Explicit opt-in: CHATCHAT_RENDERER_BROWSER points at a local browser binary.
// No downloads, providers, accounts, ports, personal profiles, or sandbox bypass.
const browserPath = process.env.CHATCHAT_RENDERER_BROWSER;
const skip = browserPath ? false : 'Set CHATCHAT_RENDERER_BROWSER to run the isolated, sandboxed browser UI checks.';
const fixtures = {
  version: '0.10.5', runtime: { available: true, label: '测试浏览器', message: '隔离测试环境' },
  providers: [
    { id: 'alpha', name: '测试甲', url: 'https://alpha.example/', automation: 'experimental' },
    { id: 'beta', name: '测试乙', url: 'https://beta.example/', automation: 'experimental' },
    { id: 'manual', name: '手动网站', url: 'https://manual.example/', automation: 'manual' },
  ], seats: [], meeting: null,
  history: [{ id: 'saved', proposal: '历史提案：保留分歧', status: 'failed', updatedAt: '2026-10-21T12:00:00Z' }], busy: false,
};

async function openRenderer(t, { bridge = true, viewport = { width: 1100, height: 760 } } = {}) {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, chromiumSandbox: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const files = new Map(await Promise.all(['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'synthesis-view.mjs'].map(async (file) => [file, await readFile(new URL(`../renderer/${file}`, import.meta.url), 'utf8')])));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const filename = url.pathname.slice(1);
    if (url.origin !== 'https://renderer.invalid' || !files.has(filename)) return route.abort();
    await route.fulfill({ status: 200, contentType: filename.endsWith('.html') ? 'text/html' : filename.endsWith('.css') ? 'text/css' : 'text/javascript', body: files.get(filename) });
  });
  if (bridge) await page.addInitScript((initial) => {
    let state = structuredClone(initial);
    let listener;
    window.fixtureCalls = [];
    window.fixtureFailure = '';
    window.fixtureCancelExport = false;
    const push = () => { listener?.(structuredClone(state)); return structuredClone(state); };
    window.fixturePush = (next) => { state = next; push(); };
    window.chatChat = {
      onState: (callback) => { listener = callback; return () => { listener = undefined; }; },
      getState: async () => structuredClone(state),
    };
    for (const method of ['addSeat', 'openSeat', 'checkSeat', 'removeSeat', 'startMeeting', 'synthesizeMeeting', 'stopMeeting', 'newMeeting', 'loadMeeting', 'exportMeeting', 'backupLocalData', 'verifyBackupFile', 'previewRestoreBackup', 'confirmRestoreBackup', 'openDataFolder']) {
      window.chatChat[method] = async (arg) => {
        window.fixtureCalls.push([method, arg]);
        if (window.fixtureFailure === method) throw new Error('测试错误：请完成网站验证');
        if (method === 'addSeat') {
          const provider = state.providers.find((item) => item.id === arg.providerId) || { id: 'custom', name: '自定义网站', url: arg.url };
          state.seats.push({ id: provider.id, providerId: provider.id, name: provider.name, url: provider.url, status: 'needs_login', detail: '请在独立窗口登录' });
        }
        if (method === 'checkSeat') state.seats.find((item) => item.id === arg).status = 'ready';
        if (method === 'removeSeat') state.seats = state.seats.filter((item) => item.id !== arg);
        if (method === 'startMeeting') {
          state.busy = true;
          state.meeting = { id: 'current', proposal: arg.proposal, status: 'running', phase: 'sealed', round: 1, report: null, events: [] };
        }
        if (method === 'stopMeeting') { state.busy = false; state.meeting.status = 'cancelled'; }
        if (method === 'newMeeting') state.meeting = null;
        if (method === 'loadMeeting') {
          const support = { participant: { id: 'alpha', name: '历史甲' }, stance: '支持试点', content: '先做小规模验证', caveats: ['结果尚不能外推'], confidence: .9 };
          const dissent = { participant: { id: 'beta', name: '历史乙' }, stance: '暂不执行', content: '<img src=x onerror=window.pwned=true> 仍有证据缺口', caveats: ['独立复核前保留异议'], confidence: .4 };
          const failed = { participant: { id: 'gone', name: '历史丙' }, stance: 'unavailable', content: '网站连接超时', caveats: [], confidence: 0, provenance: { source: 'runtime_fallback' } };
          state.meeting = {
            id: arg, proposal: '历史提案：保留分歧', status: 'failed', phase: 'final', round: 3,
            error: '有一个席位未完成',
            report: { positions: [support, dissent, failed], disagreements: [dissent], consensusStance: null, unansweredDirectRequestEventIds: ['q1'], rounds: 3, eventCount: 1, confidence: .6, consensusRatio: .5 },
            events: [{ id: 'q1', actorId: 'beta', round: 2, kind: 'challenge', content: '证据来源是什么？' }],
          };
        }
        if (method === 'exportMeeting' || method === 'backupLocalData') return { saved: !window.fixtureCancelExport };
        if (method === 'openDataFolder') return { opened: true };
        if (method === 'verifyBackupFile') return { verified: true, meetingCount: 1, seatBookmarkCount: 0, skippedDamagedArchives: 0 };
        if (method === 'previewRestoreBackup') return {
          selected: true, previewToken: 'a'.repeat(36), meetingCount: 3,
          newMeetings: 2, existingMeetings: 1, ignoredSeatBookmarks: 2,
          excludedDamagedInSource: 0,
        };
        if (method === 'confirmRestoreBackup') return {
          restored: true, imported: 2, existingMeetings: 1,
          ignoredSeatBookmarks: 2, excludedDamagedInSource: 0,
        };
        return push();
      };
    }
  }, fixtures);
  await page.goto('https://renderer.invalid/index.html');
  await page.waitForFunction(() => document.getElementById('runtime-badge').textContent !== '连接中');
  return { page, errors };
}

test('actual renderer wires onboarding, seats, proposal, cancellation, history and safe reports', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  await page.waitForFunction(() => !document.getElementById('add-seat').disabled);
  for (const provider of ['测试甲', '测试乙']) {
    await page.locator('#add-seat').click();
    await page.getByRole('button', { name: `添加 ${provider}`, exact: true }).click();
    await page.getByRole('button', { name: `登录或打开 ${provider}`, exact: true }).click();
    await page.getByRole('button', { name: `检查 ${provider} 的就绪状态`, exact: true }).click();
  }
  await page.locator('#proposal').fill('独立测试提案');
  await page.locator('#mode').selectOption('verify');
  await page.locator('#rounds').selectOption('4');
  assert.equal(await page.locator('#start-meeting').isEnabled(), true);
  await page.locator('#proposal').press('Control+Enter');
  await page.locator('#stop-meeting').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#proposal').isDisabled(), true);
  assert.equal(await page.locator('#add-seat').isDisabled(), true);
  await page.locator('#stop-meeting').click();
  await page.waitForFunction(() => document.getElementById('meeting-status').textContent.includes('已停止'));
  await page.locator('#history-open').click();
  await page.getByRole('button', { name: '加载记录', exact: true }).click();
  await page.locator('.dissent-position').waitFor();
  assert.equal(await page.locator('.dissent-position').count(), 1);
  assert.equal(await page.locator('.failed-position').count(), 1);
  assert.match(await page.locator('.dissent-position').textContent(), /独立复核前保留异议/);
  assert.match(await page.locator('.failed-position').textContent(), /未取得真实最终立场/);
  assert.match(await page.locator('.dissent-position').textContent(), /<img src=x onerror=/);
  assert.equal(await page.locator('#panel-outcome img').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.pwned)), false);
  await page.locator('#tab-outcome').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-discussion').getAttribute('aria-selected'), 'true');
  assert.match(await page.locator('#panel-discussion').textContent(), /历史乙/);
  await page.locator('#export-current').click();
  assert.match(await page.locator('#feedback-text').textContent(), /已导出/);
  await page.evaluate(() => { window.fixtureCancelExport = true; });
  await page.locator('#export-current').click();
  assert.match(await page.locator('#feedback-text').textContent(), /已取消导出/);
  await page.locator('#data-folder').click();
  await page.evaluate(() => { window.fixtureFailure = 'checkSeat'; });
  await page.getByRole('button', { name: '检查 测试甲 的就绪状态', exact: true }).click();
  assert.match(await page.locator('#feedback-text').textContent(), /请完成网站验证/);
  await page.evaluate(() => { window.fixtureFailure = ''; });
  await page.getByRole('button', { name: '移除 测试乙 席位', exact: true }).click();
  assert.equal(await page.locator('.seat-card').count(), 1);
  await page.locator('#new-meeting').click();
  await page.locator('#add-seat').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#provider-dialog').isVisible(), false);
  await page.locator('#add-seat').click();
  await page.locator('.custom-provider summary').click();
  await page.locator('#custom-url').fill('https://custom.example/');
  await page.evaluate(() => { window.fixtureFailure = 'addSeat'; });
  await page.locator('#custom-add').click();
  assert.match(await page.locator('#provider-error').textContent(), /请完成网站验证/);
  assert.equal(await page.locator('#provider-dialog').isVisible(), true);
  await page.evaluate(() => { window.fixtureFailure = ''; });
  await page.locator('#custom-add').click();
  const calls = await page.evaluate(() => window.fixtureCalls);
  assert.deepEqual(calls.find(([name]) => name === 'startMeeting')[1], { proposal: '独立测试提案', mode: 'verify', maxRounds: 4 });
  assert(calls.some(([name, value]) => name === 'addSeat' && value.url === 'https://custom.example/'));
  assert.equal(calls.filter(([name]) => name === 'startMeeting').length, 1, 'history never regenerates');
  assert.deepEqual(errors, []);
});

test('missing bridge and 1100×760 at 150% equivalent remain usable with keyboard', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t, { bridge: false });
  await page.waitForFunction(() => document.getElementById('feedback-text').textContent.includes('无法独立运行'));
  assert.equal(await page.locator('#start-meeting').isDisabled(), true);
  assert.equal(await page.locator('#add-seat').isDisabled(), true);
  for (const viewport of [{ width: 1100, height: 760 }, { width: 733, height: 506 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => {
      const composer = document.querySelector('.composer-dock').getBoundingClientRect();
      const proposal = document.getElementById('proposal').getBoundingClientRect();
      const workspace = document.getElementById('workspace');
      return { width: window.innerWidth, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, composerBottom: composer.bottom, proposalTop: proposal.top, proposalBottom: proposal.bottom, workspaceHeight: workspace.clientHeight, workspaceScrollable: workspace.scrollHeight > workspace.clientHeight };
    });
    assert(dimensions.scrollWidth <= dimensions.width, 'no horizontal viewport overflow');
    assert(dimensions.composerBottom <= dimensions.height + 1, 'composer stays in viewport');
    assert(dimensions.proposalTop > 0 && dimensions.proposalBottom < dimensions.height);
    assert(dimensions.workspaceHeight >= 120, 'room keeps useful scrollable space');
    assert.equal(dimensions.workspaceScrollable, true);
  }
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await page.locator('#proposal').fill('离线草稿');
  assert.equal(await page.locator('#proposal').inputValue(), '离线草稿');
  assert.deepEqual(errors, []);
});

test('extra unready and manual seats do not block two ready models and are explicitly excluded', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  const state = await page.evaluate(() => window.chatChat.getState());
  state.seats = [
    { id: 'alpha', providerId: 'alpha', name: 'Alpha', url: 'https://alpha.example/', status: 'ready', detail: 'Fixture ready' },
    { id: 'beta', providerId: 'beta', name: 'Beta', url: 'https://beta.example/', status: 'ready', detail: 'Fixture ready' },
    { id: 'manual', providerId: 'manual', name: 'Manual', url: 'https://manual.example/', status: 'needs_login', detail: 'Manual-only' },
  ];
  await page.evaluate((updated) => window.fixturePush(updated), state);
  await page.locator('#proposal').fill('Test two ready peers with one pending manual seat');
  await page.waitForFunction(() => !document.getElementById('start-meeting').disabled);
  assert.match(await page.locator('#start-help').innerText(), /本次不参与/);
  await page.locator('#start-meeting').click();
  await page.waitForFunction(() => document.getElementById('meeting-status').textContent.includes('讨论进行'));
  const after = await page.evaluate(() => window.chatChat.getState());
  after.meeting.participatingSeatIds = ['alpha', 'beta'];
  await page.evaluate((updated) => window.fixturePush(updated), after);
  assert.equal(await page.locator('.seat-card').count(), 3);
  assert.equal(await page.locator('.seat-card').filter({ hasText: '本次未参与' }).count(), 1);
  assert.match(await page.locator('.seat-card').filter({ hasText: '本次未参与' }).textContent(), /Manual/);
  assert.deepEqual(errors, []);
});

test('optional reviewed answer requires an explicit click, links real meeting events and preserves review dissent', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  const state = await page.evaluate(() => window.chatChat.getState());
  state.seats = [
    { id:'alpha', providerId:'alpha', name:'Alpha', url:'https://alpha.example/', status:'ready', detail:'' },
    { id:'beta', providerId:'beta', name:'Beta', url:'https://beta.example/', status:'ready', detail:'' },
  ];
  state.meeting = {
    id:'meeting-current', proposal:'Should we deploy?', status:'completed', phase:'completed', round:3,
    events:[
      { id:'ref-01', actorId:'alpha', kind:'final_position', round:3, content:'Limited pilot.' },
      { id:'ref-02', actorId:'beta', kind:'final_position', round:3, content:'Wait for additional evidence.' },
    ],
    report:{
      consensusStance:null,positions:[
        { participant:{id:'alpha',name:'Alpha'},stance:'pilot',content:'Only a small trial.',confidence:0.6,caveats:[] },
        { participant:{id:'beta',name:'Beta'},stance:'wait',content:'Need more proof.',confidence:0.6,caveats:[] },
      ],disagreements:[
        { participant:{id:'beta',name:'Beta'},stance:'wait',content:'Need more proof.',confidence:0.6,caveats:[] },
      ],
    },
  };
  state.synthesisAvailable = true;
  state.synthesisPlannedRequests = 2;
  await page.evaluate((updated) => window.fixturePush(updated), state);
  const synthButton = page.getByRole('button', { name: /生成复核答案/ });
  assert.equal(await synthButton.count(), 1);
  assert.match(await synthButton.textContent(), /最多另发 2 次模型消息/);
  assert.match(await page.locator('.synthesis-help').textContent(), /明确发起/);
  const callsBefore = await page.evaluate(() => window.fixtureCalls);
  assert.equal(callsBefore.filter((x) => x[0] === 'synthesizeMeeting').length, 0);
  await synthButton.click();
  const callsAfter = await page.evaluate(() => window.fixtureCalls);
  assert.equal(callsAfter.filter((x) => x[0] === 'synthesizeMeeting').length, 1);

  state.synthesisAvailable = false;
  state.meeting.synthesis = {
    status:'disputed',writerId:'alpha',reviewerIds:['beta'],
    draft: { writerId:'alpha',
      answer:'Trial first. <img src=x onerror=window.synthesisPwned=true>',
      eventIds:['ref-01','ref-02'],caveats:['Source facts are not verified.'] },
    reviews:[{participantId:'beta',status:'completed',verdict:'reject',
      commentary:'The original dissent was not given sufficient weight.',eventIds:['ref-02']}],
  };
  await page.evaluate((updated) => window.fixturePush(updated), state);
  await page.getByText('保留不同意见', { exact:true }).first().waitFor();
  assert.equal(await page.locator('.synthesis-answer').count(), 1);
  assert.match(await page.locator('.synthesis-answer').textContent(), /<img src=x onerror=/);
  assert.equal(await page.locator('.synthesis-panel img').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.synthesisPwned)), false);
  assert.match(await page.locator('.synthesis-review').textContent(), /反对草稿/);
  await page.getByRole('button', { name:'定位原始会议发言 ref-02' }).click();
  assert.equal(await page.locator('#tab-discussion').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.event-card').filter({hasText:'Wait for additional evidence.'}).count(),1);
  assert.deepEqual(errors, []);
});


test('history backup is explicit, excludes website logins and never starts Provider requests', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  await page.locator('#history-open').click();
  await page.locator('#history-dialog').waitFor({ state: 'visible' });
  const backup = page.locator('#backup-all');
  assert.equal(await backup.count(), 1);
  assert.equal(await backup.isEnabled(), true);
  assert.match(await page.locator('.backup-options').innerText(), /不含/);
  assert.match(await page.locator('.backup-options').innerText(), /Cookie/);
  const before = await page.evaluate(() => window.fixtureCalls);
  assert.equal(before.some(([method])=>method==='backupLocalData'),false);
  await backup.click();
  const after = await page.evaluate(() => window.fixtureCalls);
  assert.equal(after.filter(([method])=>method==='backupLocalData').length,1);
  assert.match(await page.locator('#backup-status').innerText(), /备份/);
  const verifyButton = page.locator('#verify-backup');
  assert.equal(await verifyButton.isEnabled(), true);
  await verifyButton.click();
  const verifiedCalls = await page.evaluate(() => window.fixtureCalls);
  assert.equal(verifiedCalls.filter(([method])=>method==='verifyBackupFile').length, 1);
  assert.match(await page.locator('#backup-status').innerText(), /校验通过/);
  assert.equal(after.some(([method])=>method==='startMeeting'),false);
  assert.equal(after.some(([method])=>method==='synthesizeMeeting'),false);
  assert.deepEqual(errors, []);
});


test('restoring a local backup requires preview and explicit confirmation; never starts a model chat', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  await page.locator('#history-open').click();
  await page.locator('#history-dialog').waitFor({state:'visible'});
  const confirm=page.locator('#confirm-restore');
  assert.equal(await confirm.isVisible(),false);
  await page.locator('#preview-restore').click();
  await page.locator('#restore-preview').waitFor({state:'visible'});
  assert.match(await page.locator('#restore-preview').innerText(), /可新增 2 场/);
  assert.match(await page.locator('#restore-preview').innerText(), /不恢复 Cookie/);
  assert.equal(await confirm.isEnabled(),true);
  await confirm.click();
  await page.locator('#restore-preview').waitFor({state:'hidden'});
  const calls=await page.evaluate(()=>window.fixtureCalls);
  assert.equal(calls.filter(([method])=>method==='previewRestoreBackup').length,1);
  const imports=calls.filter(([method])=>method==='confirmRestoreBackup');
  assert.equal(imports.length,1);
  assert.equal(imports[0][1],'a'.repeat(36));
  assert.ok(!calls.some(([method])=>['startMeeting','openSeat','synthesizeMeeting'].includes(method)));
  assert.deepEqual(errors,[]);
});

test('manual models occupy visible seats but cannot masquerade as automatic participants', { skip }, async (t) => {
  const { page, errors } = await openRenderer(t);
  const state = await page.evaluate(() => window.chatChat.getState());
  state.seats = [
    { id:'alpha', providerId:'openai-chatgpt', name:'ChatGPT',
      url:'https://chatgpt.com/',status:'ready',detail:'Fixture controls found' },
    { id:'beta', providerId:'deepseek-chat', name:'DeepSeek',
      url:'https://chat.deepseek.com/',status:'ready',detail:'Fixture controls found' },
    { id:'manual',providerId:'minimax-chat',name:'MiniMax',
      url:'https://chat.minimax.io/',status:'manual',
      detail:'Manual-only seat. This website can be opened and used by you, but ChatChat will not send prompts or count it as an automatic council participant.' },
  ];
  await page.evaluate((next)=>window.fixturePush(next),state);
  await page.locator('#proposal').fill('Only the two verified-ready models may speak.');
  assert.equal(await page.locator('#start-meeting').isEnabled(),true);
  assert.match(await page.locator('#start-help').textContent(), /本次不参与/);
  const card = page.locator('.seat-card').filter({hasText:'MiniMax'});
  assert.equal(await card.count(),1);
  assert.match(await card.textContent(),/手动席位/);
  assert.match(await card.locator('.seat-detail').textContent(),/暂未通过自动协商/);
  const before=await page.evaluate(()=>window.fixtureCalls);
  assert.equal(before.filter(([method])=>method==='startMeeting').length,0);
  await page.locator('#start-meeting').click();
  const calls=await page.evaluate(()=>window.fixtureCalls);
  assert.equal(calls.filter(([method])=>method==='startMeeting').length,1);
  assert.equal(calls.filter(([method])=>method==='openSeat' || method==='checkSeat').length,0);
  assert.deepEqual(errors,[]);
});


test('a saved closed manual Provider remains visibly non-automatic before its website is opened', { skip }, async (t) => {
  const {page, errors} = await openRenderer(t);
  const state = await page.evaluate(()=>window.chatChat.getState());
  state.providers = [
    ...state.providers.filter((entry)=>entry.id !== 'minimax-chat'),
    {id:'minimax-chat',name:'MiniMax',url:'https://chat.minimax.io/',automation:'manual'},
  ];
  state.seats = [
    {id:'saved-manual',providerId:'minimax-chat',name:'MiniMax',
      url:'https://chat.minimax.io/',status:'closed',detail:'Saved seat. Open to sign in.'},
  ];
  await page.evaluate((updated)=>window.fixturePush(updated),state);
  const card=page.locator('.seat-card').filter({hasText:'MiniMax'});
  assert.equal(await card.count(),1);
  assert.match(await card.locator('.seat-manual-hint').textContent(),/仅手动使用/);
  assert.match(await card.locator('.seat-manual-hint').textContent(),/不参与自动协商/);
  assert.equal(await page.locator('#start-meeting').isEnabled(),false);
  assert.deepEqual(errors,[]);
});
