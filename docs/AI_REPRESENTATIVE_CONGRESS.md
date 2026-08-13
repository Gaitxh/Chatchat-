# AI Democratic Representative Congress · AI 民主代表大会 🏛️

ChatChat's strongest product metaphor is now a concrete system rule:

> **The King raises one issue. AI delegations send representatives. The representatives deliberate publicly and produce a traceable result.**

This is not merely UI theater. The seat model, voting semantics and browser-tab runtime all follow it.

## Constitutional mapping

```text
👑 King / Issue Sponsor
User

🏛️ Congress
One ChatChat Council session

🤖 Delegation / 代表团
One model/provider origin, e.g. ChatGPT or Gemini

🪑 Representative Seat / 代表席位
One independent browser tab / conversation

📎 Committee / 专门委员会
Evidence, Security, Engineering, Counterexample, ...

🗳️ Seat Majority / 席位多数
Every representative seat votes once

⚖️ Delegation Consensus / 代表团共识
Each model delegation first resolves its internal position,
then every delegation contributes one source-level vote

🛡️ Minority Report / 少数意见
Final disagreement that survives the deliberation
```

## Default seat quota

Every model delegation defaults to:

```text
×1 seat
```

Examples:

```text
ChatGPT ×1
Claude  ×1
Gemini  ×1
DeepSeek ×1
```

The King may explicitly increase a delegation quota:

```text
ChatGPT ×3
Gemini  ×2
DeepSeek ×1
```

But every additional seat must be a genuinely separate browser tab / conversation.

ChatChat refuses:

```text
one ChatGPT conversation
→ draw five cards
→ call it ChatGPT ×5
```

## Why default ×1

The default should maximize source diversity rather than silently overweight whatever model happens to have more open tabs.

If the browser contains:

```text
8 ChatGPT tabs
3 Gemini tabs
1 DeepSeek tab
```

`SUMMON THE CONGRESS` defaults to:

```text
ChatGPT ×1
Gemini  ×1
DeepSeek ×1
```

The remaining same-model tabs are **reserve representatives**. They enter only when the King explicitly raises that delegation's seat quota.

## Seat quota is not source count

This distinction is constitutional:

> **More seats from one model increase sampling diversity. They do not create more independent model sources.**

Therefore ChatChat reports two different democratic views.

### Seat Majority

Every seat is one representative vote.

```text
ChatGPT ×5 → 4 Tauri, 1 Electron
Gemini  ×1 → Electron
DeepSeek ×1 → Electron

Seat Majority
Tauri 4 / 7
```

### Delegation Consensus

Each delegation first resolves its internal position.

```text
ChatGPT delegation → Tauri
Gemini delegation  → Electron
DeepSeek delegation → Electron

Delegation Consensus
Electron 2 / 3 delegations
```

This makes a politically interesting situation visible:

> The chamber has a seat majority for Tauri, but a majority of independent model delegations favor Electron.

ChatChat should show both rather than pretending one number is the whole truth.

## Internal dissent is allowed

A delegation is a shared model source, not a political party.

ChatGPT-01 may challenge ChatGPT-02.

Gemini-02 may side with DeepSeek against Gemini-01.

A representative may:

- support another delegation;
- challenge its own delegation;
- change its mind;
- concede;
- remain uncertain;
- preserve a minority opinion.

No prompt should say:

> "You are all ChatGPT representatives, coordinate your faction."

The goal remains accuracy, not faction discipline.

## Round 1 remains secret

Representative democracy does not replace independent thinking.

Round 1 is still sealed:

```text
ChatGPT-01 cannot see ChatGPT-02
ChatGPT-02 cannot see Gemini-01
Gemini-01 cannot see DeepSeek-01
```

Only after the sealed batch is complete does the public Blackboard open.

This prevents the first loud representative from setting the entire Congress agenda before anyone else thinks.

## Committees are cross-delegation

Committee Parliament becomes more meaningful under the Congress model.

For example:

```text
📎 Evidence Committee
ChatGPT-01
Gemini-02
DeepSeek-01

😈 Counterexample Committee
Claude-01
ChatGPT-02
Qwen-01
```

Committees deliberately mix delegations where possible.

A committee investigates a dimension; it does not become a faction or prescribe a winner.

## Browser runtime

The Browser product maps representation to real tabs:

```text
ChatGPT Delegation ×3
├── ChatGPT-01 → tab 104
├── ChatGPT-02 → tab 117
└── ChatGPT-03 → tab 131
```

The normal delegation row exposes:

```text
席位配额   −  ×3  ＋
```

`＋` creates/attaches another independent Provider tab.

`−` removes one representative seat.

Every new tab still has to pass its own runtime admission:

```text
Recipe mapping
→ Test Speech
→ Council Gate
→ READY
```

A Provider recipe may be shared as DOM mapping knowledge, but Test/Gate trust is never inherited from another seat.

## Summon rule

Bulk discovery may find every compatible open AI tab, but automatic default summoning follows:

```text
one missing delegation
→ one default representative
```

If a delegation is already represented, bulk summon does not silently increase it from ×1 to ×2.

Additional same-model open tabs remain reserves for an explicit quota increase.

## Royal Onboarding

Onboarding candidate groups expose delegation-level quotas.

Initial state:

```text
ChatGPT  − ×1 ＋
Gemini   − ×1 ＋
DeepSeek − ×1 ＋
```

The King may reduce a delegation to ×0 or explicitly raise it to the number of available independent tabs.

The ordinary Congress UI remains the main place for adding new tabs beyond those already open.

## Terminology

Public product language can use both:

```text
AI House
```

for the overall playful chamber and:

```text
AI Representative Congress
AI 民主代表大会
```

for the actual representation system.

Internal data terms stay stable:

```text
delegationId
seatIndex
seatCount
```

so the metaphor does not force needless protocol churn.

## Principle

> **One model is one delegation by default. One additional seat must mean one additional independent conversation. More seats add samples, not fake sources.**
