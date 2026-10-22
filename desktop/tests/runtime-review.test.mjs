// Independent CONTRACT.md audit. Run: node desktop/tests/runtime-review.test.mjs
// Known defects remain ordinary failing assertions so a source fix must turn them green.
// No Chromium process, DNS lookup, provider network, credentials, or package install is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import { ManagedBrowserRuntime } from '../runtime/index.mjs';
import { ADAPTERS } from '../runtime/providers.mjs';
import { createController } from '../main/controller.mjs';
import { CouncilOrchestrator } from '../generated/src/core/orchestrator.js';
import { BrowserConsultationAgent } from '../generated/src/provider-sdk/consultation-agent.js';

const CHATGPT = 'openai-chatgpt';
const CLAUDE = 'anthropic-claude';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const proposal = { proposal: 'Review this proposal using evidence.', mode: 'verify', maxRounds: 2 };
const core = { CouncilOrchestrator, BrowserConsultationAgent, timeoutMs: 8000, prepareTimeoutMs: 1000, closeTimeoutMs: 300 };
const code = (expected) => (error) => { assert.equal(error.code, expected); return true; };
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function until(predicate, label = 'condition', timeoutMs = 2500) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, `Timed out waiting for ${label}`);
    await delay(5);
  }
}
async function outcome(promise) {
  try { return { value: await promise }; } catch (error) { return { error }; }
}

// A selector-result DOM model, not a claim that current live provider CSS works.
// Runtime.evaluate executes the production function, including its origin guard,
// root de-duplication, visibility, control matching, and bounded transcript reads.
class Element {
  constructor(tagName, selectors = [], properties = {}) {
    this.tagName = tagName;
    this.selectors = new Set(selectors);
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.isContentEditable = false;
    this.disabled = false;
    this.readOnly = false;
    this.value = '';
    this.attributes = {};
    this.style = { display: 'block', visibility: 'visible' };
    this.text = '';
    this.textReads = 0;
    Object.assign(this, properties);
  }
  append(...children) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
    return this;
  }
  contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.selectors.has(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  closest() {
    for (let node = this; node; node = node.parentElement) {
      if (node.attributes.inert !== undefined || node.attributes['aria-hidden'] === 'true') return node;
    }
    return null;
  }
  getClientRects() { return this.style.display === 'none' ? [] : [{}]; }
  get innerText() {
    this.textReads++;
    if (this.forbidText) throw new Error('Existing transcript or unrelated document was read');
    return this.text;
  }
  set innerText(value) { this.text = value; }
}

class MockPage extends EventEmitter {
  constructor(context, providerId = CHATGPT) {
    super();
    this.context = context;
    this.providerId = providerId;
    this.adapter = ADAPTERS[providerId] ?? ADAPTERS[CHATGPT];
    this.address = 'about:blank';
    this.closed = false;
    this.frame = {};
    this.evaluations = [];
    this.handles = [];
    this.fills = [];
    this.clicks = [];
    this.navigations = [];
    this.document = new Element('DOCUMENT');
    this.scope = new Element('MAIN', [this.adapter.scope]);
    this.form = new Element('FORM');
    this.editor = new Element('TEXTAREA', [this.adapter.composer]);
    this.sendButton = new Element('BUTTON', [this.adapter.send]);
    this.stopButton = new Element('BUTTON', [this.adapter.busy], { style: { display: 'none', visibility: 'visible' } });
    this.form.append(this.editor, this.sendButton, this.stopButton);
    this.scope.append(this.form);
    this.document.append(this.scope);
    // Access to unrelated secrets is a fixture error, including from production code.
    Object.defineProperty(this.document, 'cookie', { get() { throw new Error('Cookie access'); } });
    this.secretReads = 0;
    this.onClick = (page) => page.addTurn('Complete assistant answer.');
  }
  url() { return this.address; }
  isClosed() { return this.closed; }
  mainFrame() { return this.frame; }
  navigate(url) { this.address = url; this.emit('framenavigated', this.frame); }
  async goto(url, options) { this.navigations.push({ url, options }); this.navigate(url); }
  async bringToFront() { this.context.driver.timeline.push('front'); }
  async close() {
    if (this.closed) return;
    if (this.closeGate) await this.closeGate.promise;
    this.closed = true;
    this.context.driver.timeline.push('page-close');
    this.emit('close');
  }
  addTurn(text, { complete = true, busy = false } = {}) {
    this.editor.value = '';
    this.stopButton.style.display = busy ? 'block' : 'none';
    const user = new Element('DIV', [this.adapter.user]);
    const assistant = new Element('DIV', [this.adapter.assistant]);
    const content = new Element('DIV', [this.adapter.text], { text });
    const copy = new Element('BUTTON', [this.adapter.complete], { style: { display: complete ? 'block' : 'none', visibility: 'visible' } });
    const wrapper = new Element('ARTICLE').append(assistant, copy);
    assistant.append(content);
    this.scope.append(user, wrapper);
    return { user, assistant, content, copy, wrapper };
  }
  execute(fn, argument) {
    const sandbox = {
      document: this.document, location: new URL(this.address), getComputedStyle: (element) => element.style,
    };
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(sandbox, name, {
      get: () => { this.secretReads++; throw new Error('Storage access'); },
    });
    sandbox.argument = argument;
    // timeout bounds accidental loops in the actual page function, not runtime polling.
    return vm.runInNewContext(`(${fn.toString()})(argument)`, sandbox, { timeout: 100 });
  }
  async evaluate(fn, argument) {
    this.evaluations.push(structuredClone(argument));
    if (this.onEvaluate) await this.onEvaluate(this, argument);
    if (this.closed) throw new Error('Page closed');
    return this.execute(fn, argument);
  }
  async evaluateHandle(fn, argument) {
    if (this.onHandle) await this.onHandle(this, argument);
    if (this.closed) throw new Error('Page closed');
    const node = this.execute(fn, argument);
    const page = this;
    const handle = {
      disposed: false,
      asElement: () => node instanceof Element ? handle : null,
      dispose: async () => { handle.disposed = true; },
      fill: async (value, options) => {
        assert.equal(node, page.editor, 'Only the selected composer can be filled');
        page.fills.push({ value, options });
        if (page.onFill) await page.onFill(page, value);
        else node.value = value;
      },
      click: async (options) => {
        assert.equal(node, page.sendButton, 'Only the selected send button can be clicked');
        assert.equal(page.closed, false);
        page.clicks.push({ prompt: page.editor.value, options });
        await page.onClick?.(page);
      },
    };
    this.handles.push(handle);
    return handle;
  }
}

class MockContext extends EventEmitter {
  constructor(driver, providerId) { super(); this.driver = driver; this.providerId = providerId; this.allPages = []; this.closeCount = 0; }
  pages() { return this.allPages.filter((page) => !page.closed); }
  setDefaultTimeout(value) { this.defaultTimeout = value; }
  setDefaultNavigationTimeout(value) { this.navigationTimeout = value; }
  async route(pattern, callback) { assert.equal(pattern, '**/*'); this.routeHandler = callback; }
  async routeWebSocket(pattern, callback) { assert.equal(pattern, '**/*'); this.socketHandler = callback; }
  async newPage() {
    this.driver.timeline.push('new-page');
    if (this.newPageGate) await this.newPageGate.promise;
    const page = new MockPage(this, this.providerId);
    this.allPages.push(page);
    this.configurePage?.(page, this.allPages.length - 1);
    this.emit('page', page);
    return page;
  }
  async close() {
    this.closeCount++;
    for (const page of this.pages()) await page.close();
    this.emit('close');
  }
}
class MockChromium {
  launches = [];
  contexts = [];
  timeline = [];
  async launchPersistentContext(profile, options) {
    this.launches.push({ profile, options: structuredClone(options) });
    if (this.launchGate) await this.launchGate.promise;
    if (this.launchError) throw this.launchError;
    const providerId = profile.includes(CLAUDE) ? CLAUDE : CHATGPT;
    const context = new MockContext(this, providerId);
    this.contexts.push(context);
    this.configureContext?.(context, this.contexts.length - 1);
    return context;
  }
  get pages() { return this.contexts.flatMap((context) => context.allPages); }
  get clicks() { return this.pages.flatMap((page) => page.clicks); }
}

async function fixture(t, { chromium = new MockChromium(), runtimeOptions = {} } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'chatchat-runtime-review-'));
  const runtimes = [];
  const controllers = [];
  const runtime = new ManagedBrowserRuntime({ dataDir, chromium, ...runtimeOptions });
  runtimes.push(runtime);
  t.after(async () => {
    for (const controller of controllers.reverse()) await controller.close();
    for (const item of runtimes.reverse()) await item.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    dataDir, runtime, chromium, runtimes,
    controller(options = {}) {
      const controller = createController({ runtime, dataDir, core, ...options });
      controllers.push(controller);
      return controller;
    },
    async prepared(providerId = CHATGPT, sessionId = 'review-session') {
      const seat = await runtime.addSeat({ providerId });
      await runtime.prepareSeat(seat.id, { sessionId });
      return { seat, page: chromium.pages.at(-1), context: chromium.contexts.at(-1) };
    },
  };
}
const send = (runtime, id, options = {}) => runtime.send(id, { prompt: 'Review prompt', operationId: 'review-operation', timeoutMs: 3500, ...options });
const journalPath = (f) => join(f.dataDir, 'managed-browser-seats.json');
const journal = async (f) => JSON.parse(await readFile(journalPath(f), 'utf8'));
async function reload(f, chromium = new MockChromium()) {
  await f.runtime.close();
  const runtime = new ManagedBrowserRuntime({ dataDir: f.dataDir, chromium });
  f.runtimes.push(runtime);
  return { runtime, chromium };
}

test('startup opens zero windows, copies are detached, and missing bundles are honestly unavailable', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.runtime.list(), []);
  assert.deepEqual(f.chromium.launches, []);
  const catalog = f.runtime.catalog();
  assert.equal(catalog.length, 7);
  catalog[0].url = 'https://attacker.example/';
  assert.equal(f.runtime.catalog()[0].url, 'https://chatgpt.com/');
  const missing = new ManagedBrowserRuntime({ dataDir: join(f.dataDir, 'missing'), executablePath: join(f.dataDir, 'absent-browser') });
  f.runtimes.push(missing);
  assert.equal(missing.getInfo().available, false);
  assert.doesNotMatch(missing.getInfo().message, /npm|npx|install command|shell/i);
  const seat = await missing.addSeat({ providerId: CHATGPT });
  assert.equal(seat.status, 'error');
});

test('launch uses separate stable app-owned persistent profiles, a sandbox, and no unsafe flags', async (t) => {
  const f = await fixture(t, { runtimeOptions: { executablePath: '/bundled/chromium/chrome', headless: true } });
  const first = await f.runtime.addSeat({ providerId: CHATGPT });
  await f.runtime.addSeat({ providerId: CLAUDE });
  assert.equal(f.chromium.launches.length, 2);
  const paths = f.chromium.launches.map(({ profile, options }) => {
    const rel = relative(join(f.dataDir, 'browser-profiles'), profile);
    assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel));
    assert.deepEqual(options, {
      executablePath: '/bundled/chromium/chrome', headless: true, chromiumSandbox: true,
      acceptDownloads: false, serviceWorkers: 'block', timeout: 30000,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    });
    return profile;
  });
  assert.notEqual(paths[0], paths[1]);
  first.url = 'https://attacker.example/';
  assert.equal(f.runtime.list()[0].url, 'https://chatgpt.com/');
  const restored = await reload(f);
  assert.equal(restored.runtime.list()[0].status, 'closed');
  assert.deepEqual(restored.chromium.launches, []);
  await restored.runtime.openSeat(first.id);
  assert.equal(restored.chromium.launches[0].profile, paths[0]);
});

test('restored tabs close only after a fresh owned page exists; login popups are never inspected', async (t) => {
  const chromium = new MockChromium();
  let restored;
  chromium.configureContext = (context) => {
    restored = new MockPage(context);
    restored.address = 'https://chatgpt.com/c/private-history';
    restored.evaluate = restored.evaluateHandle = () => { throw new Error('Restored transcript accessed'); };
    context.allPages.push(restored);
  };
  const f = await fixture(t, { chromium });
  await f.runtime.addSeat({ providerId: CHATGPT });
  assert.equal(restored.closed, true);
  assert.ok(chromium.timeline.indexOf('new-page') < chromium.timeline.indexOf('page-close'));
  const popup = await chromium.contexts[0].newPage();
  popup.navigate('https://accounts.google.com/login');
  assert.deepEqual(popup.evaluations, []);
  let cancelled = 0;
  popup.emit('download', { cancel: async () => { cancelled++; } });
  assert.equal(cancelled, 1);
});

test('invalid and private destinations are rejected before launch; one seat per pinned origin', async (t) => {
  const f = await fixture(t);
  for (const url of [
    'http://chatgpt.com/', 'file:///etc/passwd', 'data:text/html,hello', 'javascript:alert(1)',
    'https://user:password@chatgpt.com/', 'https://localhost/', 'https://host.local/',
    'https://127.1/', 'https://0x7f000001/', 'https://10.1.2.3/', 'https://172.16.0.1/',
    'https://192.168.1.1/', 'https://169.254.169.254/', 'https://100.64.0.1/',
    'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[fc00::1]/',
    'https://chatgpt.com:444/', 'https://chatgpt.com/?token=secret', 'https://chatgpt.com/#secret',
  ]) await assert.rejects(f.runtime.addSeat({ url }), code('INVALID_URL'), url);
  for (const spec of [null, {}, [], { providerId: CHATGPT, url: 'https://chatgpt.com/' }, { providerId: 'not-a-provider' }]) {
    await assert.rejects(f.runtime.addSeat(spec));
  }
  assert.equal(f.chromium.launches.length, 0);
  await f.runtime.addSeat({ url: 'https://chatgpt.com/c/not-a-fresh-chat' });
  assert.equal(f.runtime.list()[0].url, 'https://chatgpt.com/');
  await assert.rejects(f.runtime.addSeat({ providerId: CHATGPT }), code('DUPLICATE_ORIGIN'));
  assert.equal(f.chromium.launches.length, 1);
});

test('custom public sites and unreviewed providers stay manual even with plausible controls', async (t) => {
  const f = await fixture(t);
  for (const spec of [{ url: 'https://custom.example/chat' }, { providerId: 'minimax-chat' }, { providerId: 'xiaomi-mimo' }]) {
    const seat = await f.runtime.addSeat(spec);
    assert.notEqual(seat.status, 'ready');
    await assert.rejects(f.runtime.prepareSeat(seat.id, { sessionId: 'manual-review' }), code('MANUAL_ONLY'));
    await assert.rejects(send(f.runtime, seat.id), code('NOT_PREPARED'));
  }
  assert.equal(f.runtime.catalog().some((p) => p.id === f.runtime.list()[0].providerId), false);
  assert.equal(f.chromium.clicks.length, 0);
});

test('HTTP and WebSocket request guards block local destinations without any network access', async (t) => {
  const f = await fixture(t);
  await f.runtime.addSeat({ providerId: CHATGPT });
  const context = f.chromium.contexts[0];
  for (const [url, expected] of [
    ['https://8.8.8.8/resource?allowed=navigation', 'continue'],
    ['http://8.8.8.8/', 'abort'], ['https://127.0.0.1/', 'abort'],
    ['https://[::1]/', 'abort'], ['https://192.168.0.1/', 'abort'], ['file:///tmp/secret', 'abort'],
  ]) {
    const calls = [];
    await context.routeHandler({ request: () => ({ url: () => url }),
      continue: async () => { calls.push('continue'); }, abort: async () => { calls.push('abort'); } });
    assert.deepEqual(calls, [expected], url);
  }
  for (const [url, expected] of [['wss://8.8.8.8/socket', 'connect'], ['ws://8.8.8.8/', 'close'], ['wss://127.0.0.1/', 'close']]) {
    const calls = [];
    await context.socketHandler({ url: () => url, connectToServer: () => calls.push('connect'), close: () => calls.push('close') });
    assert.deepEqual(calls, [expected]);
  }
});

test('readiness inspects real controls, handles missing/ambiguous controls, drafts and generation', async (t) => {
  const f = await fixture(t);
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  const page = f.chromium.pages.at(-1);
  assert.equal(seat.status, 'ready');
  const original = page.editor.style;
  page.editor.style = { display: 'none' };
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'needs_login');
  page.editor.style = original;
  const extra = new Element('TEXTAREA', [page.adapter.composer]);
  page.form.append(extra);
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'attention');
  extra.selectors.clear();
  page.editor.value = 'Unsent human draft';
  assert.match((await f.runtime.checkSeat(seat.id)).detail, /draft/);
  page.editor.value = '';
  page.stopButton.style.display = 'block';
  assert.match((await f.runtime.checkSeat(seat.id)).detail, /generating/);
  page.stopButton.style.display = 'none';
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'ready');
  await assert.rejects(send(f.runtime, seat.id), code('NOT_PREPARED'));
  assert.equal(f.chromium.clicks.length, 0);
});

test('OAuth and same-origin login pages pause before reading any DOM; human return can be checked', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  for (const [url, errorCode] of [['https://accounts.google.com/login?token=secret', 'ORIGIN_DRIFT'], ['https://chatgpt.com/auth/login', 'LOGIN_REQUIRED']]) {
    const before = page.evaluations.length;
    page.navigate(url);
    assert.equal((await f.runtime.checkSeat(seat.id)).status, 'needs_login');
    assert.equal(page.evaluations.length, before, `${errorCode}: no cross-origin/login document evaluation`);
    await assert.rejects(send(f.runtime, seat.id, { operationId: errorCode }), code('NOT_PREPARED'));
  }
  page.navigate(seat.url);
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'ready');
  assert.equal(page.secretReads, 0);
  assert.equal(f.chromium.clicks.length, 0);
});

test('prepare always opens a fresh chat for a new meeting and never reads restored conversation text', async (t) => {
  const f = await fixture(t);
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  const old = f.chromium.pages.at(-1);
  const oldTurn = old.addTurn('PRIVATE EXISTING CONVERSATION');
  oldTurn.content.forbidText = true;
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'attention');
  assert.equal(oldTurn.content.textReads, 0);
  await f.runtime.prepareSeat(seat.id, { sessionId: 'meeting-one' });
  const fresh = f.chromium.pages.at(-1);
  assert.notEqual(fresh, old);
  assert.equal(old.closed, true);
  assert.deepEqual(fresh.navigations.map((n) => n.url), ['https://chatgpt.com/']);
  const count = f.chromium.pages.length;
  await f.runtime.prepareSeat(seat.id, { sessionId: 'meeting-one' });
  assert.equal(f.chromium.pages.length, count, 'Same preparation is idempotent');
  await f.runtime.prepareSeat(seat.id, { sessionId: 'meeting-two' });
  assert.equal(f.chromium.pages.length, count + 1);
  assert.equal(fresh.closed, true);
  assert.equal(f.chromium.launches.length, 1, 'Meetings share only the provider login profile');
});

for (const scenario of ['existing-transcript', 'draft', 'busy', 'ambiguous-send']) {
  test(`prepare refuses a nonempty or unsafe fresh page: ${scenario}`, async (t) => {
    const f = await fixture(t);
    const seat = await f.runtime.addSeat({ providerId: CHATGPT });
    f.chromium.contexts[0].configurePage = (page) => {
      if (scenario === 'existing-transcript') page.addTurn('Unexpected restored chat');
      if (scenario === 'draft') page.editor.value = 'Human draft';
      if (scenario === 'busy') page.stopButton.style.display = 'block';
      if (scenario === 'ambiguous-send') page.form.append(new Element('BUTTON', [page.adapter.send]));
    };
    const expected = { 'existing-transcript': 'UNEXPECTED_CHAT', draft: 'NONEMPTY_COMPOSER', busy: 'GENERATING', 'ambiguous-send': 'AMBIGUOUS_SURFACE' }[scenario];
    await assert.rejects(f.runtime.prepareSeat(seat.id, { sessionId: 'unsafe' }), code(expected));
    await assert.rejects(send(f.runtime, seat.id), code('NOT_PREPARED'));
    assert.equal(f.chromium.clicks.length, 0);
  });
}

test('prepare waits for the explicit safe surface instead of equating page load with readiness', async (t) => {
  const f = await fixture(t);
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  f.chromium.contexts[0].configurePage = (page) => {
    page.editor.style.display = 'none';
    page.onEvaluate = () => { if (page.evaluations.length >= 2) page.editor.style.display = 'block'; };
  };
  await f.runtime.prepareSeat(seat.id, { sessionId: 'surface-delayed' });
  assert.ok(f.chromium.pages.at(-1).evaluations.length >= 2);
  assert.equal(f.runtime.list()[0].status, 'ready');
});

test('send persists intent before its only click, captures only the new complete assistant turn, and caches detached results', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = (p) => {
    const saved = JSON.parse(readFileSync(journalPath(f), 'utf8'));
    assert.equal(saved.operations.length, 1);
    assert.equal(saved.operations[0].state, 'pending', 'Durable intent must precede external side effect');
    p.addTurn('First complete reply');
  };
  const [first, duplicate] = await Promise.all([send(f.runtime, seat.id), send(f.runtime, seat.id)]);
  assert.equal(first.responseText, 'First complete reply');
  assert.deepEqual(duplicate, first);
  assert.ok(first.elapsedMs >= 1500, 'Complete text must remain stable for the full capture window');
  first.responseText = 'Outside mutation';
  assert.equal((await send(f.runtime, seat.id)).responseText, 'First complete reply');
  assert.equal(page.fills.length, 1);
  assert.equal(page.clicks.length, 1);
  assert.ok(page.handles.every((h) => h.disposed));
  await assert.rejects(send(f.runtime, seat.id, { prompt: 'Different prompt' }), code('OPERATION_CONFLICT'));
  for (const element of page.scope.querySelectorAll(page.adapter.text)) element.forbidText = true;
  page.onClick = (p) => p.addTurn('Second complete reply');
  assert.equal((await send(f.runtime, seat.id, { operationId: 'second-operation' })).responseText, 'Second complete reply');
  assert.equal(page.clicks.length, 2);
  assert.equal((await f.runtime.checkSeat(seat.id)).status, 'ready');
  const stored = await readFile(journalPath(f), 'utf8');
  assert.doesNotMatch(stored, /Review prompt|First complete reply|Second complete reply|cookie|password/i);
  assert.deepEqual((await journal(f)).operations.map((entry) => entry.state), ['completed', 'completed']);
  assert.deepEqual((await readdir(f.dataDir)).filter((name) => name.endsWith('.tmp')), []);
});

test('same-origin switch to an unrelated chat invalidates the prepared session before any new send', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = (p) => p.addTurn('First reply');
  assert.equal((await send(f.runtime, seat.id)).responseText, 'First reply');
  const previousClicks = page.clicks.length;
  const previousFills = page.fills.length;
  // A different chat can have precisely the same number of messages.
  page.navigate('https://chatgpt.com/c/different-conversation');
  assert.equal(f.runtime.list()[0].status, 'attention');
  await assert.rejects(send(f.runtime, seat.id, { operationId: 'after-chat-switch' }), code('NOT_PREPARED'));
  assert.equal(page.clicks.length, previousClicks);
  assert.equal(page.fills.length, previousFills);
});

test('an unresponsive page.close cannot prevent cancellation from settling', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.closeGate = deferred();
  page.onFill = (p) => { p.editor.value = 'unexpected draft'; };
  const pending = outcome(send(f.runtime, seat.id, { operationId: 'blocked-close', timeoutMs: 100 }));
  await until(() => page.fills.length > 0, 'composer filled');
  const started = Date.now();
  await f.runtime.stop();
  const result = await pending;
  assert.ok(result.error, 'The aborted send must not be reported as complete');
  assert.ok(Date.now() - started < 2500, 'The bounded cleanup must release stop ownership');
  page.closeGate.resolve();
  await f.runtime.close();
});

test('changed drafts and origin drift between fill and click prevent every submission', async (t) => {
  for (const scenario of ['draft', 'origin']) {
    const f = await fixture(t);
    const { seat, page } = await f.prepared();
    page.onFill = (p) => {
      p.editor.value = scenario === 'draft' ? 'Changed by another actor' : 'Review prompt';
      if (scenario === 'origin') p.navigate('https://accounts.google.com/login');
    };
    await assert.rejects(send(f.runtime, seat.id), code(scenario === 'draft' ? 'DRAFT_CHANGED' : 'ORIGIN_DRIFT'));
    assert.equal(page.clicks.length, 0);
    assert.equal(page.closed, true);
    assert.equal((await journal(f)).operations.length, 0);
  }
});

test('surface rejects ambiguous reply counts, oversized text, and never captures old or user text', async (t) => {
  for (const scenario of ['two-assistants', 'no-user', 'oversized']) {
    const f = await fixture(t);
    const { seat, page } = await f.prepared();
    page.onClick = (p) => {
      const turn = p.addTurn(scenario === 'oversized' ? 'x'.repeat(65537) : 'Reply');
      turn.user.forbidText = true;
      if (scenario === 'two-assistants') p.scope.append(new Element('DIV', [p.adapter.assistant]));
      if (scenario === 'no-user') turn.user.selectors.clear();
    };
    const result = await outcome(send(f.runtime, seat.id, { timeoutMs: 60 }));
    assert.equal(result.error?.code, 'AMBIGUOUS_SEND');
    assert.equal(result.error.causeCode, scenario === 'two-assistants' ? 'UNEXPECTED_CHAT' : scenario === 'oversized' ? 'RESPONSE_TOO_LARGE' : 'TIMEOUT');
    assert.equal(page.clicks.length, 1);
    assert.equal((await journal(f)).operations[0].state, 'uncertain');
  }
});

test('unchanging text without a completion control or observed generation never counts as a reply', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = (p) => p.addTurn('May still be streaming', { complete: false });
  await assert.rejects(send(f.runtime, seat.id, { timeoutMs: 1750 }), (error) => {
    assert.equal(error.code, 'AMBIGUOUS_SEND');
    assert.equal(error.causeCode, 'TIMEOUT');
    return true;
  });
  assert.equal(page.clicks.length, 1);
});

test('REGRESSION: observed busy followed by missing completion evidence must not accept a partial reply', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = (p) => p.addTurn('Partial reply before interrupted stream', { complete: false, busy: true });
  let captures = 0;
  page.onEvaluate = (p, options) => {
    if (options.capture && ++captures >= 2) p.stopButton.style.display = 'none';
  };
  const result = await outcome(send(f.runtime, seat.id, { timeoutMs: 2200 }));
  assert.equal(result.error?.code, 'AMBIGUOUS_SEND', 'Busy disappearing is not proof that an assistant turn completed');
  assert.equal(result.error.causeCode, 'TIMEOUT');
});

test('REGRESSION: whitespace-only assistant content cannot satisfy a complete reply', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = (p) => p.addTurn(' \n\t ', { complete: true });
  const result = await outcome(send(f.runtime, seat.id, { timeoutMs: 1900 }));
  assert.equal(result.error?.code, 'AMBIGUOUS_SEND', 'Blank text is not an assistant answer');
});

test('ambiguous click failure is bounded, journaled and never blindly resent, including after restart', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  page.onClick = () => { throw new Error('password=SECRET https://accounts.example/?token=SECRET <private>HTML</private>'); };
  for (let i = 0; i < 2; i++) await assert.rejects(send(f.runtime, seat.id), (error) => {
    assert.equal(error.code, 'AMBIGUOUS_SEND');
    assert.equal(error.ambiguous, true);
    assert.equal(error.causeCode, 'DRIVER_FAILURE');
    assert.ok(error.message.length < 500);
    assert.doesNotMatch(error.message, /SECRET|private|HTML/);
    return true;
  });
  assert.equal(page.clicks.length, 1);
  assert.equal(page.closed, true);
  assert.doesNotMatch(f.runtime.list()[0].detail, /SECRET|private|HTML/);
  assert.equal((await journal(f)).operations[0].state, 'uncertain');
  const restored = await reload(f);
  await assert.rejects(send(restored.runtime, seat.id), code('AMBIGUOUS_SEND'));
  assert.deepEqual(restored.chromium.launches, []);
});

test('pending crash intents and completed operations survive reload without storing answers or replaying', async (t) => {
  const f = await fixture(t);
  const { seat } = await f.prepared();
  const saved = await journal(f);
  saved.operations = ['pending', 'completed'].map((state) => ({
    key: hash(`${seat.id}\u0000${state}`), seatId: seat.id, promptHash: hash('Review prompt'), state,
  }));
  await f.runtime.close();
  await writeFile(journalPath(f), JSON.stringify(saved));
  const restored = new ManagedBrowserRuntime({ dataDir: f.dataDir, chromium: new MockChromium() });
  f.runtimes.push(restored);
  await assert.rejects(send(restored, seat.id, { operationId: 'pending' }), code('AMBIGUOUS_SEND'));
  await assert.rejects(send(restored, seat.id, { operationId: 'completed' }), code('OPERATION_RECORDED'));
  await assert.rejects(send(restored, seat.id, { operationId: 'completed', prompt: 'changed' }), code('OPERATION_CONFLICT'));
  assert.equal(restored.list()[0].status, 'closed');
});

test('journal capacity and malformed storage fail closed without erasing existing evidence', async (t) => {
  const f = await fixture(t);
  const { seat } = await f.prepared();
  const saved = await journal(f);
  await f.runtime.close();
  saved.operations = Array.from({ length: 2048 }, (_, i) => ({ key: hash(`operation-${i}`), seatId: seat.id, promptHash: hash('prompt'), state: 'pending' }));
  await writeFile(journalPath(f), JSON.stringify(saved));
  const full = new ManagedBrowserRuntime({ dataDir: f.dataDir, chromium: new MockChromium() });
  f.runtimes.push(full);
  await assert.rejects(send(full, seat.id), code('OPERATION_LIMIT'));
  await full.close();
  await writeFile(journalPath(f), '{malformed evidence');
  const broken = new ManagedBrowserRuntime({ dataDir: f.dataDir, chromium: new MockChromium() });
  f.runtimes.push(broken);
  assert.equal(broken.getInfo().available, false);
  await assert.rejects(broken.addSeat({ providerId: CHATGPT }), code('STORAGE_FAILURE'));
  assert.equal(await readFile(journalPath(f), 'utf8'), '{malformed evidence');
});

test('failed journal writes prevent the click and disable further submissions', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  // Make only the atomic rename target unusable; do not alter source or permissions.
  await rename(journalPath(f), `${journalPath(f)}.saved`);
  await mkdir(journalPath(f));
  await assert.rejects(send(f.runtime, seat.id), code('STORAGE_FAILURE'));
  assert.equal(page.clicks.length, 0);
  assert.equal(f.runtime.getInfo().available, false);
  await assert.rejects(send(f.runtime, seat.id, { operationId: 'after-storage-failure' }), code('STORAGE_FAILURE'));
});

test('abort before fill and cancellation after click prevent future sends and ignore late completion', async (t) => {
  const f = await fixture(t);
  let prepared = await f.prepared();
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(send(f.runtime, prepared.seat.id, { signal: aborted.signal }), code('STOPPED'));
  assert.equal(prepared.page.fills.length, 0);
  await f.runtime.prepareSeat(prepared.seat.id, { sessionId: 'after-abort' });
  const page = f.chromium.pages.at(-1);
  const gate = deferred();
  page.onClick = () => gate.promise;
  const pending = outcome(send(f.runtime, prepared.seat.id, { operationId: 'cancel-after-click' }));
  await until(() => page.clicks.length === 1, 'one click');
  await Promise.all([f.runtime.stop(), f.runtime.stop()]);
  const result = await pending;
  assert.equal(result.error.code, 'AMBIGUOUS_SEND');
  assert.equal(result.error.causeCode, 'STOPPED');
  assert.equal(page.closed, true);
  const snapshot = f.runtime.list();
  gate.resolve();
  await delay(10);
  assert.deepEqual(f.runtime.list(), snapshot);
  await assert.rejects(send(f.runtime, prepared.seat.id, { operationId: 'no-more-work' }), code('NOT_PREPARED'));
  assert.equal(f.chromium.clicks.length, 1);
});

test('same-seat operations are serialized while different-seat pages remain isolated', async (t) => {
  const f = await fixture(t);
  const { seat, page } = await f.prepared();
  const other = await f.prepared(CLAUDE, 'second-provider');
  const gate = deferred();
  page.onFill = async (p, value) => { await gate.promise; p.editor.value = value; };
  const pending = outcome(send(f.runtime, seat.id));
  await until(() => page.fills.length === 1, 'blocked fill');
  await assert.rejects(send(f.runtime, seat.id, { operationId: 'concurrent' }), code('SEAT_BUSY'));
  await assert.rejects(f.runtime.prepareSeat(seat.id, { sessionId: 'concurrent-prepare' }), code('SEAT_BUSY'));
  assert.equal((await f.runtime.checkSeat(other.seat.id)).status, 'ready');
  const stopping = f.runtime.stop();
  gate.resolve();
  await stopping;
  assert.equal((await pending).error.code, 'STOPPED');
  assert.equal(f.chromium.clicks.length, 0);
});

test('REGRESSION: cancellation must settle even while launchPersistentContext is unresolved', async (t) => {
  const chromium = new MockChromium();
  chromium.launchGate = deferred();
  const f = await fixture(t, { chromium });
  const adding = outcome(f.runtime.addSeat({ providerId: CHATGPT }));
  await until(() => chromium.launches.length === 1, 'pending launch');
  let stopped = false;
  const stopping = f.runtime.stop().then(() => { stopped = true; });
  await delay(60);
  const settledBeforeDriver = stopped;
  chromium.launchGate.resolve(); // Always release the fake before asserting, so cleanup cannot hang.
  await Promise.all([adding, stopping]);
  assert.equal(chromium.contexts[0].closeCount, 1, 'A late-created context must be closed');
  assert.equal(settledBeforeDriver, true, 'Runtime.stop is held hostage by the unabortable launch await');
});

test('REGRESSION: cancellation must settle even while context.newPage is unresolved', async (t) => {
  const f = await fixture(t);
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  const context = f.chromium.contexts[0];
  context.newPageGate = deferred();
  const preparing = outcome(f.runtime.prepareSeat(seat.id, { sessionId: 'blocked-new-page' }));
  await until(() => f.chromium.timeline.filter((x) => x === 'new-page').length === 2, 'pending new page');
  let stopped = false;
  const stopping = f.runtime.stop().then(() => { stopped = true; });
  await delay(60);
  const settledBeforeDriver = stopped;
  context.newPageGate.resolve();
  await Promise.all([preparing, stopping]);
  assert.equal(settledBeforeDriver, true, 'Runtime.stop is held hostage by the unabortable newPage await');
});

function modelReply(prompt, provider) {
  const phase = prompt.split('\n').find((line) => line.startsWith('PHASE: '))?.slice(7);
  assert.ok(phase, 'Transport receives a real compiled-core prompt');
  return `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{
    kind: phase === 'final' ? 'final_position' : 'argument',
    stance: provider === CLAUDE ? 'Require more evidence' : 'Adopt safeguards',
    content: `${provider} ${phase}: authored fixture response`, confidence: 0.6,
    ...(phase === 'final' ? { caveats: ['Offline verification only.'] } : {}),
  }] })}</CHATCHAT_COUNCIL_JSON>`;
}

test('controller plus real runtime prepares all fresh pages before sealed sends and replays only saved evidence', async (t) => {
  const f = await fixture(t);
  f.chromium.configureContext = (context) => {
    context.configurePage = (page) => {
      page.onClick = (p) => {
        assert.equal(f.chromium.pages.filter((candidate) => !candidate.closed).length, 2, 'Both fresh chats exist before the first send');
        p.addTurn(modelReply(p.editor.value, p.providerId));
      };
    };
  };
  const controller = f.controller();
  await controller.addSeat({ providerId: CHATGPT });
  await controller.addSeat({ providerId: CLAUDE });
  const state = controller.startMeeting(proposal);
  assert.equal(state.busy, true);
  assert.equal(state.meeting.status, 'preparing');
  await assert.rejects(controller.removeSeat(state.seats[0].id), /current operation/);
  await until(() => !controller.getState().busy, 'meeting completion', 12000);
  const complete = controller.getState();
  assert.equal(complete.meeting.status, 'completed', complete.meeting.error);
  assert.equal(f.chromium.clicks.length, 6);
  assert.equal(complete.meeting.report.positions.length, 2);
  assert.equal(complete.meeting.report.consensusRatio, 0.5);
  assert.equal(complete.meeting.report.disagreements.length, 1);
  for (const phase of ['sealed', 'debate', 'final']) {
    const snapshots = f.chromium.clicks.filter((call) => call.prompt.includes(`PHASE: ${phase}\n`))
      .map((call) => call.prompt.split('\n').find((line) => line.startsWith('CONSULTATION_EVENTS_JSON: ')));
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0], snapshots[1]);
  }
  const saved = complete.meeting;
  await controller.newMeeting();
  assert.deepEqual((await controller.loadMeeting(saved.id)).meeting, saved);
  const markdown = await controller.exportData(saved.id);
  for (const position of saved.report.positions) assert.ok(markdown.includes(position.content));
  assert.match(markdown, /Remaining dissent/);
  assert.equal(f.chromium.clicks.length, 6);
  const disk = JSON.parse(await readFile(join(f.dataDir, 'controller', 'meetings', `${saved.id}.json`), 'utf8'));
  assert.deepEqual(disk.meeting, saved);
});

for (const failureMode of ['prepare', 'send']) {
  test(`controller all-${failureMode}-failure handling preserves unavailable seats, zero alignment, and no retries`, async (t) => {
    const f = await fixture(t);
    const controller = f.controller();
    await controller.addSeat({ providerId: CHATGPT });
    await controller.addSeat({ providerId: CLAUDE });
    for (const context of f.chromium.contexts) context.configurePage = (page) => {
      if (failureMode === 'prepare') page.editor.value = 'Unsent draft blocks preparation';
      else page.onClick = () => { throw new Error('Submission acknowledgement lost'); };
    };
    controller.startMeeting(proposal);
    await until(() => !controller.getState().busy, 'all-failure report');
    const state = controller.getState();
    assert.equal(state.meeting.report.consensusRatio, 0);
    assert.equal(state.meeting.report.consensusStance, null);
    assert.equal(state.meeting.report.confidence, 0);
    assert.equal(state.meeting.report.positions.length, 2);
    for (const position of state.meeting.report.positions) {
      assert.equal(position.stance, 'Unavailable');
      assert.equal(position.provenance.source, 'runtime_fallback');
      assert.equal(position.confidence, 0);
    }
    assert.ok(state.seats.every((seat) => seat.status === 'attention'));
    assert.equal(f.chromium.clicks.length, failureMode === 'prepare' ? 0 : 2);
    assert.match(await controller.exportData(state.meeting.id), /runtime fallback, not a model-authored position/);
  });
}

test('controller cancellation fences late real-runtime clicks and callbacks, and startup never replays interrupted work', async (t) => {
  const f = await fixture(t);
  const gate = deferred();
  f.chromium.configureContext = (context) => { context.configurePage = (page) => { page.onClick = () => gate.promise; }; };
  const controller = f.controller();
  await controller.addSeat({ providerId: CHATGPT });
  await controller.addSeat({ providerId: CLAUDE });
  const id = controller.startMeeting(proposal).meeting.id;
  await until(() => f.chromium.clicks.length === 2, 'two in-flight browser clicks');
  await Promise.all([controller.stopMeeting(), controller.stopMeeting()]);
  const cancelled = controller.getState();
  assert.equal(cancelled.busy, false);
  assert.equal(cancelled.meeting.status, 'cancelled');
  assert.equal(cancelled.meeting.report, null);
  gate.resolve();
  await delay(20);
  assert.deepEqual(controller.getState(), cancelled);
  await controller.close();
  const archive = join(f.dataDir, 'controller', 'meetings', `${id}.json`);
  const saved = JSON.parse(await readFile(archive, 'utf8'));
  saved.meeting.status = 'running';
  await writeFile(archive, JSON.stringify(saved));
  const restored = await reload(f);
  const recovered = f.controller({ runtime: restored.runtime });
  const loaded = await recovered.loadMeeting(id);
  assert.equal(loaded.meeting.status, 'failed');
  assert.equal(loaded.meeting.phase, 'interrupted');
  assert.match(loaded.meeting.error, /not resumed/);
  assert.deepEqual(restored.chromium.launches, []);
  assert.deepEqual(restored.chromium.clicks, []);
});

test('REGRESSION: a timed-out controller seat operation must not later mutate idle state or preferences', async (t) => {
  const chromium = new MockChromium();
  chromium.launchGate = deferred();
  const f = await fixture(t, { chromium });
  const controller = f.controller({ core: { ...core, prepareTimeoutMs: 40 } });
  await assert.rejects(controller.addSeat({ providerId: CHATGPT }), /timed out/);
  const state = controller.getState();
  assert.equal(state.busy, false);
  assert.deepEqual(state.seats, []);
  chromium.launchGate.resolve();
  await until(() => chromium.pages.length === 1, 'late browser page');
  await delay(20);
  assert.deepEqual(controller.getState().seats, state.seats, 'An expired seat-operation callback changed state after its public Promise rejected');
  assert.deepEqual(f.runtime.list(), [], 'An expired new seat must not survive as hidden runtime metadata');
});

test('a packaged browser integrity failure prevents all browser launches and further readiness', async (t) => {
  let proxyCalls = 0;
  let verifierCalls = 0;
  const f = await fixture(t, {
    runtimeOptions: {
      executablePath: '/fake/bundle/chrome.exe',
      browserVerifier: async () => { verifierCalls++; throw new Error('corrupted binary'); },
      networkProxy: async () => { proxyCalls++; throw new Error('proxy must not start'); },
    },
  });
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  assert.equal(seat.status, 'error');
  assert.equal(f.runtime.getInfo().available, false);
  assert.match(f.runtime.getInfo().message, /校验失败/);
  assert.equal(verifierCalls, 1);
  assert.equal(proxyCalls, 0);
  assert.equal(f.chromium.launches.length, 0);
  const reopened = await f.runtime.openSeat(seat.id);
  assert.equal(reopened.status, 'error');
  assert.equal(verifierCalls, 1, 'fail-closed integrity state persists for the runtime');
});

test('production browser launch is configured to use authenticated loopback CONNECT tunnels', async (t) => {
  let created = 0;
  let shutdowns = 0;
  const f = await fixture(t, {
    runtimeOptions: {
      networkProxy: async () => {
        created++;
        return {
          server: 'http://127.0.0.1:47311',
          username: 'chatchat',
          password: 'fixture-secret',
          close: async () => { shutdowns++; },
        };
      },
    },
  });
  await f.runtime.addSeat({ providerId: CHATGPT });
  await f.runtime.addSeat({ providerId: CLAUDE });
  assert.equal(created, 1, 'one internal proxy is reused for all seats');
  for (const context of f.chromium.contexts) {
    assert.equal(context.socketHandler, undefined,
      'Production must not connect WebSockets through the Playwright driver outside the proxy');
  }
  for (const { options } of f.chromium.launches) {
    assert.deepEqual(options.proxy, {
      server: 'http://127.0.0.1:47311',
      username: 'chatchat',
      password: 'fixture-secret',
    });
    assert.ok(options.args.includes('--proxy-bypass-list=<-loopback>'));
    assert.ok(options.args.includes('--disable-quic'));
    assert.ok(options.args.includes('--force-webrtc-ip-handling-policy=disable_non_proxied_udp'));
  }
  await f.runtime.close();
  assert.equal(shutdowns, 1);
});

test('secure proxy startup failure disables readiness and gives actionable recovery guidance', async (t) => {
  let starts = 0;
  const f = await fixture(t, {
    runtimeOptions: {
      networkProxy: async () => { starts++; throw new Error('fixture loopback bind denied'); },
    },
  });
  const seat = await f.runtime.addSeat({ providerId: CHATGPT });
  assert.equal(seat.status, 'error');
  assert.equal(f.runtime.getInfo().available, false);
  assert.match(f.runtime.getInfo().message, /安全网络通道/);
  assert.equal(starts, 1);
  assert.equal(f.chromium.launches.length, 0);
  const reopened = await f.runtime.openSeat(seat.id);
  assert.equal(reopened.status, 'error');
  assert.equal(starts, 1, 'Unsafe fallback/retry must not run after a failed proxy initialization');
});
