(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "zero-config") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const journey = params.get("journey") === "assemble";
  const LOCALE_KEY = "chatchat.locale.v1";
  const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1";
  const DRAFT = locale === "zh-CN"
    ? "这段用户草稿必须在会议室自动组建后原样保留。"
    : "This user draft must survive automatic room assembly unchanged.";
  const memoryLocal = { [LOCALE_KEY]: locale };
  const memorySession = journey ? { [PROPOSAL_DRAFT_KEY]: DRAFT } : {};
  const onUpdatedListeners = new Set();
  const tabs = new Map();

  document.documentElement.lang = locale;
  if (journey) document.documentElement.dataset.chatchatZeroConfigJourneyDraft = DRAFT;

  function area(memory) {
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
        Object.assign(memory, values);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
      },
    };
  }

  function recipe(profileId) {
    return {
      profileId,
      composerSelector: "[data-chatchat-zero-config=composer]",
      sendSelector: "[data-chatchat-zero-config=send]",
      responseSelector: "[data-chatchat-zero-config=response]",
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    };
  }

  function structured(contributions) {
    return `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions })}</CHATCHAT_COUNCIL_JSON>`;
  }

  window.chrome = {
    storage: {
      local: area(memoryLocal),
      session: area(memorySession),
    },
    permissions: {
      async contains() { return false; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() { return []; },
    },
    tabs: {
      async query() { return [...tabs.values()].map((tab) => ({ ...tab })); },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown zero-config showcase tab ${tabId}`);
        return { ...tab };
      },
      async create({ url, active }) {
        const id = 800 + tabs.size;
        const tab = { id, url, title: "AI · zero-config showcase", active: Boolean(active), status: "complete" };
        tabs.set(id, tab);
        queueMicrotask(() => {
          for (const listener of onUpdatedListeners) listener(id, { status: "complete" }, { ...tab });
        });
        return { ...tab };
      },
      async update(tabId, changes) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown zero-config showcase tab ${tabId}`);
        Object.assign(tab, changes);
        return { ...tab };
      },
      async remove(tabId) { tabs.delete(tabId); },
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      async sendMessage(_tabId, payload) {
        if (!journey) return { ok: false, error: "Zero-config static showcase does not run provider turns." };
        if (!payload?.__chatchat) return { ok: false, error: "Not a ChatChat message" };
        if (payload.type === "PING" || payload.type === "AWAIT_RECIPE") {
          return { ok: true, result: { ready: true } };
        }
        if (payload.type === "AUTO_SETUP") {
          return {
            ok: true,
            result: {
              recipe: recipe(String(payload.profileId ?? "zero-config-showcase")),
              responseText: "CHATCHAT_READY",
              elapsedMs: 160,
              diagnostics: { mode: "zero-config-journey" },
            },
          };
        }
        if (payload.type === "RUN_SPEECH") {
          const prompt = String(payload.prompt ?? "");
          if (/Protocol handshake only/i.test(prompt)) {
            return {
              ok: true,
              result: {
                responseText: structured([
                  { kind: "argument", stance: "READY", content: "Structured consultation protocol accepted.", confidence: 0.99 },
                ]),
                elapsedMs: 180,
                responseCount: 1,
              },
            };
          }
          return {
            ok: true,
            result: { responseText: "CHATCHAT_READY", elapsedMs: 140, responseCount: 1 },
          };
        }
        return { ok: false, error: `Unsupported zero-config journey command: ${String(payload.type)}` };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "No source verification in zero-config showcase." }; },
    },
  };
})();