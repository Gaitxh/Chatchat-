<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — one proposal, independent minds, shared reasoning" />

  <p><strong>Bring the AI tabs you already use into one local consultation.</strong><br />Ask once. Let every AI think independently, challenge claims, bring evidence, revise positions, and keep its own final view.</p>

  <p><em>A small, polite intellectual riot — with receipts.</em></p>

  <p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/BROWSER_EXTENSION.md">Browser Extension</a> · <a href="docs/CONSULTATION_PROTOCOL.md">Protocol</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & Issues</a></p>
</div>

---

## Three monologues are not a meeting

```text
ordinary multi-model UI             ChatChat

You → ChatGPT                        one proposal
You → Claude                             ↓
You → Gemini                         sealed opinions
                                         ↓
                                    shared Blackboard
                                         ↓
                              challenge · evidence · support
                                         ↓
                              machine source observations
                                         ↓
                                revision · concede
                                         ↓
                         outcome · minority views · replay
```

There is **no chair AI**, no forced unanimity, and no mysterious “the models agreed.” Every participant is an equal peer. The user proposes; ChatChat coordinates.

## Watch the room move

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat consultation product demo" /></p>

The Side Panel is not a scrolling wall of answers. It is a spectator view of the public, structured consultation:

**ROOM PULSE** shows current explicit positions and alignment.  
**LIVE MOMENTS** surfaces real clashes, evidence drops, concessions and revisions.  
**RELATIONSHIP MAP** draws only links backed by event IDs — prose mentions never invent influence.  
**CONSULTATION THEATER** replays exactly what happened after the meeting.

> Spectacle is allowed. Invented drama is not.

## A source enters the room. The room does not bow to it.

This is the kind of consultation ChatChat is built to make visible:

```text
R1 · SEALED

ChatGPT  → Browser Extension
Claude   → Web + Extension
Gemini   → Browser Extension

        ↓

R2 · OPEN CONSULTATION

⚔ ChatGPT → Claude
  “What evidence justifies maintaining two product cores?”

📎 Gemini → Blackboard
  Chrome extension permission documentation
  developer.chrome.com

        ↓

👁 CHATCHAT SOURCE OBSERVATION

SOURCE STATE        REACHABLE
PAGE DATE           2026-07-14
CONTENT FINGERPRINT sha256:…
BOUNDED EXCERPT     “Optional permissions can be requested…”

⚠ Reachable ≠ claim proven.

        ↓

🔎 ChatGPT challenges the evidence scope
   “This supports the permission mechanism,
    not the stronger adoption claim.”

        ↓

↻ Claude revises

Web + Extension
      ↓
Browser Extension

causedBy: Gemini evidence event
```

The same evidence can be **reachable, disputed, and influential at the same time**. Those are different facts, so ChatChat keeps them different.

Machine observations enter later rounds through a separate `TOOL_FACTS_JSON` channel. Every AI in the same round receives the **same bounded snapshot**. A tool result is data — never a privileged model and never a truth badge.

## Zero-touch for humans, strict underneath

A nontechnical user should mostly see:

```text
1 · Open the AI sites you already use
2 · Connect my discovered AIs
3 · Write one proposal
```

Underneath, ChatChat automatically tries to:

```text
find composer → find send action → discover reply surface
      ↓
short connection handshake
      ↓
structured Consultation Gate
      ↓
READY ✓
```

If an AI is on a login page, just sign in normally. When the tab finishes loading, ChatChat automatically resumes the connection flow. Manual selector teaching lives under **Advanced repair** only.

## Receipts, not vibes

<table>
<tr><td width="50%"><strong>🧠 Sealed first round</strong><br/>Natural disagreement is recorded before peer influence begins.</td><td width="50%"><strong>⚖️ Equal participants</strong><br/>No moderator model gets a privileged voice or private evidence feed.</td></tr>
<tr><td><strong>📎 Evidence Ledger</strong><br/>Who submitted a source, who challenged it, and whether it explicitly caused a revision remain separate facts.</td><td><strong>👁 Source Observation</strong><br/>Bounded title/date/excerpt/fingerprint observations describe what the page exposed — not whether a claim is true.</td></tr>
<tr><td><strong>↻ Changed minds with receipts</strong><br/>Strong influence requires explicit provenance such as <code>revision.causedBy[]</code>.</td><td><strong>📚 Frozen local history</strong><br/>Meeting events and evidence observations are replayed from local IndexedDB with zero automatic network requests.</td></tr>
</table>

## Pick how much of the meeting you want to watch

The Full Room includes three spectator modes that never change the underlying AI prompts:

```text
◌ Quiet   → proposal + outcome
◉ Live    → public positions + turning points
⚡ Arena   → relationship battlefield + stronger motion
```

Arena respects `prefers-reduced-motion`. “Room heat” means **interaction intensity**, not answer quality. 100% alignment still does not mean 100% truth.

## Quick start

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm install
npm run build:extension
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist-extension/`.

```bash
npm run check
npm test
npm run dev:web
```

See the [Browser Extension guide](docs/BROWSER_EXTENSION.md) and [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md).

## Trust boundaries

- Provider accounts remain in their own browser tabs.
- ChatChat has no relay server.
- Round 1 is independent by design.
- Majority support is not treated as truth.
- Source reachability is not treated as claim verification.
- New evidence origins require user-granted browser permission; already-permitted sources may be observed between rounds.
- Tool observations use bounded, credential-free fetches and are shared equally within a round.
- Broken event references are omitted, not guessed.
- Archive replay makes no Provider call and no automatic source re-check.

## On stage now

**Browser-first bilingual consultation · automatic AI-page setup · login auto-resume · Room Pulse · Live Moments · Relationship Map · Evidence Ledger · Source Observation · shared tool facts · Consultation Theater · local Consultation History · frozen evidence replay.**

The major real-world gate still ahead is [two-Provider Browser validation](https://github.com/Gaitxh/Chatchat-/issues/12): two genuinely signed-in AI websites completing one real-only consultation on a user machine.

## Human-led, AI-assisted

ChatChat is created and independently maintained by **Gaitxh**, with product ideation, interface and visual design, implementation, debugging, testing, and documentation assistance from **OpenAI's ChatGPT and Codex**.

Every direction and final change remains human-directed and reviewed. ChatChat is an independent open-source project and is **not sponsored, endorsed, or operated by OpenAI**.

---

<div align="center"><strong>One proposal. Independent minds. Shared reasoning.</strong><br /><sub>Evidence can matter without becoming authority.</sub></div>
