# AI House Committees · 委员会审议 🏛️

ChatChat Browser House supports two Parliament modes:

```text
🗣️ Free Parliament
all admitted seats receive the same Council role

🏛️ Committee Parliament
admitted seats are cross-delegation mixed into neutral investigative committees
```

The King still asks exactly one question. Committees do **not** rewrite it.

## Why committees

A large House can have many seats:

```text
ChatGPT ×5
Gemini ×3
DeepSeek ×3
Qwen ×5
Yuanbao ×2
...
```

Giving every seat the same prompt is useful for independent sampling, but it can waste diversity. Committee Parliament asks different seats to investigate different dimensions while preserving the shared decision task.

Example:

```text
📎 Evidence Committee
  ChatGPT-01 · Gemini-02 · DeepSeek-01

🛡️ Security & Privacy Committee
  Qwen-01 · ChatGPT-02 · Yuanbao-01

🧱 Engineering Committee
  DeepSeek-02 · Gemini-01 · ChatGPT-03

😈 Counterexample Committee
  Qwen-02 · ChatGPT-04 · DeepSeek-03
```

Assignments deliberately mix Provider delegations where possible.

## Built-in committees

Committee v1 ships a fixed, reviewable task set:

- 📎 Evidence Committee
- 🛡️ Security & Privacy Committee
- 💰 Cost & Economics Committee
- 🧱 Engineering Committee
- 👥 User Experience Committee
- 😈 Counterexample Committee
- 📜 Requirements Committee

Smaller Councils use a compact subset; large Houses unlock the full set.

## What a committee is **not**

A committee is not a political faction and not a desired answer.

Bad:

```text
"You are the Tauri committee. Prove Tauri is best."
```

ChatChat v1 forbids this design.

Good:

```text
COMMITTEE_TASK_JSON:
{
  "id": "security",
  "name": "Security & Privacy Committee",
  "task": "Investigate security, privacy, authentication, data-flow and trust-boundary risks symmetrically."
}
```

Every committee seat is also told:

1. the task is an investigative lens, never a desired conclusion;
2. the King's requirements and evidence outrank committee convenience;
3. it may disagree with its own committee;
4. it may disagree with its own Provider delegation;
5. its final position remains individual and does not become a committee bloc vote.

## King's Question remains separate

Committee metadata is inserted beside the existing prompt field:

```text
KING_QUESTION_JSON: "...the King's original question..."
COMMITTEE_MODE: committee-parliament
COMMITTEE_TASK_JSON: {...}
COMMITTEE_RULES_JSON: [...]
COUNCIL_EVENTS_JSON: [...]
```

The insertion helper refuses to guess. If the canonical `KING_QUESTION_JSON:` marker is missing or appears twice, it fails closed.

Tests assert that the King's Question remains byte-for-byte unchanged.

## Browser lifecycle

The Committee Parliament browser companion is armed only during a real `CouncilOrchestrator.run()` call.

That means:

```text
Teach Mode      → no committee metadata
Test Speech     → no committee metadata
Council Gate    → no committee metadata

King clicks 开廷
      ↓
Committee plan generated
      ↓
Council RUN_SPEECH prompts receive explicit committee block
      ↓
sealed → debate → final
      ↓
companion disarms
```

Validation therefore measures the Provider transport itself rather than the optional committee feature.

## Deterministic assignment

The assignment engine first minimizes how many seats from the same Provider delegation land in the same committee, then minimizes committee size.

It is deterministic so:

- replay is auditable;
- tests are stable;
- a screenshot can be reproduced;
- committee assignment is not hidden randomness.

## UI

The Browser Side Panel exposes:

```text
PARLIAMENT MODE
[ 自由 ] [ 委员会 ]
```

Free Parliament remains the default.

When Committee Parliament is active, the panel shows the committee mix and seat counts. Committee labels are theatrical presentation of real prompt metadata; they are not model rewards.

## Principle

> **Committees investigate a dimension. They never prescribe a winner.**

The fun comes from watching differently assigned advisors discover conflicts, challenge each other's evidence and sometimes change their minds — not from secretly steering them toward a preselected answer.
