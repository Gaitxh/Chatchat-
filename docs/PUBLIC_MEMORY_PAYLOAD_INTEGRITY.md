# Serialized public-memory payload integrity

Provider Memory Coverage proves which public event IDs were selected for a turn. That is necessary but not sufficient to prove that equal participants received the same public meeting content.

Two Prompts can theoretically name the same event IDs while serializing different `CONSULTATION_EVENTS_JSON` content because of a future compaction, mutation, wrapper, or prompt-construction bug. ChatChat therefore treats **deck identity** and **exact serialized payload equality** as separate auditable facts.

## Actual Prompt observation

The read-only Prompt memory observer reads the exact `CONSULTATION_EVENTS_JSON` text that actually passed through `RUN_SPEECH`. It parses that raw JSON only to validate its structure and count public events; the `eq64:` equality aid is a **64-bit FNV-1a value over the UTF-8 bytes of the raw serialized JSON text after the protocol label**, before any parse/re-stringify normalization.

That distinction is intentional. Two JSON strings can parse to the same JavaScript value while differing in whitespace, escaping, number formatting, or another serialization detail. If the UTF-8 text placed in two Provider Prompts differs, ChatChat's equality receipt should be allowed to say it differs rather than normalizing the discrepancy away.

`eq64` is intentionally **not** a cryptographic primitive. Moving from 32 bits to 64 bits reduces accidental equality collisions for this engineering receipt, but it does not turn the value into a signature, MAC, authenticity guarantee, tamper-proof receipt, evidence-quality metric, or answer-correctness score. It exists only to make equality/disagreement inside one bounded consultation mechanically visible without storing another full copy of the public payload in every transport receipt. A complete modern payload receipt also carries the exact public-event count; a fingerprint without its count remains incomplete evidence.

Old receipts that predate these fields remain `payload_unverified`; ChatChat never reconstructs a modern fingerprint from archived Blackboard events and pretends it was observed at send time.

## Missing evidence stays in the denominator

The payload-integrity denominator comes from **formal Provider transport turns**, not only from turns where the Prompt-memory observer succeeded.

If ChatGPT and Claude have complete payload receipts but Gemini has a real R3 transport record with no Prompt-memory receipt, the round is **not** “2/2 verified.” It is 2/3 observed payload evidence with one unverified seat, so same-round equality remains unknown and the aggregate state is `payload_unverified`.

This matters for both modern failures and older archives. A missing observer flag, missing fingerprint, or missing exact event count cannot make a Provider disappear from the accounting. Unknown evidence remains visible as unknown evidence.

## Equal-peer payload parity

For one immutable public round, equal Provider turns should have:

- the same public event-ID deck;
- the same exact serialized public payload fingerprint;
- the same public payload event count.

A same-round payload mismatch is reported separately as `peer_payload_drift`. It does not automatically mean the event selector was unfair: the event IDs may still match while the serialized content differs.

Peer payload parity intentionally does **not** require actor-specific context to be identical. `YOUR_PRIOR_EVENTS_JSON`, targeted Peer Inbox material, research-lane instructions, and other seat-local context may legitimately differ. The equality claim is limited to the public meeting payload shared among equal peers.

## Repair context invariance

A structured repair exists only to correct a Provider's rejected output format. It must not silently become a second deliberation turn with different public memory.

ChatChat therefore compares the first-attempt and repair-attempt context for the same actor / phase / round on two independent axes:

1. **exact serialized public payload** — `eq64` fingerprint plus exact public-event count;
2. **public selection provenance** — exact `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`, `PINNED_OPEN_ISSUE_EVENT_IDS_JSON`, `PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON`, and `LATEST_ROUND_EVENT_IDS_JSON` arrays.

The repair states mean:

- no repair happened → `not_used`;
- repair happened and **both** payload and selection provenance match → `matched`;
- either payload or selection provenance differs → `drift`;
- a historical/partial repair exists but one required receipt is missing → `unverified`.

The UI reports payload drift and selection-provenance drift separately even though both roll up to the single protocol state `repair_deck_drift`. This keeps the failure mechanically explainable without inventing a composite score.

`repair_deck_drift` is a protocol-integrity failure. It does not say which context is correct; it says the repair no longer has the same informational starting point as the turn it claims to repair.

## Frozen history replay

Live and archive views derive from the same transport receipt fields. Full Room history is not considered fully replayed until Public Payload Integrity reloads the same session from the frozen execution sidecar and reproduces complete modern payload receipts. ChatChat does not re-hash today's Blackboard and claim that value was observed at send time.

Side Panel intentionally has no History UI, so payload-history replay there remains explicitly `not-applicable` rather than pretending a historical surface exists.

## Independent quality dimensions

Serialized payload integrity remains separate from:

- stance alignment;
- Provider execution integrity;
- event-ID Memory Coverage;
- bounded-memory coverage gaps;
- source/evidence quality;
- answer correctness.

ChatChat must not combine these into a synthetic trust score.
