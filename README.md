<div align="center">
  <img src="assets/readme/chatchat-hero.svg" width="100%" alt="ChatChat — one proposal, independent minds, a traceable consultation" />

  <p><strong>Bring the AI tabs you already use into one local consultation.</strong><br />
  Ask once. Let every AI think independently, consult as an equal, challenge claims, share evidence, revise positions, and finish with its own final view.</p>

  <p><em>A small, polite intellectual riot — with receipts.</em></p>

  <p>
    <a href="README.zh-CN.md">简体中文</a>
    · <a href="docs/BROWSER_EXTENSION.md">Browser Extension</a>
    · <a href="docs/CONSULTATION_PROTOCOL.md">Consultation Protocol</a>
    · <a href="https://github.com/Gaitxh/Chatchat-/issues">Ideas & Issues</a>
  </p>

  <p>
    <img alt="CI" src="https://github.com/Gaitxh/Chatchat-/actions/workflows/ci.yml/badge.svg" />
    <img alt="Browser-first" src="https://img.shields.io/badge/browser--first-151922?style=flat-square" />
    <img alt="Local-first" src="https://img.shields.io/badge/local--first-267A4A?style=flat-square" />
    <img alt="Bilingual" src="https://img.shields.io/badge/English_%2F_简体中文-8B5CF6?style=flat-square" />
  </p>
</div>

---

## Three monologues are not a meeting

Most multi-model tools give you parallel answers:

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
report + minority views + traceable replay
```

There is **no chair AI**, no forced unanimity, and no mysterious “the models agreed.” Each participant keeps its own identity and final position.

## Watch the room think

<p align="center">
  <img src="assets/readme/demo-loop.gif" width="960" alt="Animated ChatChat consultation demo" />
</p>

The loop uses real product captures: independent seats, a shared Blackboard, a visible outcome, an explicit `Web + Extension → Browser Extension` revision, Consultation Theater, and a preview of local History replay.

<details>
  <summary><strong>Open the full Chinese product capture</strong></summary>
  <p align="center"><img src="assets/readme/consultation-zh.webp" width="440" alt="ChatChat Chinese browser consultation" /></p>
</details>

<details>
  <summary><strong>Open the full English product capture</strong></summary>
  <p align="center"><img src="assets/readme/consultation-en.webp" width="440" alt="ChatChat English browser consultation" /></p>
</details>

## What makes ChatChat different

<table>
  <tr>
    <td width="50%"><strong>🧠 Sealed first round</strong><br />Participants form an initial view before seeing anyone else. Diversity is measured before influence begins.</td>
    <td width="50%"><strong>⚖️ Equal participants</strong><br />No moderator model gets a privileged voice. ChatGPT, Claude, Gemini, and other seats speak through the same protocol.</td>
  </tr>
  <tr>
    <td width="50%"><strong>↻ Changed minds with receipts</strong><br />ChatChat never guesses persuasion from prose similarity. Strong influence appears only through explicit structured references such as <code>revision.causedBy[]</code> or <code>concede.targetEventId</code>.</td>
    <td width="50%"><strong>🏠 Local-first theater</strong><br />The browser extension coordinates the AI tabs already open on your machine. Saved-event replay does not call a Provider again.</td>
  </tr>
</table>

## How a consultation moves

```mermaid
flowchart LR
  U["Your proposal"] --> S["Sealed opinions"]
  S --> B["Shared Blackboard"]
  B --> D["Challenge · Evidence · Support"]
  D --> X["Revision / Concede"]
  D --> F["Final positions"]
  X --> F
  F --> R["Report + Minority views"]
  X --> T["Consultation Theater"]
  R --> L["Local replay / History"]
  T --> L
```

The theatrical layer may celebrate a real event. It may not invent one.

## Quick start

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm install
npm run build:extension
```

Then open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist-extension/`.

For development and validation:

```bash
npm run check
npm test
npm run dev:web
```

See the [Browser Extension guide](docs/BROWSER_EXTENSION.md) for Provider setup and the [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md) for event semantics.

## Trust boundaries

- Round 1 is independent by design.
- Majority support is not treated as truth.
- Interaction and successful persuasion are different things.
- Broken event references are omitted, not guessed.
- Provider accounts remain in their own browser tabs.
- Local replay reads saved events and makes no Provider call.

## On stage now — and next

**Now:** Browser-first bilingual consultation, structured Blackboard events, final reports, minority views, event provenance, Consultation Theater, and local replay.

**In active work:** persistent [Consultation History](https://github.com/Gaitxh/Chatchat-/pull/52) and an [Evidence Layer](https://github.com/Gaitxh/Chatchat-/issues/53) that separates “a source was supplied” from “the claim was actually verified.”

## Human-led, AI-assisted

ChatChat is created and independently maintained by **Gaitxh**, with product ideation, visual design, implementation, debugging, testing, and documentation assistance from **OpenAI's [ChatGPT](https://chatgpt.com/) and [Codex](https://openai.com/codex/)**.

Every change remains human-directed and reviewed. ChatChat is an independent open-source project and is **not sponsored, endorsed, or operated by OpenAI**.

---

<div align="center">
  <strong>One proposal. Independent minds. Shared reasoning.</strong><br />
  <sub>一个提案，多种独立思想，共同协商。</sub>
</div>
