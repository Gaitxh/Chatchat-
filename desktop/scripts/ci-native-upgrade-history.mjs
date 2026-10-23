// Produce a genuine 0.10.6 controller archive and verify that 0.10.7
// can reopen it, without a browser, live provider, profile or credentials.
// Deliberately restricted to disposable GitHub-hosted Windows runners.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true'
  || process.env.CI !== 'true' || process.env.RUNNER_OS !== 'Windows'
  || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
  throw new Error('Native cross-version meeting test requires disposable GitHub-hosted Windows CI.');
}
const mode = process.argv[2];
if (!['create', 'verify'].includes(mode)) throw new Error('Expected create or verify mode.');
const runnerTemp = process.env.RUNNER_TEMP;
const appData = process.env.APPDATA;
const previousDesktop = process.env.CHATCHAT_PREVIOUS_DESKTOP;
if (![runnerTemp, appData, previousDesktop].every((x) => x && path.isAbsolute(x))) {
  throw new Error('Missing absolute CI runner, APPDATA or pinned previous-source path.');
}
const relativeOld = path.relative(path.resolve(runnerTemp), path.resolve(previousDesktop));
if (!relativeOld || relativeOld === '..' || relativeOld.startsWith('..' + path.sep)
  || path.isAbsolute(relativeOld)) {
  throw new Error('Pinned old controller source must be under disposable runner temp.');
}

const currentDesktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = mode === 'create' ? path.resolve(previousDesktop) : currentDesktop;
const expectedVersion = mode === 'create' ? '0.10.6' : '0.10.7';
const packageInfo = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
assert.equal(packageInfo.version, expectedVersion, 'Cross-version source version mismatch');
const { createController } = await import(pathToFileURL(path.join(source, 'main', 'controller.mjs')).href);
const dataDir = path.join(appData, 'ChatChat');
const manifestPath = path.join(runnerTemp, 'chatchat-native-upgrade-history.json');
const proposal = 'CI synthetic historical meeting: preserve authored disagreement across upgrade';
const providers = [
  { id: 'alpha', name: 'CI Alpha', url: 'https://alpha.example/', automation: 'experimental' },
  { id: 'beta', name: 'CI Beta', url: 'https://beta.example/', automation: 'experimental' },
];
const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashJSON = (value) => sha(JSON.stringify(value));

class SyntheticRuntime {
  constructor(allowOperations) {
    this.allowOperations = allowOperations;
    this.seats = [];
    this.sent = 0;
    this.prepared = 0;
    this.added = 0;
  }
  getInfo() { return { available: true, label: 'CI simulation only', message: 'No provider network access' }; }
  catalog() { return clone(providers); }
  list() { return clone(this.seats); }
  async addSeat(spec) {
    assert.ok(this.allowOperations, 'A restored meeting must not open a model seat');
    const provider = providers.find((item) => item.id === spec.providerId);
    assert.ok(provider);
    const seat = { id: 'ci-seat-' + provider.id, providerId: provider.id,
      name: provider.name, url: provider.url, status: 'ready', detail: '' };
    this.seats.push(seat);
    this.added++;
    return clone(seat);
  }
  async prepareSeat() {
    assert.ok(this.allowOperations, 'A restored meeting must not prepare a provider');
    this.prepared++;
  }
  async send(id, { prompt }) {
    assert.ok(this.allowOperations, 'A restored meeting must never send a provider prompt');
    const phase = /^PHASE: ([^\r\n]+)/m.exec(prompt)?.[1];
    assert.ok(['sealed', 'debate', 'final'].includes(phase), 'Unknown synthetic council phase');
    const stance = id.includes('beta') ? 'Wait for evidence' : 'Adopt with safeguards';
    const contribution = { kind: phase === 'final' ? 'final_position' : 'argument',
      stance, content: id + ' ' + phase + ': native 0.10.6 fixture position',
      confidence: 0.71,
      ...(phase === 'final' ? { caveats: ['Synthetic runner proof, not live AI evidence.'] } : {}) };
    this.sent++;
    return { responseText: '<CHATCHAT_COUNCIL_JSON>'
      + JSON.stringify({ contributions: [contribution] }) + '</CHATCHAT_COUNCIL_JSON>',
      elapsedMs: 1 };
  }
  async openSeat() { throw new Error('No provider navigation in native-upgrade CI'); }
  async checkSeat() { throw new Error('No provider inspection in native-upgrade CI'); }
  async removeSeat() { throw new Error('No provider removal in native-upgrade CI'); }
  async stop() {}
  async close() {}
}

async function waitUntilFinished(controller) {
  const started = Date.now();
  while (controller.getState().busy) {
    if (Date.now() - started > 20_000) throw new Error('Synthetic old-version council exceeded 20 seconds.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return controller.getState();
}
function archivePath(id) {
  assert.match(id, /^meeting-[0-9a-f-]{36}$/);
  return path.join(dataDir, 'controller', 'meetings', id + '.json');
}

if (mode === 'create') {
  assert.ok(!existsSync(manifestPath), 'Native upgrade manifest already exists on CI runner');
  assert.ok(!existsSync(path.join(dataDir, 'controller', 'preferences.json')),
    'Runner already contains user meeting preferences');
  const existingMeetings = path.join(dataDir, 'controller', 'meetings');
  if (existsSync(existingMeetings)) {
    assert.deepEqual(await readdir(existingMeetings), [],
      'Runner already contains native meeting files; refusing to overwrite them');
  }
  const runtime = new SyntheticRuntime(true);
  const controller = createController({ runtime, dataDir });
  let state;
  try {
    await controller.addSeat({ providerId: 'alpha' });
    await controller.addSeat({ providerId: 'beta' });
    controller.startMeeting({ proposal, mode: 'verify', maxRounds: 2 });
    state = await waitUntilFinished(controller);
    assert.equal(state.meeting.status, 'completed');
    assert.equal(state.meeting.events.length, 6, 'Old controller must persist six actual core events');
    assert.equal(state.meeting.report.positions.length, 2);
    assert.equal(state.meeting.report.disagreements.length, 1);
    assert.equal(state.history.length, 1);
    assert.equal(runtime.sent, 6);
    assert.equal(runtime.prepared, 2);
  } finally {
    await controller.close();
  }
  const bytes = await readFile(archivePath(state.meeting.id));
  const stored = JSON.parse(bytes.toString('utf8'));
  assert.equal(stored.schema, 1);
  assert.deepEqual(stored.meeting.events, state.meeting.events);
  assert.deepEqual(stored.meeting.report, state.meeting.report);
  const manifest = {
    fromVersion: expectedVersion, toVersion: '0.10.7',
    generatedBy: 'pinned 0.10.6 createController with compiled core and synthetic runtime',
    meetingId: state.meeting.id, proposal, archiveSha256: sha(bytes),
    eventsSha256: hashJSON(state.meeting.events), reportSha256: hashJSON(state.meeting.report),
    eventCount: state.meeting.events.length, positionCount: state.meeting.report.positions.length,
    finalContents: state.meeting.report.positions.map((position) => position.content),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('PASS_NATIVE_0106_CONTROLLER_CREATED_MEETING', JSON.stringify({
    meetingId: manifest.meetingId, events: manifest.eventCount, positions: manifest.positionCount,
    syntheticProviderCalls: runtime.sent, archiveSha256: manifest.archiveSha256,
  }));
} else {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.fromVersion, '0.10.6');
  assert.equal(manifest.toVersion, expectedVersion);
  assert.equal(manifest.proposal, proposal);
  const bytesBefore = await readFile(archivePath(manifest.meetingId));
  assert.equal(sha(bytesBefore), manifest.archiveSha256, 'Upgrade changed old meeting file bytes');
  const runtime = new SyntheticRuntime(false);
  const controller = createController({ runtime, dataDir });
  try {
    const initial = controller.getState();
    assert.equal(initial.history.length, 1, 'Upgraded controller must discover exactly one old meeting');
    assert.equal(initial.history[0].id, manifest.meetingId);
    assert.equal(initial.meeting, null, 'Old meeting must not auto-resume');
    assert.equal(initial.seats.length, 2);
    assert.ok(initial.seats.every((seat) => seat.status === 'closed'));
    const loaded = await controller.loadMeeting(manifest.meetingId);
    assert.equal(loaded.meeting.status, 'completed');
    assert.equal(loaded.meeting.proposal, proposal);
    assert.equal(loaded.meeting.events.length, manifest.eventCount);
    assert.equal(loaded.meeting.report.positions.length, manifest.positionCount);
    assert.equal(hashJSON(loaded.meeting.events), manifest.eventsSha256);
    assert.equal(hashJSON(loaded.meeting.report), manifest.reportSha256);
    assert.equal(loaded.synthesisAvailable, false, 'Historical meeting must not permit unattended review');
    const exported = await controller.exportData(manifest.meetingId);
    assert.ok(exported.includes(proposal), 'Export omitted old proposal');
    for (const item of manifest.finalContents) assert.ok(exported.includes(item), 'Export omitted an old final position');
    assert.equal(runtime.added, 0, 'History load opened a provider seat');
    assert.equal(runtime.prepared, 0, 'History load prepared a provider');
    assert.equal(runtime.sent, 0, 'History load sent a provider prompt');
  } finally {
    await controller.close();
  }
  assert.equal(sha(await readFile(archivePath(manifest.meetingId))), manifest.archiveSha256,
    'History load or post-uninstall check modified native archive bytes');
  console.log('PASS_NATIVE_0106_TO_0107_HISTORY_LOAD_EXPORT_NO_RESEND', JSON.stringify({
    meetingId: manifest.meetingId, events: manifest.eventCount,
    positions: manifest.positionCount, archiveSha256: manifest.archiveSha256,
  }));
}
