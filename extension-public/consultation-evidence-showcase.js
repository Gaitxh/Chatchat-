(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || !window.chrome?.tabs?.sendMessage) return;

  const VERIFICATIONS_KEY = "chatchat.evidence.verifications.v1";
  const storageListeners = new Set();
  const storage = window.chrome.storage;

  if (!storage.onChanged) {
    storage.onChanged = {
      addListener(listener) { storageListeners.add(listener); },
      removeListener(listener) { storageListeners.delete(listener); },
    };
    const originalSet = storage.session.set.bind(storage.session);
    storage.session.set = (values) => {
      const promise = originalSet(values);
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
      queueMicrotask(() => {
        for (const listener of storageListeners) listener(changes, "session");
      });
      return promise;
    };
  }

  const originalSend = window.chrome.tabs.sendMessage.bind(window.chrome.tabs);
  window.chrome.tabs.sendMessage = async (tabId, payload) => {
    if (!payload?.__chatchat || payload.type !== "RUN_SPEECH") return originalSend(tabId, payload);
    const prompt = String(payload.prompt ?? "");
    if (/connection handshake|connection test|Protocol handshake only/i.test(prompt)) {
      return originalSend(tabId, payload);
    }

    const phase = match(prompt, /PHASE:\s*(sealed|debate|final)/i)?.toLowerCase();
    const round = Number(match(prompt, /ROUND:\s*(\d+)/) ?? 0);
    if (phase !== "debate") return originalSend(tabId, payload);

    const publicEvents = parseJsonField(prompt, "CONSULTATION_EVENTS_JSON") ?? [];
    const ownEvents = parseJsonField(prompt, "YOUR_PRIOR_EVENTS_JSON") ?? [];
    const toolFacts = parseJsonField(prompt, "TOOL_FACTS_JSON") ?? [];
    const claudeInitial = publicEvents.find((event) => /anthropic-claude/.test(event.actorId) && event.kind === "argument");
    const gptInitial = publicEvents.find((event) => /openai-chatgpt/.test(event.actorId) && event.kind === "argument");
    const geminiEvidence = publicEvents.find((event) => /google-gemini/.test(event.actorId) && event.kind === "evidence");

    if (round === 2 && tabId === 101 && claudeInitial?.id) {
      return ok([{ kind: "challenge", targetEventId: claudeInitial.id, content: "What evidence justifies maintaining two product cores instead of making the extension the authenticated workflow and the web app the demonstration surface?" }]);
    }
    if (round === 2 && tabId === 102) {
      return ok([{ kind: "question", targetActorId: gptInitial?.actorId, content: "Which browser capability is actually unique enough to justify extension-first rather than merely convenient?" }]);
    }
    if (round === 2 && tabId === 103 && claudeInitial?.id) {
      return ok([{
        kind: "evidence",
        targetEventId: claudeInitial.id,
        claim: "A Chromium extension can request optional site access at runtime instead of requiring permanent access to every AI website.",
        content: "Chrome extension documentation describes optional host permissions and runtime permission requests, supporting an extension architecture that asks only for the AI origins a user chooses.",
        source: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
        sourceDate: "2026-07-14",
        confidence: 0.86,
      }]);
    }

    if (round >= 3 && tabId === 101 && geminiEvidence?.id) {
      return ok([{ kind: "challenge", targetEventId: geminiEvidence.id, content: "The source can support the permission mechanism, but it still does not by itself prove that extension-first maximizes adoption. We should keep that product claim narrower." }]);
    }
    if (round >= 3 && tabId === 102 && geminiEvidence?.id) {
      const previous = [...ownEvents].reverse().find((event) => event.kind === "argument" || event.kind === "revision");
      if (previous?.id) {
        const observation = toolFacts.find((fact) => fact.relatedEventId === geminiEvidence.id);
        return ok([{
          kind: "revision",
          previousEventId: previous.id,
          stance: "Browser Extension",
          content: observation
            ? "I revise to Browser Extension first. ChatChat's tool observation confirms the cited public page is reachable and exposes relevant permission metadata; that does not prove the adoption claim, but it removes one implementation uncertainty while the authenticated multi-tab workflow remains the differentiator."
            : "I revise to Browser Extension first because the cited permission mechanism directly reduces one implementation concern, while the authenticated multi-tab workflow remains the differentiator.",
          confidence: 0.84,
          causedBy: [geminiEvidence.id],
        }]);
      }
    }
    if (round >= 3 && tabId === 103 && gptInitial?.id) {
      return ok([{ kind: "support", targetEventId: gptInitial.id, content: "I support extension-first for the authenticated coordination layer, while keeping a lightweight public web room for sharing and onboarding." }]);
    }

    return originalSend(tabId, payload);
  };

  window.addEventListener("chatchat:consultation-live", (event) => {
    const events = event?.detail?.events;
    if (!Array.isArray(events)) return;
    const evidence = events.find((item) => item.kind === "evidence" && /developer\.chrome\.com/.test(item.source ?? ""));
    if (!evidence?.id) return;
    void storage.session.get(VERIFICATIONS_KEY).then((stored) => {
      if (stored?.[VERIFICATIONS_KEY]?.[evidence.id]) return;
      const next = {
        ...(stored?.[VERIFICATIONS_KEY] ?? {}),
        [evidence.id]: {
          state: "reachable",
          observedAt: "2026-08-14T07:30:00+08:00",
          requestedUrl: evidence.source,
          finalUrl: evidence.source,
          statusCode: 200,
          contentType: "text/html; charset=utf-8",
          title: "Declare permissions",
          description: "Chrome Extensions documentation describing required and optional permissions, including host access requested at runtime.",
          excerpt: "Optional permissions can be requested at runtime so an extension can explain why access is needed in context.",
          pageDate: "2026-07-14",
          pageDateKind: "modified",
          bodyHash: "sha256:showcase-permissions-9a4c2e17",
          textCharacters: 6842,
          bytesRead: 14582,
          truncated: false,
        },
      };
      void storage.session.set({ [VERIFICATIONS_KEY]: next });
    });
  });

  function ok(contributions) {
    return {
      ok: true,
      result: {
        responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions })}</CHATCHAT_COUNCIL_JSON>`,
        elapsedMs: 460,
        responseCount: 1,
      },
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
})();
