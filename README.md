<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — one proposal, multiple independent minds, one traceable consultation" />

  <p><strong>You propose once. Then a table of AIs keeps the meeting going.</strong><br />In live mode, ChatChat sends consultation prompts into AI browser tabs you are already signed into. Every participant answers independently first, then reads the same public meeting snapshot and continues through research, challenge, evidence, direct replies, revision, concession, or unresolved disagreement.</p>

  <p><em>Not three answers side by side. A deliberative assembly you can watch, audit, replay, and use to prove who actually received which round, which public events were in the prompt, and which exact contributions reached the meeting.</em></p>

  <p><a href="README.zh-CN.md">中文</a> · <a href="docs/BROWSER_EXTENSION.md">Browser extension</a> · <a href="docs/CONSULTATION_PROTOCOL.md">Consultation protocol</a> · <a href="docs/MEETING_SECRETARIAT.md">Meeting secretariat</a> · <a href="docs/PROVIDER_ATTENDANCE_AUDIT.md">Provider attendance audit</a> · <a href="docs/MEETING_INTEGRITY.md">Meeting integrity</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & issues</a></p>
</div>

---

## Start with the most important boundary

ChatChat has two deliberately different execution modes, and **they must never be confused**:

| Mode | Where Provider answers come from | Intended use |
|---|---|---|
| **Live mode · LIVE PROVIDER TABS** | Real `BrowserConsultationAgent → RUN_SPEECH → chrome.tabs.sendMessage(tabId)` into browser tabs where the user is already logged in | Real user proposals |
| **Synthetic showcase · DEMO** | Deterministic fixtures under `?showcase=consultation` that simulate tabs, READY states, and meeting speech | Reproducible CI / screenshots / UI + protocol proof |

**Real Chromium is not the same thing as real Provider inference.** The showcase uses a real browser, the production build, the real React UI, Blackboard, provenance graph, Live Agenda, Conflict Board, Final Position Floor, and other production components. But the speech itself comes from deterministic fixtures, not from live ChatGPT, Claude, Gemini, DeepSeek, Grok, or Yuanbao sessions.

That is why `?showcase=consultation` permanently shows a prominent **SYNTHETIC SHOWCASE · this is not a live AI consultation** boundary, locks the fixed demo proposal, and hides connection actions that could make the fixture look like live Provider execution. If a synthetic prompt stops containing the fixed demo proposal, the fixture rejects it instead of pretending its canned story answers arbitrary user input.

Live mode now exposes two layers of execution evidence:

- **LIVE PROVIDER RECEIPTS** prove which real Provider tab received the round prompt, whether the page returned, response size, and elapsed time.
- **Provider Attendance & Execution Audit** follows the chain further: did the page response pass structured parsing or repair, and which exact event IDs were then published to the public Blackboard?

A returned webpage string is not automatically a completed meeting contribution. A turn becomes verified/repaired only after `response captured → structured parse → Blackboard publication`. This audits execution provenance; it does not inspect hidden model chain-of-thought.

---

## Three monologues are not deliberation

A typical multi-model interface stops here:

```text
You → ChatGPT
You → Claude
You → Gemini
```

ChatChat's consultation path is now:

```text
One user proposal
   ↓
real logged-in Provider tabs
   ↓
R1 · sealed independent positions
   + Live Research Desk assigns equal-power research lanes
   ↓
shared Blackboard
   + Live Agenda explains why another round exists
   ↓
challenge · evidence · question · support · defense
   ↓
Peer Exchange Queue
   “Who directly addressed whom, and who owes a reply next round?”
   ↓
replyToEventId / targetEventId / causedBy
   ↓
Conflict Board
   “What structural disputes actually exist?”
   + Conflict Resolution Ledger
   “Which response obligations are resolved, and by which exact event?”
   ↓
Explicit Stance Fronts
   “Inside this dispute, who explicitly stood where, and who only joined the pressure?”
   ↓
Live Persuasion
   only explicit revision / concede counts as strong influence
   ↓
Open Issues
   “What still lacks an explicit structured response?”
   ↓
Final Position Floor
   “What does the final report record for every seat, and did that Final really complete at the Provider?”
   ↓
Meeting Execution Integrity
   “How complete was Provider execution behind this result?”
   ↓
outcome · local replay · next consultation · shareable receipt
```

There is **no chair AI**, no privileged Provider, and no rule that turns the largest group into truth. The user is the proposer. Every AI is an equal participant. ChatChat coordinates public protocol and deterministic views.

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat consultation protocol and product overview" /></p>

> This overview describes capabilities that exist in production code. It is not a screenshot of one live third-party Provider meeting. CI reproduces the capabilities with deterministic Provider fixtures so the gates remain repeatable.

---

## 01 · Every AI gets its own turn, without a hidden chair

In live mode, every participant maps to one real browser Provider tab. `BrowserConsultationAgent` builds the structured consultation prompt for the current phase, executes `RUN_SPEECH` through the browser bridge, reads the Provider page response, and parses structured contributions. If the first response is malformed, the **same Provider** receives one format-repair attempt; ChatChat does not invent an answer to fill the seat.

Every consultation prompt also carries `SESSION_ID`, `ROUND`, `YOUR_ACTOR_ID`, and `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`. That lets ChatChat mechanically prove which already-public R1/R2 events were actually inside Claude's R3 prompt without pretending to know how Claude internally reasoned about them.

The meeting can feel alive while remaining epistemically conservative. The UI only exposes public structured facts, never fabricated private reasoning:

<table>
<tr><td><strong>LIVE PROVIDER RECEIPTS</strong><br/>Prove that a real tab received the round prompt and returned a page response.</td><td><strong>Provider Attendance Audit</strong><br/>Follows the response through parse / repair / fallback / Blackboard publication. Page I/O alone is not successful attendance.</td></tr>
<tr><td><strong>Live Research Desk</strong><br/>Each AI gets a different research lane — primary sources, strongest counterexample, implementation constraints, user failure modes — while keeping equal authority.</td><td><strong>LIVE DISCUSSION STREAM</strong><br/>Read argument / challenge / evidence / support / defense / revision / question round by round.</td></tr>
<tr><td><strong>Peer Exchange Queue</strong><br/>Direct questions, targeted challenges, and targeted evidence cannot disappear in the crowd.</td><td><strong>Conflict Board + Resolution Ledger</strong><br/>Organizes structural dispute threads and shows exactly which response obligations were resolved by which event.</td></tr>
<tr><td><strong>Explicit Stance Fronts</strong><br/>Only participant-authored stance/revision events create CURRENT / VACATED fronts and traceable movement.</td><td><strong>Live Persuasion</strong><br/>Only canonical `revision.causedBy` / `concede` influence becomes “who changed whom.”</td></tr>
<tr><td><strong>Meeting Secretariat</strong><br/>Live Agenda explains continuation; Open Issues exposes unresolved structured obligations.</td><td><strong>Final Position Floor</strong><br/>Reproduces final report seats and labels every Final as verified / repaired / fallback / unverified.</td></tr>
<tr><td><strong>Meeting Execution Integrity</strong><br/>Keeps Provider execution coverage next to the outcome so alignment cannot masquerade as correctness.</td><td><strong>CONSULTATION THEATER</strong><br/>Replays public events, explicit mind-changes, and exact influence provenance without calling Providers again.</td></tr>
</table>

Peers in the same batch read the same immutable public snapshot and work in parallel. A faster website does not gain authority, and a more eloquent model does not become chair.

---

## 02 · How AIs really answer one another

Direct answers cannot be inferred from prose.

```text
Claude → ChatGPT
question event: q-123

next public round:
ChatGPT → Claude
replyToEventId: q-123
```

`replyToEventId` must reference a real peer event visible in the current public snapshot. Invented IDs, self-references, or invalid-phase replies go through the structured repair path.

The Peer Exchange Queue models targeted requests as explicit response obligations:

```text
queued → target AI turn → answered
```

Only exact structured provenance closes the obligation. A third party answering, or prose saying “I already answered,” does not.

The **Conflict Resolution Ledger** preserves the same debt at the issue layer: which question / challenge / targeted evidence is still OPEN, which exact `replyToEventId / targetEventId / causedBy` event RESOLVED it, and how many obligations remained at the end of each round. That ledger is event-derived, not generated by a summary model.

---

## 03 · Persuasion needs a causal receipt

**Live Persuasion** does not treat “good point” as proof that persuasion succeeded.

Strong influence comes only from relationships the canonical influence graph can prove:

```text
revision.causedBy: [evidence-event, challenge-event]
concede.targetEventId: peer-event
```

So when the UI shows:

```text
Gemini ── evidence ──▶ Claude
ChatGPT ─ challenge ─▶ Claude
                         ↓
                 Claude revision
```

that story exists because Claude's own structured revision named those events as causes, not because the UI invented a narrative.

**Explicit Stance Fronts** adds another anti-inference rule: challenge, evidence, and support do **not** assign a participant to a camp. Only that participant's own stance-bearing events create membership. If Claude revises from `Web UI` to `Browser Extension`, the old front remains `VACATED`, the new one becomes `CURRENT`, and the revision plus `causedBy` IDs remain clickable. A participant who joined the pressure but never declared a stance appears explicitly as uncommitted instead of being guessed into a faction.

---

## 04 · The meeting knows why another round exists

ChatChat's **Meeting Secretariat** is not another AI and not a hidden chair. It is a deterministic view over protocol state.

Live Agenda continuation reasons come from the orchestrator:

```text
sealed_start                 → begin independent, mutually invisible Round 1
initial_debate               → move sealed positions onto a shared snapshot
fresh_signal_follow_up       → a new question/evidence/revision deserves a peer response opportunity
minimum_debate_rounds        → the selected mode requires more public discussion
alignment_not_reached        → descriptive stance alignment is below the mode threshold
finalizing_stable_alignment  → stable and no fresh response debt remains
finalizing_round_budget      → hard round boundary reached; surviving disagreement remains visible
```

`fresh_signal_follow_up` carries the actual `triggerEventIds`, so the user can trace back to the question, evidence, or revision that kept the meeting alive.

See [`docs/MEETING_SECRETARIAT.md`](docs/MEETING_SECRETARIAT.md) for the detailed rules.

---

## 05 · Closing the meeting does not mean every issue is solved

**Open Issues** is derived directly from the public Blackboard event graph:

```text
?  a direct question still lacks an explicit answer from its target
⚔  a targeted challenge still lacks a response from the owner of the challenged view
📎 targeted evidence is on the table but its target has not responded
≈  a participant explicitly remains uncertain without a later higher-confidence revision
```

Ordinary prose cannot clear the debt, and a third party cannot answer on someone else's behalf.

The **Conflict Board** does not use embeddings, prose similarity, or another “summary AI” to invent issues. Every conflict thread is anchored to a real Blackboard event and grows only through structured references such as `targetEventId / replyToEventId / previousEventId / causedBy`.

That allows a thread to say something like:

```text
Conflict thread: still OPEN
  ├─ 2 challenges
  ├─ 1 evidence event
  ├─ Claude explicitly revised
  └─ 1 direct response obligation still unresolved
```

“Somebody changed position” and “the issue is fully resolved” are different facts.

### Final Position Floor: where did every final seat actually land?

After the meeting, ChatChat keeps thread-local conflict fronts separate from meeting-wide final report accounting.

The **Final Position Floor** reproduces `CouncilReport.positions` using the same grouping contract as the orchestrator: `trim + lowercase`. It does not semantically merge labels such as `Web+Extension` and `Web + Extension`, and it never infers that challenging A means supporting B.

Every final report seat is paired with execution provenance:

```text
provider_final        → Final turn verified / repaired; Provider execution really closed
fallback_placeholder  → zero-confidence ChatChat failure placeholder after Provider Final failure
unverified_record     → not enough execution provenance to claim the Provider completed this Final
```

So **fallback seats remain in the existing report/outcome accounting, but they never masquerade as the model's own final judgment.**

The Final Floor also separates two different kinds of movement:

```text
explicit revision receipt:
Web UI → Browser Extension
revision event: r-17
causedBy: evidence-9

later verified Provider Final:
Browser Extension → Web + Extension
but no matching revision event
→ preserve the Final, explicitly mark “no revision receipt; no cause inferred”
```

If the Final is itself a fallback, it is **not** called a mysterious model stance change; the known cause is execution failure.

A meeting can therefore close honestly as:

```text
Leading stance: A
Alignment: 75%
Execution integrity: 11/12 Provider turns verified
Stop reason: round budget
Still open: 1 unanswered direct question
Final seats: 1 fallback placeholder
```

The largest group is descriptive information, not authority.

---

## 06 · Evidence can influence people without becoming truth automatically

Once Evidence enters the assembly, ChatChat keeps several facts separate:

```text
Was the source reachable?
What time signal did the page expose?
What bounded excerpt was observed?
Is somebody still challenging it?
Did a revision / concession explicitly name it as a cause?
```

That means one piece of evidence can simultaneously be **source reachable, still disputed, and explicitly influential**. `reachable` never means “claim proven.”

Evidence Gap Radar identifies source, date, dispute, and provenance gaps. NEXT MOVE can draft those gaps into the next proposal, but never auto-sends it.

---

## 07 · Five meeting modes, research lanes in every meeting

<table>
<tr><td><strong>◉ Balanced</strong><br/>Allow disagreement and revision, then form an outcome.</td><td><strong>🌿 Explore</strong><br/>Keep plausible alternatives alive longer.</td><td><strong>⚖ Decide</strong><br/>Emphasize constraints, trade-offs, and action.</td></tr>
<tr><td><strong>🔎 Verify</strong><br/>Push harder on sources, dates, and factual scope.</td><td><strong>🧨 Stress Test</strong><br/>Seek the strongest counterexamples and failure conditions.</td><td><strong>Research lane ≠ authority</strong><br/>Different assignments never change speaking or decision weight.</td></tr>
</table>

Balanced meetings also assign Research Lanes. Research is infrastructure, not a decorative feature reserved for a special mode.

---

## 08 · How to tell whether the AIs were actually called

Live mode shows **LIVE PROVIDER RECEIPTS**. For example:

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

But `RESPONSE CAPTURED` is no longer treated as successful attendance. The same turn continues into **Provider Attendance & Execution Audit**:

```text
Claude · DEBATE · R2
Prompt snapshot: 14 public event IDs
        ↓
Provider page returned
        ↓
structured parser passed
        ↓
2 Blackboard events published
        ↓
✓ VERIFIED
```

If the first structured response is malformed, the same Provider gets exactly one repair prompt and the turn can become `VERIFIED · REPAIRED`. If transport/page/parser fails, the turn is exposed as `FALLBACK` or `FAILED` rather than hidden behind an animation.

At close, the raw transport + parse / repair / fallback receipt is frozen locally alongside the consultation archive and Evidence sidecar. Opening a historical meeting reconstructs Attendance Audit from the **frozen execution receipt + frozen Blackboard events**, with **zero Provider calls**.

The outcome also carries independent **Meeting Execution Integrity**. Keep three different concepts separate:

```text
83% stance alignment
→ how many final report seats landed in the same stance group.

12/12 execution integrity
→ how many auditable Provider turns completed page response → parse → Blackboard publication.

answer correctness
→ ChatChat does not invent a percentage.
   12/12 complete and 100% aligned can still mean every model is wrong together.
```

If the transport fails, the UI shows **TRANSPORT FAILED**. If the top of the page says:

```text
DEMO · SYNTHETIC
No live AI is being called here
```

then it is a reproducible browser demo, not evidence that a live model researched the proposal.

See [`docs/PROVIDER_ATTENDANCE_AUDIT.md`](docs/PROVIDER_ATTENDANCE_AUDIT.md) and [`docs/MEETING_INTEGRITY.md`](docs/MEETING_INTEGRITY.md) for the audit contracts.

---

## 09 · Share the meeting, not just the last sentence

A completed meeting can produce a local **Consultation Receipt** and can be replayed through **Consultation Theater**.

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat local Consultation Receipt" /></p>

The receipt no longer exports only something like “83% aligned.” The on-page card, copied Markdown, and exported SVG also carry **Meeting Execution Integrity**: verified turns, complete seats, repair, fallback, failed, and unresolved counts. An execution-degraded meeting therefore cannot be silently washed into “full consensus” when it is shared elsewhere.

Historical receipts derive integrity from the execution sidecar frozen at close; they do not borrow today's page state to rewrite yesterday's meeting, and they do not call Providers again.

Replay also performs zero Provider calls. Markdown copy and SVG export remain local to the browser.

---

## Zero-config by default

Full Room is the primary product surface. A normal first-time user should mostly experience:

```text
1 · Click ChatChat
2 · approve site permissions when the browser asks
3 · if an AI is not logged in, log in normally; ChatChat resumes automatically
4 · write one proposal
5 · confirm the top says LIVE · PROVIDER TABS
6 · start the meeting
```

If the browser already has at least two known AI sources, ChatChat prefers them. If there are too few, it prepares a starter team and opens clean ChatChat-dedicated conversations rather than hijacking the user's private AI chats.

Provider accounts stay in their own browser tabs. ChatChat has no relay server. History, Evidence snapshots, and execution receipts stay local.

---

## What the browser UI / protocol gates actually prove

CI runs `?showcase=consultation` using **real Chromium + the production build + synthetic Provider fixtures**. The reproducible product evidence now covers:

```text
sealed Round 1
+ Live Research Desk / Research Lane
+ challenge / evidence / revision
+ direct reply with replyToEventId
+ Peer Exchange Queue lifecycle
+ Live Agenda fresh_signal_follow_up + trigger event
+ Open Issues + source event
+ Conflict Board + open / resolved obligations
+ Conflict Resolution Ledger + round trajectory
+ Explicit Stance Fronts: CURRENT + VACATED + movement + uncommitted
+ Live Persuasion strong moment + exact cause/change event IDs
+ Final Position Floor: leading + minority groups + Final execution provenance
+ explicit revision receipts kept separate from verified Final shifts without revision receipts
+ Meeting Execution Integrity
+ durable execution history replay
+ Relationship Map reply edge
+ synthetic showcase warning
+ locked demo proposal
+ synthetic Provider receipt
```

### Screenshot evidence no longer means merely “a PNG file exists”

Manual artifact review exposed a real CI blind spot: the old workflow could produce a **correct DOM dump while Full Room / live-frame PNGs contained only the page background**. `test -s screenshot.png` proved that bytes existed, not that the product was visible.

That evidence chain is now hardened:

1. Chromium is controlled through the **Chrome DevTools Protocol** in one page session.
2. The capture waits for the exact product-ready selector.
3. It waits two real paint frames.
4. PNG + `document.documentElement.outerHTML` are frozen from the **same page / same session**.
5. `scripts/check-png-content.mjs` decodes the PNG itself and checks sampled colors, channel range, and luma variance; a flat background fails.
6. `scripts/validate-product-evidence.mjs` validates the DOM semantics.
7. Final Position Floor also gets dedicated bilingual close-ups validated by `scripts/validate-final-position-evidence.mjs`, which requires explicit revision receipts and no-revision Final shifts to remain visibly separate facts.

So **real Chromium screenshot evidence** now means the production UI reached a proved state *and* the final PNG actually contains visible product pixels. It still does **not** turn synthetic fixture speech into live third-party model inference.

Separate Zero-config UI, Login Concierge UI, and Real Provider Proof UI workflows protect those product behaviors. Workflow names are not a license to reinterpret fixture/harness evidence as live model reasoning.

README and Demo remain constrained by `scripts/check-readme-product-truth.mjs`, `scripts/check-execution-boundary.mjs`, Conflict / Final Position Floor product guards, and deterministic tests.

---

## Quick start

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm ci
npm run build:extension
```

Open `chrome://extensions` or `edge://extensions`, enable Developer Mode, choose “Load unpacked,” and load `dist-extension/`.

```bash
npm run check
npm test
npm run demo
npm run dev:web
```

For real use, do not append `?showcase=consultation`. If the page says `DEMO · SYNTHETIC`, use the exit-demo control before submitting a real proposal.

More detail: [Browser extension guide](docs/BROWSER_EXTENSION.md), [Consultation protocol](docs/CONSULTATION_PROTOCOL.md), [Meeting Secretariat](docs/MEETING_SECRETARIAT.md), [Provider Attendance Audit](docs/PROVIDER_ATTENDANCE_AUDIT.md), and [Meeting Integrity](docs/MEETING_INTEGRITY.md).

---

## Human-led, AI-assisted

ChatChat was initiated and independently maintained by **Gaitxh**. During development, **OpenAI's ChatGPT and Codex** have assisted with product exploration, interface/visual design, implementation, debugging, testing, and documentation.

<div align="center"><strong>One proposal. Multiple independent minds. One traceable consultation.</strong><br /><sub>Alignment is not correctness. Execution integrity is not correctness. A real browser also does not make synthetic fixture speech live third-party inference.</sub></div>
