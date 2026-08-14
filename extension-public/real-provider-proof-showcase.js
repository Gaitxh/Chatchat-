(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "real-provider-proof") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const PROOF_KEY = "chatchat.extension.gate-b-proof.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  document.documentElement.lang = locale;

  const participants = [
    {
      seatId: "extension:openai-chatgpt:701",
      participantId: "extension:openai-chatgpt:701",
      tabId: 701,
      providerId: "openai-chatgpt",
      providerName: "ChatGPT",
      origin: "https://chatgpt.com",
      url: "https://chatgpt.com/",
      hostname: "chatgpt.com",
      startUrl: "https://chatgpt.com/",
      createdByChatChat: true,
    },
    {
      seatId: "extension:anthropic-claude:702",
      participantId: "extension:anthropic-claude:702",
      tabId: 702,
      providerId: "anthropic-claude",
      providerName: "Claude",
      origin: "https://claude.ai",
      url: "https://claude.ai/",
      hostname: "claude.ai",
      startUrl: "https://claude.ai/",
      createdByChatChat: true,
    },
  ];

  const recipes = Object.fromEntries(participants.map((participant) => [
    participant.origin,
    {
      profileId: participant.origin,
      composerSelector: "[data-showcase=composer]",
      sendSelector: "[data-showcase=send]",
      responseSelector: "[data-showcase=response]",
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    },
  ]));

  const proof = {
    schemaVersion: 1,
    generatedAt: "2026-08-14T00:10:00.000Z",
    evidenceCapturedAt: "2026-08-14T00:09:30.000Z",
    chatChatVersion: "0.9.0-showcase",
    environment: "Deterministic Chromium UI preview",
    verdict: "demo-only",
    providers: [
      { providerId: "openai-chatgpt", adapterId: "extension.tab", host: "chatgpt.com", recipeReady: true, testPassed: true, councilGatePassed: true, providerHostHealthy: true, seated: true },
      { providerId: "anthropic-claude", adapterId: "extension.tab", host: "claude.ai", recipeReady: true, testPassed: true, councilGatePassed: true, providerHostHealthy: true, seated: true },
    ],
    council: {
      mode: "demo",
      sessionFingerprint: "demo-preview",
      realParticipantCount: 2,
      rounds: 3,
      eventCount: 8,
      realEventCount: 8,
      eventKinds: { argument: 2, challenge: 1, evidence: 1, support: 0, defense: 0, revision: 1, concede: 0, question: 0, uncertain: 0, final_position: 2 },
      finalPositionCount: 2,
      zeroConfidenceFinalCount: 0,
      consensusRatio: 1,
      minorityOpinionPresent: false,
      durationMs: 9200,
    },
    privacy: { questionIncluded: false, eventTextIncluded: false, responseTextIncluded: false, selectorsIncluded: false, profileKeysIncluded: false, credentialsIncluded: false },
  };

  const localMemory = {
    [LOCALE_KEY]: locale,
    [RECIPES_KEY]: recipes,
    "chatchat.first-consultation-guide.done.v1": true,
  };
  const sessionMemory = {
    [PARTICIPANTS_KEY]: participants,
    [CONNECTIONS_KEY]: Object.fromEntries(participants.map((participant) => [participant.seatId, { state: "ready", automatic: true, verifiedAt: "2026-08-14T00:09:00.000Z" }])),
    [PROOF_KEY]: proof,
  };
  const storageListeners = new Set();
  const updatedListeners = new Set();

  function area(memory, areaName) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
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
        for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
      },
    };
  }

  const tabs = new Map(participants.map((participant) => [participant.tabId, { id: participant.tabId, url: participant.url, title: `${participant.providerName} · proof preview`, status: "complete", active: false }]));

  window.chrome = {
    storage: {
      local: area(localMemory, "local"),
      session: area(sessionMemory, "session"),
      onChanged: { addListener(listener) { storageListeners.add(listener); }, removeListener(listener) { storageListeners.delete(listener); } },
    },
    permissions: { async contains() { return true; }, async request() { return true; } },
    scripting: { async executeScript() { return [{ result: { passwordInputs: 0, loginControls: 0, composerCandidates: 1 } }]; } },
    tabs: {
      async query() { return [...tabs.values()].map((tab) => ({ ...tab })); },
      async get(tabId) { const tab = tabs.get(tabId); if (!tab) throw new Error(`Unknown proof showcase tab ${tabId}`); return { ...tab }; },
      async update(tabId, changes) { const tab = tabs.get(tabId); if (!tab) throw new Error(`Unknown proof showcase tab ${tabId}`); Object.assign(tab, changes); return { ...tab }; },
      async create({ url, active }) { return { id: 799, url, active: Boolean(active), status: "complete" }; },
      async remove() {},
      async sendMessage(_tabId, payload) {
        if (payload?.type === "PING") return { ok: true, result: { ready: true } };
        return { ok: true, result: {} };
      },
      onUpdated: { addListener(listener) { updatedListeners.add(listener); }, removeListener(listener) { updatedListeners.delete(listener); } },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "No runtime tool call is expected in Real Provider Proof preview." }; },
    },
  };
})();
