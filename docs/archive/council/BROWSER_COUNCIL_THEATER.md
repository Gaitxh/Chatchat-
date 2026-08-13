# Browser Council Theater · 议会剧场 🎭

The Browser Side Panel can turn a completed House session into a local replay and influence view.

The important word is **traceable**.

ChatChat does not ask another LLM:

> “Who was the most persuasive?”

It derives what it can prove from the Blackboard event graph and refuses to upgrade weaker interactions into persuasion.

## Two kinds of edges

### Strong influence

ChatChat may say an advisor changed another advisor's position only when the protocol contains an explicit relationship:

```text
revision.causedBy[]
```

Direction:

```text
cause event actor → revising actor
```

The graph also records the stance transition when it can recover it:

```text
Electron → Tauri
```

An explicit `concede.targetEventId` is also a strong relationship:

```text
accepted event actor → conceding actor
```

### Interaction / attempted influence

These are useful but are **not** successful persuasion by themselves:

```text
challenge.targetEventId
evidence.targetEventId
support.targetEventId
defense.targetEventId
```

They create interaction edges only.

ChatChat will not infer a strong edge from text similarity, model confidence or a post-hoc judge.

## Browser Theater UI

After `HOUSE VERDICT`, the Side Panel can show:

```text
COUNCIL THEATER
谁推动了谁的立场？

EXPLICIT INFLUENCE
Qwen · 01 → ChatGPT · 02
🔄 Electron → Tauri

ATTEMPTED INFLUENCE
ChatGPT · 03 → Qwen · 02   ⚔2 📎1

🏆 Most Influential
🔄 Most Open-Minded
⚔️ Most Challenged
📎 Evidence Keeper
🛡️ Strongest Dissenter
```

Fun titles are produced only when the event graph supports a unique winner. Ties or missing provenance produce no invented award.

Awards are UI-only. They are never sent back to the models as a competitive objective.

## Replay

Replay uses the already completed local Council result:

```text
▶ 1x / 2x / instant
```

The cursor reveals events one by one.

As replay advances:

1. sealed arguments appear;
2. challenge/evidence edges grow;
3. revision/concede creates a strong influence edge;
4. a revision event produces a visible `🔄 CHANGED MIND` moment;
5. final positions close the replay.

Clicking a displayed influence relationship jumps the replay cursor to its exact source Blackboard event.

## Zero Provider calls during replay

Replay must never generate a new model request.

The Browser Theater companion contains no Provider tab transport call and the focused CI workflow explicitly rejects these tokens in the replay module:

```text
chrome.tabs
RUN_SPEECH
sendMessage
```

The replay source is only:

```text
completed CouncilReport
+
completed Blackboard events
```

This keeps replay deterministic, fast and local.

## Broken references

If an event references a Blackboard event id that cannot be found, the influence graph reports an unresolved reference.

It does **not** invent a relationship to make the visualization look complete.

## Current scope

Browser Theater v1 replays the latest Council in the current Side Panel runtime.

The shared influence builder already works on archived event arrays, so future Browser Chronicle/archive UI can reuse the same graph without changing semantics.

## Principle

> **The theatrical layer may celebrate an event. It may not invent one.**
