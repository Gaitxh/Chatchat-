# Provider Memory Audit Privacy Boundary

Provider Memory Coverage proves what **public meeting event identities** were selected into a bounded Provider Prompt without turning ChatChat into a hidden transcript recorder.

## What the durable memory receipt needs

The memory-specific transport receipt stores bounded execution metadata such as:

- session / actor / phase / round;
- Provider tab identity already used by execution audit;
- Prompt character count;
- public snapshot event IDs;
- newest-round protected event IDs;
- conflict-pinned event IDs;
- exact Open Issue source event IDs that caused pinning;
- whether those categories were observed from the actual `RUN_SPEECH` Prompt;
- ordinary transport success/failure timing already used by Provider Attendance.

These IDs are enough to reconstruct the memory deck against the consultation's already-saved public Blackboard events.

## What Memory Coverage does not need to persist

Memory Coverage does not require a second durable copy of:

- hidden chain-of-thought;
- Provider internal attention weights;
- private model scratchpads;
- embeddings of discussion prose;
- semantic “importance” scores;
- full raw Provider page responses solely for the purpose of memory auditing;
- a permanent duplicate of every generated Prompt string solely for memory auditing.

Public event text is already part of the structured consultation archive. The memory receipt adds **selection provenance**, not a secret second transcript.

## Actual Prompt proof means metadata was observed at send time

`actual_prompt` means ChatChat parsed explicit memory metadata from the exact Prompt string that was passed to `RUN_SPEECH` at send time and froze those selected event IDs into the transport receipt.

It does **not** mean ChatChat claims to know what the remote model internally attended to after receiving that Prompt.

## Archive replay

Historical Memory Coverage joins:

1. the frozen public consultation event archive; and
2. the frozen execution/transport receipt containing selected event IDs.

It performs zero Provider calls and does not reconstruct hidden reasoning.
