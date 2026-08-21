# Seat-balanced public memory under latest-round overflow

ChatChat gives equal AI participants the same immutable public snapshot within a round. A bounded Provider Prompt, however, cannot always carry every public event.

## The hidden bias this policy removes

Before this policy, `latestRoundIds()` protected the newest round with a publication-tail operation equivalent to `slice(-maxEvents)`. When one round itself exceeded the 12-event Provider budget, later Blackboard publication order could determine which participants remained visible. Because the orchestrator publishes a completed parallel batch in a stable participant order, that created a repeatable seat-order bias even though every downstream Provider received the same final deck.

Equal peers receiving the same biased deck is not enough. The deck construction itself must avoid granting one seat more memory coverage merely because its batch was materialized later.

## Allocation rule

When the newest round fits inside the budget, ChatChat keeps the whole round exactly as before.

When the newest round alone exceeds the budget:

1. Group newest-round events by `actorId`.
2. Within each actor bucket, start from that actor's newest public event.
3. Give every actor with remaining events one slot before any actor receives the next slot.
4. Repeat until the hard budget is full or every bucket is exhausted.
5. If the budget is not divisible by the number of active actors, use a deterministic rotation derived from `sessionId + round` only to distribute the mathematically unavoidable remainder.
6. Restore the selected set to exact Blackboard chronology before Prompt serialization.

The rotation does **not** use Provider brand, model name, stance, confidence, response latency, publication position, majority membership, or evidence popularity.

## What this guarantees

For equally active seats, selected newest-round counts differ by at most one. A quiet seat with one event keeps that event whenever the budget can give every active seat at least one slot. Reordering entire actor publication blocks does not change the selected event set when each actor's own event sequence is unchanged.

This is a **memory coverage** guarantee only. It does not equalize how many contributions an AI is allowed to publish, judge the importance of contributions, or change convergence/voting semantics.

## What this does not solve

The public Prompt is still bounded. If a latest round contains more events than the budget, some newest-round events must be omitted. Seat balancing makes that omission procedurally fairer; it does not claim that omitted events are unimportant or that selected events are more correct.

A separate audit layer should also verify that equal peers received identical serialized public payloads, not only identical event IDs. Repair attempts must preserve the same public deck. That evidence-strength upgrade is intentionally separate from this allocation policy.
