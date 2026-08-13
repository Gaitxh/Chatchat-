# ChatChat Council Protocol v0.1

ChatChat is not a group chat with several autocomplete boxes. It is a local-first deliberation protocol for a council of AI agents.

## Roles

- **King** — the user. The King issues the question or task.
- **Councilor** — an AI model or model-backed agent.
- **Master of Ceremonies** — the `CouncilOrchestrator`. It controls rounds and publication.
- **Blackboard** — the local public event log shared with the council.
- **Historian** — future local persistence layer (SQLite).
- **Judge / Scribe** — future evaluators and final-answer synthesizers.

The playful roles belong in the UI. The protocol itself must stay evidence-seeking and neutral.

## Rule zero

A councilor's objective is **not to win**. Its objective is to improve the council's answer.

Councilors must be allowed to support, challenge, request evidence, defend, revise, concede, remain uncertain, and preserve a minority opinion.

## Round model

### Round 1 — sealed opinions

Every councilor receives the King's question and council rules, but no peer output. The orchestrator publishes all sealed contributions only after every councilor finishes.

### Round 2+ — open council

At the beginning of each debate round, every councilor receives the same immutable snapshot of the public Blackboard.

Councilors respond independently. New contributions are published only after all councilors have completed the round.

This synchronous-batch rule reduces ordering bias where a fast model anchors every slower model.

### Final round

Every councilor publishes one explicit `final_position` with a stance, rationale, confidence, and optional caveats.

A minority final position is valid output, not a protocol failure.

## Event types

The Blackboard is an event log, not a raw transcript.

| Event | Meaning |
| --- | --- |
| `argument` | A position or claim |
| `challenge` | A direct objection to another event |
| `evidence` | Evidence relevant to a claim |
| `support` | Explicit support for another event |
| `defense` | Defense of a challenged event |
| `revision` | A visible change of stance |
| `concede` | Explicit withdrawal or concession |
| `question` | A question to the council or a councilor |
| `uncertain` | Evidence is insufficient |
| `final_position` | Final stance before the council report |

## Blackboard rules

1. The Blackboard lives on the user's computer.
2. Events are append-only during a session.
3. Events have stable IDs so challenges and evidence can target exact claims.
4. A provider does not need the entire history forever. Future context builders should select relevant events and compact old resolved discussion.
5. Provider credentials, cookies and browser profiles are **not** Blackboard events.

## Privacy boundary

ChatChat itself is designed without a central ChatChat server.

That does **not** mean a question never leaves the user's computer. If the user places an online model in the council, text sent to that provider necessarily goes to that provider.

The intended flow is:

`User computer -> chosen AI provider`

not:

`User computer -> ChatChat server -> AI provider`

Local-only providers can later support a completely offline council.

## Provider boundary

The council core does not care whether a councilor is backed by a supported model website, an official API, an OpenAI-compatible local endpoint, Ollama / LM Studio / vLLM, or a deterministic mock.

A future `ProviderAdapter` translates Council Context into provider-specific browser or API operations.

## Convergence

v0.1 uses a deliberately simple stance-majority ratio for stopping. This is **not** the intended final judging algorithm.

Future convergence should consider unresolved challenges, evidence quality/freshness, independent judge scores, minority objections, confidence calibration, externally verifiable claims, and diminishing returns from extra rounds.

A majority is a signal, not truth.

## Security direction

Browser-provider support should use isolated local profiles. ChatChat should never ask users to upload session cookies to a project-operated server.

Custom URL support must be treated as untrusted integration code: adapters need permission boundaries, visible scopes, and a safe local storage model.
