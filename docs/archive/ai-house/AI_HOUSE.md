# AI House · Delegations, Seats & Caucuses

ChatChat started as a small round table.

**AI House** asks what happens when the King can invite a *delegation* instead of only one representative per model.

```text
👑 King
   ↓
GPT Delegation      × 5
Qwen Delegation     × 5
Claude Delegation   × 3
Gemini Delegation   × 3
DeepSeek Delegation × 4
   ↓
20 independent delegates
   ↓
sealed opinions → debate → caucuses → final House vote
```

## Delegation ≠ caucus

These are intentionally different concepts.

### Delegation · 代表团

A model/profile family configured by the user.

Examples:

```text
GPT Delegation
Qwen Delegation
Claude Delegation
```

Each delegate receives a unique actor id:

```text
gpt::seat-01
gpt::seat-02
gpt::seat-03
...
```

### Caucus · 党团

A caucus is an **emergent alignment** based on the Council's current/final structured stance.

It is not hard-coded from provider brand.

Example:

```text
Tauri Caucus · 11 seats
├─ GPT       3
├─ Qwen      3
├─ Claude    3
└─ DeepSeek  2

Electron Caucus · 5 seats
├─ GPT       1
├─ Qwen      1
├─ Claude    1
└─ DeepSeek  2
```

A GPT delegate can therefore sit in the same caucus as Qwen/Claude delegates while another GPT delegate remains in the minority.

That is the interesting part.

## Independence rule

A delegate is only real if it has an independent conversation/session channel.

Five UI cards pointing at one live conversation are **one channel, not five delegates**.

For browser-extension mode, the intended first runtime is:

```text
one logged-in Provider account
        ↓
5 independent Provider tabs / conversations
        ↓
GPT-01 ... GPT-05
```

The browser may share authentication cookies across those tabs. Their active conversation state must remain independent.

Until the runtime can prove five independent channels, ChatChat must not display `GPT ×5 READY`.

## Seat limits

The first House protocol deliberately caps scale:

```text
MAX_DELEGATION_SEATS = 16
MAX_HOUSE_SEATS      = 64
```

This is not a theoretical model limit. It is a product guardrail against accidental cost/context explosions and unreadable UI.

Later versions may make these limits configurable behind an advanced setting.

## Two kinds of consensus

Multiple copies of one model are correlated.

Therefore ChatChat must never use raw House seat count as a synonym for model diversity.

### Seat Majority

Every delegate counts as one House seat.

```text
Tauri 11 / 16
68.75% Seat Majority
```

This answers:

> What did the configured House vote for?

### Delegation Consensus

Each delegation contributes at most one plurality position.

A split delegation remains in the denominator but abstains from choosing a side.

Example:

```text
GPT       → Tauri
Qwen      → Tauri
Claude    → Tauri
DeepSeek  → SPLIT 2/2

Tauri 3 / 4 delegations
75% Delegation Consensus
```

This prevents the UI from turning `3 decisive delegations + 1 split delegation` into a misleading `100%` claim.

## Delegation discipline

For each delegation:

```text
discipline = plurality seats / delegation seats
```

Example:

```text
GPT Delegation
Tauri    3
Electron 1

Discipline 75%
Dissenter: GPT-03
```

A tied delegation is marked `SPLIT` and has no invented plurality winner.

## Crossing the aisle

A delegate only gets a **crossed the aisle** moment when the Blackboard contains an explicit structured revision:

```text
revision.previousEventId
revision.causedBy[]
```

Example:

```text
GPT-01 challenge event_42
        ↓
Claude-02 revision
Electron → Tauri
causedBy=[event_42]
```

This can be rendered theatrically, but the UI must retain provenance back to the causal event.

## Initial caucus algorithm

AI House v1 uses the simplest inspectable caucus rule:

```text
normalized final/current stance
```

No hidden embedding model and no extra LLM decides party membership.

Future versions may add transparent graph-community analysis over:

```text
support
challenge
evidence
revision
concede
```

but any caucus assignment must remain explainable and inspectable.

## Mock House

`createMockHouse()` creates 16 deterministic seats:

```text
GPT       ×4
Qwen      ×4
Claude    ×4
DeepSeek  ×4
```

Two delegates explicitly cross the aisle during debate.

Expected final shape:

```text
Seat Majority
Tauri 11 / 16

Delegation Consensus
Tauri 3 / 4

DeepSeek Delegation
SPLIT 2 / 2
```

The Mock House exists for protocol tests and UI demos only. It is never evidence that multiple real Provider tabs worked.

## Future fun

Possible post-hoc UI-only titles:

```text
🕊 Cross-party Broker
🗳 Minority Whip
🧭 Most Independent Delegate
🔄 Biggest Aisle Crossing
🤝 Coalition Builder
```

As with Council Theater awards, these must **never be fed back to the agents as incentives**.
