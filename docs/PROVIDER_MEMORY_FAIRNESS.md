# Provider Public-Memory Procedural Fairness

Provider Memory Coverage answers **what public events reached a Provider turn**. Procedural Fairness answers a different question:

> **Did equal participants receive a fair, internally consistent public-memory procedure when that bounded deck was constructed and delivered?**

This is not a model-quality score. It does not say an answer is correct, a Provider is trustworthy, a stance deserves more weight, or every relevant fact fit in the Prompt.

## Why this exists

The public Blackboard can contain more events than the fixed Provider context budget. Before this contract existed, the newest published round was protected with a simple tail slice. Because Blackboard publishes same-round participant blocks in configured agent order, an overfull latest round could silently favor participants published later.

For example, with three equal participants each contributing six valid events in R2:

- public R2 = 18 events;
- R3 public Prompt budget = 12 events;
- a plain tail-12 policy can erase the earliest participant's entire six-event block;
- every R3 Provider can still receive the **same biased deck**.

So same-deck equality alone is not sufficient. ChatChat now audits representation fairness as a separate procedural property.

## Seat-balanced latest-round allocation

When the newest round itself exceeds the hard context budget, `selectProviderContextEvents()` no longer uses publication-tail order.

The selector:

1. groups newest-round events by actor;
2. establishes a deterministic actor order using a stable `sessionId + round + actorId` hash, not Provider configuration or Blackboard publication order;
3. gives every latest-round actor one slot before any actor receives a second slot whenever the budget can represent every actor;
4. distributes remaining quotas round-robin in that stable order;
5. within each actor's quota, protects canonical-open same-round source events before ordinary same-round recency;
6. restores selected events to original Blackboard chronology before Prompt construction.

For three actors and twelve slots, an 18-event latest round therefore becomes a 4/4/4 representation instead of a publication-tail 0/6/6 shape.

If the number of latest-round actors itself exceeds the event budget, full representation is mathematically impossible. The selector records `latestRoundOmittedActorIds`; the meeting is then `representation_limited`, never falsely `verified`.

This changes memory coverage only. It gives no actor authority, vote weight, truth status, confidence bonus, or speaking priority.

## Actual public payload equality

Matching event IDs are not enough to prove equal public memory. A wrapper or serialization bug could theoretically preserve the same IDs while changing content, stance, confidence, targets, or other event fields.

The read-only Prompt observer therefore fingerprints the normalized **actual `CONSULTATION_EVENTS_JSON` payload** from each `RUN_SPEECH` Prompt.

The fingerprint is:

- deterministic FNV-1a 64-bit;
- synchronous, so no WebCrypto work is added to the transport path;
- stored as hash + normalized character count only;
- explicitly **not** a cryptographic security hash, authenticity proof, semantic similarity measure, or content identifier.

Equal participants in one round must have one equal actual public-payload fingerprint. Otherwise the fairness state becomes `public_payload_mismatch`.

## Prompt metadata cannot certify itself

`PUBLIC_SNAPSHOT_EVENT_IDS_JSON` is useful protocol metadata, but it is not accepted as proof of the actual public deck.

The Prompt observer independently parses IDs from `CONSULTATION_EVENTS_JSON` and keeps both:

- `declaredSnapshotEventIds` — what Prompt metadata claims;
- `snapshotEventIds` on the transport receipt — the IDs actually recovered from the public JSON payload;
- `snapshotMetadataMatchesPayload` — exact ordered parity between the two.

A mismatch is `prompt_metadata_drift` even if equal peers otherwise received the same actual payload. This separates a self-consistency bug from a Provider-to-Provider fairness bug.

The 23,500-character Prompt guard does not silently truncate the public JSON: current Prompt construction throws explicitly if the complete Prompt exceeds its budget. Metadata parity still remains audited so future wrappers or refactors cannot silently create two different truths.

## Selector actor coverage versus actual Prompt actors

Selector audit knows all actors who spoke in the newest public round, which actors were selected, and which actors could not fit.

Actual Prompt audit knows only what it can legitimately observe: actors represented by latest-round event IDs actually present in the public JSON payload.

These evidence lines remain separate. If selector actor coverage and actual Prompt actor coverage disagree, the state is `selector_actor_drift`.

The Prompt observer never invents omitted actors that are absent from the Prompt.

## Repair is format-only

A structured-output repair should fix machine-readable response format, not change the meeting context.

When a Provider requires a repair attempt, ChatChat compares first-attempt and repair Prompt receipts across:

- actual public event IDs;
- declared snapshot IDs;
- metadata↔payload parity;
- pinned event IDs;
- canonical pin-source IDs;
- protected latest-round IDs;
- represented latest-round actors;
- actual public-payload fingerprint.

Any difference is `repair_context_drift`.

A model is therefore not allowed to receive one public meeting state for its failed answer and another state for the format-repair answer while ChatChat still calls that turn a pure repair.

## Fairness states

The procedural-fairness state is explainable and discrete:

- `verified` — actual Prompt evidence exists for every audited turn; equal peers share one actual public payload; metadata matches actual payload IDs; selector actor coverage matches actual Prompt coverage; repair attempts preserve the deck; latest-round actor representation is complete;
- `representation_limited` — the hard budget could not represent every newest-round actor;
- `public_payload_mismatch` — equal peers received different actual normalized public JSON payloads;
- `prompt_metadata_drift` — a Prompt's declared snapshot IDs disagree with IDs independently parsed from its actual public payload;
- `repair_context_drift` — a format-repair attempt changed the public deck;
- `selector_actor_drift` — selector actor representation disagrees with actual Prompt representation;
- `prompt_unverified` — modern selector evidence exists but actual Prompt proof is incomplete;
- `legacy_unverified` — the archive predates modern explicit fairness provenance and is not upgraded after the fact.

No percentage is calculated from these states.

## Durable history

Fairness uses the same local execution sidecar as Provider Attendance and Provider Memory Coverage. Modern receipts freeze:

- actual public payload IDs;
- independently declared snapshot IDs;
- metadata parity;
- public-payload fingerprint;
- actual represented latest-round actors;
- selector full/selected/omitted actor sets;
- first/repair attempt metadata.

Full Room history replay makes zero Provider calls. The history proof is not complete until the same session is rebuilt as `data-provider-memory-fairness-view="archive"` with the original modern evidence still `verified`.

Side Panel intentionally has no history browser and marks this replay proof `not-applicable` while still proving storage durability.

## Browser stress proof

The dedicated synthetic `fairness-proof=overfull` scenario reproduces the old publication-order hazard using only valid production protocol contributions:

- three equal Provider seats participate;
- the normal R2 contribution plus five additional valid arguments produces exactly six contributions per seat, matching the production `MAX_CONTRIBUTIONS = 6` limit;
- R2 therefore contains 18 public events;
- the R3 Prompt remains capped at exactly 12 public events;
- production selection must preserve all three R2 actors;
- all three R3 seats must have actual Prompt receipts;
- all three must receive one equal normalized public payload fingerprint;
- Prompt metadata IDs must equal actual public-payload IDs;
- selector actor coverage must equal actual Prompt actor coverage;
- repair-context mismatch count must remain zero.

The synthetic fixture cannot write the success marker. Only a guard reading the production Fairness and Provider Memory DOM can complete the proof.

DOM and PNG are captured from the same Chromium DevTools Protocol page, and the screenshots pass the repository's nonblank pixel-diversity gate.

The fixture proves ChatChat's procedure, not third-party model intelligence or factual correctness.

## What fairness still does not solve

Procedural representation does not guarantee that every old unresolved obligation fits while a newest round is overfull. A meeting can be seat-fair and still have a Memory Coverage Gap.

That is a separate scheduling problem: unresolved obligations must not starve indefinitely under sustained public traffic. The next memory-policy layer should preserve newest-round actor representation **and** allocate bounded capacity to canonical-open obligation groups before ordinary extra recency.

Likewise, fairness does not decide when a meeting should close. A later closure policy must use explicit unresolved obligations and a bounded safety budget rather than infer semantic completeness from prose.
