# Meeting Memory Protocol Integrity

ChatChat now has enough execution provenance to separate a second protocol question from ordinary Provider attendance:

> Even if every Provider page returned a valid structured turn, did equal peers receive the same bounded **public meeting memory**, did the deterministic selector agree with the actual Prompt, and were any still-open obligations absent because the hard memory cap could not fit them?

This is **Memory Protocol Integrity**. It is not stance alignment, answer confidence, answer correctness, evidence truth, or hidden reasoning quality.

## Keep four facts separate

A completed consultation can simultaneously report:

```text
Stance alignment:            83%
Execution integrity:         12/12 Provider turns verified
Memory protocol integrity:   bounded coverage
Answer correctness:          unknown / not scored by ChatChat
```

There is no valid arithmetic that collapses those four facts into one “trust score.”

## Protocol states

Memory Protocol Integrity has four deterministic states.

### `verified`

- same-round actual Provider Prompt memory decks are consistent;
- deterministic selector audit agrees with actual Prompt metadata where actual Prompt evidence exists;
- no canonical-open source event is known to be absent from an audited bounded memory turn.

This still does not mean the answer is correct.

### `bounded_coverage`

The protocol itself is internally consistent and equal peers still receive the same deck, but at least one canonical-open source event is absent from a bounded Provider Prompt because the public context hard cap is finite.

This is a **known coverage limitation**, not a fairness violation and not a claim that the omitted issue was semantically important.

### `selector_drift`

Actual Prompt receipts remain equal between peers, but ChatChat's deterministic selector audit disagrees with what was actually sent.

This is an implementation-integrity problem. It does not automatically imply Provider unfairness if the actual peer Prompt decks are still identical.

### `peer_fairness_violation`

Two equal peers in the same immutable public round received different actual public memory decks, or their known unresolved coverage-gap sets differ because the actual decks differ.

This is the strongest memory-protocol violation. It takes precedence over selector drift or ordinary bounded coverage.

## Evidence strength is a separate axis

Protocol state and evidence strength must not be conflated.

Memory evidence strength is one of:

- `actual_prompt` — every audited turn carries memory metadata parsed from the exact `RUN_SPEECH` Prompt;
- `mixed` — some turns have actual Prompt proof and some use selector audit fallback;
- `selector_audit` — historical record predates actual Prompt metadata and can only reconstruct the deterministic selector result;
- `none` — no auditable memory turns are available.

For example, an old archive can be:

```text
protocol state: verified
proof strength: selector_audit
```

That means “no violation is visible in the deterministic frozen selector record,” **not** “ChatChat observed every old Prompt string.”

## Coverage gaps

A Memory Coverage Gap is created only when all of these are true for a Provider turn:

1. the source event existed before that turn;
2. the source was still canonical-open at turn start;
3. the source event was absent from that turn's bounded public memory snapshot.

Gap derivation does not ask whether the source was “important.” It does not use embeddings, semantic similarity, confidence ranking, provider identity, majority stance, or a model-generated summary.

The gap keeps exact provenance:

- turn / actor / phase / round;
- Open Issue source event ID;
- issue kind;
- source actor and target actor when present;
- opened round;
- bounded source excerpt;
- evidence strength (`actual_prompt` vs `selector_audit`).

## Fairness of gaps

If all equal peers receive the same actual memory deck, they should also have the same known unresolved coverage-gap set for that round.

A different gap set is not normalized away. It is evidence that peer memory decks or their provenance differ and should contribute to a peer-fairness violation.

## Relationship to Meeting Execution Integrity

Meeting Execution Integrity answers:

> Did each Provider turn complete page response → structured parse → Blackboard publication?

Memory Protocol Integrity answers:

> What bounded public memory reached that turn, and was it equal / selector-consistent / coverage-complete with respect to canonical open sources?

A turn can be execution-verified while memory protocol is degraded. The final product should surface both facts rather than letting a green execution chain hide a memory-fairness or bounded-coverage limitation.

## Relationship to Conflict Resolution

Conflict Resolution Ledger and Open Issues share the canonical structural resolver that determines whether an obligation is still open.

Provider memory pinning and coverage-gap derivation consume that same open/closed state. This creates one consistent lifecycle:

```text
open issue
→ eligible for old-memory pin
→ exact resolver
→ no longer open
→ no longer eligible for later pin
```

No prose similarity shortcut is allowed to discharge the issue for memory purposes.

## Archive replay

Historical Memory Protocol Integrity is reconstructed from frozen public Blackboard events plus the frozen execution/transport sidecar.

It performs **zero Provider calls** and must preserve evidence-strength distinctions from the original session.
