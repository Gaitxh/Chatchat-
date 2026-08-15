# Provider Memory Coverage

ChatChat's Provider Memory Coverage answers a deliberately narrow question:

> For this Provider turn, which **public Blackboard events** were actually placed in the bounded consultation Prompt, why were older events restored, which ordinary history was omitted, and did equal peers receive the same public memory deck?

It is a public-Prompt provenance system. It does **not** expose or infer hidden model reasoning, attention weights, embeddings, internal memory, or chain-of-thought.

## Hard public context budget

The Provider consultation Prompt uses a hard public-event budget:

```text
DEFAULT_PROVIDER_CONTEXT_EVENTS = 12
```

The selector is deterministic and ordered:

1. protect the newest published round first;
2. use remaining capacity to restore older event groups tied to structurally unresolved meeting issues;
3. fill remaining capacity with ordinary recent public events;
4. omit older ordinary history once the hard budget is full.

The hard limit is real. ChatChat must never describe it as unlimited memory or claim that every historical issue is guaranteed to fit.

## Conflict-aware pinning

An older issue may be restored only because it is still structurally open according to the same canonical Open Issues resolver used elsewhere in the product.

A pin group begins from a real Open Issue source event, such as:

- a direct question awaiting the targeted peer;
- an unanswered challenge;
- evidence awaiting an explicit response;
- explicit uncertainty that has not yet been superseded by a qualifying revision/final position.

ChatChat may also include the referenced target event so the restored issue remains intelligible.

The pin budget is bounded:

```text
DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6
```

That is a cap on restored **events**, not a promise to remember six issues. A single issue group may consume more than one event slot.

## Pinning is not authority

A pinned event gets **memory priority only**.

Pinning does not grant:

- extra vote weight;
- speaking priority;
- truth status;
- evidence verification status;
- a right to force agreement;
- a right to override the newest public round;
- special Provider/model authority.

The prompt explicitly tells each peer to treat pinning as attention, not as new evidence or a truth verdict.

## Pin until structurally resolved

The intended lifecycle is:

```text
old public issue still unresolved
        ↓
history grows beyond 12 events
        ↓
old issue group is restored into a later Provider Prompt
        ↓
exact structured resolver appears
        ↓
canonical Open Issues resolver closes the obligation
        ↓
future turns stop pinning that source
```

Resolution is never inferred from similar prose. The same exact structured resolver used by Open Issues and Conflict Resolution Ledger controls whether the issue is still eligible for later pinning.

## Actual Prompt evidence vs selector audit

Provider Memory Coverage keeps two evidence strengths separate.

### `actual_prompt`

For new browser turns, ChatChat parses explicit memory metadata from the exact string passed to `RUN_SPEECH`:

```text
PUBLIC_SNAPSHOT_EVENT_IDS_JSON
PINNED_OPEN_ISSUE_EVENT_IDS_JSON
PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON
LATEST_ROUND_EVENT_IDS_JSON
```

The outer Prompt-memory observer records those fields **before** delegating to the existing transport wrapper. The durable transport receipt is then enriched from that exact Prompt metadata.

This is the strongest available proof of what public memory ChatChat sent to the page.

### `selector_audit`

Older archives may predate actual-Prompt memory metadata. They can still reconstruct the deterministic selector result from frozen execution audit fields.

Those records are explicitly treated as selector-audit fallback. ChatChat must not upgrade them to actual-Prompt proof after the fact.

## Two independent integrity checks

Memory Coverage separates two failure domains.

### Provider-to-Provider public-memory fairness

Within one immutable public round, equal peers should receive the same public memory deck.

If actual Provider Prompt receipts differ between two peers in the same round, this is a **peer-memory fairness violation**.

### Selector ↔ actual Prompt agreement

The deterministic selector audit and the actual Prompt metadata should also agree.

If Provider A and Provider B received the same actual Prompt deck, but ChatChat's selector audit says one of those decks should have been different, Provider fairness may still be intact while **selector-to-Prompt integrity is broken**.

The product keeps these two facts separate instead of collapsing them into one generic green/red score.

## Coverage gaps are possible

A hard context budget means unresolved material can still be absent from a later Prompt.

Examples:

- the newest round itself consumes all 12 slots;
- there are more unresolved issue groups than the remaining pin budget can fit;
- a pin group requires multiple events and the remaining capacity is insufficient.

Therefore “conflict-aware pinning” must never be marketed as unlimited memory or guaranteed zero forgetting.

A subsequent product layer should expose these as **memory coverage gaps**: unresolved source events that existed at turn time but were not present in the actual public memory deck.

## Archive replay

Durable execution history stores the raw transport and execution audit records by session. Historical Provider Memory Coverage is reconstructed from:

- frozen Blackboard events;
- frozen execution selector audit;
- frozen transport Prompt-memory metadata when available.

Archive replay performs **zero Provider calls**.

## Synthetic Chromium proof

`?showcase=consultation&memory-proof=coverage` uses deterministic synthetic Provider responses to create bounded-memory pressure without pretending third-party models attended.

The dedicated browser proof requires a real production Chromium run to demonstrate:

- R3 public history exceeds 12 events;
- the actual R3 Prompt still contains exactly 12 public events;
- an old unresolved source is restored;
- ordinary older history is omitted;
- equal peers receive the same actual public Prompt deck;
- deterministic selector audit equals actual Prompt metadata;
- the pinned source later gets an exact structural resolver;
- R4 history still exceeds 12, but the resolved source is no longer pinned.

This proves ChatChat's memory-selection/provenance mechanism. It does not prove any third-party model's hidden attention or reasoning.
