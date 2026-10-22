export const OPEN_MEETING_ROOM = "OPEN_MEETING_ROOM";
const WELCOME_SHOWN_KEY = "chatchat.welcome.shown.v1";

export function isLiveRoomUrl(rawUrl, appUrl) {
  if (typeof rawUrl !== "string") return false;
  try {
    const url = new URL(rawUrl);
    const expected = new URL(appUrl);
    // Extension URL origins can be opaque in URL implementations. Compare the
    // scheme, authority and complete path, never a string prefix or origin alone.
    return url.protocol === expected.protocol
      && url.host === expected.host
      && url.pathname === expected.pathname
      && !url.username && !url.password
      && !url.searchParams.has("showcase");
  } catch {
    return false;
  }
}

export function createRoomLauncher(browser, {
  appUrl = browser.runtime.getURL("app/app.html"),
  createTab = () => browser.tabs.create({ url: appUrl, active: true }),
} = {}) {
  let pendingLaunch;

  async function findRoom() {
    const tabs = await browser.tabs.query({});
    // A pending navigation takes precedence over the old document's URL.
    return tabs.find((tab) => Number.isInteger(tab.id)
      && isLiveRoomUrl(tab.pendingUrl || tab.url, appUrl));
  }

  async function focusRoom(tab) {
    // Do not navigate, reload or otherwise reset an existing meeting.
    await browser.tabs.update(tab.id, { active: true });
    if (Number.isInteger(tab.windowId) && typeof browser.windows?.update === "function") {
      await browser.windows.update(tab.windowId, { focused: true });
    }
    return { kind: "existing", tabId: tab.id };
  }

  async function launch() {
    const existing = await findRoom();
    if (existing) return focusRoom(existing);

    if (typeof browser.windows?.create !== "function") {
      const tab = await createTab();
      return { kind: "tab", tabId: tab?.id };
    }

    try {
      // Uses this browser profile; provider sites stay in their ordinary tabs.
      const window = await browser.windows.create({
        url: appUrl,
        type: "popup",
        focused: true,
        width: 1200,
        height: 820,
      });
      return { kind: "window", windowId: window?.id };
    } catch (error) {
      // Creation may have succeeded before an API error. Reconcile, but never
      // blindly create a second surface after an attempted popup creation.
      const opened = await findRoom();
      if (opened) return focusRoom(opened);
      throw error;
    }
  }

  return function openRoom() {
    if (!pendingLaunch) {
      pendingLaunch = launch().finally(() => { pendingLaunch = undefined; });
    }
    return pendingLaunch;
  };
}

export function createWelcomeInstaller(browser) {
  let pendingWelcome;
  return function showWelcomeOnInstall(details) {
    if (details?.reason !== "install") return Promise.resolve(false);
    if (!pendingWelcome) {
      pendingWelcome = (async () => {
        const stored = await browser.storage.local.get(WELCOME_SHOWN_KEY);
        if (stored?.[WELCOME_SHOWN_KEY]) return false;
        // Record before opening for at-most-once behavior across worker restarts.
        // If opening fails, Help remains available in extension details.
        await browser.storage.local.set({ [WELCOME_SHOWN_KEY]: true });
        await browser.tabs.create({ url: browser.runtime.getURL("welcome.html"), active: true });
        return true;
      })().finally(() => { pendingWelcome = undefined; });
    }
    return pendingWelcome;
  };
}

export function createRoomMessageListener(browser, openRoom) {
  return function onRoomMessage(message, sender, sendResponse) {
    if (message?.type !== OPEN_MEETING_ROOM) return undefined;

    const trusted = sender?.id === browser.runtime.id
      && sender?.url === browser.runtime.getURL("welcome.html")
      && (sender.frameId === undefined || sender.frameId === 0)
      && (sender.documentLifecycle === undefined || sender.documentLifecycle === "active");
    const valid = message !== null && typeof message === "object"
      && !Array.isArray(message) && Object.keys(message).length === 1;
    if (!trusted || !valid) {
      sendResponse({ ok: false, error: "Meeting room request denied." });
      return false;
    }

    Promise.resolve().then(openRoom)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, error: "The meeting room could not be opened." }));
    return true;
  };
}
