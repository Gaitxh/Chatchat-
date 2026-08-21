# Obligation-Aware Bounded Memory Scheduling

Provider Memory Coverage proves what entered each bounded public Prompt. Procedural Fairness prevents configured publication order from becoming hidden memory privilege. A third problem remains:

> **Can a structurally unresolved public obligation regain attention under sustained high-volume rounds, or can it starve forever even while the meeting stays procedurally fair?**

Before this policy, an overfull newest round could consume all 12 public-context slots. The deck could be perfectly equal across Providers and still exclude the same old unanswered direct question forever.

That is fair delivery of an incomplete process. It is not enough for a deliberative assembly that is supposed to work unfinished business toward closure.

## Scheduling order

When the newest round fits the public context budget, the existing policy remains unchanged:

1. preserve the complete newest round;
2. restore canonical-open structural obligation groups with remaining capacity;
3. use ordinary older recency last.

When the newest round itself exceeds the hard cap, ChatChat now uses:

> **seat floor → unresolved obligation groups → extra newest-round speech → ordinary recency**

### 1. Equal-seat floor

Every actor who spoke in the newest round receives one selected event before old obligations are allowed to consume optional newest-round speech capacity, whenever the hard cap can mathematically represent every actor.

This keeps Provider Memory Fairness intact. An old question cannot erase a representable current participant merely because it is old and unresolved.

Within an actor's seat-floor choice, a canonical-open newest-round source is preferred over ordinary same-round speech. This protects current unfinished business without semantic scoring.

### 2. Canonical-open obligation groups

After the seat floor, remaining bounded capacity may be allocated to the same canonical Open Issues provenance used by the meeting secretariat, conflict memory, and resolution ledger.

Eligible public obligations are structural, not LLM-inferred:

- direct/open questions;
- challenged claims still awaiting the challenged actor's explicit response;
- targeted evidence still awaiting response;
- explicit uncertainty that has not been structurally resolved.

The scheduler moves bounded **event groups**, not summaries. A group contains the source and, when needed, a small related/parent event so a restored challenge/evidence item remains intelligible. The existing group bound remains finite.

Scheduling priority changes memory coverage only. It does not create authority, truth status, confidence weight, or vote weight.

### 3. Extra newest-round speech

Any capacity left after obligation scheduling goes back to newest-round speech. Extra slots are allocated by current per-actor representation count using the stable fairness order. Obligation-scheduled newest-round events count toward that actor's representation.

This means restoring one old direct question in a 3-seat / 18-event newest round produces a shape such as:

- 1 old unresolved direct obligation;
- 11 newest-round events;
- all 3 newest-round actors still represented;
- 12 total public events.

The old obligation displaces an **optional extra event**, not a seat.

### 4. Ordinary older recency

Only if the newest round and scheduled obligations cannot consume the budget are ordinary older events added by recency.

## Structural-parent preservation

Some obligations are unintelligible without the event they refer to. For example, an old challenge without the challenged claim is a dangling instruction.

Obligation scheduling therefore reuses the bounded structural-group logic from conflict memory. A restored challenge may bring its target parent; evidence/reply obligations may bring one relevant structural parent. Groups remain capped so one thread cannot consume the entire meeting memory.

## Targeted Provider behavior

The public deck remains identical for all equal Providers. ChatChat never gives one seat a different public history.

When a restored obligation explicitly targets the current Provider, the existing `CHATCHAT_PINNED_OPEN_ISSUES` Prompt rule tells that participant to address the unfinished public business before unrelated new points. The source event id remains visible in Prompt provenance.

A later refinement may expose recovered obligations as their own structured inbox items, but the shared public-memory schedule is the canonical fact and must not depend on private prose inference.

## Mathematical saturation stays visible

If the newest round itself contains 12 distinct actors and the public context cap is 12, the seat floor consumes every slot. An older obligation cannot be restored without erasing a current actor.

ChatChat does **not** pretend this is solved. The older canonical-open source remains a Provider Memory Coverage Gap.

That gap is useful input for the next policy layer: bounded closure / resolution rounds. A later round can reduce public traffic and deliberately allocate a response opportunity without silently violating seat fairness.

## Deterministic regression shape

The core regression fixture uses:

- R1: one old direct question from A to B;
- R2: A, B, C each publish six events (18 newest-round events);
- R3 Prompt cap: 12 events.

The expected selection must prove:

- exactly 12 events total;
- all A/B/C latest-round actors represented;
- old direct question restored;
- exactly one optional newest-round slot displaced by that one-event obligation;
- remaining newest-round representation stays balanced;
- changing R2 actor publication block order does not change those guarantees.

A second fixture uses an old challenge and its challenged parent; both must return as one bounded structural obligation group.

A saturation fixture uses 12 newest-round actors. All 12 seat-floor slots must remain represented and the old obligation must **not** displace a seat.

## What this policy does not decide

This policy improves the probability that unfinished public business gets a real response opportunity. It does not claim semantic completeness, and it does not decide when the meeting is finished.

Closure is a separate protocol decision. The next layer should use canonical unresolved obligations plus a bounded safety budget:

- continue when an unresolved obligation has not yet received a fair response opportunity and bounded capacity remains;
- do not loop forever;
- at the hard safety cap, close honestly with exact unresolved receipts and an explicit stop reason.

That keeps `deliberate until resolved` procedural rather than magical.
