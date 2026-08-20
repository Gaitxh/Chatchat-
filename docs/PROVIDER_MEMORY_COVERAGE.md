# Provider Memory Coverage

Provider Memory Coverage answers one narrow question:

> **Which public Blackboard events did ChatChat actually include in a Provider turn's bounded consultation Prompt?**

It does **not** claim to inspect a model's private attention, hidden chain-of-thought, internal memory, training data, or answer correctness.

## Why this exists

ChatChat keeps the complete public Blackboard locally, but Provider Prompts have a fixed public-context budget. The current selector allows at most 12 public events per turn.

A plain "last 12 events" policy could silently forget an old direct question, challenge, targeted evidence item, or explicit uncertainty even while the meeting still considered that obligation unresolved. ChatChat therefore uses a deterministic bounded selector:

1. protect the newest published round first;
2. use remaining capacity for old canonical-open obligations when they would otherwise age out;
3. fill remaining slots with ordinary recent public events;
4. restore selected events to Blackboard chronology.

A pinned event gains **memory coverage only**. It gains no authority, truth status, vote weight, speaking priority, confidence bonus, or right to force agreement.

## Two independent evidence sources

Modern Provider Memory auditing deliberately keeps two sources separate.

### Selector audit

`ProviderExecutionAuditEvent` records what the deterministic selector chose at turn start:

- exact public snapshot event IDs;
- pinned old event IDs;
- exact canonical source event IDs that caused pinning;
- protected latest-round event IDs.

Modern records carry `contextSelectionObserved: true` and explicit arrays even when no pin exists. This distinguishes a modern zero-pin turn from a legacy archive that predates selection provenance.

### Actual Prompt evidence

`prompt-memory-observer.ts` is a read-only wrapper around the existing browser `RUN_SPEECH` transport. It parses only ChatChat's explicit metadata lines from the exact outgoing Prompt string:

- `SESSION_ID`
- `PHASE`
- `ROUND`
- `YOUR_ACTOR_ID`
- `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`
- `PINNED_OPEN_ISSUE_EVENT_IDS_JSON`
- `PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON`
- `LATEST_ROUND_EVENT_IDS_JSON`

The wrapper does not change the Prompt, response, retry behavior, timeout, or Provider page interaction.

Transport receipts that can be paired with this observation receive `promptMemoryObserved: true`. Provider Memory Coverage prefers this **actual Prompt** evidence when reconstructing what was sent, while retaining selector audit independently so drift can be detected.

## Peer fairness versus selector drift

These are intentionally different failures.

If equal peers in the same round received the same actual public Prompt deck, Provider-to-Provider memory fairness is intact even if ChatChat's selector audit disagrees with that deck.

If equal peers received different actual public Prompt decks for the same public round, that is a `peer_fairness_violation`.

The intentionally participant-specific blocks are outside this equality claim: own prior events, research lane, and direct peer inbox can differ by participant. The shared public Blackboard deck must not.

## Memory Coverage Gaps

A Memory Coverage Gap exists when:

1. a canonical Open Issue existed at the start of a Provider turn; and
2. its source event was absent from that turn's bounded public snapshot.

That is a **coverage fact only**. A gap does not mean:

- the omitted issue was semantically more important than included material;
- the Provider would have changed its answer if it had seen the event;
- the meeting result is automatically wrong;
- another Provider received preferential treatment.

Same-round gap-set equality is tracked separately from the existence of hard-cap gaps.

## Meeting Memory Integrity states

Memory protocol integrity is reported as an explainable state, never a synthetic trust score:

- `verified` — audited public decks are peer-consistent, selector audit does not drift from actual Prompt evidence, and no canonical-open source was observed omitted;
- `bounded_coverage` — peer delivery is consistent, but at least one canonical-open source was absent because the public context is finite;
- `selector_drift` — actual Prompt evidence and deterministic selector audit disagree;
- `peer_fairness_violation` — equal peers in a round did not receive the same public deck or the same coverage-gap set;
- `legacy_unverified` — the historical receipt predates modern explicit memory provenance and is not upgraded after the fact.

Evidence strength is reported separately as `actual_prompt`, `mixed`, `selector_audit`, `legacy_selector_audit`, or `none`.

## Durable history

ChatChat does not create a separate memory-history database. The existing local execution sidecar freezes the raw transport and execution audit records. Provider Memory Coverage is deterministically rebuilt from those frozen records plus the already-frozen Blackboard archive.

Full Room history replay performs zero Provider calls. The browser history proof is not considered complete until both:

- Provider Attendance has rebuilt a peer-visible published turn; and
- Provider Memory has rebuilt the same session as an `archive` view with non-empty actual-Prompt evidence for every modern turn.

Side Panel intentionally has no Consultation History UI, so historical replay is marked `not-applicable` there while storage durability is still checked.

## What is stored

The memory audit stores protocol metadata such as event IDs, phase/round, selection categories, transport state, and timing already associated with the execution receipt.

The Prompt-memory observer does **not** persist the raw `RUN_SPEECH` Prompt text into the execution sidecar. Public event content already belongs to the separately persisted consultation Blackboard archive.

## Result interpretation

Keep these dimensions separate:

- **stance alignment** — how final participant-authored positions are distributed;
- **execution integrity** — whether Provider turns completed response → parse → Blackboard publication;
- **memory protocol integrity** — which bounded public context actually reached those turns and whether peer delivery was fair;
- **answer correctness** — not assigned an invented percentage by ChatChat.

A meeting can be 100% aligned, 100% execution-complete, and memory-protocol verified — and still be factually wrong.

## Browser proof

The dedicated synthetic `memory-proof=coverage` fixture creates real protocol pressure without writing its own success marker:

- an old R1 uncertainty remains open;
- R2 adds enough ordinary public material to push R3 history above 12 events;
- the production selector must restore the old source into an exact 12-event R3 Prompt;
- all equal R3 seats must carry actual Prompt evidence for the same public deck;
- ordinary older history must be visibly omitted;
- an exact R3 revision must structurally resolve the old uncertainty;
- R4 must remain above the hard cap while no longer pinning that same resolved source.

The success marker is produced only by a guard reading the production Provider Memory DOM. DOM and PNG come from the same Chromium DevTools Protocol page, and PNGs pass the repository's nonblank pixel-content gate.

The fixture is explicitly synthetic. It proves ChatChat's memory-selection and provenance mechanism, not live third-party model inference.
