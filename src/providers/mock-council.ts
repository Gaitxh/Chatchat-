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
      (event.kind === "argument" || event.kind === "revision" || event.kind === "final_position"),
  );
}

function directQuestionFor(
  events: readonly CouncilEvent[],
  targetActorId: string,
  fromActorId?: string,
): Extract<CouncilEvent, { kind: "question" }> | undefined {
  return [...events].reverse().find(
    (event): event is Extract<CouncilEvent, { kind: "question" }> =>
      event.kind === "question"
      && event.targetActorId === targetActorId
      && (!fromActorId || event.actorId === fromActorId),
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
    name: "ChatGPT",
    provider: "mock",
    role: "Independent AI Participant",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Web Room + Invisible Bridge",
          content:
            "Make the Full Room the product surface and keep the extension as browser plumbing. Users should submit one proposal, not configure provider tabs and selectors before the meeting can begin.",
          confidence: 0.78,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const claudeInitial = firstEventBy(context.publicEvents, "mock-claude");
      return [
        {
          kind: "challenge",
          targetEventId: requireTarget(claudeInitial, "missing-claude-initial"),
          content:
            "What user-visible capability actually requires extension-first UI instead of a Web Room with an invisible authenticated browser bridge?",
        },
      ];
    }

    if (context.phase === "debate") {
      const question = directQuestionFor(context.publicEvents, "mock-gpt", "mock-claude");
      if (!question) return [];
      return [
        {
          kind: "argument",
          stance: "Web Room + Invisible Bridge",
          content:
            "The Web Room should expose only the recovery moment: open the Provider login, detect readiness, and automatically resume the same consultation. The extension remains transport rather than a settings workflow.",
          confidence: 0.87,
          replyToEventId: question.id,
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Web Room + Invisible Bridge",
        content:
          "Use the Full Room as the primary product surface and the extension as a zero-config browser bridge for authenticated Provider sessions.",
        confidence: 0.88,
        caveats: ["Recovery must remain obvious when a Provider login expires."],
      },
    ];
  },
);

const claude = new ScriptedCouncilAgent(
  {
    id: "mock-claude",
    name: "Claude",
    provider: "mock",
    role: "Independent AI Participant",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Extension-first",
          content:
            "I initially prefer extension-first because browser permissions, authenticated Provider tabs, and recovery all live closest to the extension runtime.",
          confidence: 0.7,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      return [
        {
          kind: "question",
          targetActorId: "mock-gpt",
          content:
            "If the extension becomes invisible infrastructure, how should the Web Room recover when ChatGPT needs the user to sign in again without exposing configuration machinery?",
        },
      ];
    }

    if (context.phase === "debate") {
      const original = firstEventBy(context.publicEvents, "mock-claude");
      const causes = context.publicEvents
        .filter((event) =>
          (event.actorId === "mock-gpt" && event.kind === "challenge")
          || (event.actorId === "mock-gemini" && event.kind === "evidence"),
        )
        .map((event) => event.id);
      return [
        {
          kind: "revision",
          previousEventId: requireTarget(original, "missing-claude-initial"),
          stance: "Web Room + Invisible Bridge",
          content:
            "I revise toward a Web-first room. Runtime host permissions support an invisible bridge, while the user-visible recovery flow can remain in the Full Room instead of becoming extension configuration.",
          confidence: 0.82,
          causedBy: causes,
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Web Room + Invisible Bridge",
        content:
          "I now support Web Room first, provided the bridge can surface login recovery clearly and automatically resume the same consultation afterward.",
        confidence: 0.84,
        caveats: ["Do not hide login failure; hide configuration, not recovery state."],
      },
    ];
  },
);

const gemini = new ScriptedCouncilAgent(
  {
    id: "mock-gemini",
    name: "Gemini",
    provider: "mock",
    role: "Independent AI Participant",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Web Room + Invisible Bridge",
          content:
            "A Web-first room gives the product a clear home, while the browser bridge can retain authenticated Provider access without forcing ordinary users through adapter configuration.",
          confidence: 0.8,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      const claudeInitial = firstEventBy(context.publicEvents, "mock-claude");
      return [
        {
          kind: "evidence",
          targetEventId: requireTarget(claudeInitial, "missing-claude-initial"),
          claim:
            "Chromium extensions can request optional host permissions at runtime instead of requiring permanent access to every supported AI site.",
          content:
            "That permission model supports treating the extension as a narrowly scoped bridge. It does not, by itself, prove which product surface will maximize adoption.",
          source: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
          sourceDate: "2026-07-14",
          confidence: 0.86,
        },
      ];
    }

    if (context.phase === "debate") {
      const gptInitial = firstEventBy(context.publicEvents, "mock-gpt");
      return [
        {
          kind: "support",
          targetEventId: requireTarget(gptInitial, "missing-gpt-initial"),
          content:
            "I support Web Room first for the product surface while keeping the extension responsible for authenticated browser coordination and site permissions.",
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Web Room + Invisible Bridge",
        content:
          "The hybrid architecture is the strongest default: one obvious Web Room for users and a local extension bridge for browser-specific capabilities.",
        confidence: 0.87,
        caveats: ["Keep Provider permissions optional and origin-scoped."],
      },
    ];
  },
);

const deepseek = new ScriptedCouncilAgent(
  {
    id: "mock-deepseek",
    name: "DeepSeek",
    provider: "mock",
    role: "Independent AI Participant",
  },
  (context) => {
    if (context.phase === "sealed") {
      return [
        {
          kind: "argument",
          stance: "Web Room + Bootstrap Fallback",
          content:
            "Web-first is attractive, but the product still needs a believable first-run path when the browser bridge is missing, disabled, or has lost Provider permission.",
          confidence: 0.64,
        },
      ];
    }

    if (context.phase === "debate" && context.round === 2) {
      return [
        {
          kind: "question",
          targetActorId: "mock-gemini",
          content:
            "What is the user-facing bootstrap path when the Web Room opens but the browser bridge is not installed or no longer has the required site permission?",
        },
      ];
    }

    if (context.phase === "debate") {
      return [
        {
          kind: "uncertain",
          content:
            "I still do not see enough public protocol evidence for the no-bridge bootstrap path. Web-first can be right while this recovery edge remains unresolved.",
          confidence: 0.63,
        },
      ];
    }

    return [
      {
        kind: "final_position",
        stance: "Web Room + Bootstrap Fallback",
        content:
          "Keep the Web Room primary, but treat missing-bridge bootstrap and permission recovery as an explicit product requirement rather than assuming the bridge is always ready.",
        confidence: 0.6,
        caveats: ["The no-bridge bootstrap question remains open in this demo."],
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

export function currentMockPosition(events: readonly CouncilEvent[], actorId: string): CouncilEvent | undefined {
  return latestPositionBy(events, actorId);
}
