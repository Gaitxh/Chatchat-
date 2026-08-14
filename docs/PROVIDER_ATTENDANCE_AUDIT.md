# Provider Attendance & Execution Audit

ChatChat's Provider Attendance & Execution Audit answers a narrower and more useful question than “did the UI show this AI as present?”:

> For this participant and this round, can ChatChat trace the path from the exact public meeting snapshot sent to the selected Provider page through structured parsing to the exact events that reached the public Blackboard?

It is an execution/provenance audit. It does **not** expose or infer hidden model chain-of-thought.

## Verified turn contract

A turn is marked **VERIFIED** only when all of the following are observable:

1. ChatChat started the participant turn for a concrete `sessionId`, phase and round.
2. The exact provider prompt identifies that session and carries `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`.
3. `RUN_SPEECH` was sent to the selected browser tab.
4. The page returned a response.
5. The response passed the structured consultation parser, either on the first attempt or after the single allowed repair attempt.
6. One or more events from that participant/round were actually published to the public Blackboard.

A page response without parse/publication stays **RESPONSE CAPTURED** and is not counted as verified attendance.

## Audit states

- `TURN STARTED` — the orchestrator asked this seat to respond.
- `PROMPT SENT` — the real browser bridge sent the consultation prompt to the selected tab.
- `RESPONSE CAPTURED` — the page returned text, but that alone is not a meeting contribution.
- `PARSED · WAITING` — structured parsing succeeded but publication has not yet been observed.
- `VERIFIED` — response parsed and one or more exact event IDs reached the Blackboard.
- `VERIFIED · REPAIRED` — first response was rejected, the same Provider received one repair prompt, the repaired response parsed, and resulting event IDs reached the Blackboard.
- `FALLBACK` — transport/page/parser failure caused ChatChat's explicit zero-confidence fallback contribution. This never counts as verified Provider reasoning.
- `FAILED` — the chain failed before a valid published Provider contribution was established.

## What the prompt proves

Every consultation prompt now includes:

```text
SESSION_ID: session_...
PHASE: debate
ROUND: 3
YOUR_ACTOR_ID: extension:anthropic-claude:...
PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["event_...", "event_...", ...]
```

`PUBLIC_SNAPSHOT_EVENT_IDS_JSON` is derived from the same compact public event slice serialized into `CONSULTATION_EVENTS_JSON`. The execution UI reads these fields from the actual string passed to `RUN_SPEECH`, not from a post-hoc reconstruction.

This lets the user audit a claim such as:

> Claude's R3 prompt contained the R1 positions plus the R2 challenge/evidence events that were public at that point.

It does not prove how Claude internally reasoned about those events. It proves that those events were in the prompt delivered to the page.

## Repair provenance

If the first Provider response cannot be parsed, ChatChat records `repair_requested` and sends the same Provider exactly one repair prompt. A turn is shown as **VERIFIED · REPAIRED** only if the second response parses and its resulting events are observed on the Blackboard.

The repair path is therefore visible rather than silently laundering an invalid first response into an apparently clean meeting turn.

## Fallback provenance

`BrowserConsultationAgent` remains fail-soft: a transport/page/parser failure creates an explicit `uncertain` contribution (or a zero-confidence final `Uncertain` position) so one broken Provider does not crash the whole meeting.

The audit deliberately labels that turn **FALLBACK** even if the fallback event itself reaches the Blackboard. A ChatChat-generated fallback is not evidence that the Provider successfully reasoned about the round.

## Synthetic showcase boundary

`?showcase=consultation` still uses deterministic synthetic Provider speech for reproducible Chromium UI/protocol proof. The Attendance Audit is rendered there so the complete audit UI can be tested, but the page remains labeled `DEMO · SYNTHETIC` and explicitly says that third-party models did not attend.

The live-deliberation Chromium guard now requires the showcase to exhibit at least one visible turn with:

- `published` or `repaired` state;
- a non-zero public snapshot event count; and
- a non-zero Blackboard publication count.

That proves the audit mechanism and UI work end-to-end in production Chromium. It does **not** convert synthetic fixture speech into real Provider inference.

## Data retention

The current Attendance Audit is a live, in-memory execution view. Meeting history already persists the structured public events separately. Persisting the execution audit itself as a durable session receipt is a natural next step, but until that storage contract is added ChatChat should not imply that transport/parse audit records survive browser restart.
