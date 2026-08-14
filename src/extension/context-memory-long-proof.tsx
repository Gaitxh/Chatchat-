import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilContext, CouncilEvent, CouncilParticipant } from "../core/types.js";
import { parseProviderConsultationTurn } from "../provider-sdk/consultation-agent.js";
import {
  buildProviderConsultationPrompt,
  parseProviderConsultationResponse,
} from "../provider-sdk/consultation-protocol.js";
import { selectProviderContextEvents } from "../provider-sdk/context-selection.js";
import "./context-memory-long-proof.css";

const ACTIVE = new URLSearchParams(location.search).get("memory-proof") === "long";
const SESSION_ID = "synthetic-context-memory-long-proof";

interface ProofResult {
  inputCount: number;
  snapshotIds: string[];
  pinnedIds: string[];
  latestIds: string[];
  oldQuestionId: string;
  invisibleId: string;
  invisibleTargetRejected: boolean;
  pinnedReplyAccepted: boolean;
  chronological: boolean;
  hardBudgetPreserved: boolean;
}

function ContextMemoryLongProof() {
  const proof = useMemo(() => buildProof(), []);
  const complete = proof.hardBudgetPreserved
    && proof.pinnedIds.includes(proof.oldQuestionId)
    && proof.latestIds.length > 0
    && proof.latestIds.every((id) => proof.snapshotIds.includes(id))
    && proof.invisibleTargetRejected
    && proof.pinnedReplyAccepted
    && proof.chronological;

  if (complete) {
    document.documentElement.dataset.chatchatContextMemoryLongProof = "complete";
  } else {
    document.documentElement.dataset.chatchatContextMemoryLongProof = "failed";
  }

  return (
    <section
      className="context-memory-long-proof"
      data-context-memory-long-proof={complete ? "complete" : "failed"}
      data-context-memory-proof-input={proof.inputCount}
      data-context-memory-proof-snapshot={proof.snapshotIds.length}
      data-context-memory-proof-pinned={proof.pinnedIds.length}
      data-context-memory-proof-latest={proof.latestIds.length}
      data-context-memory-proof-invisible-rejected={String(proof.invisibleTargetRejected)}
      data-context-memory-proof-pinned-reply={String(proof.pinnedReplyAccepted)}
    >
      <header>
        <span>SYNTHETIC PROTOCOL PROOF · LONG CONTEXT</span>
        <strong>Context memory anti-forgetting proof</strong>
        <p>
          This is a deterministic production-module proof, not live Provider inference. It forces a Blackboard longer than the 12-event Provider window so the real selector, prompt builder and parser must demonstrate bounded conflict pinning.
        </p>
      </header>

      <div className="context-memory-long-proof__chain">
        <Metric value={proof.inputCount} label="public Blackboard events" />
        <b>→</b>
        <Metric value={proof.snapshotIds.length} label="visible snapshot" />
        <b>+</b>
        <Metric value={proof.pinnedIds.length} label="old unresolved pinned" />
        <b>+</b>
        <Metric value={proof.latestIds.length} label="latest-round protected" />
      </div>

      <div className="context-memory-long-proof__checks">
        <span className={proof.hardBudgetPreserved ? "ok" : "bad"}>✓ hard budget = 12</span>
        <span className={proof.pinnedIds.includes(proof.oldQuestionId) ? "ok" : "bad"}>✓ old direct question restored</span>
        <span className={proof.invisibleTargetRejected ? "ok" : "bad"}>✓ invisible old ID rejected</span>
        <span className={proof.pinnedReplyAccepted ? "ok" : "bad"}>✓ pinned old question accepts exact reply</span>
        <span className={proof.chronological ? "ok" : "bad"}>✓ Blackboard chronology preserved</span>
      </div>

      <div className="context-memory-long-proof__ids">
        <div>
          <span>PINNED OPEN ISSUE EVENT IDS</span>
          {proof.pinnedIds.map((id) => <code key={id}>{id}</code>)}
        </div>
        <div>
          <span>PROTECTED LATEST ROUND IDS</span>
          {proof.latestIds.map((id) => <code key={id}>{id}</code>)}
        </div>
      </div>

      <footer>
        Pinning changes memory coverage only. It does not add truth, authority, vote weight, or hidden reasoning.
      </footer>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><small>{label}</small></div>;
}

function buildProof(): ProofResult {
  const participants: CouncilParticipant[] = [
    { id: "gpt-proof", name: "ChatGPT", provider: "synthetic-proof" },
    { id: "claude-proof", name: "Claude", provider: "synthetic-proof" },
    { id: "gemini-proof", name: "Gemini", provider: "synthetic-proof" },
  ];
  const events = proofEvents();
  const selection = selectProviderContextEvents(events);
  const snapshotIds = selection.events.map((event) => event.id);
  const invisibleId = events.map((event) => event.id).find((id) => !snapshotIds.includes(id)) ?? "";

  const baseContext: CouncilContext = {
    sessionId: SESSION_ID,
    question: "Synthetic proof: can ChatChat remember an old unresolved direct question without growing the Provider context?",
    mode: "balanced",
    phase: "debate",
    round: 8,
    participant: participants[0]!,
    publicEvents: events,
    ownEvents: events.filter((event) => event.actorId === participants[0]!.id),
  };

  // Invoke the real prompt builder too: this ensures the production prompt can
  // serialize the exact selection within its normal safety budget.
  const prompt = buildProviderConsultationPrompt(baseContext);
  const promptSnapshot = parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON") as string[];
  const promptPinned = parseJsonLine(prompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON") as string[];
  const promptLatest = parseJsonLine(prompt, "LATEST_ROUND_EVENT_IDS_JSON") as string[];
  if (JSON.stringify(promptSnapshot) !== JSON.stringify(snapshotIds)) throw new Error("Prompt snapshot diverged from selector output.");
  if (JSON.stringify(promptPinned) !== JSON.stringify(selection.pinnedEventIds)) throw new Error("Prompt pinned ids diverged from selector output.");
  if (JSON.stringify(promptLatest) !== JSON.stringify(selection.latestRoundEventIds)) throw new Error("Prompt latest ids diverged from selector output.");

  let invisibleTargetRejected = false;
  if (invisibleId) {
    try {
      parseProviderConsultationResponse(
        `<CHATCHAT_COUNCIL_JSON>{"contributions":[{"kind":"challenge","targetEventId":"${invisibleId}","content":"Guessed invisible id."}]}</CHATCHAT_COUNCIL_JSON>`,
        baseContext,
      );
    } catch {
      invisibleTargetRejected = true;
    }
  }

  const claudeContext: CouncilContext = {
    ...baseContext,
    participant: participants[1]!,
    ownEvents: events.filter((event) => event.actorId === participants[1]!.id),
  };
  let pinnedReplyAccepted = false;
  try {
    const reply = parseProviderConsultationTurn(
      '<CHATCHAT_COUNCIL_JSON>{"contributions":[{"kind":"argument","stance":"Addressed","content":"I explicitly answer the old pinned question.","confidence":0.8,"replyToEventId":"proof-old-question"}]}</CHATCHAT_COUNCIL_JSON>',
      claudeContext,
    );
    pinnedReplyAccepted = reply[0]?.kind === "argument" && reply[0].replyToEventId === "proof-old-question";
  } catch {
    pinnedReplyAccepted = false;
  }

  return {
    inputCount: events.length,
    snapshotIds,
    pinnedIds: selection.pinnedEventIds,
    latestIds: selection.latestRoundEventIds,
    oldQuestionId: "proof-old-question",
    invisibleId,
    invisibleTargetRejected,
    pinnedReplyAccepted,
    chronological: isChronological(selection.events, events),
    hardBudgetPreserved: selection.events.length === 12,
  };
}

function proofEvents(): CouncilEvent[] {
  const events: CouncilEvent[] = [
    proofEvent({ id: "proof-old-claim", round: 1, actorId: "gpt-proof", kind: "argument", stance: "A", content: "An old position.", confidence: .7 }),
    proofEvent({ id: "proof-old-question", round: 2, actorId: "gpt-proof", kind: "question", targetActorId: "claude-proof", content: "An old direct question that remains unanswered." }),
    proofEvent({ id: "proof-old-challenge", round: 2, actorId: "claude-proof", kind: "challenge", targetEventId: "proof-old-claim", content: "An old challenge that remains unanswered." }),
  ];
  for (let index = 0; index < 20; index += 1) {
    events.push(proofEvent({
      id: `proof-recent-${String(index).padStart(2, "0")}`,
      round: 3 + Math.floor(index / 4),
      actorId: index % 2 ? "gpt-proof" : "gemini-proof",
      kind: "argument",
      stance: index % 2 ? "Recent A" : "Recent B",
      content: `Recent synthetic proof event ${index}.`,
      confidence: .6,
    }));
  }
  return events;
}

let proofTick = 0;
function proofEvent<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: SESSION_ID,
    createdAt: `2026-08-15T02:30:${String(proofTick++).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}

function isChronological(selected: readonly CouncilEvent[], full: readonly CouncilEvent[]): boolean {
  const indexes = selected.map((event) => full.findIndex((candidate) => candidate.id === event.id));
  return indexes.every((value, index) => index === 0 || indexes[index - 1]! < value);
}

function parseJsonLine(prompt: string, label: string): unknown {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`))?.[1];
  if (!raw) throw new Error(`Missing ${label}`);
  return JSON.parse(raw);
}

const root = document.getElementById("context-memory-long-proof-root");
if (root && ACTIVE) {
  createRoot(root).render(<StrictMode><ContextMemoryLongProof /></StrictMode>);
}
