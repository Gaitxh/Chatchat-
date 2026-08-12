# Why ChatChat? 👑

Multi-LLM councils and multi-agent debate are not new ideas. That is a feature, not a problem: ChatChat can learn from a real body of work while choosing a different product boundary.

Nearby open-source ideas include:

- [karpathy/llm-council](https://github.com/karpathy/llm-council) — a local web app that sends one query to several LLMs through OpenRouter, asks them to review/rank each other, then lets a Chairman model synthesize the answer.
- [Skytliang/Multi-Agents-Debate](https://github.com/Skytliang/Multi-Agents-Debate) — a research-oriented Multi-Agent Debate framework exploring adversarial discussion and judge roles.
- [thunlp/ChatEval](https://github.com/thunlp/ChatEval) — multi-agent debate for evaluation-oriented workflows.

ChatChat deliberately explores a different interaction model.

## The product thesis

> **What if the user's existing AI accounts could literally enter the same local room?**

Instead of making “choose model A/B/C” feel like an API configuration screen, ChatChat makes the user the King and the models the Council.

```text
You do not select a backend.
You summon an advisor.

You do not paste a cookie.
You log into the Provider directly.

You do not hand-write a scraper.
You teach ChatChat three visible surfaces.

You do not fan out one prompt and merge text.
You watch typed claims, challenges, evidence, revisions and minority opinions evolve.
```

## 1. Bring your own web account

Many multi-model tools start from API credentials or an aggregation gateway.

ChatChat's main experiment is different:

```text
Provider URL
→ isolated local WebView
→ user-controlled login
→ local session/profile
```

The login belongs to the user. ChatChat itself has no relay server and does not require the user to copy session cookies into the app.

That does not mean Provider traffic is offline: a remote AI still receives whatever the user chooses to send to it. The distinction is that ChatChat does not add a central ChatChat server in the middle.

## 2. Teach the page instead of waiting for a hard-coded integration

AI webpages change often, and there are far more Provider UIs than one open-source project can maintain centrally.

ChatChat therefore treats visual teaching as a first-class primitive:

```text
✍️ Composer
➤ Send
💬 Response
```

The user clicks those three elements in the Provider WebView. ChatChat stores a local selector recipe.

This creates a path for:

- built-in Provider recipes;
- community recipes;
- private/internal AI tools;
- experimental models;
- unknown Custom URLs.

A provider-specific adapter can still be added when a framework needs custom input/generation behavior. Teach Mode is the generic floor, not a claim that every page is universally automatable.

## 3. A Provider is not automatically a Council seat

ChatChat intentionally has visible trust gates:

```text
recognized
≠ logged in
≠ probed
≠ taught
≠ test passed
≠ council ready
≠ seated
```

This makes failures diagnosable and prevents the UI from pretending a model is integrated before it actually works on the user's machine.

## 4. The discussion is an event graph, not just a transcript

The Blackboard contains typed events:

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

That allows ChatChat to ask questions a normal transcript cannot answer reliably:

- Who challenged this claim?
- Which evidence changed a position?
- Who changed their mind?
- Which minority opinion survived the final round?
- Which advisor repeatedly produces invalid evidence?
- How many rounds did convergence take?

This is the foundation for future persuasion graphs, replay, benchmarking and evidence verification.

## 5. Round 1 is actually sealed

Sequential “group chat” can create immediate anchoring.

ChatChat runs the first opinions concurrently and does not publish them to peers until all Round 1 turns finish.

Later rounds follow:

```text
snapshot
→ parallel advisor turns
→ publish batch
→ next snapshot
```

The UI can look like a lively room while the protocol avoids making speaking order the hidden source of consensus.

## 6. Changing your mind is a first-class visual event

A debate product can accidentally reward stubbornness.

ChatChat instead wants a shareable moment to be:

```text
🔄 CLAUDE CHANGED POSITION
Electron → Tauri
because of event_xxx
```

A model conceding a good point is progress, not defeat.

## 7. Minority opinions survive

The Council is not forced to produce fake unanimity.

Final output can contain:

```text
Consensus: 75%
Majority: Tauri
Minority: Electron

Minority caveat:
If the team requires a mature Chromium-only plugin ecosystem,
Electron may reverse the recommendation.
```

This is especially important for product, strategy and research questions where disagreement can contain useful conditional information.

## 8. The UI is part of the protocol's appeal

ChatChat is intentionally theatrical:

```text
👑 King
🕯 Sealed Council
⚔ Challenge
📎 Evidence
🔄 Changed Mind
⚖ Council Gate
🪑 Take a Seat
📚 Court Chronicle
🔥 Live Council
```

The theatrical layer is not supposed to change model incentives. Underneath it, prompts and parsers stay explicit and boring.

> **The UI can be theatrical; the protocol must stay sober.**

## 9. Local history is a future research dataset owned by the user

The Court Chronicle stores structured sessions locally.

That makes it possible to build future features without uploading the user's history to ChatChat:

- replay a debate;
- visualize influence;
- compare advisors by task type;
- identify repeated hallucination patterns;
- evaluate whether extra debate rounds actually helped;
- export a sanitized benchmark dataset only when the user chooses.

## 10. What could make ChatChat memorable

The strongest demo is not:

> “Here are four model answers.”

It is:

```text
User pastes an AI URL
        ↓
logs in themselves
        ↓
clicks three webpage elements
        ↓
TEST PASSED
        ↓
COUNCIL GATE ✓
        ↓
TAKE A SEAT
        ↓
second AI joins
        ↓
🔥 LIVE COUNCIL
        ↓
King asks one question
        ↓
real models challenge each other automatically
        ↓
one model visibly changes its mind
        ↓
minority report survives
```

That is the product story ChatChat should optimize for.

## Non-goals

ChatChat should not become:

- a credential harvesting service;
- a central proxy for user conversations;
- a generic arbitrary-page scraper;
- a system that guarantees debate always improves correctness;
- a fake consensus generator;
- a UI that labels unvalidated Providers as supported.

The open-source community should be able to make the palace bigger without making the trust boundary blurrier.
