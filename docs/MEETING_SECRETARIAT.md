# ChatChat Meeting Secretariat

ChatChat's Meeting Secretariat is a deterministic view over the consultation protocol. It is **not** a chair, moderator, judge, or additional AI participant.

## What it answers

During a live consultation the user should be able to answer two questions without reading the whole event stream:

1. **Why does this round exist?**
2. **Which structured issues still await an explicit response?**

## Live Agenda

The consultation engine emits an optional `CouncilPhaseUpdate.reason` with machine-readable context:

- `sealed_start` — independent Round 1 is beginning.
- `initial_debate` — sealed views have been published to the shared snapshot.
- `fresh_signal_follow_up` — the prior parallel batch introduced new argument/challenge/evidence/revision/question/uncertainty events that peers could not have seen in that same batch.
- `minimum_debate_rounds` — the selected consultation mode requires more open debate.
- `alignment_not_reached` — descriptive stance alignment is below the configured threshold.
- `finalizing_stable_alignment` — minimum debate is satisfied, alignment reached the threshold, and the prior batch introduced no fresh peer-response signal.
- `finalizing_round_budget` — the mode reached its hard round boundary without pretending that all disagreement disappeared.

For `fresh_signal_follow_up`, `triggerEventIds` carries the exact public events that caused the next round. The UI can therefore trace the reason back to evidence rather than inventing an explanation after the fact.

Alignment is descriptive telemetry only. It does not grant authority to a majority and never gives one participant more speaking or voting power.

## Open Issues

Open Issues are derived from the public Blackboard event graph. ChatChat does not ask another model whether a concern "sounds resolved."

A direct question, targeted challenge, or targeted evidence item is discharged only by an exact structured response from the participant who was addressed. Similar prose and third-party replies do not count.

An explicit uncertainty remains visible until the same participant later records a higher-confidence structured revision or final position under the conservative rules in `src/consultation/open-issues.ts`.

This means a meeting may reach its configured round boundary while still displaying unresolved issues. ChatChat reports that state instead of rewriting it into fake consensus.

## Shared response semantics

`src/consultation/structured-response.ts` is shared by both the Peer Exchange Queue and Open Issues derivation. This avoids two UI features disagreeing about whether an AI actually answered a peer.

## Browser evidence

The live-deliberation Chromium product guard cannot complete unless the browser has witnessed both:

- a `fresh_signal_follow_up` Agenda with an exact triggering event; and
- at least one event-backed Open Issue.

These requirements are additive to the existing sealed/debate, evidence, research, revision, reply, relationship-map, and Peer Exchange lifecycle proof.
