import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import { ADAPTERS, PROVIDERS } from './providers.mjs';
import { managedPageSurface } from './surface.mjs';
import { startOutboundProxy } from './outbound-proxy.mjs';
import { assertBrowserIntegrity } from './browser-integrity.mjs';
import { isLoginLocation, isPublicAddress, validatePublicUrl } from './urls.mjs';

const MESSAGES = Object.freeze({
  INVALID_URL: 'Enter a public HTTPS URL without credentials, query strings, fragments, or a custom port.',
  INVALID_SEAT: 'The requested seat does not exist.',
  INVALID_REQUEST: 'The browser request is invalid or exceeds its size limit.',
  DUPLICATE_ORIGIN: 'This provider origin already has a seat. Each origin has one equal participant slot.',
  CAPACITY: 'The desktop harness allows at most eight seats.',
  CLOSED: 'The managed browser runtime is closed.',
  STOPPED: 'Browser work was cancelled. Start a new meeting before sending again.',
  TIMEOUT: 'The browser operation timed out. Check the managed browser before starting a new meeting.',
  SEAT_BUSY: 'This seat already has a browser operation in progress.',
  RUNTIME_UNAVAILABLE: 'Bundled Chromium is unavailable. Repair or reinstall the desktop application.',
  NETWORK_PROXY_UNAVAILABLE: 'Secure browser network tunnel could not start. Check your local firewall, then restart ChatChat.',
  DRIVER_FAILURE: 'The managed browser operation failed. Check the browser window and try a new meeting.',
  STORAGE_FAILURE: 'Managed browser preferences could not be saved safely. Browser submission is paused.',
  ORIGIN_DRIFT: 'The page left its pinned provider origin. Finish sign-in manually, return to the provider, and check the seat.',
  LOGIN_REQUIRED: 'Sign in manually in the managed browser, return to the chat page, and check the seat.',
  SURFACE_UNAVAILABLE: 'A safe chat composer and send control could not be identified. Sign in manually or check the site layout.',
  AMBIGUOUS_SURFACE: 'The page contains multiple possible chat controls. Automatic sending is paused.',
  MANUAL_ONLY: 'Manual-only seat. This website can be opened and used by you, but ChatChat will not send prompts or count it as an automatic council participant.',
  UNEXPECTED_CHAT: 'The page contains an existing or unexpected conversation. A fresh, empty chat is required.',
  NONEMPTY_COMPOSER: 'The composer contains an unsent draft. Automatic sending is paused.',
  GENERATING: 'The page is already generating a response. Automatic sending is paused.',
  NOT_PREPARED: 'Prepare a fresh chat for this meeting before sending.',
  DRAFT_CHANGED: 'The chat composer changed unexpectedly. Automatic sending is paused.',
  RESPONSE_TOO_LARGE: 'The assistant reply exceeded the bounded response size.',
  REPLY_UNAVAILABLE: 'A single assistant reply could not be identified safely.',
  OPERATION_CONFLICT: 'This operation ID was already used with a different prompt.',
  OPERATION_RECORDED: 'This operation was recorded in a previous app session and cannot be sent again.',
  OPERATION_LIMIT: 'The operation safety journal is full. Remove and re-add the seat before a new meeting.',
  AMBIGUOUS_SEND: 'Submission may have reached the provider. It will not be retried. Check the browser and start a new meeting.',
});

export class ManagedBrowserError extends Error {
  constructor(code, { ambiguous = false, causeCode } = {}) {
    super(MESSAGES[code] ?? MESSAGES.DRIVER_FAILURE);
    this.name = 'ManagedBrowserError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'DRIVER_FAILURE';
    this.ambiguous = ambiguous;
    if (causeCode && Object.hasOwn(MESSAGES, causeCode)) this.causeCode = causeCode;
  }
}

const failure = (code) => new ManagedBrowserError(code);
const safeError = (error) => error instanceof ManagedBrowserError ? error : failure('DRIVER_FAILURE');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const copy = (value) => structuredClone(value);
const CLEANUP_TIMEOUT_MS = 1_200;
// Browser processes can wedge while closing. Release cancellation ownership
// within a fixed deadline; never let a late close resume browser operations.
async function boundedCleanup(dispose) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(dispose).catch(() => {}),
      new Promise((resolve) => { timer = setTimeout(resolve, CLEANUP_TIMEOUT_MS); }),
    ]);
  } finally { clearTimeout(timer); }
}
const validToken = (value, max = 180) => typeof value === 'string' && value.length >= 1
  && value.length <= max && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/.test(value);

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

/** Local-only owner of app profiles and the fixed, page-scoped browser transport. */
export class ManagedBrowserRuntime {
  #dataDir;
  #metadataPath;
  #executablePath;
  #chromium;
  #injected;
  #proxyFactory;
  #proxyPromise;
  #proxyFailed = false;
  #browserVerifier;
  #integrityPromise;
  #integrityFailed = false;
  #headless;
  #onChange;
  #seats = new Map();
  #browsers = new Map();
  #active = new Map();
  #operations = new Map();
  #journal = new Map();
  #dnsCache = new Map();
  #storageFailed = false;
  #closed = false;
  #stopping = false;
  #stopPromise;
  #closePromise;
  #removing = new Set();
  #epoch = 0;

  constructor({ dataDir, executablePath, onChange = () => {}, headless = false, chromium, networkProxy, browserVerifier } = {}) {
    if (typeof dataDir !== 'string' || !dataDir || dataDir.length > 4096
      || (executablePath !== undefined && (typeof executablePath !== 'string' || !path.isAbsolute(executablePath)))
      || typeof onChange !== 'function' || typeof headless !== 'boolean') throw failure('INVALID_REQUEST');
    this.#dataDir = path.resolve(dataDir);
    this.#metadataPath = path.join(this.#dataDir, 'managed-browser-seats.json');
    this.#executablePath = executablePath;
    this.#headless = headless;
    this.#chromium = chromium;
    this.#injected = chromium !== undefined;
    // Production MUST use the pinned-socket tunnel. Injected Chromium and
    // proxy factories exist only for controlled, offline driver tests.
    this.#proxyFactory = networkProxy ?? (this.#injected ? null : startOutboundProxy);
    this.#browserVerifier = browserVerifier === undefined
      ? (this.#injected ? null : assertBrowserIntegrity)
      : browserVerifier;
    if (this.#browserVerifier !== null && typeof this.#browserVerifier !== 'function') throw failure('INVALID_REQUEST');
    this.#onChange = onChange;
    this.#load();
  }

  getInfo() {
    let executableAvailable = false;
    try { executableAvailable = Boolean(this.#executablePath && statSync(this.#executablePath).isFile()); } catch { /* Missing/unreadable bundle. */ }
    const available = !this.#closed && !this.#storageFailed && !this.#integrityFailed && !this.#proxyFailed && (this.#injected
      ? typeof this.#chromium?.launchPersistentContext === 'function'
      : executableAvailable);
    return { available, label: '内置浏览器', message: this.#closed ? MESSAGES.CLOSED
      : this.#integrityFailed ? '内置 Chromium 文件完整性校验失败。请从可信来源重新安装 ChatChat。'
      : this.#proxyFailed ? '无法启动本机安全网络通道。请检查安全软件或防火墙并重启 ChatChat。'
      : this.#storageFailed ? MESSAGES.STORAGE_FAILURE : available
        ? '本机运行，账号登录保存在专用浏览器中。各网站兼容性仍需验证。'
        : MESSAGES.RUNTIME_UNAVAILABLE };
  }

  catalog() { return copy(PROVIDERS); }
  list() { return [...this.#seats.values()].map(copy); }

  async addSeat(spec) {
    this.#assertUsable();
    const descriptor = this.#descriptor(spec);
    if (this.#seats.size >= 8) throw failure('CAPACITY');
    const origin = new URL(descriptor.url).origin;
    if ([...this.#seats.values()].some((seat) => new URL(seat.url).origin === origin)) throw failure('DUPLICATE_ORIGIN');
    const seat = { id: `seat-${randomUUID()}`, providerId: descriptor.id, name: descriptor.name, url: descriptor.url,
      status: 'closed', detail: 'Open this app-owned browser to sign in manually.' };
    this.#seats.set(seat.id, seat);
    try { this.#save(); } catch (error) { this.#seats.delete(seat.id); throw error; }
    this.#emit(seat);
    return this.openSeat(seat.id);
  }

  async openSeat(id) {
    this.#seat(id);
    try {
      return await this.#task(id, {}, async (task, seat) => {
        this.#update(id, 'opening', 'Opening the separate managed browser.');
        const record = await this.#ensureContext(seat, task);
        if (!record.page || record.page.isClosed()) {
          const page = await this.#resource(task, () => record.context.newPage(), (late) => late.close());
          record.page = page;
          task.page = page;
          this.#watchPage(seat, record, page);
          task.check();
          await this.#discardRestored(record, task);
          await this.#step(task, () => page.goto(seat.url, { waitUntil: 'domcontentloaded', timeout: 30_000 }));
        } else task.page = record.page;
        await this.#step(task, () => record.page.bringToFront());
        return this.#checkSurface(seat, record, task);
      });
    } catch (caught) {
      const error = safeError(caught);
      if (error.code === 'INVALID_SEAT' || error.code === 'SEAT_BUSY' || error.code === 'CLOSED') throw error;
      return this.#update(id, error.code === 'LOGIN_REQUIRED' || error.code === 'ORIGIN_DRIFT' ? 'needs_login' : 'error', error.message);
    }
  }

  async checkSeat(id) {
    return this.#task(id, {}, async (task, seat) => {
      const record = this.#browsers.get(id);
      if (!record?.page || record.page.isClosed()) return this.#update(id, 'closed', 'Open the managed browser to check this seat.');
      task.page = record.page;
      return this.#checkSurface(seat, record, task);
    });
  }

  async removeSeat(id) {
    this.#assertUsable();
    this.#seat(id);
    if (this.#removing.has(id)) throw failure('SEAT_BUSY');
    this.#removing.add(id);
    try {
    const active = this.#active.get(id);
    if (active) { active.controller.abort(failure('STOPPED')); await active.promise.catch(() => {}); }
    const record = this.#browsers.get(id);
    if (record) {
      this.#browsers.delete(id);
      await boundedCleanup(() => record.context.close());
    }
    const seat = this.#seats.get(id);
    this.#seats.delete(id);
    for (const [key, entry] of this.#journal) if (entry.seatId === id) this.#journal.delete(key);
    for (const [key, entry] of this.#operations) if (entry.seatId === id) this.#operations.delete(key);
    this.#save();
    this.#emit({ ...seat, status: 'closed', detail: 'Seat removed. Its app-owned login profile remains on this device.' });
    } finally { this.#removing.delete(id); }
  }

  async prepareSeat(id, { sessionId, signal } = {}) {
    if (!validToken(sessionId)) throw failure('INVALID_REQUEST');
    return this.#task(id, { signal }, async (task, seat) => {
      const adapter = this.#adapter(seat);
      const record = await this.#ensureContext(seat, task);
      if (record.session?.id === sessionId && record.page && !record.page.isClosed()) {
        this.#assertOrigin(seat, record.page);
        return;
      }
      record.session = null;
      const previous = record.page;
      // A new page shares only this provider's persistent app profile, preserving human login.
      const page = await this.#resource(task, () => record.context.newPage(), (late) => late.close());
      record.page = page;
      task.page = page;
      this.#watchPage(seat, record, page);
      task.check();
      await this.#discardRestored(record, task);
      await this.#step(task, () => page.goto(seat.url, { waitUntil: 'domcontentloaded', timeout: 30_000 }));
      const surface = await this.#waitForSurface(seat, page, task, adapter);
      this.#assertEmpty(surface);
      record.session = { id: sessionId, users: 0, assistants: 0 };
      if (previous && previous !== page && !previous.isClosed()) await this.#step(task, () => previous.close());
      this.#update(id, 'ready', 'Fresh chat prepared. Automation remains experimental.');
    });
  }

  async send(id, { prompt, operationId, signal, timeoutMs = 120_000 } = {}) {
    this.#assertUsable();
    this.#seat(id);
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 48_000 || prompt.includes('\u0000')
      || !validToken(operationId) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw failure('INVALID_REQUEST');
    const key = digest(`${id}\u0000${operationId}`);
    const promptHash = digest(prompt);
    const existing = this.#operations.get(key);
    if (existing) {
      if (existing.promptHash !== promptHash) throw failure('OPERATION_CONFLICT');
      return existing.promise.then(copy);
    }
    const recorded = this.#journal.get(key);
    if (recorded) {
      if (recorded.promptHash !== promptHash) throw failure('OPERATION_CONFLICT');
      if (recorded.state !== 'completed') throw new ManagedBrowserError('AMBIGUOUS_SEND', { ambiguous: true });
      throw failure('OPERATION_RECORDED');
    }
    if (this.#journal.size >= 2048 || this.#operations.size >= 2048) throw failure('OPERATION_LIMIT');
    const entry = { seatId: id, promptHash, dispatchStarted: false, promise: null };
    this.#operations.set(key, entry);
    entry.promise = this.#task(id, { signal, timeoutMs }, async (task, seat) => {
      const startedAt = Date.now();
      const record = this.#browsers.get(id);
      if (!record?.session || !record.page || record.page.isClosed()) throw failure('NOT_PREPARED');
      const page = record.page;
      task.page = page;
      const adapter = this.#adapter(seat);
      const baseline = { users: record.session.users, assistants: record.session.assistants };
      const before = await this.#inspect(seat, page, task, adapter);
      this.#assertExpected(before, baseline);
      if (before.hasDraft) throw failure('NONEMPTY_COMPOSER');
      if (before.busy) throw failure('GENERATING');
      const composer = await this.#element(seat, page, task, adapter, 'composer');
      task.mutated = true;
      try { await this.#step(task, () => composer.fill(prompt, { timeout: Math.min(8_000, timeoutMs) })); }
      finally { await composer.dispose().catch(() => {}); }
      let filled;
      // Framework-controlled composers can enable their send button on the next render.
      for (;;) {
        filled = await this.#inspect(seat, page, task, adapter, { expectedPrompt: prompt });
        this.#assertExpected(filled, baseline);
        if (!filled.matchesPrompt) throw failure('DRAFT_CHANGED');
        if (filled.busy) throw failure('GENERATING');
        if (filled.sendEnabled) break;
        await this.#pause(task, 100);
      }
      const send = await this.#element(seat, page, task, adapter, 'send', { expectedPrompt: prompt, capture: baseline });
      try {
        task.check();
        // Persist intent BEFORE the only click. Crashes, aborts and ambiguous driver failures never cause resend.
        this.#journal.set(key, { seatId: id, promptHash, state: 'pending' });
        this.#save();
        entry.dispatchStarted = true;
        await this.#step(task, () => send.click({ timeout: Math.min(8_000, timeoutMs) }));
      } finally { await send.dispose().catch(() => {}); }
      let lastText = null;
      let stableSince = 0;
      for (;;) {
        const current = await this.#inspect(seat, page, task, adapter, { capture: baseline });
        if (current.userCount < baseline.users || current.userCount > baseline.users + 1
          || current.assistantCount < baseline.assistants || current.assistantCount > baseline.assistants + 1) throw failure('UNEXPECTED_CHAT');
        const text = current.responseText;
        const complete = !current.busy && !current.hasDraft && current.replyComplete === true;
        if (typeof text === 'string' && text.trim() && complete) {
          if (text !== lastText) { lastText = text; stableSince = Date.now(); }
          else if (Date.now() - stableSince >= 1_500) {
            task.check();
            record.session.users = baseline.users + 1;
            record.session.assistants = baseline.assistants + 1;
            // Freeze the conversation URL after the first completed provider turn.
            record.session.chatUrl = page.url();
            this.#journal.set(key, { seatId: id, promptHash, state: 'completed' });
            this.#save();
            this.#update(id, 'ready', 'One assistant turn captured. Automation remains experimental.');
            return { responseText: text, elapsedMs: Date.now() - startedAt };
          }
        } else { lastText = null; stableSince = 0; }
        await this.#pause(task, 250);
      }
    }).catch(async (caught) => {
      let error = safeError(caught);
      if (entry.dispatchStarted) {
        this.#journal.set(key, { seatId: id, promptHash, state: 'uncertain' });
        try { this.#save(); } catch { /* Storage failure already fences future submissions. */ }
        error = new ManagedBrowserError('AMBIGUOUS_SEND', { ambiguous: true, causeCode: error.code });
      }
      throw error;
    });
    // Keep the rejected promise for idempotent replay without creating an unhandled rejection.
    entry.promise.catch(() => {});
    return entry.promise.then(copy);
  }

  async stop() {
    if (this.#stopPromise) return this.#stopPromise;
    this.#stopping = true;
    ++this.#epoch;
    this.#stopPromise = (async () => {
      const tasks = [...this.#active.values()];
      for (const task of tasks) task.controller.abort(failure('STOPPED'));
      await Promise.allSettled(tasks.map((task) => task.promise));
      for (const record of this.#browsers.values()) record.session = null;
    })().finally(() => { this.#stopping = false; this.#stopPromise = undefined; });
    return this.#stopPromise;
  }

  async close() {
    if (this.#closePromise) return this.#closePromise;
    this.#closed = true;
    this.#closePromise = (async () => {
    await this.stop();
    const records = [...this.#browsers.values()];
    this.#browsers.clear();
    await Promise.allSettled(records.map((record) => boundedCleanup(() => record.context.close())));
    for (const seat of this.#seats.values()) this.#update(seat.id, 'closed', 'Managed browser closed. Login remains in its app-owned profile.');
    this.#dnsCache.clear();
    const proxy = await this.#proxyPromise?.catch(() => null);
    this.#proxyPromise = null;
    await proxy?.close();
    })();
    return this.#closePromise;
  }

  #assertUsable() {
    if (this.#closed) throw failure('CLOSED');
    if (this.#stopping) throw failure('STOPPED');
    if (this.#storageFailed) throw failure('STORAGE_FAILURE');
  }

  #seat(id) {
    if (typeof id !== 'string' || !this.#seats.has(id)) throw failure('INVALID_SEAT');
    return this.#seats.get(id);
  }

  #descriptor(spec) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec) || Object.keys(spec).length !== 1) throw failure('INVALID_REQUEST');
    if (Object.hasOwn(spec, 'providerId')) {
      const provider = PROVIDERS.find((candidate) => candidate.id === spec.providerId);
      if (!provider) throw failure('INVALID_REQUEST');
      return provider;
    }
    if (!Object.hasOwn(spec, 'url')) throw failure('INVALID_REQUEST');
    let url;
    try { url = validatePublicUrl(spec.url); } catch { throw failure('INVALID_URL'); }
    const known = PROVIDERS.find((provider) => new URL(provider.url).origin === url.origin);
    if (known) return known;
    return { id: `custom-${digest(url.origin).slice(0, 20)}`, name: url.hostname, url: url.href, automation: 'manual' };
  }

  #adapter(seat) {
    const adapter = ADAPTERS[seat.providerId];
    if (!adapter) throw failure('MANUAL_ONLY');
    return adapter;
  }

  #emit(seat) { try { this.#onChange(copy(seat)); } catch { /* UI observers never control browser work. */ } }

  #update(id, status, detail) {
    const previous = this.#seat(id);
    const seat = { ...previous, status, detail };
    this.#seats.set(id, seat);
    this.#emit(seat);
    return copy(seat);
  }

  #task(id, { signal, timeoutMs = 30_000 }, action) {
    try { this.#assertUsable(); this.#seat(id); }
    catch (error) { return Promise.reject(error); }
    if (signal !== undefined && (!signal || typeof signal.addEventListener !== 'function' || typeof signal.aborted !== 'boolean')) return Promise.reject(failure('INVALID_REQUEST'));
    if (this.#active.has(id)) return Promise.reject(failure('SEAT_BUSY'));
    if (this.#removing.has(id)) return Promise.reject(failure('STOPPED'));
    const controller = new AbortController();
    const epoch = this.#epoch;
    const externalAbort = () => controller.abort(failure('STOPPED'));
    if (signal?.aborted) externalAbort();
    else signal?.addEventListener('abort', externalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(failure('TIMEOUT')), timeoutMs);
    const task = { controller, page: null, promise: null, mutated: false, check: () => {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (epoch !== this.#epoch || this.#closed || this.#stopping) throw failure('STOPPED');
    } };
    this.#active.set(id, task);
    task.promise = (async () => {
      try { task.check(); return await action(task, this.#seat(id)); }
      catch (caught) {
        const error = safeError(caught);
        const record = this.#browsers.get(id);
        if (record) record.session = null;
        // Closing this app-owned page cancels pending Playwright actions as well as late callbacks.
        const mustClose = task.mutated || (controller.signal.aborted && !['LOGIN_REQUIRED', 'ORIGIN_DRIFT'].includes(error.code));
        if (mustClose && task.page && !task.page.isClosed()) await boundedCleanup(() => task.page.close());
        if (mustClose && record?.page === task.page) record.page = null;
        if (this.#seats.has(id)) this.#update(id, ['LOGIN_REQUIRED', 'ORIGIN_DRIFT'].includes(error.code) ? 'needs_login' : 'attention', error.message);
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', externalAbort);
        if (this.#active.get(id) === task) this.#active.delete(id);
      }
    })();
    return task.promise;
  }

  async #step(task, action) {
    task.check();
    const result = await abortable(action(), task.controller.signal);
    task.check();
    return result;
  }

  async #resource(task, create, dispose) {
    task.check();
    const pending = Promise.resolve(create());
    try {
      const resource = await abortable(pending, task.controller.signal);
      task.check();
      return resource;
    } catch (error) {
      // Driver creation has no AbortSignal. Stop immediately and dispose of a
      // late object instead of adopting it or letting it perform any navigation.
      void pending.then((resource) => dispose(resource)).catch(() => {});
      throw error;
    }
  }

  async #pause(task, milliseconds) {
    let timer;
    try { await this.#step(task, () => new Promise((resolve) => { timer = setTimeout(resolve, milliseconds); })); }
    finally { clearTimeout(timer); }
  }

  async #verifyBrowser(task) {
    if (!this.#browserVerifier) return;
    task.check();
    if (!this.#integrityPromise) {
      this.#integrityPromise = Promise.resolve().then(() => this.#browserVerifier(this.#executablePath))
        .catch(() => {
          this.#integrityFailed = true;
          throw failure('RUNTIME_UNAVAILABLE');
        });
    }
    await this.#step(task, () => this.#integrityPromise);
  }

  async #getOutboundProxy(task) {
    if (!this.#proxyFactory) return null;
    if (this.#proxyFailed) throw failure('NETWORK_PROXY_UNAVAILABLE');
    task.check();
    if (!this.#proxyPromise) {
      this.#proxyPromise = Promise.resolve().then(() => this.#proxyFactory())
        .then(async (proxy) => {
          if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy.server)
            || typeof proxy.username !== 'string' || typeof proxy.password !== 'string'
            || typeof proxy.close !== 'function') {
            await proxy?.close?.();
            throw failure('RUNTIME_UNAVAILABLE');
          }
          if (this.#closed) {
            await proxy.close();
            throw failure('CLOSED');
          }
          return proxy;
        })
        .catch(() => { this.#proxyFailed = true; throw failure('NETWORK_PROXY_UNAVAILABLE'); });
    }
    return this.#step(task, () => this.#proxyPromise);
  }

  async #ensureContext(seat, task) {
    if (this.#browsers.has(seat.id)) return this.#browsers.get(seat.id);
    if (!this.getInfo().available) throw failure(this.#storageFailed ? 'STORAGE_FAILURE' : 'RUNTIME_UNAVAILABLE');
    if (!this.#chromium) {
      try { this.#chromium = (await import('playwright-core')).chromium; }
      catch { throw failure('RUNTIME_UNAVAILABLE'); }
    }
    task.check();
    await this.#verifyBrowser(task);
    const outboundProxy = await this.#getOutboundProxy(task);
    const origin = new URL(seat.url).origin;
    const profile = path.join(this.#dataDir, 'browser-profiles', `${seat.providerId.replace(/[^a-z0-9-]/gi, '-').slice(0, 50)}-${digest(origin).slice(0, 16)}`);
    mkdirSync(profile, { recursive: true, mode: 0o700 });
    // Playwright uses --remote-debugging-pipe itself. Never add a debug TCP listener or sandbox bypass.
    const context = await this.#resource(task, () => this.#chromium.launchPersistentContext(profile, {
      ...(this.#executablePath ? { executablePath: this.#executablePath } : {}),
      ...(outboundProxy ? {
        proxy: {
          server: outboundProxy.server,
          username: outboundProxy.username,
          password: outboundProxy.password,
        },
        // Chromium bypasses HTTP proxies for loopback by default. Remove that
        // exception, disable QUIC and non-proxied WebRTC UDP traffic.
        args: ['--proxy-bypass-list=<-loopback>', '--disable-quic',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
      } : {}),
      headless: this.#headless, chromiumSandbox: true, acceptDownloads: false, serviceWorkers: 'block',
      timeout: 30_000, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    }), (late) => late.close());
    const record = { context, page: null, session: null, restored: context.pages() };
    this.#browsers.set(seat.id, record);
    if (task.controller.signal.aborted || this.#closed || this.#stopping) {
      this.#browsers.delete(seat.id);
      await boundedCleanup(() => context.close());
      task.check();
    }
    context.setDefaultTimeout(8_000);
    context.setDefaultNavigationTimeout(30_000);
    await this.#step(task, () => context.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      if (await this.#publicDestination(requestUrl)) await route.continue().catch(() => {});
      else await route.abort('blockedbyclient').catch(() => {});
    }));
    // IMPORTANT: connectToServer() in Playwright WebSocket routing can
    // establish a driver-side connection instead of Chromium's configured
    // network proxy. Production MUST leave WebSockets on the browser network
    // stack, where each WSS CONNECT is checked by the authenticated proxy.
    // Keep the legacy preflight route only for injected/offline fixtures that
    // do not use the outbound proxy.
    if (!outboundProxy && typeof context.routeWebSocket === 'function') {
      await this.#step(task, () => context.routeWebSocket('**/*', async (socket) => {
        const destination = socket.url().replace(/^wss:/, 'https:');
        if (socket.url().startsWith('wss:') && await this.#publicDestination(destination)) socket.connectToServer();
        else socket.close();
      }));
    }
    context.on('page', (page) => {
      // Login popups are human-operated. Runtime never inspects their document or credentials.
      page.on('download', (download) => { void download.cancel().catch(() => {}); });
    });
    context.on('close', () => {
      if (this.#browsers.get(seat.id) !== record) return;
      this.#browsers.delete(seat.id);
      record.session = null;
      this.#active.get(seat.id)?.controller.abort(failure('DRIVER_FAILURE'));
      if (this.#seats.has(seat.id)) this.#update(seat.id, 'closed', 'Managed browser closed. Reopen it to continue.');
    });
    return record;
  }

  async #discardRestored(record, task) {
    // Open the owned page first: closing the last restored tab can exit headed Chromium.
    for (const restored of record.restored.splice(0)) {
      if (restored !== record.page && !restored.isClosed()) await this.#step(task, () => restored.close());
    }
  }

  async #publicDestination(input) {
    let url;
    try { url = validatePublicUrl(input, { navigation: true }); } catch { return false; }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host)) return isPublicAddress(host);
    const cached = this.#dnsCache.get(host);
    if (cached && cached.expires > Date.now()) return cached.allowed;
    try {
      const answers = await lookup(host, { all: true, verbatim: true });
      const allowed = answers.length > 0 && answers.every(({ address }) => isPublicAddress(address));
      if (this.#dnsCache.size >= 256) this.#dnsCache.clear();
      this.#dnsCache.set(host, { allowed, expires: Date.now() + 10_000 });
      return allowed;
    } catch { return false; }
  }

  #watchPage(seat, record, page) {
    page.on('close', () => {
      if (record.page !== page) return;
      record.page = null;
      record.session = null;
      this.#active.get(seat.id)?.controller.abort(failure('DRIVER_FAILURE'));
      if (this.#seats.has(seat.id)) this.#update(seat.id, 'closed', 'Chat page closed. Open it again before a new meeting.');
    });
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame() || record.page !== page) return;
      try {
        this.#assertOrigin(seat, page);
        // The first send may legitimately assign a new chat URL. Once the
        // first reply is captured, any navigation invalidates that conversation.
        this.#assertPinnedChat(seat, page);
      } catch (error) {
        record.session = null;
        const active = this.#active.get(seat.id);
        if (active) active.controller.abort(error);
        if (this.#seats.has(seat.id)) {
          this.#update(seat.id, error.code === 'UNEXPECTED_CHAT' ? 'attention' : 'needs_login', error.message);
        }
      }
    });
  }

  #assertOrigin(seat, page) {
    let url;
    try { url = validatePublicUrl(page.url(), { navigation: true }); }
    catch { throw failure('ORIGIN_DRIFT'); }
    if (url.origin !== new URL(seat.url).origin) throw failure('ORIGIN_DRIFT');
    if (isLoginLocation(url)) throw failure('LOGIN_REQUIRED');
  }

  #assertPinnedChat(seat, page) {
    const record = this.#browsers.get(seat.id);
    if (record?.page === page && record.session?.users > 0
      && (!record.session.chatUrl || record.session.chatUrl !== page.url())) throw failure('UNEXPECTED_CHAT');
  }

  async #inspect(seat, page, task, adapter, options = {}) {
    task.check();
    this.#assertOrigin(seat, page);
    this.#assertPinnedChat(seat, page);
    const record = this.#browsers.get(seat.id);
    const surface = await this.#step(task, () => page.evaluate(managedPageSurface, {
      origin: new URL(seat.url).origin, adapter, action: 'inspect', ...options,
      expectedChatUrl: record?.session?.users > 0 ? record.session.chatUrl : undefined,
    }));
    if (!surface || typeof surface !== 'object') throw failure('SURFACE_UNAVAILABLE');
    // An assistant node can exist briefly before its content container is mounted.
    if (surface.issue && !(surface.issue === 'REPLY_UNAVAILABLE' && options.capture)) throw failure(surface.issue);
    return surface;
  }

  async #element(seat, page, task, adapter, action, options = {}) {
    task.check();
    this.#assertOrigin(seat, page);
    this.#assertPinnedChat(seat, page);
    const record = this.#browsers.get(seat.id);
    const handle = await this.#step(task, () => page.evaluateHandle(managedPageSurface, {
      origin: new URL(seat.url).origin, adapter, action, ...options,
      expectedChatUrl: record?.session?.users > 0 ? record.session.chatUrl : undefined,
    }));
    const element = handle.asElement();
    if (!element) { await handle.dispose().catch(() => {}); throw failure('AMBIGUOUS_SURFACE'); }
    return element;
  }

  async #waitForSurface(seat, page, task, adapter) {
    for (;;) {
      try { return await this.#inspect(seat, page, task, adapter); }
      catch (error) {
        if (error.code !== 'SURFACE_UNAVAILABLE') throw error;
        await this.#pause(task, 250);
      }
    }
  }

  #assertEmpty(surface) {
    this.#assertExpected(surface, { users: 0, assistants: 0 });
    if (surface.hasDraft) throw failure('NONEMPTY_COMPOSER');
    if (surface.busy) throw failure('GENERATING');
  }

  #assertExpected(surface, baseline) {
    if (!Number.isInteger(surface.userCount) || !Number.isInteger(surface.assistantCount)
      || surface.userCount !== baseline.users || surface.assistantCount !== baseline.assistants) throw failure('UNEXPECTED_CHAT');
  }

  async #checkSurface(seat, record, task) {
    try {
      const adapter = this.#adapter(seat);
      const surface = await this.#inspect(seat, record.page, task, adapter);
      if (record.session) this.#assertExpected(surface, record.session);
      else this.#assertEmpty(surface);
      if (surface.hasDraft) throw failure('NONEMPTY_COMPOSER');
      if (surface.busy) throw failure('GENERATING');
      return this.#update(seat.id, 'ready', 'Empty chat controls detected. Automation and login compatibility remain experimental.');
    } catch (caught) {
      const error = safeError(caught);
      if (['STOPPED', 'TIMEOUT'].includes(error.code)) throw error;
      return this.#update(seat.id, error.code === 'MANUAL_ONLY' ? 'manual'
        : ['LOGIN_REQUIRED', 'ORIGIN_DRIFT'].includes(error.code)
          ? 'needs_login' : 'attention', error.message);
    }
  }

  #load() {
    if (!existsSync(this.#metadataPath)) return;
    try {
      if (statSync(this.#metadataPath).size > 1_048_576) throw new Error();
      const stored = JSON.parse(readFileSync(this.#metadataPath, 'utf8'));
      if (stored.version !== 1 || !Array.isArray(stored.seats) || stored.seats.length > 8
        || !Array.isArray(stored.operations) || stored.operations.length > 2048) throw new Error();
      const origins = new Set();
      const seats = new Map();
      for (const item of stored.seats) {
        if (!item || !/^seat-[a-f0-9-]{36}$/.test(item.id)) throw new Error();
        const descriptor = this.#descriptor({ url: item.url });
        if (descriptor.id !== item.providerId || item.url !== descriptor.url || seats.has(item.id)) throw new Error();
        const origin = new URL(descriptor.url).origin;
        if (origins.has(origin)) throw new Error();
        origins.add(origin);
        seats.set(item.id, { id: item.id, providerId: descriptor.id, name: descriptor.name, url: descriptor.url,
          status: 'closed', detail: 'Saved seat. Open its managed browser to check login and readiness.' });
      }
      const journal = new Map();
      for (const item of stored.operations) {
        if (!item || !/^[a-f0-9]{64}$/.test(item.key) || !/^[a-f0-9]{64}$/.test(item.promptHash)
          || !seats.has(item.seatId) || !['pending', 'completed', 'uncertain'].includes(item.state) || journal.has(item.key)) throw new Error();
        journal.set(item.key, { seatId: item.seatId, promptHash: item.promptHash, state: item.state });
      }
      this.#seats = seats;
      this.#journal = journal;
    } catch { this.#storageFailed = true; }
  }

  #save() {
    if (this.#storageFailed) throw failure('STORAGE_FAILURE');
    const contents = JSON.stringify({ version: 1,
      seats: [...this.#seats.values()].map(({ id, providerId, url }) => ({ id, providerId, url })),
      operations: [...this.#journal.entries()].map(([key, value]) => ({ key, ...value })),
    });
    const temporary = `${this.#metadataPath}.${randomUUID()}.tmp`;
    try {
      mkdirSync(this.#dataDir, { recursive: true, mode: 0o700 });
      writeFileSync(temporary, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.#metadataPath);
    } catch { this.#storageFailed = true; throw failure('STORAGE_FAILURE'); }
  }
}
