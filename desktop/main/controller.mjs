import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { open, rename, unlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { isIP } from 'node:net';
import { buildMeetingBackup, verifiedMeetingBackup } from './backup.mjs';
import {
  authoredReferenceEvents, participatingAuthors, chooseDraftAuthor, draftPrompt, reviewPrompt,
  parseSynthesisDraft, parseSynthesisReview, synthesisStatus,
} from './synthesis.mjs';

const MODES = new Set(['balanced', 'explore', 'decide', 'verify', 'stress_test']);
const TERMINAL = new Set(['completed', 'cancelled', 'failed']);
const STATUSES = new Set(['opening', 'needs_login', 'ready', 'manual', 'attention', 'closed', 'error']);
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const MEETING_ID = /^meeting-[0-9a-f-]{36}$/;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_EVENTS = 8 * 9 * 6;
const MAX_EXPORT_CHARACTERS = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT = 120_000;
const PREPARE_TIMEOUT = 45_000;
const CLOSE_TIMEOUT = 5_000;

const copy = (value) => structuredClone(value);
const timestamp = () => new Date().toISOString();
const abortError = () => Object.assign(new Error('Meeting cancelled.'), { name: 'AbortError' });
const text = (value, max = 600) => typeof value === 'string'
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';

// Keep actionable errors, without serializing exception objects, headers, stacks,
// credential-bearing URLs, or page contents supplied by a driver exception.
function errorText(error) {
  return text(error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/[^\s<>"']+/gi, '[provider URL]')
    .replace(/\b(?:bearer\s+\S+|(?:password|cookie|authorization|access_token|refresh_token)\s*[:=]\s*[^\s,;]+)/gi, '[redacted]')
    .replace(/<[^>]*>/g, '[markup]') || 'The operation failed.';
}

function publicURL(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a public HTTPS provider URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a public HTTPS provider URL.'); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = isIP(host) === 4 ? host.split('.').map(Number) : null;
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') && !isIP(host)
    || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    || (v4 && (v4[0] === 0 || v4[0] === 10 || v4[0] === 127 || v4[0] >= 224
      || v4[0] === 169 && v4[1] === 254 || v4[0] === 172 && v4[1] >= 16 && v4[1] <= 31
      || v4[0] === 192 && v4[1] === 168 || v4[0] === 100 && v4[1] >= 64 && v4[1] <= 127))
    || isIP(host) === 6 && (/^(::|f[cd]|fe[89ab])/i.test(host) || host.includes('ffff:'))) {
    throw new Error('Enter a public HTTPS provider URL without credentials.');
  }
  // Queries/fragments can contain account tokens; the harness stores public entry URLs.
  url.search = '';
  url.hash = '';
  return url.href;
}

function seatCopy(seat, persisted = false) {
  if (!seat || !ID.test(seat.id) || typeof seat.providerId !== 'string' || !ID.test(seat.providerId)) {
    throw new Error('The browser runtime returned an invalid seat.');
  }
  return {
    id: seat.id, providerId: seat.providerId, name: text(seat.name, 100) || seat.providerId,
    url: publicURL(seat.url), status: persisted ? 'closed' : STATUSES.has(seat.status) ? seat.status : 'error',
    detail: persisted ? 'Open this seat to check its managed browser session.' : seat.detail ? errorText(seat.detail) : '',
  };
}

const SYNTHESIS_STATES = new Set(['drafting', 'reviewing', 'reviewed', 'disputed',
  'incomplete', 'failed', 'cancelled', 'interrupted']);

function validSynthesisArchive(synthesis, events) {
  if (synthesis === undefined) return true;
  if (!synthesis || typeof synthesis !== 'object' || Array.isArray(synthesis)
    || !SYNTHESIS_STATES.has(synthesis.status) || !ID.test(synthesis.writerId)
    || !Array.isArray(synthesis.reviewerIds) || synthesis.reviewerIds.length > 7
    || synthesis.reviewerIds.some((id) => typeof id !== 'string' || !ID.test(id) || id === synthesis.writerId)
    || new Set(synthesis.reviewerIds).size !== synthesis.reviewerIds.length
    || !Array.isArray(synthesis.reviews) || synthesis.reviews.length > 7
    || typeof synthesis.error !== 'undefined' && (typeof synthesis.error !== 'string' || synthesis.error.length > 2000)) return false;
  const allowed = new Map(authoredReferenceEvents(events).map((event) => [event.id, event.actorId]));
  const validIds = (value, min = 1) => Array.isArray(value) && value.length >= min
    && value.length <= 16 && new Set(value).size === value.length && value.every((id) => allowed.has(id));
  const draft = synthesis.draft;
  if (draft !== null && draft !== undefined) {
    if (!draft || typeof draft !== 'object' || typeof draft.answer !== 'string'
      || !draft.answer.trim() || draft.answer.length > 6500 || draft.writerId !== synthesis.writerId
      || !validIds(draft.eventIds)
      || new Set(draft.eventIds.map((id) => allowed.get(id))).size < 2
      || !Array.isArray(draft.caveats) || draft.caveats.length > 8
      || draft.caveats.some((x) => typeof x !== 'string' || x.length > 260)) return false;
  }
  const seen = new Set();
  for (const review of synthesis.reviews) {
    if (!review || typeof review !== 'object' || !synthesis.reviewerIds.includes(review.participantId)
      || seen.has(review.participantId) || !['completed', 'failed'].includes(review.status)) return false;
    seen.add(review.participantId);
    if (review.status === 'completed') {
      if (!['approve', 'revise', 'reject'].includes(review.verdict) || typeof review.commentary !== 'string'
        || !review.commentary.trim() || review.commentary.length > 1600 || !validIds(review.eventIds)) return false;
    } else if (typeof review.error !== 'string' || review.error.length > 1200) return false;
  }
  return true;
}

function readJSON(path) {
  if (statSync(path).size > MAX_FILE_BYTES) throw new Error('Local meeting storage exceeds its safety limit.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function atomicWrite(path, value) {
  const data = JSON.stringify(value);
  if (Buffer.byteLength(data) > MAX_FILE_BYTES) throw new Error('Local meeting storage exceeds its safety limit.');
  const temporary = `${path}.${randomUUID()}.tmp`;
  let file;
  try {
    file = await open(temporary, 'wx', 0o600);
    await file.writeFile(data, 'utf8');
    await file.sync();
    await file.close();
    file = null;
    await rename(temporary, path);
  } finally {
    await file?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

// The driver receives a child signal even if it ignores the deadline itself.
// Racing also bounds shutdown when a buggy driver never settles. Late results
// are consumed by Promise.race and never invoke controller state callbacks.
async function deadline(invoke, { signal, timeoutMs, label }) {
  if (signal?.aborted) throw abortError();
  const operation = new AbortController();
  let timer;
  let abort;
  const interrupted = new Promise((_, reject) => {
    abort = () => { operation.abort(); reject(abortError()); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      operation.abort();
      reject(new Error(`${label} timed out; submission state may be unknown. No automatic resend will be attempted.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => {
      if (operation.signal.aborted) throw abortError();
      return invoke(operation.signal);
    }), interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function productionCore() {
  const [orchestrator, provider] = await Promise.all([
    import('../generated/src/core/orchestrator.js'),
    import('../generated/src/provider-sdk/consultation-agent.js'),
  ]);
  return { CouncilOrchestrator: orchestrator.CouncilOrchestrator, BrowserConsultationAgent: provider.BrowserConsultationAgent };
}

/**
 * Local controller. No Electron, browser selectors, or provider network clients.
 *
 * Main integration: construct the runtime with
 *   onChange: seat => controller?.runtimeChanged(seat)
 * and assign controller = createController(...). runtimeChanged is synchronous;
 * the ordinary onChange option publishes detached state to the renderer.
 * A runtime callback that publishes controller.getState() is also supported:
 * getState refreshes known seats from runtime.list(), preserving failure flags.
 *
 * core test injection: {CouncilOrchestrator, BrowserConsultationAgent,
 * timeoutMs?, prepareTimeoutMs?, closeTimeoutMs?}. Classes use the unchanged
 * compiled core signatures. Timing overrides are only supplied by Node tests.
 *
 * BrowserConsultationAgent requires a complete recipe. Its recipe below carries
 * explicit driver sentinels, NOT CSS selectors or a compatibility assertion.
 * Only runtime.prepareSeat/send operate the browser and own real selectors.
 */
export function createController({ runtime, dataDir, onChange = () => {}, version = '0.10.6', core } = {}) {
  if (!runtime || typeof dataDir !== 'string' || !dataDir) throw new Error('runtime and dataDir are required.');
  const directory = join(dataDir, 'controller');
  const archiveDirectory = join(directory, 'meetings');
  const preferencesPath = join(directory, 'preferences.json');
  mkdirSync(archiveDirectory, { recursive: true, mode: 0o700 });
  const seats = new Map();
  const runtimeIds = new Map();
  const seatFailures = new Map();
  const archives = new Map();
  const interrupted = [];
  const quarantinedArchives = [];
  let meeting = null;
  // In-memory gate: a historical/loaded meeting can never silently reopen
  // a chat or re-dispatch synthesis calls after app restart.
  let synthesisEligibleMeetingId = null;
  let active = null;
  let mutation = false;
  let restoreInFlight = null;
  let closing = false;
  let closed = false;
  let closeTask;
  let writeTail = Promise.resolve();
  let storageError = '';
  const lifecycle = new AbortController();
  const timeoutMs = core?.timeoutMs ?? DEFAULT_TIMEOUT;
  const prepareTimeoutMs = core?.prepareTimeoutMs ?? PREPARE_TIMEOUT;
  const closeTimeoutMs = core?.closeTimeoutMs ?? CLOSE_TIMEOUT;
  for (const duration of [timeoutMs, prepareTimeoutMs, closeTimeoutMs]) {
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 300_000) throw new Error('Invalid controller timeout.');
  }

  // Startup does not open any provider windows or send any prompts. Scan owned
  // archives as well as preferences: a crash may follow the archive rename but
  // precede the preferences rename.
  try {
    if (existsSync(preferencesPath)) {
      const saved = readJSON(preferencesPath);
      if (saved.schema !== 1 || !Array.isArray(saved.seats) || saved.seats.length > 8) throw new Error('Invalid local seat preferences.');
      for (const seat of saved.seats) {
        const restored = seatCopy(seat, true);
        if (seats.has(restored.id)) throw new Error('Duplicate saved seat.');
        seats.set(restored.id, restored);
      }
    }
    for (const filename of readdirSync(archiveDirectory)) {
      // A crash may leave a private restore staging file before its
      // no-overwrite hard-link commit. Delete ONLY this exact app-owned pattern.
      if (/^meeting-[0-9a-f-]{36}\.json\.[0-9a-f-]{36}\.restore\.tmp$/.test(filename)) {
        try { unlinkSync(join(archiveDirectory, filename)); }
        catch { throw new Error('Cannot clean an interrupted restore staging file.'); }
        continue;
      }
      if (!filename.endsWith('.json') || !MEETING_ID.test(filename.slice(0, -5))) continue;
      let saved;
      try {
        saved = readArchive(filename.slice(0, -5));
      } catch {
        // Preserve corrupt bytes under a unique name; do not let one damaged
        // meeting prevent access to healthy archives or the user's login UI.
        const original = join(archiveDirectory, filename);
        const quarantined = join(archiveDirectory, `${filename}.corrupt-${randomUUID()}`);
        renameSync(original, quarantined);
        quarantinedArchives.push(filename);
        continue;
      }
      let needsRecovery = false;
      if (!TERMINAL.has(saved.meeting.status)) {
        saved.meeting.status = 'failed';
        saved.meeting.phase = 'interrupted';
        saved.meeting.error = [saved.meeting.error, 'The app stopped before this meeting finished. It was not resumed.'].filter(Boolean).join(' ');
        needsRecovery = true;
      }
      // The parent meeting can be completed while optional peer synthesis was
      // still running. Resume neither drafts nor reviewers after app restart:
      // a provider may already have received the last prompt.
      if (['drafting', 'reviewing'].includes(saved.meeting.synthesis?.status)) {
        saved.meeting.synthesis.status = 'interrupted';
        saved.meeting.synthesis.error = [saved.meeting.synthesis.error,
          'The app closed during answer review. Nothing was re-sent. Inspect the original provider chat before starting a new council.']
          .filter(Boolean).join(' ').slice(0, 1200);
        needsRecovery = true;
      }
      if (needsRecovery) {
        saved.updatedAt = timestamp();
        interrupted.push(saved);
      }
      archives.set(saved.meeting.id, metadata(saved));
    }
    for (const seat of runtime.list()) {
      const live = seatCopy(seat);
      const previous = [...seats.values()].find((saved) => saved.providerId === live.providerId && new URL(saved.url).origin === new URL(live.url).origin);
      const id = previous?.id ?? live.id;
      seats.set(id, { ...live, id });
      runtimeIds.set(id, live.id);
    }
    if (seats.size > 8) throw new Error('Saved seat preferences and runtime seats exceed eight participants.');
  } catch (error) {
    throw new Error(`Cannot read local controller storage: ${errorText(error)}`);
  }

  function metadata(saved) {
    return { id: saved.meeting.id, proposal: saved.meeting.proposal, status: saved.meeting.status, updatedAt: saved.updatedAt };
  }
  function readArchive(id) {
    if (!MEETING_ID.test(id)) throw new Error('Invalid meeting id.');
    const saved = readJSON(join(archiveDirectory, `${id}.json`));
    const m = saved.meeting;
    if (saved.schema !== 1 || !m || m.id !== id || typeof m.proposal !== 'string' || m.proposal.length > 8000
      || !Array.isArray(m.events) || m.events.length > MAX_EVENTS
      || !validSynthesisArchive(m.synthesis, m.events)
      || !['preparing', 'running', ...TERMINAL].includes(m.status) || typeof saved.updatedAt !== 'string') {
      throw new Error('Invalid local meeting archive.');
    }
    return saved;
  }
  function runtimeInfo() {
    try {
      const info = runtime.getInfo();
      return { available: info?.available === true, label: text(info?.label, 100) || 'Managed Chromium', message: text(info?.message, 600) };
    } catch (error) {
      return { available: false, label: 'Managed Chromium', message: errorText(error) };
    }
  }
  function catalog() {
    try {
      return runtime.catalog().map((provider) => ({
        id: text(provider.id, 100), name: text(provider.name, 100), url: publicURL(provider.url),
        automation: provider.automation === 'experimental' ? 'experimental' : 'manual',
      }));
    } catch { return []; }
  }
  function getState() {
    if (!closing && !closed && !active?.cancelled) {
      try {
        for (const actual of runtime.list()) {
          const id = [...runtimeIds].find(([, runtimeSeatId]) => runtimeSeatId === actual.id)?.[0];
          if (id) acceptSeat(id, actual);
        }
      } catch { /* A broken driver must not prevent reading recorded meeting state. */ }
    }
    const info = runtimeInfo();
    if (storageError) info.message = [info.message, `Local storage: ${storageError}`].filter(Boolean).join(' ');
    if (quarantinedArchives.length) {
      info.message = [info.message, `${quarantinedArchives.length} 份异常历史记录已保留原文件（.corrupt- 后缀），并暂停加载。请先导出其他记录，再检查本地数据文件夹。`].filter(Boolean).join(' ');
    }
    const eligibleForSynthesis = meeting?.status === 'completed'
      && synthesisEligibleMeetingId === meeting.id && !meeting.synthesis
      && !active && !mutation && !storageError;
    const candidateAuthors = eligibleForSynthesis
      ? participatingAuthors(meeting.report,
        [...seats.values()].filter((seat) => seat.status === 'ready'))
      : [];
    const canSynthesize = candidateAuthors.length >= 2;
    // A draft plus (N - 1) peer reviews means *at most* N more website
    // messages. The number is UI metadata, not part of immutable history.
    return copy({
      version, runtime: info, providers: catalog(), seats: [...seats.values()], meeting,
      synthesisAvailable: canSynthesize, synthesisPlannedRequests: canSynthesize ? candidateAuthors.length : 0,
      history: [...archives.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200),
      busy: Boolean(active || mutation),
    });
  }
  function notify() {
    if (!closed) {
      try { onChange(getState()); } catch { /* A disconnected renderer cannot interrupt a meeting. */ }
    }
  }
  function enqueue(action) {
    const pending = writeTail.then(action);
    writeTail = pending.catch(() => {});
    return pending;
  }
  function preferences() {
    return { schema: 1, seats: [...seats.values()].map(({ id, providerId, name, url }) => ({ id, providerId, name, url })) };
  }
  function persistPreferences() {
    const saved = preferences();
    return enqueue(() => atomicWrite(preferencesPath, saved));
  }
  function persist(saved) {
    const snapshot = copy(saved);
    archives.set(snapshot.meeting.id, metadata(snapshot));
    return enqueue(() => atomicWrite(join(archiveDirectory, `${snapshot.meeting.id}.json`), snapshot));
  }
  function saveJob(job) {
    job.record.updatedAt = timestamp();
    return persist(job.record);
  }
  function storageFailed(error) { storageError = errorText(error); notify(); }
  // Recovery writes participate in the same queue as all later writes. Before
  // any meeting can send, it awaits this queue and checks storageError.
  for (const saved of interrupted) persist(saved).catch(storageFailed);

  function idle() {
    if (closing || closed) throw new Error('The controller is closing.');
    if (active || mutation) throw new Error('Stop the current operation before changing the meeting or seats.');
  }
  function knownSeat(id) {
    if (typeof id !== 'string' || !ID.test(id) || !seats.has(id)) throw new Error('Unknown seat.');
    return seats.get(id);
  }
  function runtimeId(id) {
    const mapped = runtimeIds.get(id);
    if (!mapped) throw new Error('Open this seat before starting a meeting.');
    return mapped;
  }
  function acceptSeat(id, value) {
    if (closing || closed) throw new Error('The controller is closing.');
    const actual = seatCopy(value);
    runtimeIds.set(id, actual.id);
    seats.set(id, { ...actual, id });
    if (seatFailures.has(id)) {
      seats.get(id).status = 'attention';
      seats.get(id).detail = seatFailures.get(id);
    }
    return seats.get(id);
  }
  function runtimeChanged(value) {
    if (closed || closing || active?.cancelled) return;
    const id = [...runtimeIds].find(([, runtimeSeatId]) => runtimeSeatId === value?.id)?.[0];
    if (!id) return;
    try {
      acceptSeat(id, value);
      notify();
    } catch { /* Invalid runtime notifications cannot populate UI/storage. */ }
  }
  async function seatOperation(action, { invalidatesSynthesis = true } = {}) {
    idle();
    // A seat can change conversation ownership when added/reopened/removed.
    // Inspecting readiness does not navigate a prepared Chat and must not
    // remove the completed meeting's optional answer-review opportunity.
    if (invalidatesSynthesis) synthesisEligibleMeetingId = null;
    mutation = true;
    const operation = { active: true };
    const stillCurrent = () => {
      if (!operation.active || closing || closed || lifecycle.signal.aborted) throw abortError();
    };
    notify();
    try {
      await deadline(() => action(stillCurrent), { signal: lifecycle.signal, timeoutMs: prepareTimeoutMs, label: 'Seat operation' });
      await persistPreferences();
    } catch (error) {
      if (error?.code && /^(EACCES|EPERM|ENOSPC|ENOTDIR|EIO|EROFS)$/.test(error.code)) storageFailed(error);
      throw new Error(errorText(error));
    } finally { operation.active = false; mutation = false; notify(); }
    return getState();
  }
  async function addSeat(spec) {
    return seatOperation(async (stillCurrent) => {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)
        || Object.keys(spec).length !== 1 || !(Object.hasOwn(spec, 'providerId') || Object.hasOwn(spec, 'url'))) {
        throw new Error('Choose a provider or enter one public HTTPS URL.');
      }
      if (seats.size >= 8) throw new Error('A meeting supports at most eight seats.');
      const provider = Object.hasOwn(spec, 'providerId') ? catalog().find((item) => item.id === spec.providerId) : null;
      if (Object.hasOwn(spec, 'providerId') && !provider) throw new Error('Unknown provider.');
      const url = publicURL(provider?.url ?? spec.url);
      const origin = new URL(url).origin;
      if ([...seats.values()].some((seat) => new URL(seat.url).origin === origin || provider && seat.providerId === provider.id)) {
        throw new Error('Each provider origin has one equal participant seat.');
      }
      const actual = seatCopy(await runtime.addSeat(provider ? { providerId: provider.id } : { url }));
      try { stillCurrent(); } catch (error) {
        // A timed-out add cannot leave an invisible duplicate in persistent runtime metadata.
        await runtime.removeSeat(actual.id).catch(() => {});
        throw error;
      }
      if (seats.has(actual.id)) throw new Error('The runtime returned a duplicate seat id.');
      acceptSeat(actual.id, actual);
    });
  }
  async function openSeat(id) {
    return seatOperation(async (stillCurrent) => {
      const seat = knownSeat(id);
      if (!runtimeIds.has(id)) {
        // Rehydrate a saved preference only on an explicit open. Runtime ids may
        // change after restart; controller ids remain stable for the UI/history.
        const provider = catalog().find((item) => item.id === seat.providerId);
        const actual = await runtime.addSeat(provider ? { providerId: provider.id } : { url: seat.url });
        stillCurrent();
        seatFailures.delete(id);
        acceptSeat(id, actual);
      } else {
        const actual = await runtime.openSeat(runtimeId(id));
        stillCurrent();
        seatFailures.delete(id);
        acceptSeat(id, actual);
      }
    });
  }
  async function checkSeat(id) {
    return seatOperation(async (stillCurrent) => {
      knownSeat(id);
      const actual = await runtime.checkSeat(runtimeId(id));
      stillCurrent();
      seatFailures.delete(id);
      acceptSeat(id, actual);
    }, { invalidatesSynthesis: false });
  }
  async function removeSeat(id) {
    return seatOperation(async (stillCurrent) => {
      knownSeat(id);
      if (runtimeIds.has(id)) await runtime.removeSeat(runtimeId(id));
      stillCurrent();
      if (closing || closed) throw new Error('The controller is closing.');
      runtimeIds.delete(id);
      seatFailures.delete(id);
      seats.delete(id);
    });
  }
  function live(job) {
    if (active !== job || job.cancelled || job.abort.signal.aborted || closing || closed) throw abortError();
  }
  function failSeat(job, id, error) {
    live(job);
    const reason = errorText(error);
    job.failures.set(id, reason);
    seatFailures.set(id, reason);
    const seat = seats.get(id);
    if (seat) { seat.status = 'attention'; seat.detail = reason; }
    notify();
  }
  async function execute(job) {
    const signal = job.abort.signal;
    try {
      await writeTail;
      live(job);
      if (storageError) throw new Error(`Local storage: ${storageError}`);
      await saveJob(job); // A failed initial write prevents every provider send.
      live(job);
      const implementation = await deadline(() => core ?? productionCore(), { signal, timeoutMs: prepareTimeoutMs, label: 'Core loading' });
      live(job);
      const { CouncilOrchestrator, BrowserConsultationAgent } = implementation;
      if (typeof CouncilOrchestrator !== 'function' || typeof BrowserConsultationAgent !== 'function') throw new Error('The compiled consultation core is unavailable.');
      await Promise.all(job.roster.map(async (seat) => {
        try {
          await deadline((operationSignal) => {
            live(job);
            return runtime.prepareSeat(seat.runtimeId, { sessionId: job.record.meeting.id, signal: operationSignal });
          }, { signal, timeoutMs: prepareTimeoutMs, label: 'Fresh chat preparation' });
          live(job);
        } catch (error) {
          live(job);
          failSeat(job, seat.id, error);
        }
      }));
      live(job);
      job.record.meeting.status = 'running';
      await saveJob(job);
      live(job);
      notify();
      const agents = job.roster.map((seat) => {
        const now = timestamp();
        const profile = {
          profileId: seat.id, providerId: seat.providerId, adapterId: 'managed-browser-driver', displayName: seat.name,
          url: seat.url, origin: new URL(seat.url).origin, profileKey: seat.id,
          authState: 'ready', seatState: 'seated', createdAt: now, updatedAt: now,
        };
        const recipe = {
          profileId: seat.id, composerSelector: 'driver:managed-runtime:composer', sendSelector: 'driver:managed-runtime:send',
          responseSelector: 'driver:managed-runtime:response', createdAt: now, updatedAt: now,
        };
        return new BrowserConsultationAgent(profile, recipe, async (_profile, _recipe, prompt) => {
          live(job);
          if (job.failures.has(seat.id)) throw new Error(job.failures.get(seat.id));
          if (typeof prompt !== 'string' || prompt.length > 32_000) throw new Error('Consultation prompt exceeds the desktop safety limit.');
          try {
            const result = await deadline((operationSignal) => {
              live(job);
              return runtime.send(seat.runtimeId, { prompt, operationId: `${job.record.meeting.id}:${seat.id}:${++job.operation}`, signal: operationSignal, timeoutMs });
            }, { signal, timeoutMs, label: 'Provider response' });
            live(job);
            if (!result || typeof result.responseText !== 'string' || result.responseText.length > 256_000) throw new Error('Provider response is missing or exceeds the safety limit.');
            return { responseText: result.responseText, elapsedMs: result.elapsedMs };
          } catch (error) {
            live(job);
            failSeat(job, seat.id, error);
            throw new Error(errorText(error));
          }
        }, async () => {
          live(job); // Fresh chats were prepared once per slot, before sealed round 1.
          if (job.failures.has(seat.id)) throw new Error(job.failures.get(seat.id));
        }, async (audit) => {
          live(job);
          if (audit.stage === 'fallback_emitted') failSeat(job, seat.id, new Error(audit.error || 'Structured consultation failed.'));
        });
      });
      const orchestrator = new CouncilOrchestrator(agents);
      const result = await deadline(() => orchestrator.run(job.record.meeting.proposal, {
        mode: job.record.mode, maxRounds: job.record.maxRounds,
        onPhase: async (update) => {
          live(job);
          job.record.meeting.phase = text(update.phase, 100);
          job.record.meeting.round = update.round;
          await saveJob(job);
          live(job);
          notify();
        },
        onEvent: async (event) => {
          live(job);
          if (job.record.meeting.events.length >= MAX_EVENTS) throw new Error('Meeting event safety limit reached.');
          job.record.meeting.events.push(copy(event));
          await saveJob(job);
          live(job);
          notify();
        },
      }), { signal, timeoutMs: Math.min(2_147_483_647, (job.record.maxRounds + 1) * 2 * timeoutMs + prepareTimeoutMs), label: 'Meeting' });
      live(job);
      // Preserve the core's actual final positions, dissent and runtime failure
      // provenance. No extra synthesis call, invented conclusion, or vote repair.
      if (!result?.report || !Array.isArray(result.report.positions) || !Array.isArray(result.report.disagreements)) throw new Error('The consultation core did not return a report.');
      job.record.meeting.report = copy(result.report);
      job.record.meeting.status = 'completed';
      job.record.meeting.phase = 'completed';
    } catch (error) {
      if (!job.cancelled) {
        job.record.meeting.status = 'failed';
        job.record.meeting.phase = 'failed';
        job.record.meeting.error = errorText(error);
        job.abort.abort();
        try { await deadline(() => runtime.stop(), { timeoutMs: closeTimeoutMs, label: 'Browser stop' }); }
        catch (stopError) { job.record.meeting.error += ` ${errorText(stopError)}`; }
      }
    } finally {
      // Cancellation makes live() fail before every subsequent send/callback,
      // even when the underlying core/driver continues to resolve late.
      try { await saveJob(job); } catch (error) {
        storageFailed(error);
        job.record.meeting.error = [job.record.meeting.error, `Local storage: ${errorText(error)}`].filter(Boolean).join(' ');
        if (!job.cancelled) job.record.meeting.status = 'failed';
      }
      if (active === job && !job.cancelled) { active = null; notify(); }
    }
  }
  function startMeeting(input) {
    idle();
    getState(); // Refresh readiness even when main only publishes runtime notifications.
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.proposal !== 'string'
      || !input.proposal.trim() || input.proposal.length > 8000 || !MODES.has(input.mode)
      || !Number.isInteger(input.maxRounds) || input.maxRounds < 2 || input.maxRounds > 8) {
      throw new Error('Enter a proposal of 1–8000 characters, a valid mode, and 2–8 rounds.');
    }
    if (!runtimeInfo().available) throw new Error('The managed browser runtime is unavailable.');
    if (storageError) throw new Error(`Local storage: ${storageError}`);
    const configured = [...seats.values()];
    // Unready/manual websites may remain saved for later without blocking an
    // otherwise-ready council. They receive zero prompts in this meeting.
    const roster = configured.filter((seat) => seat.status === 'ready');
    if (configured.length > 8 || roster.length < 2 || roster.length > 8) throw new Error('Start with two to eight ready seats.');
    if (new Set(roster.map((seat) => new URL(seat.url).origin)).size !== roster.length) throw new Error('Each provider origin has one equal participant seat.');
    const frozenRoster = Object.freeze(roster.map((seat) => Object.freeze({ ...copy(seat), runtimeId: runtimeId(seat.id) })));
    meeting = { id: `meeting-${randomUUID()}`, proposal: input.proposal.trim(), status: 'preparing',
      phase: 'preparing', round: 0, events: [], report: null,
      participatingSeatIds: frozenRoster.map((seat) => seat.id) };
    const record = { schema: 1, meeting, roster: frozenRoster.map(({ runtimeId: _runtimeId, ...seat }) => seat), mode: input.mode, maxRounds: input.maxRounds, updatedAt: timestamp() };
    const job = { kind: 'council', record, roster: frozenRoster, abort: new AbortController(), cancelled: false, failures: new Map(), operation: 0, task: null, stopping: null };
    active = job;
    synthesisEligibleMeetingId = meeting.id;
    archives.set(meeting.id, metadata(record));
    job.task = Promise.resolve().then(() => execute(job));
    notify();
    return getState();
  }
  // Deliberately opt-in. Starts no Provider work during archive playback,
  // startup, meeting completion or normal seat readiness polling.
  function synthesizeMeeting() {
    idle();
    getState();
    if (!meeting || meeting.status !== 'completed' || meeting.synthesis
      || meeting.id !== synthesisEligibleMeetingId || storageError) {
      throw new Error('Only a just-completed live meeting can create a reviewed answer.');
    }
    const saved = readArchive(meeting.id);
    const roster = (Array.isArray(saved.roster) ? saved.roster : [])
      .filter((seat) => seats.get(seat.id)?.status === 'ready'
        && runtimeIds.has(seat.id) && !seatFailures.has(seat.id));
    const authors = participatingAuthors(saved.meeting.report, roster);
    if (authors.length < 2) throw new Error('Two real model authors are needed to cross-review an answer.');
    const writer = chooseDraftAuthor(saved.meeting.id, authors);
    const reviewers = authors.filter((seat) => seat.id !== writer.id);
    // The exact frozen peers, not a privileged chairman or a majority vote.
    const synthesis = {
      status: 'drafting', writerId: writer.id,
      reviewerIds: reviewers.map((seat) => seat.id),
      draft: null, reviews: [], error: '', startedAt: timestamp(),
    };
    saved.meeting.synthesis = synthesis;
    meeting = saved.meeting;
    synthesisEligibleMeetingId = null;
    const job = {
      kind: 'synthesis', record: saved, roster: authors, writer, reviewers,
      abort: new AbortController(), cancelled: false, task: null, stopping: null,
    };
    active = job;
    job.task = Promise.resolve().then(() => executeSynthesis(job));
    notify();
    return getState();
  }

  async function executeSynthesis(job) {
    const signal = job.abort.signal;
    const synthesis = job.record.meeting.synthesis;
    const meetingRecord = job.record.meeting;
    try {
      await writeTail;
      live(job);
      if (storageError) throw new Error('Local archive persistence is unavailable.');
      await saveJob(job); // Record explicit intent before ANY new Provider send.
      live(job);
      const author = job.writer;
      const drafted = await deadline((operationSignal) =>
        runtime.send(runtimeId(author.id), {
          prompt: draftPrompt(meetingRecord),
          operationId: meetingRecord.id + ':' + author.id + ':synthesis-draft',
          signal: operationSignal, timeoutMs,
        }), { signal, timeoutMs, label: 'Synthesis draft' });
      live(job);
      const draft = parseSynthesisDraft(drafted.responseText, meetingRecord.events);
      synthesis.draft = { ...draft, writerId: author.id };
      synthesis.status = 'reviewing';
      await saveJob(job);
      live(job);
      notify();
      // Reviews have independent Provider transport receipts. A failed/absent
      // reviewer is NOT an approval; all failures remain visible.
      await Promise.all(job.reviewers.map(async (seat) => {
        let entry;
        try {
          const received = await deadline((operationSignal) =>
            runtime.send(runtimeId(seat.id), {
              prompt: reviewPrompt(meetingRecord, draft),
              operationId: meetingRecord.id + ':' + seat.id + ':synthesis-review',
              signal: operationSignal, timeoutMs,
            }), { signal, timeoutMs, label: 'Synthesis peer review' });
          live(job);
          entry = { participantId: seat.id, status: 'completed',
            ...parseSynthesisReview(received.responseText, meetingRecord.events) };
        } catch (caught) {
          live(job);
          entry = { participantId: seat.id, status: 'failed', error: errorText(caught) };
        }
        live(job);
        synthesis.reviews.push(entry);
        await saveJob(job);
        live(job);
        notify();
      }));
      live(job);
      synthesis.status = synthesisStatus(synthesis.reviewerIds, synthesis.reviews);
    } catch (caught) {
      if (!job.cancelled) {
        synthesis.status = 'failed';
        synthesis.error = errorText(caught);
        // No automatic retries: the Provider may already have received the prompt.
      }
    } finally {
      synthesis.completedAt = timestamp();
      try { await saveJob(job); } catch (error) {
        storageFailed(error);
        synthesis.status = 'failed';
        synthesis.error = [synthesis.error, `Local storage: ${errorText(error)}`].filter(Boolean).join(' ').slice(0, 1200);
      }
      if (active === job && !job.cancelled) { active = null; notify(); }
    }
  }

  async function stopMeeting() {
    const job = active;
    if (!job) return getState();
    if (!job.stopping) {
      job.cancelled = true;
      job.abort.abort();
      if (job.kind === 'synthesis') {
        job.record.meeting.synthesis.status = 'cancelled';
        job.record.meeting.synthesis.error = 'Peer review was stopped. Provider submissions already sent cannot be withdrawn.';
      } else {
        job.record.meeting.status = 'cancelled';
        job.record.meeting.phase = 'cancelled';
      }
      job.stopping = (async () => {
        const results = await Promise.allSettled([
          deadline(() => runtime.stop(), { timeoutMs: closeTimeoutMs, label: 'Browser stop' }),
          deadline(() => job.task, { timeoutMs: closeTimeoutMs, label: 'Meeting cancellation' }),
        ]);
        for (const result of results) if (result.status === 'rejected') {
          const outcome = job.kind === 'synthesis' ? job.record.meeting.synthesis : job.record.meeting;
          outcome.error = [outcome.error, errorText(result.reason)].filter(Boolean).join(' ').slice(0, 1200);
        }
        // Ensure prior queued archive writes settle before returning cancellation.
        try { await deadline(() => saveJob(job), {
          timeoutMs: Math.max(closeTimeoutMs, 5_000),
          label: 'Saving cancelled meeting',
        }); }
        catch (error) {
          storageFailed(error);
          const outcome = job.kind === 'synthesis' ? job.record.meeting.synthesis : job.record.meeting;
          outcome.error = [outcome.error, 'Local storage: ' + errorText(error)].filter(Boolean).join(' ').slice(0, 1800);
        }
        if (active === job) active = null;
        notify();
      })();
      notify();
    }
    await job.stopping;
    return getState();
  }
  async function newMeeting() {
    if (active) await stopMeeting();
    idle();
    meeting = null;
    synthesisEligibleMeetingId = null;
    notify();
    return getState();
  }
  async function loadMeeting(id) {
    idle();
    if (!archives.has(id)) throw new Error('Unknown meeting.');
    await writeTail;
    const saved = readArchive(id);
    if (!TERMINAL.has(saved.meeting.status)) throw new Error('This meeting has not finished.');
    meeting = copy(saved.meeting);
    synthesisEligibleMeetingId = null;
    notify();
    return getState();
  }
  async function backupData() {
    idle();
    await writeTail;
    if (storageError) throw new Error('Local storage is unavailable; a reliable backup cannot be created.');
    // Saved meeting archives only; never copy login browser profiles, cookies,
    // managed-browser operation journal, or arbitrary userData files.
    const records = [];
    let estimatedBytes = 0;
    for (const item of archives.values()) {
      estimatedBytes += statSync(join(archiveDirectory, item.id + '.json')).size;
      if (estimatedBytes > 48 * 1024 * 1024) {
        throw new Error('All saved meetings exceed the full-backup limit. Export individual meetings first.');
      }
      const saved = readArchive(item.id);
      if (!TERMINAL.has(saved.meeting.status)) {
        throw new Error('An unfinished meeting must be resolved before making a full backup.');
      }
      records.push(saved);
    }
    const excludedDamaged = readdirSync(archiveDirectory)
      .filter((name) => /^meeting-[0-9a-f-]{36}\.json\.corrupt-/.test(name)).length;
    const content = buildMeetingBackup({
      meetings: records, seats: preferences().seats,
      skippedDamagedArchives: excludedDamaged, createdAt: timestamp(),
    });
    return { content, meetingCount: records.length,
      skippedDamagedArchives: excludedDamaged };
  }

  function verifiedRestoreRecords(content) {
    const snapshot = verifiedMeetingBackup(content);
    const seen = new Set();
    const records = snapshot.meetings.map((saved) => {
      const m = saved?.meeting;
      if (saved?.schema !== 1 || !m || !MEETING_ID.test(m.id)
        || seen.has(m.id) || !TERMINAL.has(m.status)
        || typeof m.proposal !== 'string' || !m.proposal.trim() || m.proposal.length > 8000
        || typeof m.phase !== 'string' || m.phase.length > 60
        || !Number.isInteger(m.round) || m.round < 0 || m.round > 9
        || !Array.isArray(m.events) || m.events.length > MAX_EVENTS
        || !validSynthesisArchive(m.synthesis, m.events)
        || !MODES.has(saved.mode) || !Number.isInteger(saved.maxRounds)
        || saved.maxRounds < 2 || saved.maxRounds > 8
        || typeof saved.updatedAt !== 'string' || saved.updatedAt.length > 40
        || !Number.isFinite(Date.parse(saved.updatedAt))
        || !Array.isArray(saved.roster) || saved.roster.length > 8
        || m.status === 'completed' && (!m.report
          || !Array.isArray(m.report.positions) || !Array.isArray(m.report.disagreements))
        || m.report && (!Array.isArray(m.report.positions)
          || !Array.isArray(m.report.disagreements)
          || m.report.positions.length > 8 || m.report.disagreements.length > 8)) {
        throw new Error('Backup contains an invalid or unfinished meeting archive.');
      }
      seen.add(m.id);
      const roster = new Set();
      for (const seat of saved.roster) {
        const normalized = seatCopy({ ...seat, status: 'closed' }, true);
        if (roster.has(normalized.id)) throw new Error('Backup has a repeated participant.');
        roster.add(normalized.id);
      }
      for (const event of m.events) {
        if (!event || typeof event !== 'object' || Array.isArray(event)
          || typeof event.id !== 'string' || !event.id || event.id.length > 200
          || typeof event.actorId !== 'string' || event.actorId.length > 100
          || typeof event.kind !== 'string' || event.kind.length > 60
          || typeof event.content !== 'string' || event.content.length > 16000
          || !Number.isInteger(event.round) || event.round < 0 || event.round > 9) {
          throw new Error('Backup has an invalid meeting event.');
        }
      }
      if (m.report) {
        if (typeof m.report.confidence !== 'number' || !Number.isFinite(m.report.confidence)
          || m.report.confidence < 0 || m.report.confidence > 1
          || typeof m.report.consensusRatio !== 'number' || !Number.isFinite(m.report.consensusRatio)
          || m.report.consensusRatio < 0 || m.report.consensusRatio > 1) {
          throw new Error('Backup has an invalid final council report.');
        }
        for (const position of [...m.report.positions, ...m.report.disagreements]) {
          if (!position || typeof position !== 'object' || Array.isArray(position)
            || !position.participant || !ID.test(position.participant.id)
            || typeof position.participant.name !== 'string'
            || position.participant.name.length > 100
            || typeof position.stance !== 'string' || position.stance.length > 200
            || typeof position.content !== 'string' || position.content.length > 16000
            || typeof position.confidence !== 'number' || !Number.isFinite(position.confidence)
            || position.confidence < 0 || position.confidence > 1
            || !Array.isArray(position.caveats) || position.caveats.length > 16
            || position.caveats.some((x) => typeof x !== 'string' || x.length > 2000)) {
            throw new Error('Backup has an invalid participant final position.');
          }
        }
      }
      const serialized = JSON.stringify(saved);
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_FILE_BYTES) {
        throw new Error('Backup contains an oversized meeting archive.');
      }
      return copy(saved);
    });
    return { records, ignoredSeatBookmarks: snapshot.seats.length,
      excludedDamagedInSource: snapshot.skippedDamagedArchives };
  }

  function previewRestoreData(content) {
    idle();
    if (storageError) throw new Error('Local storage is unavailable.');
    const parsed = verifiedRestoreRecords(content);
    const newRecords = parsed.records.filter((record) => !archives.has(record.meeting.id)
      && !existsSync(join(archiveDirectory, record.meeting.id + '.json')));
    return {
      meetingCount: parsed.records.length,
      newMeetings: newRecords.length,
      existingMeetings: parsed.records.length - newRecords.length,
      ignoredSeatBookmarks: parsed.ignoredSeatBookmarks,
      excludedDamagedInSource: parsed.excludedDamagedInSource,
    };
  }

  async function restoreBackupData(content) {
    idle();
    if (storageError) throw new Error('Local storage is unavailable.');
    const parsed = verifiedRestoreRecords(content);
    mutation = true;
    // Shutdown waits for the restore transaction to finish rolling back,
    // rather than terminating the process halfway through a history import.
    let resolveRestore;
    restoreInFlight = new Promise((resolve) => { resolveRestore = resolve; });
    notify();
    const committed = [];
    let duplicates = 0;
    try {
      await writeTail;
      if (storageError || closing || closed) throw new Error('Local storage is unavailable.');
      for (const record of parsed.records) {
        if (closing || closed || lifecycle.signal.aborted) throw abortError();
        const id = record.meeting.id;
        const target = join(archiveDirectory, id + '.json');
        if (archives.has(id) || existsSync(target)) { duplicates += 1; continue; }
        const temporary = target + '.' + randomUUID() + '.restore.tmp';
        let file;
        try {
          file = await open(temporary, 'wx', 0o600);
          await file.writeFile(JSON.stringify(record), 'utf8');
          await file.sync();
          await file.close();
          file = null;
          if (closing || closed || lifecycle.signal.aborted) throw abortError();
          // Creating a hard link is atomic and fails with EEXIST. Unlike a
          // Windows rename, it can never replace an existing archive.
          try { await link(temporary, target); }
          catch (error) {
            if (error?.code === 'EEXIST') { duplicates += 1; continue; }
            throw error;
          }
          committed.push({ id, target });
          archives.set(id, metadata(record));
        } finally {
          await file?.close().catch(() => {});
          await unlink(temporary).catch(() => {});
        }
      }
      return { imported: committed.length, existingMeetings: duplicates,
        ignoredSeatBookmarks: parsed.ignoredSeatBookmarks,
        excludedDamagedInSource: parsed.excludedDamagedInSource };
    } catch (error) {
      let rollbackFailed = false;
      for (const item of committed.reverse()) {
        try { await unlink(item.target); archives.delete(item.id); }
        catch { rollbackFailed = true; }
      }
      if (rollbackFailed) storageFailed(new Error('Some imported records could not be rolled back. Inspect the local meeting folder.'));
      throw new Error('Backup import did not finish; existing meetings were never overwritten. ' + errorText(error));
    } finally {
      mutation = false;
      resolveRestore();
      restoreInFlight = null;
      notify();
    }
  }

  async function exportData(id) {
    if (!archives.has(id)) throw new Error('Unknown meeting.');
    await writeTail;
    const saved = active?.record.meeting.id === id ? copy(active.record) : readArchive(id);
    const m = saved.meeting;
    const lines = ['# ChatChat consultation', '', `Proposal: ${m.proposal}`, '', `Status: ${m.status}`, `Mode: ${saved.mode}`, `Phase: ${m.phase}`, `Round: ${m.round}`];
    if (m.error) lines.push('', `Error: ${m.error}`);
    if (m.synthesis) {
      const syn = m.synthesis;
      lines.push('', '## Optional post-meeting synthesis',
        '', 'Review state: ' + syn.status,
        'This draft reflects model discussion; it is not an independent fact-check.');
      if (syn.draft) {
        lines.push('', '### Answer draft', '', syn.draft.answer,
          '', 'Internal discussion event IDs: ' + syn.draft.eventIds.join(', '));
        for (const caveat of syn.draft.caveats) lines.push('Caveat: ' + caveat);
      }
      for (const review of syn.reviews) {
        lines.push('', '### Reviewer: ' + review.participantId, '',
          'Review receipt: ' + review.status,
          ...(review.verdict ? ['Verdict: ' + review.verdict] : []),
          ...(review.eventIds?.length ? ['Related discussion event IDs: ' + review.eventIds.join(', ')] : []),
          '', review.commentary ?? review.error ?? 'No review reply.');
      }
      if (syn.error) lines.push('', 'Synthesis limitation: ' + syn.error);
    }
    if (m.report) {
      lines.push('', '## Actual final positions', '', 'Alignment describes participant positions; it is not proof.');
      for (const position of m.report.positions) {
        lines.push('', `### ${position.participant.name}`, '', `Stance: ${position.stance}`, '', position.content);
        if (position.provenance?.source === 'runtime_fallback') lines.push('', 'Unavailable: runtime fallback, not a model-authored position.');
        for (const caveat of position.caveats ?? []) lines.push('', `Caveat: ${caveat}`);
      }
      lines.push('', '## Remaining dissent', '');
      for (const position of m.report.disagreements) lines.push(`${position.participant.name}: ${position.stance}`, '', position.content, '');
      if (!m.report.disagreements.length) lines.push('No differing authored stance was recorded. Unavailable participants do not establish agreement.');
    }
    lines.push('', '## Event record', '');
    for (const event of m.events) {
      lines.push(`### Round ${event.round} · ${event.actorId} · ${event.kind}`, '', '```json', JSON.stringify(event).replace(/`/g, '\\u0060'), '```', '');
    }
    const result = lines.join('\n');
    if (result.length > MAX_EXPORT_CHARACTERS) throw new Error('Meeting export exceeds its safety limit.');
    return result;
  }
  function close() {
    if (closeTask) return closeTask;
    closing = true;
    lifecycle.abort();
    closeTask = (async () => {
      try {
        const stopping = stopMeeting(); // Abort/fence synchronously before closing the browser.
        // Always invoke close, including when a faulty driver's stop never settles.
        const results = await deadline(() => Promise.allSettled([
          stopping, deadline(() => runtime.close(), { timeoutMs: closeTimeoutMs, label: 'Browser close' }),
          writeTail, restoreInFlight,
        ]), { timeoutMs: 3 * closeTimeoutMs + 50, label: 'Controller shutdown' });
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
      } catch (error) {
        if (meeting) meeting.error = [meeting.error, errorText(error)].filter(Boolean).join(' ').slice(0, 1200);
      } finally { closed = true; }
    })();
    return closeTask;
  }
  return { getState, addSeat, openSeat, checkSeat, removeSeat,
    startMeeting, synthesizeMeeting, stopMeeting, newMeeting, loadMeeting,
    exportData, backupData, previewRestoreData, restoreBackupData, runtimeChanged, close };
}
