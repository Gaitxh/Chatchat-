<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — one proposal, independent minds, shared reasoning" />

  <p><strong>You submit one proposal. Then let a table of AIs run the meeting.</strong><br />ChatChat assembles equal participants that think independently, split research work, challenge claims, bring evidence, ask each other direct questions, publish traceable replies, revise positions, and leave unresolved issues visible instead of polishing them away.</p>

  <p><em>Not three answers side by side. A watchable, traceable, replayable AI consultation assembly.</em></p>

  <p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/BROWSER_EXTENSION.md">Browser Extension</a> · <a href="docs/CONSULTATION_PROTOCOL.md">Protocol</a> · <a href="docs/MEETING_SECRETARIAT.md">Meeting Secretariat</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & Issues</a></p>
</div>

---

## Three monologues are not a meeting

Most multi-model interfaces stop here:

```text
You → ChatGPT
You → Claude
You → Gemini
```

ChatChat now runs a different chain:

```text
one proposal
    ↓
automatic equal AI team + clean consultation sessions
    ↓
R1 · sealed independent opinions
    + Live Research Desk assigns distinct research missions
    ↓
shared Blackboard
    + Live Agenda explains why another round exists
    ↓
challenge · evidence · question · support · defense
    ↓
Peer Exchange Queue
    “who directly addressed whom, and who owes a response?”
    ↓
replyToEventId / targetEventId / causedBy
    exact provenance for replies and changed minds
    ↓
revision · concede · surviving minority
    ↓
Open Issues
    “which structured concerns still have no explicit response?”
    ↓
outcome · local replay · next move · shareable receipt
```

There is **no chair AI**, no privileged model, and no rule that turns a majority into truth. The user is the proposer; every AI is an equal participant; ChatChat coordinates the public protocol and deterministic meeting views.

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat real consultation meeting overview" /></p>

> The diagram above is not a future concept mock. It only depicts capabilities that exist in production code and are covered by the real Chromium product proof.

---

## 01 · Every AI behaves like a participant doing real work

The live room exposes several layers of activity, but these surfaces only read public structured facts. They do not expose or fabricate a model's private chain of thought.

<table>
<tr><td><strong>LIVE PARTICIPANTS</strong><br/>See who is independently analyzing, researching, responding, completed, or failed.</td><td><strong>Live Research Desk</strong><br/>Every AI receives a different research mission such as primary-source checks, strongest counterexamples, or implementation constraints. Different mission, equal authority.</td></tr>
<tr><td><strong>LIVE DISCUSSION STREAM</strong><br/>Read argument / challenge / evidence / support / defense / revision / question events round by round.</td><td><strong>Peer Exchange Queue</strong><br/>Direct questions, targeted challenges, and targeted evidence cannot disappear into the room. The addressed AI gets a next-round response obligation.</td></tr>
<tr><td><strong>RELATIONSHIP MAP</strong><br/>Support, challenge, evidence, direct replies, and explicit changed-mind links become traceable edges.</td><td><strong>Meeting Secretariat</strong><br/>Live Agenda says why the meeting continues; Open Issues says what still lacks an explicit structured response.</td></tr>
</table>

AIs in the same batch read the same immutable public snapshot and work in parallel. A faster website gets no extra authority, and no model becomes moderator because it sounds more confident.

---

## 02 · One real meeting chain

The current Chromium showcase exercises a flow like this:

```text
R1 · SEALED

ChatGPT  → Browser Extension
Claude   → Web + Extension
Gemini   → Browser Extension

Research lanes
ChatGPT  → verify the primary premise
Claude   → search for the strongest counterexample
Gemini   → inspect implementation constraints

        ↓

R2 · OPEN CONSULTATION

⚔ ChatGPT → Claude
  “What evidence justifies maintaining two product cores?”

? Claude → ChatGPT
  “If the extension becomes invisible plumbing, how should the Web Room
   recover when ChatGPT needs the user to sign in again?”

📎 Gemini → Blackboard
  developer.chrome.com

        ↓

Live Agenda
FRESH SIGNAL FOLLOW-UP
“The last public batch introduced new questions / evidence that peers could
not have seen inside that same parallel batch, so they get another response opportunity.”

        ↓

R3

↪ ChatGPT → Claude
  “The Web Room should expose only the recovery moment: open Provider login,
   detect READY, then resume the same consultation automatically.”

replyToEventId: Claude question event

🔎 ChatGPT keeps challenging the scope of Gemini's evidence
↻ Claude revises because of explicit public events
🤝 Other AIs may support the change or continue opposing it
```

A “direct answer” is not inferred from prose. `replyToEventId` must reference a real peer event in the current public snapshot. Invented IDs, self-replies, or replies in disallowed phases enter the existing structured repair flow.

That means one `Claude → ChatGPT → answer` exchange can simultaneously appear in:

- the Live Discussion Stream reply card;
- the Peer Exchange Queue lifecycle: `queued → target turn → answered`;
- a `reply` arrow in the Relationship Map;
- the exact source-event provenance panel.

That is peer consultation, not several models writing past each other.

---

## 03 · The room knows why another round exists

ChatChat's **Meeting Secretariat** is not a hidden moderator and not an extra AI. It is a deterministic view over the consultation protocol.

**Live Agenda** reasons come directly from the orchestrator, including:

```text
sealed_start                 → begin the mutually hidden first round
initial_debate               → sealed positions enter the shared snapshot
fresh_signal_follow_up       → new question / evidence / revision needs a peer response opportunity
minimum_debate_rounds        → the selected mode requires more public debate
alignment_not_reached        → descriptive stance alignment remains below the threshold
finalizing_stable_alignment  → stable alignment and no fresh peer-response signal
finalizing_round_budget      → the hard round boundary was reached without erasing disagreement
```

For `fresh_signal_follow_up`, the Agenda carries exact `triggerEventIds`, so the user can trace “why are we still debating?” back to the original Evidence / Challenge / Question rather than trusting a post-hoc explanation.

See the [Meeting Secretariat protocol](docs/MEETING_SECRETARIAT.md) for the exact rules.

---

## 04 · Closing the meeting does not mean everything was solved

**Open Issues** are derived directly from the public Blackboard event graph. ChatChat does not ask another model whether something “sounds resolved.”

These can remain open:

```text
?  direct question with no explicit response from the addressed AI
⚔  targeted challenge with no defense / concession / revision from the claim owner
📎 targeted evidence placed on the table but never addressed by the target participant
≈  explicit uncertainty with no later higher-confidence structured update
```

Prose such as “I already answered Claude” does **not** discharge an issue. A third party answering on someone else's behalf does not discharge it either. The shared structured-response rules require exact provenance.

So a meeting may finish like this:

```text
Leading position: Browser Extension first
Alignment: 80%

Still open:
- 1 unanswered direct question
- 1 challenged key claim
- 1 explicit uncertainty

Meeting stopped because: round budget reached
```

ChatChat leaves those gaps visible instead of hiding them behind a clean-looking consensus score.

---

## 05 · Evidence can change minds without becoming authority

When a source enters the room, ChatChat keeps different facts separate:

```text
Was the public source reachable?
What date signal did the page expose?
What bounded excerpt was observed?
Is another participant still challenging it?
Did a revision / concession explicitly cite it as a cause?
```

The same evidence can therefore be **reachable, disputed, and influential at the same time**. `reachable` never means “claim proven.”

The Evidence Gap Radar still finds missing source, date, observation, dispute, and evidence-chain signals. NEXT MOVE can turn those gaps into a staged follow-up proposal, but it only fills the proposal box and suggests a mode. **Nothing auto-sends.**

---

## 06 · Five meeting modes, research in every one

<table>
<tr><td><strong>◉ Balanced</strong><br/>Practical default: allow disagreement and revision, then finish.</td><td><strong>🌿 Explore</strong><br/>Keep more alternatives alive longer.</td><td><strong>⚖ Decide</strong><br/>Emphasize constraints, trade-offs, and usable recommendations.</td></tr>
<tr><td><strong>🔎 Verify</strong><br/>Push on facts, source scope, dates, and uncertainty.</td><td><strong>🧨 Stress Test</strong><br/>Search for strongest counterexamples and failure conditions.</td><td><strong>Research mission ≠ authority</strong><br/>Different Research Lanes are division of labor, never hierarchy.</td></tr>
</table>

Balanced also assigns Research Lanes. Research is now a default consultation capability, not a special effect reserved for verification modes.

---

## 07 · Take the whole meeting with you, not only the final sentence

A finished consultation can generate a local **Consultation Receipt**, and **Consultation Theater** can replay saved structured events without calling Providers again.

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat local Consultation Receipt" /></p>

You can inspect:

- final positions and surviving minority views;
- challenge / evidence / revision counts;
- explicit evidence → revision / concession influence chains;
- who answered whom and which exact public event was referenced;
- frozen source observations and evidence state;
- local replay with no automatic Provider calls.

Copy Markdown and SVG export happen locally in the browser. ChatChat uploads nothing on its own.

---

## Zero-config by default: users should not configure an AI meeting

The Full Room is the primary product surface. A normal first run should feel like:

```text
1 · Click ChatChat
2 · Confirm site access once if the browser asks
3 · Sign in normally to any AI that needs it — ChatChat resumes automatically
4 · Write one proposal
5 · Start the consultation
```

If two or more known AI sources are already available, ChatChat prefers them. If the room needs more participants, it prepares a small starter team in **dedicated clean consultation tabs** instead of hijacking the user's existing private AI conversations.

Page recognition → connection handshake → consultation readiness → login recovery are handled automatically. The toolbar opens or focuses the Full Room directly; Side Panel remains an optional compact controller. Selectors, manual URLs, and Teach tools stay under **Advanced repair**.

Provider accounts remain in their own browser tabs. ChatChat has no relay server. History and frozen evidence observations remain local; replay does not automatically call AIs again or use today's web page to rewrite yesterday's meeting.

---

## Real product gates

Production CI checks more than TypeScript. The bilingual real-Chromium showcase must observe, in the running product DOM:

```text
sealed Round 1
+ Live Research Desk / Research Lane
+ challenge
+ evidence
+ revision
+ direct reply with replyToEventId
+ full Peer Exchange Queue answer lifecycle
+ Live Agenda fresh_signal_follow_up + trigger event
+ Open Issues + source event
+ Relationship Map reply edge
```

Separate **Zero-config UI, Login Concierge UI, and Real Provider Proof UI** gates also run.

The README itself is now protected by `scripts/check-readme-product-truth.mjs`: these headline capabilities must map to production implementations and the Chromium proof, or product checks fail.

---

## Quick start

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm ci
npm run build:extension
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist-extension/`.

```bash
npm run check
npm test
npm run dev:web
```

See the [Browser Extension guide](docs/BROWSER_EXTENSION.md), [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md), and [Meeting Secretariat](docs/MEETING_SECRETARIAT.md).

---

## Human-led, AI-assisted

ChatChat is created and independently maintained by **Gaitxh**, with product ideation, interface and visual design, implementation, debugging, testing, and documentation assistance from **OpenAI's ChatGPT and Codex**.

<div align="center"><strong>One proposal. Independent minds. Shared reasoning.</strong><br /><sub>It can get noisy, people can change their minds, disagreement can survive — but relationships must be provable and majority is never authority.</sub></div>
