(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const locale = params.get("lang") === "en" ? "en" : "zh-CN";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const showcaseProposal = locale === "en"
    ? "Should ChatChat make the Web Room the primary experience while keeping the browser extension as a zero-config bridge to logged-in AI providers? Examine adoption, privacy, reliability, and implementation evidence before recommending a path."
    : "ChatChat 是否应该把 Web Room 做成主要体验，同时让浏览器扩展退到幕后，作为连接已登录 AI Provider 的零配置桥梁？请从传播、隐私、可靠性和实现证据出发充分协商后再给出建议。";

  const participantRows = [
    {
      seatId: "extension:openai-chatgpt:101",
      participantId: "extension:openai-chatgpt:101",
      tabId: 101,
      url: "https://chatgpt.com/",
      origin: "https://chatgpt.com",
      hostname: "chatgpt.com",
      providerId: "openai-chatgpt",
      providerName: "ChatGPT",
      startUrl: "https://chatgpt.com/",
      createdByChatChat: false,
    },
    {
      seatId: "extension:anthropic-claude:102",
      participantId: "extension:anthropic-claude:102",
      tabId: 102,
      url: "https://claude.ai/",
      origin: "https://claude.ai",
      hostname: "claude.ai",
      providerId: "anthropic-claude",
      providerName: "Claude",
      startUrl: "https://claude.ai/",
      createdByChatChat: false,
    },
    {
      seatId: "extension:google-gemini:103",
      participantId: "extension:google-gemini:103",
      tabId: 103,
      url: "https://gemini.google.com/app",
      origin: "https://gemini.google.com",
      hostname: "gemini.google.com",
      providerId: "google-gemini",
      providerName: "Gemini",
      startUrl: "https://gemini.google.com/app",
      createdByChatChat: false,
    },
  ];

  const recipes = Object.fromEntries(
    participantRows.map((participant) => [
      participant.origin,
      {
        profileId: participant.origin,
        composerSelector: "[data-chatchat-demo=composer]",
        sendSelector: "[data-chatchat-demo=send]",
        responseSelector: "[data-chatchat-demo=response]",
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    ]),
  );

  const connections = Object.fromEntries(
    participantRows.map((participant) => [
      participant.seatId,
      {
        state: "ready",
        automatic: true,
        verifiedAt: "2026-08-13T00:00:01.000Z",
        detail: "Synthetic automatic connection passed.",
      },
    ]),
  );

  const memoryLocal = {
    [RECIPES_KEY]: recipes,
    [LOCALE_KEY]: locale,
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: participantRows,
    [CONNECTIONS_KEY]: connections,
    [PROPOSAL_DRAFT_KEY]: showcaseProposal,
  };

  function area(memory) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
        return Object.fromEntries(list.map((key) => [key, memory[key]]));
      },
      async set(values) { Object.assign(memory, values); },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
      },
    };
  }

  const tabs = new Map(participantRows.map((participant) => [
    participant.tabId,
    {
      id: participant.tabId,
      url: participant.url,
      title: `${participant.providerName} · demo`,
      active: participant.tabId === 101,
      status: "complete",
    },
  ]));

  const onUpdatedListeners = new Set();

  window.chrome = {
    storage: {
      local: area(memoryLocal),
      session: area(memorySession),
    },
    permissions: {
      async contains() { return true; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() { return []; },
    },
    tabs: {
      async query(query) {
        const values = [...tabs.values()];
        if (query?.active) return values.filter((tab) => tab.active);
        return values;
      },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown showcase tab ${tabId}`);
        return { ...tab };
      },
      async update(tabId, changes) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown showcase tab ${tabId}`);
        if (changes.active) {
          for (const item of tabs.values()) item.active = false;
          tab.active = true;
        }
        if (changes.url) {
          tab.url = changes.url;
          tab.status = "complete";
          queueMicrotask(() => {
            for (const listener of onUpdatedListeners) listener(tabId, { status: "complete" }, { ...tab });
          });
        }
        return { ...tab };
      },
      async create({ url, active }) {
        const id = 900 + tabs.size;
        const tab = { id, url, title: "AI · demo", active: Boolean(active), status: "complete" };
        if (active) for (const item of tabs.values()) item.active = false;
        tabs.set(id, tab);
        return { ...tab };
      },
      async remove(tabId) { tabs.delete(tabId); },
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      async sendMessage(tabId, payload) {
        if (!payload?.__chatchat) return { ok: false, error: "Not a ChatChat message" };
        if (payload.type === "PING") return { ok: true, result: { ready: true } };
        if (payload.type === "AWAIT_RECIPE") return { ok: true, result: { ready: true } };
        if (payload.type === "AUTO_SETUP") {
          return {
            ok: true,
            result: {
              recipe: recipes[tabs.get(tabId)?.url?.startsWith("https://claude.ai") ? "https://claude.ai" : tabs.get(tabId)?.url?.startsWith("https://gemini.google.com") ? "https://gemini.google.com" : "https://chatgpt.com"],
              responseText: "CHATCHAT_READY",
              elapsedMs: 280,
              diagnostics: { mode: "synthetic-automatic" },
            },
          };
        }
        if (payload.type === "TEACH") {
          return {
            ok: true,
            result: {
              role: payload.role,
              selector: `[data-chatchat-demo=${payload.role}]`,
              capturedAt: new Date().toISOString(),
            },
          };
        }
        if (payload.type === "RUN_SPEECH") {
          const prompt = String(payload.prompt ?? "");
          if (!/connection handshake|connection test|Protocol handshake only/i.test(prompt)) {
            // Keep real headless Chromium in the working state long enough to prove
            // multiple equal participants are visibly active at the same time.
            await delay(tabId === 101 ? 260 : tabId === 102 ? 380 : 500);
          }
          return { ok: true, result: speechFor(tabId, prompt) };
        }
        return { ok: false, error: `Unsupported showcase bridge command: ${payload.type}` };
      },
    },
  };

  function speechFor(tabId, prompt) {
    if (/connection handshake|connection test/i.test(prompt)) {
      return { responseText: "CHATCHAT_READY", elapsedMs: 320, responseCount: 1 };
    }
    if (/Protocol handshake only/i.test(prompt)) {
      return structured([
        { kind: "argument", stance: "READY", content: "Structured consultation protocol accepted.", confidence: 0.99 },
      ]);
    }

    const phase = match(prompt, /PHASE:\s*(sealed|debate|final)/i)?.toLowerCase() ?? "sealed";
    const round = Number(match(prompt, /ROUND:\s*(\d+)/i) ?? "1");
    const actorId = match(prompt, /YOUR_ACTOR_ID:\s*([^\n]+)/) ?? `actor-${tabId}`;
    const publicEvents = parseJsonField(prompt, "CONSULTATION_EVENTS_JSON") ?? parseJsonField(prompt, "COUNCIL_EVENTS_JSON") ?? [];
    const ownEvents = parseJsonField(prompt, "YOUR_PRIOR_EVENTS_JSON") ?? [];
    const peer = publicEvents.find((event) => event.actorId !== actorId) ?? publicEvents[0];
    const ownArgument = [...ownEvents].reverse().find((event) => event.kind === "argument");
    const claudeArgument = publicEvents.find((event) => /anthropic-claude/.test(event.actorId) && event.kind === "argument");
    const chatgptArgument = publicEvents.find((event) => /openai-chatgpt/.test(event.actorId) && event.kind === "argument");
    const geminiEvidence = [...publicEvents].reverse().find((event) => /google-gemini/.test(event.actorId) && event.kind === "evidence");
    const chatgptChallenge = [...publicEvents].reverse().find((event) => /openai-chatgpt/.test(event.actorId) && event.kind === "challenge");

    if (phase === "sealed") {
      if (tabId === 101) return structured([{ kind: "argument", stance: "Browser Extension", content: "The differentiated capability is controlling the user's already-authenticated AI webpages locally. I would keep the extension as the product center until the browser workflow is extremely reliable.", confidence: 0.78 }]);
      if (tabId === 102) return structured([{ kind: "argument", stance: "Web UI", content: "The public Web Room should be the product people understand and share. A visible browser-extension control surface creates too much setup language for newcomers.", confidence: 0.74 }]);
      return structured([{ kind: "argument", stance: "Web + Extension", content: "Treat the Web Room as the meeting and the extension as infrastructure. That preserves logged-in local provider access without making configuration the user's job.", confidence: 0.82 }]);
    }

    if (phase === "debate" && round === 2) {
      if (tabId === 101 && claudeArgument?.id) {
        return structured([{ kind: "challenge", targetEventId: claudeArgument.id, content: "A Web-first interface is attractive, but how does it reach authenticated ChatGPT, Claude and Gemini sessions without pushing API keys or cross-origin setup back onto the user?" }]);
      }
      if (tabId === 103) {
        return structured([{
          kind: "evidence",
          targetEventId: chatgptArgument?.id,
          claim: "Chrome extensions can request optional host permissions at runtime rather than demanding every provider permission up front.",
          content: "This supports an architecture where the Web Room owns the experience while a narrowly-permissioned extension acts as the authenticated browser bridge.",
          source: "https://developer.chrome.com/docs/extensions/reference/api/permissions",
          sourceDate: "2026-08-14",
          confidence: 0.9,
        }]);
      }
      if (tabId === 102 && chatgptArgument?.id) {
        return structured([{ kind: "challenge", targetEventId: chatgptArgument.id, content: "The extension may be technically unique, but why should its implementation surface define the product surface? Can the bridge remain invisible while the Web Room owns the novice experience?" }]);
      }
      return structured([{ kind: "question", content: "Which product layer should remain visible to the user, and which layer should disappear into infrastructure?" }]);
    }

    if (phase === "debate" && round >= 3) {
      if (tabId === 102 && ownArgument?.id && geminiEvidence?.id) {
        return structured([{
          kind: "revision",
          previousEventId: ownArgument.id,
          stance: "Web + Extension",
          content: "I revise from a pure Web UI position to Web + Extension. The permission model makes the split credible: the Web Room can own the understandable meeting experience while the extension quietly supplies authenticated provider access.",
          confidence: 0.88,
          causedBy: [geminiEvidence.id, ...(chatgptChallenge?.id ? [chatgptChallenge.id] : [])],
        }]);
      }
      if (tabId === 101 && geminiEvidence?.id) {
        return structured([{ kind: "support", targetEventId: geminiEvidence.id, content: "This permission evidence materially strengthens the case for hiding the extension behind the Web Room instead of exposing broad setup during onboarding." }]);
      }
      if (tabId === 103 && geminiEvidence?.id) {
        return structured([{ kind: "defense", targetEventId: geminiEvidence.id, content: "The evidence supports the browser permission mechanism, not adoption by itself. The product conclusion should remain conditional on the bridge staying reliable and genuinely zero-config." }]);
      }
      if (peer?.id) return structured([{ kind: "question", content: "What remaining failure mode would overturn the current architecture?" }]);
    }

    if (tabId === 101) {
      return structured([{
        kind: "final_position",
        stance: "Browser Extension",
        content: "Keep the extension as the technical center because authenticated browser control is the unique capability, but aggressively hide configuration and let the Web Room become the visible shell once bridge reliability is proven.",
        confidence: 0.82,
        caveats: ["The novice-facing UI should still look like one Web consultation room, not an extension settings panel."],
      }]);
    }
    return structured([{
      kind: "final_position",
      stance: "Web + Extension",
      content: tabId === 102
        ? "Make the Web Room the primary product experience and the extension a zero-config authenticated bridge. The meeting metaphor should stay visible; browser plumbing should disappear."
        : "Use a Web-first Consultation Room with a narrowly-permissioned extension bridge. This best separates user experience from provider-specific browser mechanics.",
      confidence: tabId === 103 ? 0.9 : 0.88,
      caveats: tabId === 103 ? ["Bridge reliability and provider-page drift remain engineering risks."] : [],
    }]);
  }

  function structured(contributions) {
    return {
      responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions })}</CHATCHAT_COUNCIL_JSON>`,
      elapsedMs: 420,
      responseCount: 1,
    };
  }

  function match(text, expression) {
    const value = text.match(expression)?.[1];
    return value ? value.trim() : null;
  }

  function parseJsonField(text, label) {
    const prefix = `${label}: `;
    const line = text.split("\n").find((item) => item.startsWith(prefix));
    if (!line) return null;
    try { return JSON.parse(line.slice(prefix.length)); } catch { return null; }
  }

  async function driveShowcase() {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const start = document.querySelector(".start-button");
      if (start instanceof HTMLButtonElement && !start.disabled) {
        start.click();
        document.documentElement.dataset.chatchatConsultationShowcase = "running";
        for (let completionAttempt = 0; completionAttempt < 240; completionAttempt += 1) {
          const liveFloor = document.querySelector(".live-participant-floor");
          const workingSeats = document.querySelectorAll(".live-participant-card.is-working");
          if (liveFloor && workingSeats.length >= 2) {
            document.documentElement.dataset.chatchatLiveFloorShowcase = "complete";
          }
          if (
            document.querySelector(".consultation-event.event-evidence")
            && document.querySelector(".consultation-event.event-support")
            && document.querySelector(".consultation-event.event-revision")
          ) {
            document.documentElement.dataset.chatchatDeliberationStoryShowcase = "complete";
          }
          if (
            document.querySelector(".outcome-card") &&
            document.querySelector(".live-room-card") &&
            document.querySelector(".consultation-theater")
          ) {
            document.documentElement.dataset.chatchatConsultationShowcase = "complete";
            return;
          }
          await delay(50);
        }
        document.documentElement.dataset.chatchatConsultationShowcase = "failed";
        return;
      }
      await delay(50);
    }
    document.documentElement.dataset.chatchatConsultationShowcase = "failed";
  }

  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  window.addEventListener("DOMContentLoaded", () => void driveShowcase(), { once: true });
})();