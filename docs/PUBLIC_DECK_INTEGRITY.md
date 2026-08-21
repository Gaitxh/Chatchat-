# Exact public Blackboard deck integrity

ChatChat treats equal AI participants as peers. That promise is incomplete if two Providers receive the same public event IDs but different serialized event contents.

## What is audited

For each real outgoing `RUN_SPEECH` Prompt, ChatChat observes the exact serialized value of `CONSULTATION_EVENTS_JSON` after the normal bounded context selector has already chosen the public Blackboard snapshot.

For one `sessionId + phase + round`, first-attempt Provider Prompts are grouped by the exact raw serialized payload. Equal peers pass the deck-integrity check only when the observed payload strings are byte-for-byte identical.

This is stronger than checking `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`. A payload with unchanged IDs but changed actor, stance, confidence, evidence, content, or ordering must fail exact parity.

## Repair continuity is a separate invariant

A structured parser failure may cause ChatChat to ask the same Provider to repair its response format. That repair Prompt may add parser-error guidance, but it must reuse the exact same public Blackboard deck that the actor saw on its first attempt.

The audit therefore checks repair continuity per actor independently of cross-peer parity.

## Privacy boundary

The exact public payload is kept only in a bounded in-memory audit buffer. ChatChat does not persist another transcript copy for this proof.

Transport receipts may expose a compact diagnostic fingerprint and payload character count. The fingerprint is not cryptographic proof and is never used to decide equality; exact equality compares the raw in-memory payload strings.

This audit does not read Provider credentials, cookies, hidden reasoning, chain-of-thought, or private model state.

## Product truth

In live mode, the Public Blackboard Deck Integrity panel describes observations from real outgoing Provider-tab transport.

In `?showcase=consultation`, the panel must identify itself as a synthetic fixture. Synthetic evidence proves the audit/UI path only; it does not prove that ChatGPT, Claude, Gemini, or any other live Provider attended or received the fixture deck.

## What this does not prove

Exact deck parity is a procedural fairness property. It does not prove that the shared events are true, that a majority is correct, that all Providers interpreted the same text identically, or that context omitted by the bounded selector was unimportant.
