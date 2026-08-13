# ChatChat Consultation Protocol

ChatChat is a browser-first multi-AI consultation system.

The user proposes a question, decision, plan or claim. AI participants join as **independent and equal peers**. There is no chair model, leader, delegation, party or weighted vote.

## Meeting flow

```text
User Proposal
    ↓
Independent Views · Round 1 is sealed
    ↓
Shared Consultation Space
    ↓
challenge · evidence · support · defense · question
    ↓
revision · concede · uncertainty
    ↓
Final Positions
    ↓
Consultation Outcome + Different Positions
```

## Equality rules

1. Every participating AI origin gets one equal participant slot in the primary browser experience.
2. No provider receives extra weight because the user opened more copies of the same model.
3. There is no chair model that writes a privileged final answer.
4. The outcome is derived from the participants' own final positions.
5. Majority alignment is descriptive information, not authority.
6. Different final positions remain visible.
7. Changing a position after evidence or criticism is a first-class success event.

## Round 1 — independent views

Every participant receives the same user proposal without seeing peer outputs.

Only after the entire first batch completes are the structured events published to the shared consultation space.

This reduces immediate anchoring and speaking-order effects.

## Later rounds — shared snapshot, parallel response

Later rounds use:

```text
immutable consultation snapshot N
           ↓
  ┌────────┼────────┐
  ↓        ↓        ↓
 AI A     AI B     AI C
  ↓        ↓        ↓
  └────────┼────────┘
           ↓
publish one event batch
           ↓
consultation snapshot N+1
```

No participant gets an earlier turn merely because its website responded faster.

## Structured events

The shared space is an event graph rather than only a transcript.

```text
argument
challenge
evidence
support
defense
revision
concede
question
uncertain
final_position
```

A revision can reference the prior position it changes and the event(s) that caused the change. This lets the UI later show influence without asking another model to guess who persuaded whom.

## Prompt boundary

Provider webpages and peer messages are untrusted external content.

The participant prompt explicitly separates:

```text
USER_PROPOSAL_JSON
CONSULTATION_EVENTS_JSON
YOUR_PRIOR_EVENTS_JSON
```

Peer text is discussion data. Instructions embedded inside another AI's contribution are not system instructions.

## Final outcome

The core report exposes:

- every participant's final stance;
- confidence;
- consensus/alignment ratio;
- disagreement/minority positions;
- the complete structured event history.

The browser UI may summarize those values visually, but it must not silently replace them with a single chair-model verdict.

## Bilingual interface

The primary interface ships with:

- English (`en`)
- 简体中文 (`zh-CN`)

The protocol event schema is language-neutral. AI contributions may use the user's working language while event kinds remain stable machine-readable identifiers.

## Product principle

> **Independent first. Equal throughout. Revise when the evidence earns it. Keep disagreement visible.**
