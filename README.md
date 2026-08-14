<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — one proposal, independent minds, shared reasoning" />

  <p><strong>You submit one proposal. Then let a table of AIs run the meeting.</strong><br />In live mode, ChatChat sends consultation prompts to the actual AI browser tabs you are already signed into. Each participant answers independently first, then reads the same public meeting snapshot and keeps researching, challenging, answering, revising, or preserving disagreement.</p>

  <p><em>Not three answers side by side. A watchable, traceable, replayable consultation assembly — with visible proof that a round really reached a Provider tab.</em></p>

  <p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/BROWSER_EXTENSION.md">Browser Extension</a> · <a href="docs/CONSULTATION_PROTOCOL.md">Protocol</a> · <a href="docs/MEETING_SECRETARIAT.md">Meeting Secretariat</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & Issues</a></p>
</div>

---

## Start with the execution boundary

ChatChat now has two very different execution modes, and they **must not be confused**:

| Mode | Where Provider speech comes from | Purpose |
|---|---|---|
| **Live mode · LIVE PROVIDER TABS** | real `BrowserConsultationAgent → RUN_SPEECH → chrome.tabs.sendMessage(tabId)` into signed-in AI tabs | answer the user's real proposal |
| **Synthetic showcase · DEMO** | deterministic fixture under `?showcase=consultation`, including simulated tabs, READY states and meeting speech | reproducible CI / screenshots / UI and protocol evidence |

**Real Chromium is not the same thing as real Provider inference.** In the CI showcase, the browser, production build, React UI, Blackboard, provenance, Live Agenda and Open Issues are genuinely running. The words attributed to the models, however, come from a deterministic test fixture — not from live ChatGPT, Claude, Gemini, DeepSeek, Grok or other third-party model sessions.

Because of that, `?showcase=consultation` now always shows a prominent **SYNTHETIC SHOWCASE MODE — This is not a live AI consultation** warning. The proposal is locked to the fixed demo scenario, misleading provider-connect controls are hidden, and a synthetic prompt that no longer contains the fixed demo proposal is rejected instead of receiving the canned architecture story.

Live mode shows **LIVE PROVIDER RECEIPTS**. For each real Provider tab, ChatChat exposes whether the current consultation prompt was sent, the phase and round, response size, elapsed time, and transport failure state. These receipts prove **page I/O**; they do not expose or claim access to hidden chain-of-thought.

---

## Three monologues are not a meeting

Most multi-model interfaces stop here:

```text
You → ChatGPT
You → Claude
You → Gemini
```

The live ChatChat path is different:

```text
one user proposal
    ↓
real signed-in Provider tabs
    ↓
R1 · sealed independent opinions
    + Live Research Desk assigns research lanes
    ↓
shared Blackboard
    + Live Agenda explains why another round exists
    ↓
challenge · evidence · question · support · defense
    ↓
Peer Exchange Queue
    "who addressed whom, and who owes a response?"
    ↓
replyToEventId / targetEventId / causedBy
    ↓
Live Persuasion
    only explicit revision / concede becomes strong influence
    ↓
Open Issues
    "what still has no structured answer?"
    ↓
outcome · local replay · next consultation · shareable receipt
```

There is **no chair AI**, no privileged model, and no rule that turns a majority into truth. The user is the proposer; every AI is an equal participant; ChatChat coordinates the public protocol and deterministic views.

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat consultation protocol and product overview" /></p>

> The overview illustrates production capabilities. It is not a screenshot of one live third-party Provider meeting. CI replays those capabilities with a synthetic Provider fixture so browser evidence remains deterministic.

---

## 01 · Every AI has its own turn, but there is no hidden moderator

In live mode, each participant maps to a real browser Provider tab. `BrowserConsultationAgent` builds the consultation prompt for the current phase, executes `RUN_SPEECH` through the browser bridge, reads the Provider page response, and then parses it into structured events. If the first answer violates the schema, the same Provider gets one repair-format attempt; ChatChat does not invent a replacement answer.

The live UI shows public protocol facts, never private reasoning traces:

<table>
<tr><td><strong>LIVE PROVIDER RECEIPTS</strong><br/>Shows whether the real tab received the round prompt, returned a page response, how long it took, and how large the response was.</td><td><strong>Live Research Desk</strong><br/>Each AI receives a different investigation lane such as primary sources, strongest counterexample, or implementation constraints. Different work, equal authority.</td></tr>
<tr><td><strong>LIVE DISCUSSION STREAM</strong><br/>Reads the public argument / challenge / evidence / support / defense / revision / question events round by round.</td><td><strong>Peer Exchange Queue</strong><br/>Direct questions and targeted challenges do not disappear into a wall of text.</td></tr>
<tr><td><strong>Live Persuasion</strong><br/>Only canonical `revision.causedBy` / `concede` strong edges are shown as “who moved whom”.</td><td><strong>RELATIONSHIP MAP</strong><br/>Support, challenge, evidence, direct reply and revision edges all come from exact event IDs.</td></tr>
<tr><td><strong>Meeting Secretariat</strong><br/>Live Agenda explains why the meeting continues; Open Issues shows unresolved structured obligations.</td><td><strong>CONSULTATION THEATER</strong><br/>Replays public events and changed-mind provenance later without calling Providers again.</td></tr>
</table>

Peers in one batch read the same immutable public snapshot and work in parallel. A faster website does not gain more authority.

---

## 02 · How one AI really answers another

Direct replies are not inferred from prose.

```text
Claude → ChatGPT
question event: q-123

next public round:
ChatGPT → Claude
replyToEventId: q-123
```

`replyToEventId` must refer to a real peer event in the current public snapshot. Invented IDs, self-replies or invalid-phase provenance enter the existing repair path.

The **Peer Exchange Queue** treats direct requests as explicit response obligations:

```text
queued → target turn → answered
```

Only exact structured provenance clears the obligation. A third party answering instead, or prose saying “I answered Claude”, does not count.

---

## 03 · Persuasion needs receipts

**Live Persuasion** never decides that influence happened just because an AI wrote “good point”.

Strong influence comes from canonical event relationships such as:

```text
revision.causedBy: [evidence-event, challenge-event]
concede.targetEventId: peer-event
```

So a visible chain like:

```text
Gemini ── evidence ──▶ Claude
ChatGPT ─ challenge ─▶ Claude
                         ↓
                 Claude revision
```

exists because Claude's own structured revision names those source events, not because the UI guessed a story.

---

## 04 · The meeting knows why it is still running

The **Meeting Secretariat** is not a hidden chair and not another AI. It is a deterministic view over protocol state.

**Live Agenda** reasons include:

```text
sealed_start                 → independent first round begins
initial_debate               → sealed positions enter the shared snapshot
fresh_signal_follow_up       → new questions/evidence/revisions deserve another peer-visible round
minimum_debate_rounds        → the selected mode requires more open debate
alignment_not_reached        → descriptive stance alignment remains below threshold
finalizing_stable_alignment  → debate is stable and no fresh peer-response signal remains
finalizing_round_budget      → hard round boundary reached; disagreement remains visible
```

`fresh_signal_follow_up` carries exact `triggerEventIds`, so users can trace the reason back to the original Evidence / Challenge / Question.

See [`docs/MEETING_SECRETARIAT.md`](docs/MEETING_SECRETARIAT.md).

---

## 05 · Closing the meeting does not mean everything was resolved

**Open Issues** is derived from the public Blackboard event graph:

```text
?  direct question still lacks the addressed AI's explicit reply
⚔  targeted challenge still lacks a response from the claim owner
📎 targeted evidence is on the board but the target has not responded
≈  explicit uncertainty still lacks a higher-confidence revision
```

Similar prose does not clear an issue. A third party cannot answer on someone's behalf.

A meeting may therefore honestly end like this:

```text
leading stance: A
alignment: 75%
stop reason: round budget
still open: 1 direct question + 1 explicit uncertainty
```

Majority is descriptive information, not authority.

---

## 06 · Evidence can influence a view without becoming truth

ChatChat keeps different evidence facts separate:

```text
Is the source reachable?
What date signal does the page expose?
What bounded excerpt was observed?
Is the evidence still challenged?
Did a revision / concede explicitly name it as a cause?
```

The same Evidence can therefore be reachable, disputed, and influential at the same time. `reachable` never means “claim proven”.

`Evidence Gap Radar` finds source, date, dispute and provenance gaps. `NEXT MOVE` can stage those gaps as the next proposal, but it never auto-sends.

---

## 07 · Five meeting modes, research lanes in every consultation

<table>
<tr><td><strong>◉ Balanced</strong><br/>Allow disagreement and revision, then finish.</td><td><strong>🌿 Explore</strong><br/>Keep alternatives alive longer.</td><td><strong>⚖ Decide</strong><br/>Emphasize constraints, trade-offs and actionability.</td></tr>
<tr><td><strong>🔎 Verify</strong><br/>Push on sources, dates and factual scope.</td><td><strong>🧨 Stress Test</strong><br/>Seek the strongest counterexample and failure conditions.</td><td><strong>Research task ≠ authority</strong><br/>A Research Lane changes what to investigate, never participant status.</td></tr>
</table>

Balanced mode also receives Research Lanes; research is not a special-mode decoration.

---

## 08 · How to verify that the AIs were actually called

Live mode exposes **LIVE PROVIDER RECEIPTS**. For example:

```text
LIVE · PROVIDER TABS

Claude · claude.ai
DEBATE · R2
PROMPT SENT
3,842 prompt chars

→ RESPONSE CAPTURED
2,917 response chars
18.4 s
```

If page transport fails, the receipt shows **TRANSPORT FAILED**. Transport or structured parsing failure uses the existing uncertainty / zero-confidence fallback; it is not silently replaced by the synthetic fixture.

If the top of the room says:

```text
DEMO · SYNTHETIC
This is not a live AI consultation
```

then you are looking at a deterministic browser demo and should not use it as evidence that any third-party model researched your question.

---

## 09 · Take the whole meeting with you

A finished consultation can produce a local **Consultation Receipt** and a **Consultation Theater** replay from saved structured events.

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat local consultation receipt" /></p>

The record can show final positions, surviving minority views, challenge / evidence / revision counts, strong influence chains, exact peer replies, source observations and local Replay.

Replay makes no new Provider calls. Markdown copy and SVG export happen locally in the browser.

---

## Zero-config by default

The Full Room is the main product surface. A normal first run should feel like:

```text
1 · Click ChatChat
2 · Confirm browser site access once if asked
3 · Sign in normally to any AI that needs it; ChatChat resumes
4 · Write one proposal
5 · Confirm the top says LIVE · PROVIDER TABS
6 · Start the consultation
```

If at least two known AI sources are already open, ChatChat prefers them. If more are needed, it prepares clean dedicated sessions instead of hijacking the user's existing private AI conversations.

Provider accounts remain in their own browser tabs. ChatChat has no relay server. History and evidence snapshots remain local.

---

## What the browser / protocol gates actually prove

CI runs `?showcase=consultation` with **real Chromium + the production build + a synthetic Provider fixture**. It verifies that the following product surfaces and protocol relationships work together:

```text
sealed Round 1
+ Live Research Desk / Research Lane
+ challenge / evidence / revision
+ direct reply with replyToEventId
+ Peer Exchange Queue lifecycle
+ Live Agenda fresh_signal_follow_up + trigger event
+ Open Issues + source event
+ Live Persuasion strong moment + exact cause/change event ids
+ Relationship Map reply edge
+ visible synthetic-showcase warning
+ locked demo proposal
+ synthetic provider receipt
```

That is strong evidence for browser UI, provenance and lifecycle behavior. It **does not prove that third-party Providers generated the fixture speech inside CI**.

Additional workflows include **Zero-config UI, Login Concierge UI and Real Provider Proof UI**. Treat them as product-behavior gates; do not infer live third-party model reasoning from the workflow name alone.

README and demos are checked by `scripts/check-readme-product-truth.mjs`, `scripts/check-execution-boundary.mjs`, and `tests/demo-output.test.mjs`.

---

## Quick start

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm ci
npm run build:extension
```

Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and load `dist-extension/`.

```bash
npm run check
npm test
npm run demo
npm run dev:web
```

For live use, do not keep `?showcase=consultation` in the URL. If you see `DEMO · SYNTHETIC`, use **Exit demo for live provider mode**.

See the [Browser Extension guide](docs/BROWSER_EXTENSION.md), [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md), and [Meeting Secretariat](docs/MEETING_SECRETARIAT.md).

---

## Human-led, AI-assisted

ChatChat is created and independently maintained by **Gaitxh**, with product ideation, interface and visual design, implementation, debugging, testing, and documentation assistance from **OpenAI's ChatGPT and Codex**.

<div align="center"><strong>One proposal. Independent minds. Shared reasoning.</strong><br /><sub>A real browser does not make fixture speech real Provider inference; live Provider calls need live tab transport receipts.</sub></div>
