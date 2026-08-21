(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "invite-ai") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const existingOrigin = "https://gemini.google.com";
  const existingSeatId = "extension:google-gemini:701";
  const storageListeners = new Set();
  const tabUpdatedListeners = new Set();
  const tabs = new Map([
    [701, {
      id: 701,
      url: "https://gemini.google.com/app",
      title: "Gemini",
      active: false,
      status: "complete",
    }],
  ]);
  let nextTabId = 801;
  let createdCount = 0;
  let autoSetupCount = 0;

  document.documentElement.lang = locale;
  document.documentElement.dataset.chatchatInviteAiCreatedCount = "0";
  document.documentElement.dataset.chatchatInviteAiAutoSetupCount = "0";

  const existingParticipant = {
    seatId: existingSeatId,
    participantId: existingSeatId,
    tabId: 701,
    providerId: "google-gemini",
    providerName: "Gemini",
    origin: existingOrigin,
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    startUrl: "https://gemini.google.com/app",
    createdByChatChat: true,
  };

  const memoryLocal = {
    [LOCALE_KEY]: locale,
    [RECIPES_KEY]: {
      [existingOrigin]: recipe(existingOrigin),
    },
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: [existingParticipant],
    [CONNECTIONS_KEY]: {
      [existingSeatId]: {
        state: "ready",
        automatic: true,
        verifiedAt: "2026-08-21T00:00:00.000Z",
        detail: "Automatic page connection and consultation protocol both passed.",
      },
    },
  };

  function area(memory, areaName) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys)
          ? keys
          : typeof keys === "string"
            ? [keys]
            : Object.keys(keys);
        return Object.fromEntries(list.map((key) => [key, memory[key]]));
      },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: memory[key], newValue: value };
          memory[key] = value;
        }
        for (const listener of storageListeners) listener(changes, areaName);
      },
      async remove(keys) {
        const changes = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          changes[key] = { oldValue: memory[key], newValue: undefined };
          delete memory[key];
        }
        for (const listener of storageListeners) listener(changes, areaName);
      },
    };
  }

  function recipe(profileId) {
    return {
      profileId,
      composerSelector: "[data-chatchat-invite-ai=composer]",
      sendSelector: "[data-chatchat-invite-ai=send]",
      responseSelector: "[data-chatchat-invite-ai=response]",
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    };
  }

  function structuredReady() {
    return `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({
      contributions: [{
        kind: "argument",
        stance: "READY",
        content: "Structured consultation protocol accepted for the invited AI seat.",
        confidence: 0.99,
      }],
    })}</CHATCHAT_COUNCIL_JSON>`;
  }

  window.chrome = {
    storage: {
      local: area(memoryLocal, "local"),
      session: area(memorySession, "session"),
      onChanged: {
        addListener(listener) { storageListeners.add(listener); },
        removeListener(listener) { storageListeners.delete(listener); },
      },
    },
    permissions: {
      async contains() { return true; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() {
        return [{ result: { passwordInputs: 0, loginControls: 0, composerCandidates: 1 } }];
      },
    },
    tabs: {
      async query() { return [...tabs.values()].map((tab) => ({ ...tab })); },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown Invite AI showcase tab ${tabId}`);
        return { ...tab };
      },
      async create({ url, active }) {
        const id = nextTabId++;
        const hostname = new URL(url).hostname;
        const tab = {
          id,
          url,
          title: hostname.includes("claude") ? "Claude" : "Invited AI",
          active: Boolean(active),
          status: "complete",
        };
        tabs.set(id, tab);
        createdCount += 1;
        document.documentElement.dataset.chatchatInviteAiCreatedCount = String(createdCount);
        queueMicrotask(() => {
          for (const listener of tabUpdatedListeners) {
            listener(id, { status: "complete", url }, { ...tab });
          }
        });
        return { ...tab };
      },
      async update(tabId, changes) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown Invite AI showcase tab ${tabId}`);
        Object.assign(tab, changes);
        return { ...tab };
      },
      async remove(tabId) { tabs.delete(tabId); },
      onUpdated: {
        addListener(listener) { tabUpdatedListeners.add(listener); },
        removeListener(listener) { tabUpdatedListeners.delete(listener); },
      },
      async sendMessage(tabId, payload) {
        const tab = tabs.get(tabId);
        if (!tab) return { ok: false, error: `Unknown Invite AI showcase tab ${tabId}` };
        if (payload?.type === "PING") {
          return {
            ok: true,
            result: { url: tab.url, title: tab.title, readyState: "complete" },
          };
        }
        if (payload?.type === "AUTO_SETUP") {
          const profileId = String(payload.profileId ?? new URL(tab.url).origin);
          autoSetupCount += 1;
          document.documentElement.dataset.chatchatInviteAiAutoSetupCount = String(autoSetupCount);
          document.documentElement.dataset.chatchatInviteAiAutoSetupProfile = profileId;
          return {
            ok: true,
            result: {
              recipe: recipe(profileId),
              responseText: "CHATCHAT_READY",
              elapsedMs: 180,
              diagnostics: { mode: "invite-ai-automatic" },
            },
          };
        }
        if (payload?.type === "RUN_SPEECH") {
          const prompt = String(payload.prompt ?? "");
          return {
            ok: true,
            result: {
              responseText: /Protocol handshake only/i.test(prompt) ? structuredReady() : "CHATCHAT_READY",
              elapsedMs: 190,
              responseCount: 1,
            },
          };
        }
        if (payload?.type === "AWAIT_RECIPE") {
          return { ok: true, result: { ready: true, elapsedMs: 20 } };
        }
        return { ok: false, error: `Unsupported Invite AI command: ${String(payload?.type)}` };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage(message) {
        if (message?.type === "CLAIM_PROVIDER_SELF_HEALING") return { ok: true, claimed: false };
        return { ok: false, error: "No runtime tool call is expected in the Invite AI showcase." };
      },
    },
  };
})();