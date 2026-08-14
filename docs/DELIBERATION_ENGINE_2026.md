# ChatChat Deliberation Engine — Research Notes (2026-08)

This memo turns recent multi-agent reasoning research into concrete ChatChat product and protocol constraints. It is not a claim that any single paper defines the correct architecture.

## Current design we should preserve

ChatChat already makes several choices that matter more than the visual metaphor of “AIs talking”:

- Round 1 is sealed: every participant forms an initial position before seeing peers.
- The primary team is heterogeneous across AI providers rather than duplicated seats from one provider.
- Later rounds use immutable shared snapshots and publish typed Blackboard events in batches.
- Evidence, challenges, revisions and concessions are explicit events with provenance.
- There is no chair AI and no privileged model.
- Minority positions survive into the report and UI.
- Source reachability is a tool observation, not a truth verdict.
- Proposal Modes impose bounded round budgets instead of unbounded chat.

The next engine work should strengthen those properties rather than drift back toward “chat until everyone agrees.”

## Research signals

### Vanilla debate is not automatically better than ensemble

Smit et al. (ICML 2024), *Should we be going MAD?*, found that multi-agent debate does not reliably outperform self-consistency or ensembling without protocol tuning.

Source: https://proceedings.mlr.press/v235/smit24a.html

**Implication:** more rounds are not automatically more intelligence. Debate should be selective and budgeted.

### Consensus and majority voting can be failure modes

Free-MAD (ACL Findings 2026) removes forced consensus, motivated by token overhead, conformity-driven error propagation and weaknesses of last-round majority voting.

Source: https://aclanthology.org/2026.findings-acl.1600/

**Implication:** `consensusRatio` is descriptive telemetry only. It must never become a truth score or an unconditional stop signal.

### Diversity and confidence matter more than cosmetic agent count

Zhu et al. (ACL Findings 2026) identify diversity of initial viewpoints and calibrated confidence communication as important mechanisms missing from vanilla homogeneous debate.

Source: https://aclanthology.org/2026.findings-acl.1694/

**Implication:** prioritize distinct providers/model families over duplicate tabs. Confidence should remain visible but never be equated with correctness.

### Longer debate can drift away from the problem

Becker et al. (EACL Findings 2026) study problem drift across multi-agent debates and show that longer interaction can harm performance when discussion loses progress, feedback quality or clarity.

Source: https://aclanthology.org/2026.findings-eacl.268/

**Implication:** another round should require a reason: unresolved challenge, new evidence, revision, question, uncertainty, or another explicit open signal. A round budget remains a hard ceiling.

### Information diversity may matter as much as model diversity

Li et al. (2026 preprint) argue that giving all forecasting agents identical evidence can encourage herding; designed information asymmetry can reduce correlated errors.

Source: https://arxiv.org/abs/2607.01661

**Implication:** future Verify/Deep modes should experiment with Research Lanes. Agents can investigate different evidence goals, but any consequential evidence must be published onto the shared Blackboard before it influences later revisions.

### Correct minorities are worth protecting

Minority Sentinel (2026 preprint) studies conditions under which a minority agent can be correct against a heterogeneous-agent majority.

Source: https://arxiv.org/abs/2606.29270

**Implication:** do not auto-delete or visually bury minority positions. A minority with evidence, strong challenge handling or unresolved provenance remains part of the result.

## Protocol decisions

### 1. A majority cannot end a batch before peers see new information

Every participant in one debate batch responds to the same immutable pre-round snapshot. If that batch creates a new `argument`, `challenge`, `evidence`, `revision`, `question`, or `uncertain` event, peers have not seen that information yet. Alignment alone must not end debate before one subsequent batch can inspect it, unless the Proposal Mode budget is exhausted.

### 2. Stop reasons must be explicit

New reports should expose one of:

- `stable_alignment_no_new_signal`
- `round_budget`

The UI and Consultation Receipt must distinguish them. Hitting a budget is not epistemic convergence.

### 3. Consensus remains compatibility terminology, not authority

Existing `consensusStance` / `consensusRatio` fields remain for archive compatibility. New UI should increasingly frame them as leading/shared stance and alignment rather than a verdict.

### 4. Research Lanes are the next serious Deep-mode experiment

Candidate equal-status research lanes:

- primary-source verification
- strongest counterexample
- implementation constraints
- historical/base-rate evidence
- user-impact / failure-mode evidence

Lane assignment changes what an agent investigates, not its authority.

### 5. Debate health should measure progress, not activity

Useful signals include:

- unresolved challenge count
- new evidence since the previous batch
- evidence/challenge-caused revisions
- repeated claim fingerprints
- unanswered questions
- surviving stance diversity after evidence exchange
- missing or disputed source observations

Message count, animation intensity and token volume are not quality signals.

## Near-term roadmap

### P0 — stop provenance

Add `stopReason` to new Council reports, derive it in the orchestrator, test adaptive convergence vs round-budget exhaustion, and surface it in Consultation Receipt / archive replay.

### P0 — zero-config product UI

Full Room shows the AI team as an automatic system. Manual tab/URL/member controls live behind “Change AI team”. Teach Mode stays under Advanced repair.

### P1 — diversity telemetry

Derive locally:

- distinct provider count
- duplicate-provider suppression
- initial stance distribution
- confidence spread
- final minority survival
- changed-mind count

Use these for diagnostics/benchmarking, not a universal quality score.

### P1 — Research Lanes prototype

Add structured lane assignments to Verify / Stress Test / Deep paths while keeping every participant equal in authority.

### P1 — drift/repetition guard

Before spending another round, detect whether the unresolved event graph actually changed. Repeated paraphrases without a new claim, challenge, evidence item, revision or uncertainty should not justify another expensive batch.

### P2 — benchmark harness

Compare:

1. single strong model
2. heterogeneous independent ensemble
3. current ChatChat deliberation
4. consensus-free trajectory-aware variant
5. Research-Lane variant

Measure accuracy where ground truth exists, plus cost, latency, revision precision, minority recovery, evidence utilization and drift.

## Anti-goals

ChatChat should not optimize for:

- maximum number of agents
- maximum debate length
- forced unanimity
- dramatic-looking argument transcripts
- confidence as a proxy for truth
- one hidden judge model silently overruling every participant

The interface can be playful. The protocol should remain sober, inspectable and explicitly uncertain when the evidence is uncertain.
