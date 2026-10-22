import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createController } from '../main/controller.mjs';
import { CouncilOrchestrator } from '../generated/src/core/orchestrator.js';
import { BrowserConsultationAgent } from '../generated/src/provider-sdk/consultation-agent.js';

const clone = (value) => structuredClone(value);
const input = (overrides = {}) => ({ proposal: 'Should we adopt this proposal?', mode: 'balanced', maxRounds: 2, ...overrides });
const core = { CouncilOrchestrator, BrowserConsultationAgent, timeoutMs: 150, prepareTimeoutMs: 150, closeTimeoutMs: 150 };
const providers = [
  { id: 'alpha', name: 'Alpha', url: 'https://alpha.example/', automation: 'experimental' },
  { id: 'beta', name: 'Beta', url: 'https://beta.example/', automation: 'experimental' },
  { id: 'gamma', name: 'Gamma', url: 'https://gamma.example/', automation: 'manual' },
];
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function promptField(prompt, key) {
  const line = prompt.split('\n').find((item) => item.startsWith(`${key}: `));
  assert.ok(line, `Real core prompt contains ${key}`);
  return line.slice(key.length + 2);
}
function response(prompt, id) {
  const phase = promptField(prompt, 'PHASE');
  const stance = id.includes('beta') ? 'Wait for evidence' : 'Adopt with safeguards';
  return { responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{
    kind: phase === 'final' ? 'final_position' : 'argument', stance,
    content: `${id} ${phase}: actual fixture position`, confidence: 0.65,
    ...(phase === 'final' ? { caveats: ['The fixture establishes no live compatibility.'] } : {}),
  }] })}</CHATCHAT_COUNCIL_JSON>`, elapsedMs: 1 };
}
class Runtime {
  seats = new Map();
  calls = [];
  info = { available: true, label: 'Test managed browser', message: 'Deterministic test only' };
  onChange = () => {};
  sendHook = null;
  prepareHook = null;
  stopHook = null;
  closeHook = null;
  serial = 0;
  getInfo() { return clone(this.info); }
  catalog() { return clone(providers); }
  list() { return clone([...this.seats.values()]); }
  async addSeat(spec) {
    this.calls.push({ method: 'add', spec });
    const provider = spec.providerId ? providers.find((item) => item.id === spec.providerId)
      : { id: 'custom', name: 'Custom', url: spec.url };
    const seat = { id: `seat-${provider.id}-${++this.serial}`, providerId: provider.id, name: provider.name, url: provider.url, status: 'ready', detail: 'Fixture ready', password: 'must never reach state' };
    this.seats.set(seat.id, seat);
    this.onChange(clone(seat));
    return clone(seat);
  }
  async openSeat(id) { this.calls.push({ method: 'open', id }); return clone(this.seats.get(id)); }
  async checkSeat(id) { this.calls.push({ method: 'check', id }); return clone(this.seats.get(id)); }
  async removeSeat(id) { this.calls.push({ method: 'remove', id }); this.seats.delete(id); }
  async prepareSeat(id, options) {
    this.calls.push({ method: 'prepare', id, ...options });
    return this.prepareHook?.(id, options);
  }
  async send(id, options) {
    this.calls.push({ method: 'send', id, ...options });
    return this.sendHook ? this.sendHook(id, options) : response(options.prompt, id);
  }
  async stop() { this.calls.push({ method: 'stop' }); return this.stopHook?.(); }
  async close() { this.calls.push({ method: 'close' }); return this.closeHook?.(); }
}
async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'chatchat-controller-'));
  const runtime = options.runtime ?? new Runtime();
  const controller = createController({ runtime, dataDir, core, ...options });
  runtime.onChange = controller.runtimeChanged;
  t.after(async () => { await controller.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { dataDir, runtime, controller };
}
async function ready(controller, count = 2) {
  for (const provider of providers.slice(0, count)) await controller.addSeat({ providerId: provider.id });
  return controller.getState().seats;
}
async function until(predicate, message = 'condition', timeout = 2500) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) assert.fail(`Timed out waiting for ${message}`);
    await delay(5);
  }
}
async function finished(controller) {
  await until(() => !controller.getState().busy, 'finite meeting task');
  return controller.getState();
}
const sent = (runtime) => runtime.calls.filter((call) => call.method === 'send');
const archivedPath = (dataDir, id) => join(dataDir, 'controller', 'meetings', `${id}.json`);

test('empty startup is honest, detached, and opens no model windows', async (t) => {
  const { controller, runtime } = await fixture(t);
  const state = controller.getState();
  assert.equal(state.version, '0.10.2');
  assert.equal(state.meeting, null);
  assert.deepEqual(state.seats, []);
  assert.equal(state.busy, false);
  assert.deepEqual(runtime.calls, []);
  assert.equal(state.providers[2].automation, 'manual');
  state.runtime.available = false;
  state.providers[0].name = 'Changed outside';
  assert.equal(controller.getState().runtime.available, true);
  assert.equal(controller.getState().providers[0].name, 'Alpha');
  runtime.info = { available: false, label: 'Managed Chromium', message: 'Packaged browser is missing.' };
  await ready(controller);
  assert.throws(() => controller.startMeeting(input()), /unavailable/);
  assert.equal(controller.getState().runtime.message, 'Packaged browser is missing.');
  assert.equal(sent(runtime).length, 0);
});

test('seat preferences persist without secrets, restore closed, and rehydrate stable ids only on explicit open', async (t) => {
  const { controller, runtime, dataDir } = await fixture(t);
  const [seat] = await ready(controller);
  assert.equal(controller.getState().seats[0].password, undefined);
  const saved = JSON.parse(await readFile(join(dataDir, 'controller', 'preferences.json'), 'utf8'));
  assert.equal(saved.seats[0].password, undefined);
  assert.equal(saved.seats[0].status, undefined);
  await controller.close();
  const secondRuntime = new Runtime();
  secondRuntime.serial = 20;
  const restored = createController({ runtime: secondRuntime, dataDir, core });
  secondRuntime.onChange = restored.runtimeChanged;
  t.after(() => restored.close());
  assert.deepEqual(secondRuntime.calls, []);
  assert.equal(restored.getState().seats[0].status, 'closed');
  assert.throws(() => restored.startMeeting(input()), /ready seats/);
  await restored.openSeat(seat.id);
  assert.equal(restored.getState().seats[0].id, seat.id);
  assert.equal(restored.getState().seats[0].status, 'ready');
  const actual = secondRuntime.list()[0];
  assert.notEqual(actual.id, seat.id);
  actual.status = 'needs_login';
  actual.detail = 'Sign in in the managed browser.';
  secondRuntime.seats.set(actual.id, actual);
  restored.runtimeChanged(actual);
  assert.equal(restored.getState().seats[0].status, 'needs_login');
  await restored.removeSeat(seat.id);
  assert.equal(restored.getState().seats.length, 1);
  assert.equal(secondRuntime.calls.at(-1).id, actual.id);
  assert.equal(runtime.calls.filter((call) => call.method === 'add').length, 2);
});

test('two ready seats can deliberate while a third unready seat remains parked without prompt delivery', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller, 3);
  const gamma = runtime.list().find((seat) => seat.providerId === 'gamma');
  assert.ok(gamma);
  gamma.status = 'needs_login';
  gamma.detail = 'Manual provider; no unattended sending.';
  runtime.seats.set(gamma.id, gamma);
  controller.runtimeChanged(gamma);
  const started = controller.startMeeting(input());
  assert.equal(started.meeting.participatingSeatIds.length, 2);
  assert.equal(started.seats.length, 3);
  assert.ok(!started.meeting.participatingSeatIds.includes(gamma.id));
  const complete = await finished(controller);
  assert.equal(complete.meeting.report.positions.length, 2);
  assert.ok(runtime.calls.filter((call) => call.method === 'send' && call.id === gamma.id).length === 0);
  assert.equal(complete.seats.find((seat) => seat.id === gamma.id).status, 'needs_login');
});

test('provider and input validation happens before runtime mutations or sends', async (t) => {
  const { controller, runtime } = await fixture(t);
  for (const spec of [null, {}, { providerId: 'missing' }, { providerId: 'alpha', url: providers[0].url },
    { url: 'file:///etc/passwd' }, { url: 'https://user:pass@public.example/' },
    { url: 'https://127.0.0.1/' }, { url: 'https://[::1]/' }, { url: 'https://10.0.0.4/' },
    { url: 'https://192.168.1.1/' }, { url: 'https://localhost/' }, { url: 'https://host.local/' }, { url: 1 }]) {
    await assert.rejects(controller.addSeat(spec));
  }
  assert.deepEqual(runtime.calls, []);
  assert.throws(() => controller.startMeeting(input()), /ready seats/);
  await ready(controller);
  await assert.rejects(controller.addSeat({ providerId: 'alpha' }), /one equal/);
  await assert.rejects(controller.addSeat({ url: 'https://alpha.example/other' }), /one equal/);
  for (const invalid of [null, {}, input({ proposal: ' ' }), input({ proposal: 'a'.repeat(8001) }),
    input({ proposal: {} }), input({ maxRounds: 1 }), input({ maxRounds: 9 }), input({ maxRounds: 2.1 }),
    input({ maxRounds: Infinity }), input({ maxRounds: '2' }), input({ mode: 'chair' })]) {
    assert.throws(() => controller.startMeeting(invalid));
  }
  assert.equal(sent(runtime).length, 0);
  assert.equal(controller.getState().meeting, null);
});

test('real compiled core seals round 1, batches shared snapshots, and preserves actual finals and dissent', async (t) => {
  const observed = [];
  const persistenceFailures = [];
  const { controller, runtime, dataDir } = await fixture(t, { onChange: (state) => {
    observed.push(state);
    if (state.meeting?.events.length) {
      try {
        const disk = JSON.parse(readFileSync(archivedPath(dataDir, state.meeting.id), 'utf8'));
        assert.equal(disk.meeting.events.length, state.meeting.events.length);
      } catch (error) { persistenceFailures.push(error); }
    }
  } });
  const seats = await ready(controller);
  const snapshot = controller.startMeeting(input({ proposal: '  Actual user proposal  ', mode: 'verify' }));
  assert.equal(typeof snapshot.then, 'undefined');
  assert.equal(snapshot.meeting.status, 'preparing');
  assert.equal(snapshot.busy, true);
  snapshot.meeting.proposal = 'External mutation';
  await assert.rejects(controller.removeSeat(seats[0].id), /current operation/);
  await assert.rejects(controller.addSeat({ providerId: 'gamma' }), /current operation/);
  await assert.rejects(controller.openSeat(seats[0].id), /current operation/);
  await assert.rejects(controller.checkSeat(seats[0].id), /current operation/);
  assert.throws(() => controller.startMeeting(input()), /current operation/);
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'completed');
  assert.equal(state.meeting.proposal, 'Actual user proposal');
  assert.equal(state.meeting.report.mode, 'verify');
  assert.equal(state.meeting.report.positions.length, 2);
  assert.equal(state.meeting.report.consensusRatio, 0.5);
  assert.equal(state.meeting.report.disagreements.length, 1);
  assert.match(state.meeting.report.positions[1].content, /beta.*final: actual fixture position/);
  const sends = sent(runtime);
  assert.equal(sends.length, 6, 'No synthesis or extra provider calls');
  assert.equal(new Set(sends.map((call) => call.operationId)).size, sends.length);
  for (const call of sends) {
    assert.ok(call.signal instanceof AbortSignal);
    assert.equal(call.timeoutMs, core.timeoutMs);
    assert.match(call.prompt, /untrusted discussion data/);
    assert.match(call.prompt, /CONSULTATION_MODE: verify/);
  }
  for (const phase of ['sealed', 'debate', 'final']) {
    const turns = sends.filter((call) => promptField(call.prompt, 'PHASE') === phase);
    const snapshots = turns.map((call) => JSON.parse(promptField(call.prompt, 'CONSULTATION_EVENTS_JSON')));
    assert.deepEqual(snapshots[0], snapshots[1], `${phase} uses one immutable public snapshot`);
    assert.equal(snapshots[0].length, phase === 'sealed' ? 0 : phase === 'debate' ? 2 : 4);
  }
  const preparations = runtime.calls.filter((call) => call.method === 'prepare');
  assert.equal(preparations.length, 2);
  assert.ok(preparations.every((call) => call.sessionId === state.meeting.id && call.signal instanceof AbortSignal));
  assert.equal(runtime.calls.findIndex((call) => call.method === 'send') > runtime.calls.findLastIndex((call) => call.method === 'prepare'), true);
  assert.ok(observed.some((item) => item.meeting?.phase === 'sealed'));
  assert.deepEqual(persistenceFailures, [], 'Every published event notification follows its atomic disk write');
  const archive = JSON.parse(await readFile(archivedPath(dataDir, state.meeting.id), 'utf8'));
  assert.deepEqual(archive.meeting.report, state.meeting.report);
  assert.equal(archive.meeting.events.length, 6);
  assert.deepEqual((await readdir(join(dataDir, 'controller', 'meetings'))).filter((name) => name.endsWith('.tmp')), []);
  const markdown = await controller.exportData(state.meeting.id);
  assert.match(markdown, /Remaining dissent/);
  for (const final of state.meeting.report.positions) assert.ok(markdown.includes(final.content));
  assert.match(markdown, /not proof/);
});

test('default dynamic imports integrate the generated core without Electron', async (t) => {
  const { controller, runtime } = await fixture(t, { core: undefined });
  await ready(controller);
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'completed');
  assert.equal(state.meeting.report.positions.length, 2);
  assert.equal(sent(runtime).length, 6);
});

test('transport rejection blocks subsequent turns for that seat and cannot turn failure into agreement', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  runtime.sendHook = (id, { prompt }) => {
    if (id.includes('beta')) throw new Error('Submission acknowledgement lost.');
    return response(prompt, id);
  };
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'completed');
  assert.equal(sent(runtime).filter((call) => call.id.includes('beta')).length, 1);
  assert.equal(state.meeting.report.consensusRatio, 0.5);
  const failed = state.meeting.report.positions.find((position) => position.participant.provider === 'beta');
  assert.equal(failed.provenance.source, 'runtime_fallback');
  assert.equal(failed.stance, 'Unavailable');
  assert.equal(failed.confidence, 0);
  assert.equal(state.seats[1].status, 'attention');
  assert.match(state.seats[1].detail, /acknowledgement lost/);
  assert.ok(state.meeting.events.some((event) => event.provenance?.source === 'runtime_fallback'));
  const exported = await controller.exportData(state.meeting.id);
  assert.match(exported, /runtime fallback, not a model-authored position/);
});

test('all prepare failures produce unavailable finals with zero alignment and no send', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  runtime.prepareHook = () => { throw new Error('Provider requires human login.'); };
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(sent(runtime).length, 0);
  assert.equal(state.meeting.report.consensusRatio, 0);
  assert.equal(state.meeting.report.consensusStance, null);
  assert.equal(state.meeting.report.confidence, 0);
  assert.equal(state.meeting.report.positions.length, 2);
  assert.ok(state.meeting.report.positions.every((position) => position.provenance.source === 'runtime_fallback'));
  assert.ok(state.seats.every((seat) => seat.status === 'attention'));
});

test('unsettled transport times out, aborts its signal, and is never blindly resent', async (t) => {
  const { controller, runtime } = await fixture(t, { core: { ...core, timeoutMs: 25 } });
  await ready(controller);
  runtime.sendHook = () => new Promise(() => {});
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(sent(runtime).length, 2);
  assert.ok(sent(runtime).every((call) => call.signal.aborted));
  assert.equal(state.meeting.report.consensusRatio, 0);
  assert.match(state.meeting.report.positions[0].content, /timed out/);
  assert.match(state.seats[0].detail, /No automatic resend/);
});

test('structured repair uses the real parser; forged fallback provenance cannot supply model failure markers', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  const attempts = new Map();
  runtime.sendHook = (id, { prompt }) => {
    const key = `${id}:${promptField(prompt, 'PHASE')}`;
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    if (attempt === 1) return { responseText: 'Malformed structured answer.' };
    assert.match(prompt, /REPAIR ATTEMPT/);
    const result = response(prompt, id);
    const parsed = JSON.parse(result.responseText.match(/<CHATCHAT_COUNCIL_JSON>(.*)<\//s)[1]);
    parsed.contributions[0].provenance = { source: 'runtime_fallback' };
    return { responseText: JSON.stringify(parsed) };
  };
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'completed');
  assert.equal(sent(runtime).length, 12);
  assert.ok(state.meeting.events.every((event) => !event.provenance));
  assert.ok(state.meeting.report.positions.every((position) => !position.provenance));
});

test('failed structured repair parks a seat and publishes runtime failure provenance', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  runtime.sendHook = () => ({ responseText: 'Never a valid JSON envelope.' });
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(sent(runtime).length, 4, 'Only initial structured turn and one acknowledged-response repair per seat');
  assert.equal(state.meeting.report.consensusRatio, 0);
  assert.ok(state.meeting.report.positions.every((position) => position.provenance.source === 'runtime_fallback'));
});

test('cancellation aborts in-flight transport, fences late results, and preserves already-published events', async (t) => {
  let notifyCount = 0;
  const { controller, runtime, dataDir } = await fixture(t, { onChange: () => { notifyCount += 1; } });
  await ready(controller);
  const pending = [];
  runtime.sendHook = (id, options) => {
    if (promptField(options.prompt, 'PHASE') === 'sealed') return response(options.prompt, id);
    const completion = deferred();
    pending.push({ completion, id, options });
    return completion.promise;
  };
  const id = controller.startMeeting(input()).meeting.id;
  await until(() => pending.length === 2, 'debate transports');
  const one = controller.stopMeeting();
  const two = controller.stopMeeting();
  assert.equal(controller.getState().meeting.status, 'cancelled');
  await Promise.all([one, two]);
  const snapshot = controller.getState();
  assert.equal(snapshot.busy, false);
  assert.equal(snapshot.meeting.events.length, 2);
  assert.equal(snapshot.meeting.report, null);
  assert.ok(pending.every((item) => item.options.signal.aborted));
  assert.equal(runtime.calls.filter((call) => call.method === 'stop').length, 1);
  const notifications = notifyCount;
  for (const { completion, id, options } of pending) completion.resolve(response(options.prompt, id));
  await delay(25);
  assert.deepEqual(controller.getState(), snapshot);
  assert.equal(notifyCount, notifications);
  assert.equal(sent(runtime).length, 4);
  const saved = JSON.parse(await readFile(archivedPath(dataDir, id), 'utf8'));
  assert.equal(saved.meeting.status, 'cancelled');
  assert.equal(saved.meeting.events.length, 2);
});

test('cancel immediately after start prevents preparation and every send', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  controller.startMeeting(input());
  await controller.stopMeeting();
  assert.equal(sent(runtime).length, 0);
  assert.equal(runtime.calls.filter((call) => call.method === 'prepare').length, 0);
  assert.equal(controller.getState().meeting.status, 'cancelled');
});

test('late core phase/event callbacks and report cannot mutate a cancelled or new meeting', async (t) => {
  let callbacks;
  const completion = deferred();
  class LateCore {
    constructor() {}
    run(_proposal, options) { callbacks = options; return completion.promise; }
  }
  const { controller, runtime } = await fixture(t, { core: { ...core, CouncilOrchestrator: LateCore } });
  await ready(controller);
  controller.startMeeting(input());
  await until(() => callbacks, 'core callbacks');
  await controller.stopMeeting();
  await controller.newMeeting();
  const snapshot = controller.getState();
  await assert.rejects(callbacks.onPhase({ phase: 'final', round: 3 }), /cancelled/);
  await assert.rejects(callbacks.onEvent({ id: 'late', kind: 'final_position' }), /cancelled/);
  completion.resolve({ report: { positions: [], disagreements: [] } });
  await delay(10);
  assert.deepEqual(controller.getState(), snapshot);
  assert.equal(sent(runtime).length, 0);
});

test('new meetings prepare a fresh chat for every frozen slot; replay/export never regenerate', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  const first = controller.startMeeting(input()).meeting.id;
  await finished(controller);
  const original = controller.getState().meeting;
  await controller.newMeeting();
  assert.equal(controller.getState().meeting, null);
  const second = controller.startMeeting(input({ proposal: 'A different question' })).meeting.id;
  await finished(controller);
  assert.notEqual(first, second);
  const preparations = runtime.calls.filter((call) => call.method === 'prepare');
  assert.equal(preparations.length, 4);
  assert.deepEqual(preparations.map((call) => call.sessionId), [first, first, second, second]);
  const before = sent(runtime).length;
  const state = await controller.loadMeeting(first);
  assert.deepEqual(state.meeting, original);
  await controller.exportData(first);
  await assert.rejects(controller.loadMeeting('../preferences'), /Unknown/);
  await assert.rejects(controller.exportData('../preferences'), /Unknown/);
  assert.equal(sent(runtime).length, before);
  assert.equal(controller.getState().history.length, 2);
});

test('startup recovers interrupted archives atomically without opening windows or replaying', async (t) => {
  const { controller, dataDir } = await fixture(t);
  await ready(controller);
  const id = controller.startMeeting(input()).meeting.id;
  await finished(controller);
  await controller.close();
  const path = archivedPath(dataDir, id);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  saved.meeting.status = 'running';
  saved.meeting.phase = 'debate';
  saved.meeting.report = null;
  saved.meeting.error = 'Earlier explicit error.';
  await writeFile(path, JSON.stringify(saved));
  // A partial atomic-write temp is not an archive and is never replayed.
  await writeFile(`${path}.abandoned.tmp`, '{not json');
  const runtime = new Runtime();
  const recovered = createController({ runtime, dataDir, core });
  t.after(() => recovered.close());
  assert.deepEqual(runtime.calls, []);
  assert.equal(recovered.getState().history[0].status, 'failed');
  const state = await recovered.loadMeeting(id);
  assert.equal(state.meeting.phase, 'interrupted');
  assert.match(state.meeting.error, /Earlier explicit error/);
  assert.match(state.meeting.error, /not resumed/);
  assert.equal(state.meeting.events.length, 6);
  const disk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(disk.meeting.status, 'failed');
  assert.deepEqual(runtime.calls, []);
});

test('failed initial atomic persistence prevents provider activity and preserves storage errors', async (t) => {
  const { controller, runtime, dataDir } = await fixture(t);
  await ready(controller);
  const path = join(dataDir, 'controller', 'meetings');
  await rename(path, `${path}-saved`);
  await writeFile(path, 'This is deliberately not a directory.');
  controller.startMeeting(input());
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'failed');
  assert.match(state.meeting.error, /ENOTDIR|not a directory|Local storage/);
  assert.match(state.runtime.message, /Local storage/);
  assert.equal(sent(runtime).length, 0);
  assert.equal(runtime.calls.filter((call) => call.method === 'prepare').length, 0);
  await rm(path);
  await mkdir(path);
});

test('core failures are preserved, finite, and persisted rather than converted into a report', async (t) => {
  class BrokenCore {
    constructor() {}
    async run() { throw new Error('Concrete orchestration failure.'); }
  }
  const { controller, dataDir } = await fixture(t, { core: { ...core, CouncilOrchestrator: BrokenCore } });
  await ready(controller);
  const id = controller.startMeeting(input()).meeting.id;
  const state = await finished(controller);
  assert.equal(state.meeting.status, 'failed');
  assert.equal(state.meeting.report, null);
  assert.match(state.meeting.error, /Concrete orchestration failure/);
  const disk = JSON.parse(await readFile(archivedPath(dataDir, id), 'utf8'));
  assert.match(disk.meeting.error, /Concrete orchestration failure/);
});

test('shutdown aborts active tasks, invokes close even if stop hangs, and remains bounded', async (t) => {
  const { controller, runtime } = await fixture(t, { core: { ...core, closeTimeoutMs: 30 } });
  await ready(controller);
  runtime.sendHook = () => new Promise(() => {});
  runtime.stopHook = () => new Promise(() => {});
  runtime.closeHook = () => new Promise(() => {});
  controller.startMeeting(input());
  await until(() => sent(runtime).length === 2, 'in-flight sends');
  const start = Date.now();
  const closing = controller.close();
  assert.equal(controller.close(), closing, 'Close is idempotent');
  await closing;
  assert.ok(Date.now() - start < 500, 'Shutdown is bounded even for a broken driver');
  assert.ok(sent(runtime).every((call) => call.signal.aborted));
  assert.equal(runtime.calls.filter((call) => call.method === 'close').length, 1);
  assert.equal(controller.getState().meeting.status, 'cancelled');
  assert.throws(() => controller.startMeeting(input()), /closing/);
  await delay(50); // Allow bounded stop/persistence cleanup before temporary-directory teardown.
});

test('malformed archives are preserved in quarantine while healthy history remains usable', async (t) => {
  const { controller, dataDir } = await fixture(t);
  await ready(controller);
  const damagedId = controller.startMeeting(input()).meeting.id;
  await finished(controller);
  await controller.newMeeting();
  const healthyId = controller.startMeeting(input({ proposal: 'Retain a healthy meeting' })).meeting.id;
  await finished(controller);
  await controller.close();
  const original = archivedPath(dataDir, damagedId);
  const source = '{bad archive';
  await writeFile(original, source);
  const runtime = new Runtime();
  const recovered = createController({ runtime, dataDir, core });
  t.after(() => recovered.close());
  const state = recovered.getState();
  assert.deepEqual(runtime.calls, []);
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].id, healthyId);
  assert.match(state.runtime.message, /异常历史记录/);
  const files = await readdir(join(dataDir, 'controller', 'meetings'));
  const copies = files.filter((name) => name.startsWith(damagedId + '.json.corrupt-'));
  assert.equal(copies.length, 1, 'Exactly one quarantined original must survive');
  assert.equal(await readFile(join(dataDir, 'controller', 'meetings', copies[0]), 'utf8'), source);
  assert.equal(existsSync(original), false);
  const healthy = await recovered.loadMeeting(healthyId);
  assert.equal(healthy.meeting.proposal, 'Retain a healthy meeting');
  const again = createController({ runtime: new Runtime(), dataDir, core });
  t.after(() => again.close());
  assert.equal(again.getState().history.length, 1);
  assert.equal((await readdir(join(dataDir, 'controller', 'meetings'))).filter((name) => name.includes('.corrupt-')).length, 1);
});

test('optional real-model synthesis requires an explicit click, preserves dissent and archives peer review', async (t) => {
  const { controller, runtime, dataDir } = await fixture(t);
  await ready(controller);
  const originalId = controller.startMeeting(input({ proposal: 'Pilot or full release?' })).meeting.id;
  const complete = await finished(controller);
  assert.equal(complete.meeting.status, 'completed');
  assert.equal(complete.synthesisAvailable, true);
  assert.equal(complete.synthesisPlannedRequests, 2);
  const events = complete.meeting.events.filter((e) => e.kind === 'final_position' && e.provenance?.source !== 'runtime_fallback');
  assert.ok(events.length >= 2);
  const callsBefore = sent(runtime).length;
  runtime.sendHook = async (_id, args) => {
    if (args.prompt.includes('Return only <CHATCHAT_SYNTHESIS_V1>')) {
      return {
        responseText: '<CHATCHAT_SYNTHESIS_V1>' + JSON.stringify({
          answer: 'Run a reversible pilot first. Preserve the concern about missing evidence.',
          eventIds: events.slice(0, 2).map((e) => e.id),
          caveats: ['The model claims have not been independently fact-checked.'],
        }) + '</CHATCHAT_SYNTHESIS_V1>', elapsedMs: 1,
      };
    }
    assert.match(args.prompt, /CHATCHAT_REVIEW_V1/);
    return { responseText: '<CHATCHAT_REVIEW_V1>' + JSON.stringify({
      verdict: 'approve', commentary: 'The answer retains the minority conditions.',
      eventIds: [events[1].id],
    }) + '</CHATCHAT_REVIEW_V1>', elapsedMs: 1 };
  };
  const started = controller.synthesizeMeeting();
  assert.equal(started.meeting.synthesis.status, 'drafting');
  assert.equal(started.synthesisAvailable, false);
  await until(() => !controller.getState().busy, 'synthesis finished');
  const result = controller.getState();
  assert.equal(result.meeting.id, originalId);
  assert.equal(result.meeting.status, 'completed');
  assert.equal(result.meeting.synthesis.status, 'reviewed');
  assert.equal(result.meeting.synthesis.reviews.length, 1);
  assert.equal(sent(runtime).length, callsBefore + 2);
  assert.match(result.meeting.synthesis.draft.answer, /reversible pilot/);
  assert.throws(() => controller.synthesizeMeeting(), /just-completed live meeting/);
  const exported = await controller.exportData(originalId);
  assert.match(exported, /Optional post-meeting synthesis/);
  assert.match(exported, /Internal discussion event IDs/);
  const archived = JSON.parse(await readFile(archivedPath(dataDir, originalId), 'utf8'));
  assert.equal(archived.meeting.synthesis.status, 'reviewed');
  await controller.newMeeting();
  await controller.loadMeeting(originalId);
  assert.equal(controller.getState().meeting.synthesis.status, 'reviewed');
  assert.equal(controller.getState().synthesisAvailable, false);
  assert.equal(controller.getState().synthesisPlannedRequests, 0);
  assert.equal(sent(runtime).length, callsBefore + 2, 'Historical loading must never resend synthesis');
});

test('synthesis refuses fabricated evidence IDs without blaming peers or changing the original report', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  controller.startMeeting(input());
  const completed = await finished(controller);
  const originalReport = completed.meeting.report;
  const initialSends = sent(runtime).length;
  runtime.sendHook = async () => ({
    responseText: '<CHATCHAT_SYNTHESIS_V1>' + JSON.stringify({
      answer: 'Fabricated supporting event', eventIds: ['imaginary-event'], caveats: [],
    }) + '</CHATCHAT_SYNTHESIS_V1>', elapsedMs: 1,
  });
  controller.synthesizeMeeting();
  await until(() => !controller.getState().busy, 'failed synthesis');
  const result = controller.getState().meeting;
  assert.equal(result.synthesis.status, 'failed');
  assert.equal(result.synthesis.draft, null);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.report, originalReport);
  assert.equal(sent(runtime).length, initialSends + 1, 'No reviewer should see invalid draft');
});

test('peer rejection remains visible rather than silently becoming consensus', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  controller.startMeeting(input());
  const prior = await finished(controller);
  const refs = prior.meeting.events.filter((e) => e.kind === 'final_position' && !e.provenance).slice(0, 2);
  assert.equal(refs.length,2);
  runtime.sendHook = async (_id, opts) => ({
    responseText: opts.prompt.includes('CHATCHAT_SYNTHESIS_V1') ?
      '<CHATCHAT_SYNTHESIS_V1>' + JSON.stringify({answer:'Possible recommendation',eventIds:refs.map((e)=>e.id),caveats:[]}) + '</CHATCHAT_SYNTHESIS_V1>' :
      '<CHATCHAT_REVIEW_V1>' + JSON.stringify({verdict:'reject',commentary:'The minority argument is underrepresented.',eventIds:[refs[1].id]}) + '</CHATCHAT_REVIEW_V1>',
    elapsedMs: 1,
  });
  controller.synthesizeMeeting();
  await until(() => !controller.getState().busy, 'review rejected');
  assert.equal(controller.getState().meeting.synthesis.status, 'disputed');
  assert.equal(controller.getState().meeting.synthesis.reviews[0].verdict, 'reject');
});

test('stopping synthesis leaves the completed council intact and does not retry a late draft', async (t) => {
  const { controller, runtime, dataDir } = await fixture(t);
  await ready(controller);
  controller.startMeeting(input());
  const before = await finished(controller);
  const originalReport = before.meeting.report;
  const initialSends = sent(runtime).length;
  const blocked = deferred();
  runtime.sendHook = () => blocked.promise;
  const status = controller.synthesizeMeeting();
  assert.equal(status.meeting.synthesis.status, 'drafting');
  await until(() => sent(runtime).length === initialSends + 1, 'post-council draft dispatched');
  const stopped = await controller.stopMeeting();
  assert.equal(stopped.meeting.status, 'completed');
  assert.equal(stopped.meeting.synthesis.status, 'cancelled');
  assert.deepEqual(stopped.meeting.report, originalReport);
  assert.equal(controller.getState().busy, false);
  blocked.resolve({responseText:'<CHATCHAT_SYNTHESIS_V1>{}</CHATCHAT_SYNTHESIS_V1>',elapsedMs:1});
  await delay(40);
  assert.equal(sent(runtime).length, initialSends + 1);
  const archive = JSON.parse(await readFile(archivedPath(dataDir, stopped.meeting.id), 'utf8'));
  assert.equal(archive.meeting.synthesis.status, 'cancelled');
});

test('a crashed reviewing phase becomes interrupted history with no automatic Provider work', async (t) => {
  const { controller, dataDir } = await fixture(t);
  await ready(controller);
  const id = controller.startMeeting(input()).meeting.id;
  const prior = await finished(controller);
  assert.equal(prior.meeting.status, 'completed');
  await controller.close();
  const filename = archivedPath(dataDir, id);
  const saved = JSON.parse(await readFile(filename, 'utf8'));
  saved.meeting.synthesis = {
    status: 'reviewing', writerId: saved.roster[0].id,
    reviewerIds: [saved.roster[1].id], draft: null, reviews: [],
  };
  await writeFile(filename, JSON.stringify(saved));
  const runtime = new Runtime();
  const restored = createController({ runtime, dataDir, core });
  t.after(() => restored.close());
  assert.deepEqual(runtime.calls, [], 'No new chat or provider send during startup recovery');
  const state = await restored.loadMeeting(id);
  assert.equal(state.meeting.status, 'completed');
  assert.equal(state.meeting.synthesis.status, 'interrupted');
  assert.match(state.meeting.synthesis.error, /Nothing was re-sent/);
  assert.equal(state.synthesisAvailable, false);
  assert.equal(isRunningHistory(state.meeting), false, 'Historical synthesis must no longer appear active');
  const disk = JSON.parse(await readFile(filename, 'utf8'));
  assert.equal(disk.meeting.synthesis.status, 'interrupted');
  assert.deepEqual(runtime.calls, []);
});

function isRunningHistory(meeting) {
  return ['drafting', 'reviewing'].includes(meeting?.synthesis?.status);
}

test('invalid peer review is recorded as incomplete, never silently approved', async (t) => {
  const { controller, runtime } = await fixture(t);
  await ready(controller);
  controller.startMeeting(input());
  const prior = await finished(controller);
  const refs = prior.meeting.events.filter((e) => e.kind === 'final_position' && !e.provenance).slice(0, 2);
  assert.equal(refs.length, 2);
  runtime.sendHook = async (_id, opts) => ({
    responseText: opts.prompt.includes('CHATCHAT_SYNTHESIS_V1') ?
      '<CHATCHAT_SYNTHESIS_V1>' + JSON.stringify({
        answer:'Try a limited pilot; review unresolved objections.',
        eventIds:refs.map((e) => e.id),caveats:[],
      }) + '</CHATCHAT_SYNTHESIS_V1>' :
      '<CHATCHAT_REVIEW_V1>' + JSON.stringify({
        verdict:'approve',commentary:'Approval without any source reference',eventIds:[],
      }) + '</CHATCHAT_REVIEW_V1>',
    elapsedMs:1,
  });
  controller.synthesizeMeeting();
  await until(() => !controller.getState().busy, 'incomplete reviewer response');
  const syn = controller.getState().meeting.synthesis;
  assert.equal(syn.status, 'incomplete');
  assert.equal(syn.reviews.length, 1);
  assert.equal(syn.reviews[0].status, 'failed');
  assert.equal(syn.draft.eventIds.length, 2);
});

test('malformed synthesis archives are quarantined without losing unrelated completed meetings', async (t) => {
  const { controller, dataDir } = await fixture(t);
  await ready(controller);
  const first = controller.startMeeting(input()).meeting.id;
  await finished(controller);
  await controller.newMeeting();
  const second = controller.startMeeting(input({proposal:'Keep this good history'})).meeting.id;
  await finished(controller);
  await controller.close();
  const file = archivedPath(dataDir, first);
  const altered = JSON.parse(await readFile(file, 'utf8'));
  altered.meeting.synthesis = {
    status:'reviewed',writerId:'not-a-real-seat',
    reviewerIds:['invalid'],draft:{answer:'Fabricated',eventIds:['invented'],caveats:[]},
    reviews:[],
  };
  const bytes = JSON.stringify(altered);
  await writeFile(file, bytes);
  const runtime = new Runtime();
  const restored = createController({runtime,dataDir,core});
  t.after(() => restored.close());
  assert.equal(restored.getState().history.length, 1);
  assert.equal(restored.getState().history[0].id, second);
  const dir = join(dataDir,'controller','meetings');
  const name = (await readdir(dir)).find((n) => n.startsWith(first+'.json.corrupt-'));
  assert.ok(name);
  assert.equal(await readFile(join(dir,name),'utf8'),bytes);
  assert.deepEqual(runtime.calls,[]);
});
