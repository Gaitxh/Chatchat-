import type {
  CouncilAgent,
  CouncilContext,
  CouncilEvent,
} from "../core/types.js";
import { ScriptedCouncilAgent } from "./provider.js";

function firstEventBy(
  events: readonly CouncilEvent[],
  actorId: string,
): CouncilEvent | undefined {
  return events.find((event) => event.actorId === actorId);
}

function latestPositionBy(
  events: readonly CouncilEvent[],
  actorId: string,
): CouncilEvent | undefined {
  return [...events].reverse().find(
    (event) =>
      event.actorId === actorId &&
      (event.kind === "argument" ||
        event.kind === "revision" ||
        event.kind === "final_position"),
  );
}

function requireTarget(
  event: CouncilEvent | undefined,
  fallback: string,
): string {
  return event?.id ?? fallback;
}

const gpt = new ScriptedCouncilAgent(
  {
    id: "mock-gpt",
    name: "GPT",
    provider: "mock",
    role: "Systems Architect",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Tauri",
          content:
            "For a local-first desktop client, I favor Tauri because the product brief values a small local footprint and a thin native shell around a web UI.",
          confidence: 0.74,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const claude = firstEventBy(context.publicEvents, "mock-claude");
      return [
        {
          kind: "challenge",
          targetEventId: requireTarget(claude, "missing-claude-event"),
          content:
            "Electron's maturity is real, but how much should that outweigh footprint and local-first packaging for this particular product?",
        },
      ];
    }

    if (context.phase === "debate") {
      const own = latestPositionBy(context.publicEvents, "mock-gpt");
      return [
        {
          kind: "defense",
          targetEventId: requireTarget(own, "missing-gpt-event"),
          content:
            "I keep Tauri as my preference, but I would require an adapter compatibility test matrix before committing to it.",
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Tauri",
        content:
          "Tauri wins for this brief, provided the project treats browser automation compatibility as an explicit engineering risk.",
        confidence: 0.8,
        caveats: ["Validate provider WebView/browser-control compatibility early."],
      },
    ];
  },
);

const claude = new ScriptedCouncilAgent(
  {
    id: "mock-claude",
    name: "Claude",
    provider: "mock",
    role: "Risk Analyst",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Electron",
          content:
            "I initially prefer Electron: its mature Chromium environment lowers integration risk for controlling multiple model web experiences.",
          confidence: 0.68,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const gptEvent = firstEventBy(context.publicEvents, "mock-gpt");
      return [
        {
          kind: "challenge",
          targetEventId: requireTarget(gptEvent, "missing-gpt-event"),
          content:
            "Tauri is lighter, but the council should prove that provider automation is reliable across OS WebViews before treating footprint as decisive.",
        },
      ];
    }

    if (context.phase === "debate") {
      const original = firstEventBy(context.publicEvents, "mock-claude");
      return [
        {
          kind: "revision",
          previousEventId: requireTarget(original, "missing-claude-event"),
          stance: "Tauri",
          content:
            "I revise toward Tauri because the architecture can isolate provider control behind adapters, reducing the lock-in risk I was assigning to the shell.",
          confidence: 0.72,
          causedBy: context.publicEvents
            .filter(
              (event) =>
                event.kind === "challenge" && event.actorId === "mock-gpt",
            )
            .map((event) => event.id),
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Tauri",
        content:
          "I now support Tauri for v0.1, but only with an early spike that proves login persistence and DOM automation for the first supported providers.",
        confidence: 0.76,
        caveats: ["Keep Electron as a fallback if WebView automation is brittle."],
      },
    ];
  },
);

const gemini = new ScriptedCouncilAgent(
  {
    id: "mock-gemini",
    name: "Gemini",
    provider: "mock",
    role: "Evidence Keeper",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Tauri",
          content:
            "I prefer Tauri, but the decision should be based on the product constraint: ChatChat itself should remain local-first and lightweight.",
          confidence: 0.78,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const gptEvent = firstEventBy(context.publicEvents, "mock-gpt");
      return [
        {
          kind: "evidence",
          targetEventId: requireTarget(gptEvent, "missing-gpt-event"),
          claim: "The King's product brief prioritizes local-first operation.",
          content:
            "This is direct requirement evidence from the session, not an external benchmark. It supports optimizing for a minimal local application layer.",
          source: "session://king-question",
          confidence: 1,
        },
      ];
    }

    if (context.phase === "debate") {
      const claudeRevision = [...context.publicEvents]
        .reverse()
        .find(
          (event) =>
            event.actorId === "mock-claude" && event.kind === "revision",
        );
      if (!claudeRevision) return [];
      return [
        {
          kind: "support",
          targetEventId: claudeRevision.id,
          content:
            "Claude's revised position preserves the real risk instead of pretending it disappeared: validate automation first, then keep the lighter shell.",
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Tauri",
        content:
          "Tauri is the better default for the local-first product vision, with provider compatibility treated as a release gate rather than an assumption.",
        confidence: 0.84,
        caveats: ["Do not claim compatibility before testing each provider adapter."],
      },
    ];
  },
);

const deepseek = new ScriptedCouncilAgent(
  {
    id: "mock-deepseek",
    name: "DeepSeek",
    provider: "mock",
    role: "Devil's Advocate",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "uncertain",
          content:
            "The shell decision is premature without knowing whether browser automation needs a bundled Chromium runtime.",
          confidence: 0.55,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const gptEvent = firstEventBy(context.publicEvents, "mock-gpt");
      const claudeEvent = firstEventBy(context.publicEvents, "mock-claude");
      return [
        {
          kind: "question",
          content:
            "Before converging, which requirement matters more if they conflict: minimal footprint or deterministic browser behavior?",
        },
        {
          kind: "challenge",
          targetEventId: requireTarget(gptEvent, "missing-gpt-event"),
          content:
            "A thin shell is not automatically safer if provider pages behave differently across system WebViews.",
        },
        {
          kind: "support",
          targetEventId: requireTarget(claudeEvent, "missing-claude-event"),
          content:
            "The Electron argument correctly identifies browser determinism as a first-class risk.",
        },
      ];
    }

    if (context.phase === "debate") {
      return [
        {
          kind: "uncertain",
          content:
            "I still do not think the council has enough implementation evidence to eliminate Electron. The correct MVP should preserve an escape hatch.",
          confidence: 0.63,
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Electron",
        content:
          "I keep the minority position: Electron is the safer fallback when deterministic browser behavior matters more than footprint.",
        confidence: 0.67,
        caveats: [
          "This minority position should be revisited after a real Tauri provider-automation spike.",
        ],
      },
    ];
  },
);

export function createMockCouncil(): readonly CouncilAgent[] {
  return [gpt, claude, gemini, deepseek];
}

export function describeContext(context: CouncilContext): string {
  return `${context.participant.name}:${context.phase}:round-${context.round}`;
}
