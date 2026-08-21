(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("memory-proof") !== "coverage") return;

  const tabs = window.chrome?.tabs;
  if (!tabs?.sendMessage) return;
  const originalSendMessage = tabs.sendMessage.bind(tabs);
  const OLD_RISK_MARKER = "MEMORY_PROOF_OLD_ROLLOUT_RISK";
  const ORDINARY_MARKER = "MEMORY_PROOF_R2_ORDINARY";
  const RESOLVER_MARKER = "MEMORY_PROOF_R3_RESOLVER";

  tabs.sendMessage = async (tabId, payload, ...rest) => {
    const response = await originalSendMessage(tabId, payload, ...rest);
    if (!response?.ok || payload?.type !== "RUN_SPEECH" || !response.result?.responseText) return response;

    const prompt = String(payload.prompt ?? "");
    const phase = match(prompt, /PHASE:\s*(sealed|debate|final)/i)?.toLowerCase() ?? "";
    const round = Number(match(prompt, /ROUND:\s*(\d+)/i) ?? "0");
    if (!round) return response;
    const envelope = parseEnvelope(response.result.responseText);
    if (!envelope) return response;

    // R1 adds one ordinary public uncertainty. It is not a DOM test marker and
    // receives no protocol privilege; it must survive later only through the
    // same canonical Open Issues + bounded context selector used in production.
    if (phase === "sealed" && round === 1 && tabId === 101) {
      envelope.contributions.push({
        kind: "uncertain",
        content: `${OLD_RISK_MARKER}: I am not yet convinced the zero-config bridge has a bounded recovery path when provider authentication expires mid-consultation.`,
        confidence: 0.24,
      });
      return withEnvelope(response, envelope);
    }

    // Add six ordinary R2 arguments across the three equal seats. Combined with
    // the normal showcase debate events this pushes public history above the
    // fixed 12-event Provider context before R3 while keeping R2 itself below
    // the hard budget, so old unresolved memory must compete with older recency.
    if (phase === "debate" && round === 2) {
      const stance = tabId === 101 ? "Browser Extension" : tabId === 102 ? "Web UI" : "Web + Extension";
      envelope.contributions.push(
        {
          kind: "argument",
          stance,
          content: `${ORDINARY_MARKER}_${tabId}_A: A bounded browser bridge should expose explicit recovery states rather than adding more permanent setup controls.`,
          confidence: 0.66,
        },
        {
          kind: "argument",
          stance,
          content: `${ORDINARY_MARKER}_${tabId}_B: Provider-specific DOM adaptation belongs in infrastructure and should not become a visible authority hierarchy in the meeting.`,
          confidence: 0.64,
        },
      );
      return withEnvelope(response, envelope);
    }

    // In R3 the old uncertainty should only be visible because context selection
    // restored it. Resolve it with a real structured revision so the canonical
    // Open Issues resolver stops pinning the same source in R4.
    if (phase === "debate" && round === 3 && tabId === 101) {
      const publicEvents = parseJsonField(prompt, "CONSULTATION_EVENTS_JSON") ?? [];
      const ownEvents = parseJsonField(prompt, "YOUR_PRIOR_EVENTS_JSON") ?? [];
      const pinnedSources = parseJsonField(prompt, "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON") ?? [];
      const oldRisk = publicEvents.find((event) =>
        event.kind === "uncertain"
        && event.actorId === "extension:openai-chatgpt:101"
        && String(event.content ?? "").includes(OLD_RISK_MARKER),
      );
      const priorPosition = [...ownEvents].reverse().find((event) =>
        (event.kind === "argument" || event.kind === "revision")
        && typeof event.stance === "string",
      );
      const cause = [...publicEvents].reverse().find((event) =>
        event.round === 2
        && event.id !== oldRisk?.id
        && String(event.content ?? "").includes(ORDINARY_MARKER),
      );
      if (!oldRisk?.id || !priorPosition?.id || !cause?.id || !pinnedSources.includes(oldRisk.id)) return response;
      envelope.contributions.push({
        kind: "revision",
        previousEventId: priorPosition.id,
        stance: "Web + Extension",
        content: `${RESOLVER_MARKER}: I now support the Web Room plus an invisible bridge because the public recovery constraints give the authentication failure mode an explicit bounded path.`,
        confidence: 0.84,
        causedBy: [cause.id],
      });
      return withEnvelope(response, envelope);
    }

    return response;
  };

  function parseEnvelope(raw) {
    const text = String(raw).trim();
    const open = "<CHATCHAT_COUNCIL_JSON>";
    const close = "</CHATCHAT_COUNCIL_JSON>";
    const start = text.indexOf(open);
    const end = text.indexOf(close);
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start + open.length, end).trim());
      return parsed && Array.isArray(parsed.contributions) ? parsed : null;
    } catch {
      return null;
    }
  }

  function withEnvelope(response, envelope) {
    return {
      ...response,
      result: {
        ...response.result,
        responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify(envelope)}</CHATCHAT_COUNCIL_JSON>`,
      },
    };
  }

  function parseJsonField(prompt, field) {
    const prefix = `${field}: `;
    const line = prompt.split("\n").find((item) => item.startsWith(prefix));
    if (!line) return null;
    try { return JSON.parse(line.slice(prefix.length)); } catch { return null; }
  }

  function match(value, pattern) { return value.match(pattern)?.[1] ?? null; }
})();
