# Meeting Execution Integrity

ChatChat separates three things that are easy to blur together:

1. **Stance alignment** — how many final positions use the same normalized stance label.
2. **Meeting Execution Integrity** — whether the selected Provider turns actually completed the auditable page-response → structured-parse → Blackboard-publication chain.
3. **Answer correctness** — whether the recommendation is actually true or good. ChatChat does not invent a percentage for this.

A high alignment ratio cannot repair missing Provider participation. Likewise, perfect execution integrity does not make a unanimous answer correct.

## States

`verified`
: Every auditable Provider turn completed the execution chain without fallback, failure, or unresolved audit state.

`verified_after_repair`
: Every turn ultimately completed, but one or more Provider responses required the single structured repair attempt. Repair remains visible because the first response was not a valid public meeting contribution.

`degraded`
: One or more turns ended in ChatChat fallback or hard execution failure. The final stance distribution may still be shown, but the product must explicitly warn that it is **not** consensus after complete Provider participation.

`incomplete`
: Some turns are still outside a terminal audited class. A completed-looking recommendation must be treated as provisional until the execution chain is understood.

`waiting`
: No auditable Provider turn exists yet.

## What it does not score

Meeting Integrity never scores intelligence, truth, reasoning quality, research quality, persuasiveness, or hidden chain-of-thought. It is mechanical execution provenance only.

The strongest positive claim it can make is:

> These Provider turns returned page responses, passed the structured consultation parser, and produced these exact public Blackboard events.

## Synthetic showcase

`?showcase=consultation` renders the same integrity UI so Chromium can prove the product surface. It is explicitly labeled synthetic. A synthetic `12/12 verified` means the deterministic fixture completed the execution protocol; it does **not** mean live ChatGPT, Claude, Gemini, or other third-party models attended.

## Relationship to Provider Attendance

Meeting Integrity is derived from the canonical Provider Attendance & Execution Audit. It does not maintain a second attendance interpretation. See [Provider Attendance & Execution Audit](PROVIDER_ATTENDANCE_AUDIT.md) for the underlying per-seat/per-round provenance and durable execution receipt history.
