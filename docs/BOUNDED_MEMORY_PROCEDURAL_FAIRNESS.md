# Bounded-memory procedural fairness

ChatChat treats equal AI participants as equal not only in role labels, but also in how a finite public-memory budget is allocated. A Provider Prompt cannot contain the whole Blackboard forever, so omission is unavoidable. The procedural question is **which facts are allowed to decide that omission**.

This policy rejects fixed seat publication order as an invisible source of power.

## Three allocation layers

### 1. Newest-round protection

The newest public round is protected before older material. If the newest round itself exceeds the hard budget, events are allocated actor-by-actor: every active actor gets one of its newest events before any actor gets a second, then a second before any actor gets a third. A deterministic `sessionId + round` rotation resolves only indivisible remainder slots.

### 2. Structurally unresolved pins

Older unresolved obligations can displace ordinary older recency. Structural priority still matters: a directly targeted question or challenged claim may rank ahead of a generic uncertainty. Older rounds still rank before newer rounds within the same structural priority so old obligations do not starve forever.

But **within the same structural priority and the same source round**, Blackboard source index must not decide who receives the finite pin budget. ChatChat groups candidate obligations by their source actor and round-robins across actors. Each bounded issue context group is indivisible: if the whole group does not fit, it is skipped rather than pinning a challenge/question without the bounded structural context that makes it intelligible.

This is not actor quota voting. Structural obligation priority still outranks seat balancing. Fairness is used only to resolve a genuine procedural tie.

### 3. Ordinary recency

After newest-round protection and unresolved pins, remaining slots are ordinary recency.

ChatChat preserves complete newer rounds first. If one older round becomes the boundary that cannot fit entirely, only that boundary round is seat-balanced. Events from an even older round never displace a complete newer round merely to make actor counts look more equal.

## Deterministic rotation

When a capacity cannot be divided evenly among active actors, ChatChat uses a stable rotation derived from session/round/allocation-purpose metadata. The rotation does not inspect:

- Provider brand or model name;
- stance or majority membership;
- confidence;
- response latency;
- evidence popularity;
- semantic importance;
- Blackboard publication position.

The same immutable public snapshot therefore produces the same selected event set.

## Chronology remains public truth

Actor balancing is only an internal allocator. Once the selected event set is known, events are restored to exact Blackboard chronology before Prompt serialization. The Provider never receives a fake round-robin conversation order.

## What this policy guarantees

- newest-round overflow does not systematically reward later-published seats;
- same-rank / same-round pin competition does not systematically reward earlier-published seats;
- a truncated ordinary boundary round is balanced across active seats;
- sufficiently active equal seats differ by at most one slot under an indivisible single-round capacity;
- quiet seats are not erased merely because other seats produced more events when capacity exists for at least one item each;
- reordering entire actor publication blocks does not change the selected event set in the tested tie cases.

## What it does not guarantee

It does not guarantee equal numbers of events per actor in the full Prompt. Pins are obligation-driven, not quotas. It does not rank semantic importance, equalize speaking volume, change stance alignment, or imply that omitted events are unimportant. It does not guarantee answer correctness.

Procedural fairness is one independent quality dimension of the consultation institution, not a synthetic trust score.
