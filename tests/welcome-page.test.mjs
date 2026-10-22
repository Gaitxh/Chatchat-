import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OPEN_MEETING_ROOM,
  createRoomLauncher,
  createRoomMessageListener,
  createWelcomeInstaller,
} from "../extension-public/room-launcher.js";
import { setupWelcomePage } from "../extension-public/welcome.js";

const extensionUrl = "chrome-extension://test-extension/";
const welcomeUrl = `${extensionUrl}welcome.html`;
const roomUrl = `${extensionUrl}app/app.html`;
const trustedSender = { id: "test-extension", url: welcomeUrl, frameId: 0, documentLifecycle: "active" };

function fixture() {
  const calls = [];
  const stored = {};
  const listeners = { installed: [], startup: [], clicked: [], message: [] };
  const event = (key) => ({ addListener: (listener) => listeners[key].push(listener) });
  const browser = {
    runtime: {
      id: "test-extension", getURL: (path) => `${extensionUrl}${path}`,
      onInstalled: event("installed"), onStartup: event("startup"), onMessage: event("message"),
    },
    action: { onClicked: event("clicked") },
    sidePanel: { setPanelBehavior: async (options) => { calls.push(["panel", options]); } },
    storage: { local: {
      get: async (key) => { calls.push(["storage.get", key]); return { [key]: stored[key] }; },
      set: async (values) => { calls.push(["storage.set", values]); Object.assign(stored, values); },
    } },
    tabs: {
      query: async () => { calls.push(["tabs.query"]); return []; },
      create: async (options) => { calls.push(["tabs.create", options]); return { id: 1 }; },
    },
    windows: { create: async (options) => { calls.push(["windows.create", options]); return { id: 2 }; } },
  };
  return { browser, calls, stored, listeners };
}

const drainTasks = () => new Promise((resolve) => setImmediate(resolve));

test("first install opens local help only once, including concurrent events and worker restarts", async () => {
  const { browser, calls } = fixture();
  const install = createWelcomeInstaller(browser);
  assert.deepEqual(await Promise.all([install({ reason: "install" }), install({ reason: "install" })]), [true, true]);
  assert.equal(await install({ reason: "install" }), false);
  assert.equal(await createWelcomeInstaller(browser)({ reason: "install" }), false);
  assert.deepEqual(calls.filter(([name]) => name === "tabs.create"), [["tabs.create", { url: welcomeUrl, active: true }]]);
  assert.deepEqual(calls.slice(0, 3).map(([name]) => name), ["storage.get", "storage.set", "tabs.create"]);
  assert.equal(calls.some(([name]) => name === "windows.create"), false);
});

test("updates, browser updates and absent install details do not read storage or open anything", async () => {
  const { browser, calls } = fixture();
  const install = createWelcomeInstaller(browser);
  for (const details of [{ reason: "update" }, { reason: "chrome_update" }, { reason: "shared_module_update" }, {}, undefined]) {
    assert.equal(await install(details), false);
  }
  assert.deepEqual(calls, []);
});

test("failed welcome creation is not repeatedly reopened after a worker restart", async () => {
  const { browser, calls } = fixture();
  browser.tabs.create = async () => { calls.push(["tabs.error"]); throw new Error("denied"); };
  await assert.rejects(createWelcomeInstaller(browser)({ reason: "install" }), /denied/);
  assert.equal(await createWelcomeInstaller(browser)({ reason: "install" }), false);
  assert.equal(calls.filter(([name]) => name === "tabs.error").length, 1);
});

test("welcome storage failures fail closed before creating a tab", async () => {
  const { browser, calls } = fixture();
  browser.storage.local.set = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(createWelcomeInstaller(browser)({ reason: "install" }), /storage unavailable/);
  assert.ok(calls.every(([name]) => !name.endsWith(".create")));
});

test("only the trusted top-level welcome page may request a meeting room", async () => {
  const { browser, calls } = fixture();
  const listener = createRoomMessageListener(browser, createRoomLauncher(browser));
  const senders = [
    undefined, {}, { ...trustedSender, id: "another-extension" },
    { ...trustedSender, url: "https://example.invalid/welcome.html" },
    { ...trustedSender, url: `${welcomeUrl}.fake` },
    { ...trustedSender, url: `${welcomeUrl}?redirect=anything` },
    { ...trustedSender, url: roomUrl },
    { ...trustedSender, url: `${extensionUrl}extension/sidepanel.html` },
    { ...trustedSender, frameId: 1 },
    { ...trustedSender, documentLifecycle: "prerender" },
  ];
  for (const sender of senders) {
    const responses = [];
    assert.equal(listener({ type: OPEN_MEETING_ROOM }, sender, (response) => responses.push(response)), false);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
  }
  await drainTasks();
  assert.deepEqual(calls, []);

  const response = await new Promise((resolve) => {
    assert.equal(listener({ type: OPEN_MEETING_ROOM }, trustedSender, resolve), true);
  });
  assert.deepEqual(response, { ok: true });
  assert.deepEqual(calls.map(([name]) => name), ["tabs.query", "windows.create"]);
  assert.equal(calls[1][1].url, roomUrl);
});

test("malformed launch requests and unrelated messages have no side effects", async () => {
  const { browser, calls } = fixture();
  const listener = createRoomMessageListener(browser, createRoomLauncher(browser));
  for (const message of [
    { type: OPEN_MEETING_ROOM, url: "https://example.invalid/" },
    { type: OPEN_MEETING_ROOM, reset: true },
    Object.assign([], { type: OPEN_MEETING_ROOM }),
  ]) {
    const responses = [];
    assert.equal(listener(message, trustedSender, (response) => responses.push(response)), false);
    assert.equal(responses[0].ok, false);
  }
  for (const message of [null, undefined, "OPEN_MEETING_ROOM", {}, { type: "VERIFY_EVIDENCE_SOURCE" }, { type: "CLAIM_PROVIDER_SELF_HEALING" }]) {
    assert.equal(listener(message, trustedSender, () => assert.fail("Unrelated messages must be untouched")), undefined);
  }
  await drainTasks();
  assert.deepEqual(calls, []);
});

test("launch errors send a bounded response without exposing browser error details", async () => {
  const { browser } = fixture();
  const listener = createRoomMessageListener(browser, () => { throw new Error("private implementation detail"); });
  const response = await new Promise((resolve) => listener({ type: OPEN_MEETING_ROOM }, trustedSender, resolve));
  assert.deepEqual(response, { ok: false, error: "The meeting room could not be opened." });
});

test("service worker wires help, first install and toolbar without startup/update launches", async () => {
  const { browser, calls, listeners } = fixture();
  const previousChrome = globalThis.chrome;
  globalThis.chrome = browser;
  try {
    await import(`../extension-public/service-worker.js?welcome-test=${Date.now()}`);
    assert.equal(listeners.installed.length, 1);
    assert.equal(listeners.startup.length, 1);
    assert.equal(listeners.clicked.length, 1);
    for (const listener of listeners.startup) listener();
    for (const listener of listeners.installed) listener({ reason: "update" });
    await drainTasks();
    assert.ok(calls.every(([name]) => name === "panel"));

    for (const listener of listeners.installed) listener({ reason: "install" });
    await drainTasks();
    assert.deepEqual(calls.filter(([name]) => name === "tabs.create"), [["tabs.create", { url: welcomeUrl, active: true }]]);

    const responses = [];
    for (const listener of listeners.message) {
      listener({ type: OPEN_MEETING_ROOM }, { ...trustedSender, url: "https://example.invalid/" }, (response) => responses.push(response));
    }
    await drainTasks();
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
    assert.equal(calls.some(([name]) => name === "tabs.query" || name === "windows.create"), false);

    // Both entry points must share the same coalesced launcher.
    for (const listener of listeners.clicked) listener();
    const response = await new Promise((resolve) => {
      for (const listener of listeners.message) listener({ type: OPEN_MEETING_ROOM }, trustedSender, resolve);
    });
    await drainTasks();
    assert.deepEqual(response, { ok: true });
    assert.equal(calls.filter(([name]) => name === "windows.create").length, 1);
    assert.equal(calls.filter(([name]) => name === "tabs.create").length, 1);
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});

function pageFixture() {
  const handlers = new Map();
  const button = { disabled: false, addEventListener: (type, handler) => handlers.set(type, handler) };
  const status = { textContent: "" };
  const page = { getElementById: (id) => ({ "open-meeting-room": button, "launch-status": status })[id] };
  return { page, button, status, click: () => handlers.get("click")() };
}

test("welcome button sends only a fixed internal message and suppresses duplicate clicks", async () => {
  const { page, button, status, click } = pageFixture();
  const messages = [];
  let finish;
  setupWelcomePage(page, { sendMessage: (message) => {
    messages.push(message);
    return new Promise((resolve) => { finish = resolve; });
  } });
  assert.deepEqual(messages, []);
  const firstClick = click();
  assert.equal(button.disabled, true);
  await click();
  assert.deepEqual(messages, [{ type: OPEN_MEETING_ROOM }]);
  finish({ ok: true });
  await firstClick;
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /meeting room is open/);
  assert.match(status.textContent, /会议室已打开/);
});

test("denial, missing APIs and message failures show accessible retry guidance", async () => {
  for (const runtime of [undefined, { sendMessage: async () => ({ ok: false }) }, { sendMessage: async () => undefined }, { sendMessage: async () => { throw new Error("disconnected"); } }]) {
    const { page, button, status, click } = pageFixture();
    setupWelcomePage(page, runtime);
    await click();
    assert.equal(button.disabled, false);
    assert.match(status.textContent, /Try again or use the ChatChat toolbar icon/);
    assert.match(status.textContent, /请重试/);
  }
});

test("welcome assets stay local, bilingual and accessible without widening install privileges", async () => {
  const [html, css, rawManifest] = await Promise.all([
    readFile(new URL("../extension-public/welcome.html", import.meta.url), "utf8"),
    readFile(new URL("../extension-public/welcome.css", import.meta.url), "utf8"),
    readFile(new URL("../extension-public/manifest.json", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(rawManifest);
  assert.deepEqual(manifest.options_ui, { page: "welcome.html", open_in_tab: true });
  assert.deepEqual(manifest.permissions, ["sidePanel", "storage", "scripting", "tabs"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
  assert.equal(manifest.content_security_policy, undefined, "Keep MV3's default local-script CSP");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<section lang="zh-CN"/);
  assert.match(html, /<button[^>]*id="open-meeting-room"[^>]*type="button"/);
  assert.match(html, /id="launch-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<script type="module" src="welcome.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="welcome.css">/);
  assert.doesNotMatch(html, /\son\w+\s*=|<iframe|<webview|<style|style=|https?:\/\/|javascript:/i);
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width:/);
  assert.match(html, /dedicated new chat per seat, for every meeting/);
  assert.match(html, /每场会议的每个席位都使用一个专用的新对话/);
  assert.match(html, /specific site/);
  assert.match(html, /stored locally/);
  assert.match(html, /Provider tabs stay online/);
  assert.match(html, /not a signed desktop app/);
  assert.match(html, /Synthetic demos are separate/);
  assert.match(html, /Extension options/);
});
