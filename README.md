<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — one proposal, independent minds, shared reasoning" />

  <p><strong>Open the AIs you already use. ChatChat brings clean copies into one local meeting.</strong><br />Ask once. Watch independent AI participants challenge claims, drop evidence, change positions, and finish with their own final views.</p>

  <p><em>A small, polite intellectual riot — with receipts.</em></p>

  <p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/BROWSER_EXTENSION.md">Browser Extension</a> · <a href="docs/CONSULTATION_PROTOCOL.md">Consultation Protocol</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & Issues</a></p>
</div>

---

## Your first meeting: four moves

You do **not** configure selectors, adapters, APIs, model keys, or a ChatChat account.

| You | ChatChat |
| --- | --- |
| **1 · Open the AI sites you already use** and sign in normally. | Keeps scanning the browser for known AI sites. |
| **2 · Click the ChatChat extension icon.** | Opens the full-page **Web Room**. The compact Side Panel remains only as the local extension launcher / compatibility surface. |
| **3 · Press “Auto-assemble my AI team.”** | Requests the selected site permissions once, opens a **fresh conversation tab** for each AI, detects its message UI, runs the connection handshake, and checks the structured consultation protocol automatically. Your existing chats are not used for setup. |
| **4 · When 2/2 participants are READY, write one proposal.** | Runs the sealed first round, opens the shared consultation, keeps the public event ledger, and produces final positions + replay. |

If a Provider stops at a login screen, just finish that Provider's normal login. The Web Room watches the attached tab and automatically resumes setup after the page loads. **Manual Teach is an Advanced repair tool, not the normal onboarding path.**

```text
open / sign in to your AIs
          ↓
     click ChatChat
          ↓
      FULL WEB ROOM
          ↓
  Auto-assemble my AI team
          ↓
 fresh AI chats are created
          ↓
 detect → handshake → protocol check
          ↓
     ✓ READY   ✓ READY
          ↓
       your proposal
```

## Why a Web Room + an extension?

ChatChat deliberately uses both:

```text
┌────────────────────────────────────────────────────┐
│                 FULL-PAGE WEB ROOM                 │
│  proposal · AI roster · live room · evidence      │
│  relationship map · outcome · theater             │
└─────────────────────────┬──────────────────────────┘
                          │ local extension APIs
                    ┌─────▼─────┐
                    │ MV3 bridge │
                    └──┬──┬──┬──┘
                       │  │  │
                 ┌─────┘  │  └─────┐
                 ▼        ▼        ▼
             ChatGPT    Claude    Gemini   ...
             browser    browser   browser
               tab        tab       tab
```

The **Web Room** gives the meeting enough visual space to feel alive. The **Manifest V3 extension** is the local bridge that can work with the Provider tabs you are already signed into. ChatChat does not need a relay server to hold your AI account sessions.

## Three monologues are not a meeting

Most multi-model tools stop at parallel answers:

```text
You ── ask ChatGPT
You ── ask Claude
You ── ask Gemini
```

ChatChat creates an actual consultation:

```text
one proposal
    ↓
sealed independent opinions
    ↓
shared Blackboard
    ↓
challenge · evidence · support · defense
    ↓
explicit revision / concede
    ↓
final positions · minority views · replay
```

There is **no chair AI**, no forced unanimity, and no mysterious “the models agreed.” Each participant keeps its own identity and final position.

## Watch the meeting become a spectator sport

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="Three-act ChatChat consultation demo" /></p>

The live process is visible — but ChatChat does **not** expose or invent hidden chain-of-thought. It renders the public structured events that the consultation protocol actually produced.

| Live layer | What it means |
| --- | --- |
| **Room Pulse** | Current submitted positions, phase, public events, and alignment. Alignment is not truth. |
| **Live Moments** | Event-backed highlights such as **CLASH**, **EVIDENCE DROP**, **PLOT TWIST**, **CONCESSION**, and **LONE VOICE**. Empty events produce no fake drama. |
| **Room Heat** | Interaction intensity only — never answer quality. |
| **Relationship Map** | Directional AI-to-AI links only when explicit event references prove the relationship. Prose mentions do not create edges. |
| **Evidence Ledger** | Claim/source provenance, challenges, downstream revisions, and bounded public-source reachability checks. **Reachable does not mean true.** |
| **Blackboard** | The inspectable structured event stream behind the spectacle. |
| **Consultation Theater** | Post-meeting replay: who challenged whom, which evidence mattered, and which explicit event caused a revision. |

That distinction is core to ChatChat: **make the real consultation dramatic; never manufacture drama.**

## A changed mind should have receipts

A model saying “good point” is not enough. Strong influence is recorded only through explicit protocol provenance such as:

```text
Gemini evidence #18
        ↓
Claude revision #23
causedBy: [#18]
        ↓
Relationship Map edge
        ↓
Live Moment: RECEIPTS CHANGED A MIND
        ↓
Theater replay
```

Broken references are omitted, not guessed. Majority support never upgrades evidence into truth.

## Quick install

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm install
npm run build:extension
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist-extension/`. Then open the AI sites you use, sign in normally, and click the ChatChat extension icon.

For contributors:

```bash
npm run check
npm test
npm run dev:web
```

See the [Browser Extension guide](docs/BROWSER_EXTENSION.md) and [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md).

## Trust boundaries

- Round 1 is sealed and independent by design.
- Majority support is information, not authority.
- Provider account sessions remain inside their Provider/browser context.
- ChatChat requests Provider site access at runtime instead of installing with blanket host access.
- Fresh onboarding conversations keep automatic setup away from your existing chats.
- Public-source evidence checks omit credentials, are size/time bounded, and report reachability rather than truth.
- Structured public events may be visualized; hidden chain-of-thought is neither required nor fabricated.
- Local replay reads saved structured events and does not rerun the meeting.

## What is real today

**Shipping on `main`:** full-page Web Room, compact Side Panel compatibility launcher, bilingual zero-touch onboarding, automatic page detection and protocol verification, login auto-resume, sealed first round, Room Pulse, event-backed Live Moments, Room Heat, explicit Relationship Map, Evidence Ledger with bounded reachability checks, final reports, minority views, and Consultation Theater.

**Still being proved / expanded:** [real two-Provider Browser acceptance](https://github.com/Gaitxh/Chatchat-/issues/12), [persistent Consultation History](https://github.com/Gaitxh/Chatchat-/issues/57), [Community Recipes](https://github.com/Gaitxh/Chatchat-/issues/37), and deeper [Evidence verification](https://github.com/Gaitxh/Chatchat-/issues/53).

Deterministic CI showcases use synthetic browser/provider state to test the **real built UI without private accounts**. They are product regression evidence, not a claim that a live external Provider session ran in CI. Real signed-in Provider validation is tracked separately in Gate B.

## Human-led, AI-assisted

ChatChat is created and independently maintained by **Gaitxh**, with product ideation, interface and visual design, implementation, debugging, testing, and documentation assistance from **OpenAI's ChatGPT and Codex**.

Every change remains human-directed and reviewed. ChatChat is an independent open-source project and is **not sponsored, endorsed, or operated by OpenAI**.

---

<div align="center"><strong>One proposal. Independent minds. Shared reasoning.</strong><br /><sub>一个提案，多种独立思想，共同协商。</sub></div>
