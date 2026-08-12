# Council Theater · Influence Map & Local Replay

The Council Chamber shows what the advisors said.

The **Council Theater** asks a different question:

> **What actually moved the room?**

Its first rule is intentionally conservative:

> **The theatrical layer may celebrate an event. It may not invent one.**

## Influence is not inferred from prose

ChatChat does not run another LLM over the transcript and ask it to guess who was persuasive.

The Influence Map is derived deterministically from Blackboard references.

### Interaction edges

These represent a traceable interaction / attempted influence:

```text
challenge.targetEventId
evidence.targetEventId
support.targetEventId
defense.targetEventId
```

Direction:

```text
actor of the new event
        ↓
actor of the referenced event
```

Example:

```text
GPT emits challenge(targetEventId = claude_argument)

GPT ── challenge ──▶ Claude
```

This is **not** labelled “GPT persuaded Claude.”

A challenge can be ignored, rejected or answered successfully.

## Strong influence edges

Only explicit structured change-of-position signals become strong influence.

### Revision

```text
revision.previousEventId
revision.causedBy[]
```

For each valid `causedBy` event authored by another advisor:

```text
actor of causal event
        ↓
actor of revision
```

The edge retains:

- revision event id;
- causal event id;
- previous position event id;
- old stance when recoverable;
- new stance;
- round.

Example:

```text
GPT challenge event_17
        ↓
Claude revision previous=event_4 causedBy=[event_17]
        ↓
Electron → Tauri

GPT ══ changed mind ══▶ Claude
```

### Concede

For:

```text
concede.targetEventId
```

the actor of the target event receives a strong influence edge toward the conceding advisor.

## Broken references

An event graph can contain bad references because of:

- malformed imported archives;
- old schema bugs;
- manually edited data;
- future compatibility mistakes.

The Theater must not fabricate a missing actor/event.

Broken ids are omitted from the graph and surfaced as an unresolved-reference warning.

## Self edges

Self-targeting interactions do not create inter-advisor influence lines.

They may still exist in the Blackboard, but an `A → A` line would confuse the social graph.

## Aggregation

Multiple edges in the same direction may be summarized visually, but the aggregate always retains the underlying Blackboard event ids.

This allows:

```text
GPT → Claude
challenge × 2
evidence × 1
```

while still letting the user click through to the original events.

Strong and interaction edges remain separate because one is evidence of explicit position change and the other is not.

## Changed Mind Trails

A Changed Mind card appears only when there is an explicit revision with a valid causal link.

It can display:

```text
GPT + Gemini → Claude

Electron → Tauri

trace:
event_challenge → event_revision
```

The card is clickable and focuses the exact revision on the Public Blackboard.

## After-Council titles

Titles are UI-only post-processing.

**They are never sent back to models.**

Otherwise advisors would start optimizing for awards instead of truth.

Current event-derived candidates:

### 🧠 Most Influential

Unique advisor with the most outgoing **strong** revision/concede influence edges.

No strong edge → no title.

Tie → no title.

### 🔄 Most Open-Minded

Unique advisor with the most explicit revision + concede events.

### ⚔️ Most Challenged

Unique advisor with the most incoming challenge edges.

### 📎 Evidence Keeper

Unique advisor with the most structured evidence events.

This does not imply its evidence was correct; verification is a separate future layer.

### 🛡️ Strongest Dissenter

Only considered among final minority participants.

Uses traceable interaction count as an explanatory statistic; the important fact is that the final minority position survived.

## Replay

Replay is entirely local.

It consumes the event stream already stored in the Court Chronicle.

It must never:

- re-send King's Command;
- call Provider pages;
- open network requests;
- ask an LLM to reconstruct missing history.

Controls:

```text
↺ Replay
▶ Play / Ⅱ Pause
1× / 2× / ALL
scrubber
```

As the event cursor advances:

```text
READY
  ↓
SEALED
  ↓
DEBATE
  ↓
FINAL
  ↓
COMPLETE
```

The Influence Map is rebuilt from only the events visible at the replay cursor, so relationships appear when their source events actually enter history.

## Privacy

Unlike Royal Proof Pack, Council Theater is a **private local view** and may show Council message text from the user's own Chronicle.

It is not a safe public export format by default.

A future “share replay” feature must have an explicit redaction/sanitization layer before generating public media/data.

## Mock and real advisors

Nodes must visibly identify:

```text
MOCK
LIVE WEB
```

A Hybrid Council must never make a Mock relationship look like evidence of real Provider interoperability.

## Why this matters

A normal transcript can tell the user:

> Claude changed its answer.

A structured Council can show:

```text
GPT challenged event_17
Gemini submitted evidence event_21
Claude defended event_24
Claude revised event_4 because of event_17
Electron → Tauri
```

That difference is the heart of ChatChat's long-term observability story.
