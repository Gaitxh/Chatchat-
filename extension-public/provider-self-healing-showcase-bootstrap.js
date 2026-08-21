(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "provider-self-healing") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const requestedJourney = params.get("journey");
  const journey = ["static", "resume", "exhausted", "owned"].includes(requestedJourney)
    ? requestedJourney
    : "resume";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const GUIDE_DONE_KEY = "chatchat.first-consultation-guide.done.v1";
  const MAPPING_FAILURE = "ChatChat found the message box but could not confidently identify the send button.";

  document.documentElement.lang = locale;
  document.documentElement.dataset.chatchatSelfHealingNavigationCount = "0";

  const participant = {
    seatId: "extension:anthropic-claude:801",
    participantId: "extension:anthropic-claude:801",
    tabId: 801,
    providerId: "anthropic-claude",
    providerName: "Claude",
    origin: "https://claude.ai",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
    startUrl: "https://claude.ai/",
    createdByChatChat: journey !== "owned",
  };

  const localMemory = {
    [RECIPES_KEY]: {},
    [LOCALE_KEY]: locale,
    [GUIDE_DONE_KEY]: true,
  };
  const sessionMemory = {
    [PARTICIPANTS_KEY]: [participant],
    [CONNECTIONS_KEY]: {
      [participant.seatId]: {
        state: "failed",
        automatic: true,
        detail: MAPPING_FAILURE,
      },
    },
  };

  const storageListeners = new Set();
  const tabUpdatedListeners = new Set();
  const recoveryClaims = new Set();
  const tab = {
    id: 801,
    url: participant.url,
    title: "Claude",
    active: false,
    status: "complete",
  };
  let freshSession = false;
  let navigationCount = 0;

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

  const recipe = {
    profileId: participant.origin,
    composerSelector: "[data-chatchat-demo=composer]",
    sendSelector: "[data-chatchat-demo=send]",
    responseSelector: "[data-chatchat-demo=response]",
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };

  const structuredReady = () => `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({
    contributions: [{
      kind: "argument",
      stance: "READY",
      content: "Structured consultation protocol accepted after bounded automatic recovery.",
      confidence: 0.99,
    }],
  })}</CHATCHAT_COUNCIL_JSON>`;

  window.chrome = {
    storage: {
      local: area(localMemory, "local"),
      session: area(sessionMemory, "session"),
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
      async query() { return [{ ...tab }]; },
      async get(tabId) {
        if (tabId !== tab.id) throw new Error(`Unknown self-healing showcase tab ${tabId}`);
        return { ...tab };
      },
      async update(tabId, changes) {
        if (tabId !== tab.id) throw new Error(`Unknown self-healing showcase tab ${tabId}`);
        if (changes.active) tab.active = true;
        if (changes.url) {
          navigationCount += 1;
          document.documentElement.dataset.chatchatSelfHealingNavigationCount = String(navigationCount);
          tab.url = changes.url;
          tab.status = "complete";
          participant.url = changes.url;
          freshSession = true;
          if (journey !== "static") {
            window.setTimeout(() => {
              for (const listener of tabUpdatedListeners) {
                listener(tab.id, { url: tab.url, status: "complete" }, { ...tab });
              }
            }, 180);
          }
        }
        return { ...tab };
      },
      async create({ url, active }) {
        return { id: 802, url, active: Boolean(active), status: "complete" };
      },
      async remove() {},
      onUpdated: {
        addListener(listener) { tabUpdatedListeners.add(listener); },
        removeListener(listener) { tabUpdatedListeners.delete(listener); },
      },
      async sendMessage(_tabId, payload) {
        if (payload?.type === "PING") {
          return { ok: true, result: { url: tab.url, title: tab.title, readyState: "complete" } };
        }
        if (payload?.type === "AUTO_SETUP") {
          if (!freshSession || journey === "exhausted") {
            return { ok: false, error: MAPPING_FAILURE };
          }
          await delay(240);
          return {
            ok: true,
            result: {
              recipe,
              responseText: "CHATCHAT_READY",
              elapsedMs: 240,
              diagnostics: { mode: "synthetic-self-healed-automatic" },
            },
          };
        }
        if (payload?.type === "RUN_SPEECH") {
          if (!freshSession || journey === "exhausted") {
            return { ok: false, error: "Configured Provider controls are still unavailable." };
          }
          await delay(260);
          const prompt = String(payload.prompt ?? "");
          return {
            ok: true,
            result: {
              responseText: /Protocol handshake only/i.test(prompt) ? structuredReady() : "CHATCHAT_READY",
              elapsedMs: 260,
              responseCount: 1,
            },
          };
        }
        if (payload?.type === "AWAIT_RECIPE") {
          return { ok: true, result: { ready: true, elapsedMs: 20 } };
        }
        return { ok: true, result: {} };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage(message) {
        if (message?.type === "CLAIM_PROVIDER_SELF_HEALING") {
          const key = `${String(message.seatId ?? "")}:${Number(message.tabId)}`;
          const claimed = !recoveryClaims.has(key);
          if (claimed) recoveryClaims.add(key);
          document.documentElement.dataset.chatchatSelfHealingClaimCount = String(recoveryClaims.size);
          return { ok: true, claimed };
        }
        return { ok: false, error: "No other runtime tool call is expected in the self-healing showcase." };
      },
    },
  };

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
