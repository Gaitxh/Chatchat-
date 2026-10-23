import assert from "node:assert/strict";
import test from "node:test";
import { createRoomLauncher, isLiveRoomUrl } from "../extension-public/room-launcher.js";

const appUrl = "chrome-extension://test-extension/app/app.html";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(initialTabs = []) {
  const calls = [];
  const tabs = [...initialTabs];
  const browser = {
    runtime: { getURL: (path) => `chrome-extension://test-extension/${path}` },
    tabs: {
      query: async (options) => { calls.push(["query", options]); return [...tabs]; },
      update: async (id, options) => { calls.push(["tab.update", id, options]); },
      create: async (options) => {
        calls.push(["tab.create", options]);
        const tab = { id: 10, windowId: 20, url: options.url };
        tabs.push(tab);
        return tab;
      },
    },
    windows: {
      update: async (id, options) => { calls.push(["window.update", id, options]); },
      create: async (options) => {
        calls.push(["window.create", options]);
        tabs.push({ id: 10, windowId: 20, pendingUrl: options.url });
        return { id: 20 };
      },
    },
  };
  return { browser, calls, tabs };
}

test("rapid simultaneous launches share one popup operation and later focus it", async () => {
  const { browser, calls } = fixture();
  const gate = deferred();
  const createWindow = browser.windows.create;
  browser.windows.create = async (options) => { await gate.promise; return createWindow(options); };
  const open = createRoomLauncher(browser);
  const first = open();
  const second = open();
  const third = open();
  assert.equal(first, second);
  assert.equal(first, third);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), Array(3).fill({ kind: "window", windowId: 20 }));
  assert.deepEqual(calls, [
    ["query", {}],
    ["window.create", { url: appUrl, type: "popup", focused: true, width: 1200, height: 820 }],
  ]);
  assert.deepEqual(await open(), { kind: "existing", tabId: 10 });
  assert.deepEqual(calls.slice(2), [
    ["query", {}], ["tab.update", 10, { active: true }], ["window.update", 20, { focused: true }],
  ]);
});

test("focuses an existing live room without navigating, reloading or resetting it", async () => {
  const { browser, calls } = fixture([
    { id: 1, windowId: 2, url: `${appUrl}?showcase=consultation` },
    { id: 0, windowId: 3, url: `${appUrl}?locale=zh-CN#history` },
  ]);
  assert.deepEqual(await createRoomLauncher(browser)(), { kind: "existing", tabId: 0 });
  assert.deepEqual(calls, [
    ["query", {}], ["tab.update", 0, { active: true }], ["window.update", 3, { focused: true }],
  ]);
});

test("requires the exact extension path and excludes every showcase parameter", () => {
  for (const url of [appUrl, `${appUrl}?locale=en`, `${appUrl}#history`]) {
    assert.equal(isLiveRoomUrl(url, appUrl), true, url);
  }
  for (const url of [
    `${appUrl}?showcase=consultation`, `${appUrl}?showcase=`, `${appUrl}?showcase`,
    `${appUrl}?locale=en&%73howcase=consultation`, `${appUrl}?showcase=&showcase=consultation`,
    `${appUrl}.evil`, `${appUrl}/extra`, `${appUrl}%2Fextra`,
    "chrome-extension://other-extension/app/app.html",
    "chrome-extension://test-extension.evil/app/app.html",
    "chrome-extension://test-extension/other/app/app.html",
    "https://test-extension/app/app.html", `https://evil.example/?next=${appUrl}`,
    "not a url", "", null, undefined, {},
  ]) {
    assert.equal(isLiveRoomUrl(url, appUrl), false, String(url));
  }
});

test("demo and deceptive prefix tabs are left untouched when opening a live window", async () => {
  const { browser, calls, tabs } = fixture([
    { id: 1, url: `${appUrl}?showcase=consultation` },
    { id: 2, url: `${appUrl}.impostor` },
    { id: 3, url: `chrome-extension://other/app/app.html` },
  ]);
  const originals = structuredClone(tabs);
  await createRoomLauncher(browser)();
  assert.deepEqual(tabs.slice(0, 3), originals);
  assert.deepEqual(calls.map(([name]) => name), ["query", "window.create"]);
  assert.equal(calls[1][1].url, appUrl);
});

test("pending URL prevents reusing a room navigating to a demo or another page", async () => {
  const { browser, calls } = fixture([
    { id: 1, url: appUrl, pendingUrl: `${appUrl}?showcase=consultation` },
    { id: 2, url: appUrl, pendingUrl: "https://example.invalid/" },
    { id: 3, windowId: 4, url: "about:blank", pendingUrl: appUrl },
  ]);
  await createRoomLauncher(browser)();
  assert.deepEqual(calls, [
    ["query", {}], ["tab.update", 3, { active: true }], ["window.update", 4, { focused: true }],
  ]);
});

test("falls back to one ordinary tab when popup API is unavailable", async (t) => {
  for (const windows of [undefined, {}]) {
    await t.test(windows ? "missing create" : "missing windows", async () => {
      const { browser, calls } = fixture();
      browser.windows = windows;
      const open = createRoomLauncher(browser);
      assert.deepEqual(await Promise.all([open(), open()]), Array(2).fill({ kind: "tab", tabId: 10 }));
      assert.deepEqual(calls, [["query", {}], ["tab.create", { url: appUrl, active: true }]]);
      await open();
      assert.deepEqual(calls.slice(2), [["query", {}], ["tab.update", 10, { active: true }]]);
    });
  }
});

test("a popup error after creation focuses the created room instead of duplicating it", async () => {
  const { browser, calls } = fixture();
  const createWindow = browser.windows.create;
  browser.windows.create = async (options) => {
    await createWindow(options);
    throw new Error("ambiguous API failure");
  };
  const open = createRoomLauncher(browser);
  const results = await Promise.all([open(), open()]);
  assert.deepEqual(results, Array(2).fill({ kind: "existing", tabId: 10 }));
  assert.deepEqual(calls.map(([name]) => name), ["query", "window.create", "query", "tab.update", "window.update"]);
});

test("failed popup attempts never blindly fall back, and a later explicit retry is allowed", async () => {
  const { browser, calls } = fixture();
  const createWindow = browser.windows.create;
  browser.windows.create = async () => { calls.push(["window.error"]); throw new Error("denied"); };
  const open = createRoomLauncher(browser);
  const results = await Promise.allSettled([open(), open()]);
  assert.ok(results.every((result) => result.status === "rejected" && result.reason.message === "denied"));
  assert.deepEqual(calls.map(([name]) => name), ["query", "window.error", "query"]);
  browser.windows.create = createWindow;
  assert.deepEqual(await open(), { kind: "window", windowId: 20 });
});

test("lookup and focus failures do not create replacement rooms", async (t) => {
  for (const failingOperation of ["query", "tab.update", "window.update"]) {
    await t.test(failingOperation, async () => {
      const { browser, calls } = fixture([{ id: 1, windowId: 2, url: appUrl }]);
      const fail = async () => { throw new Error("unavailable"); };
      if (failingOperation === "query") browser.tabs.query = fail;
      if (failingOperation === "tab.update") browser.tabs.update = fail;
      if (failingOperation === "window.update") browser.windows.update = fail;
      await assert.rejects(createRoomLauncher(browser)(), /unavailable/);
      assert.ok(calls.every(([name]) => !name.endsWith(".create")));
    });
  }
});

test("tab fallback errors do not trigger another creation", async () => {
  const { browser, calls } = fixture();
  delete browser.windows;
  browser.tabs.create = async () => { calls.push(["tab.error"]); throw new Error("denied"); };
  const open = createRoomLauncher(browser);
  const results = await Promise.allSettled([open(), open()]);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.deepEqual(calls.map(([name]) => name), ["query", "tab.error"]);
});
