<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="132" alt="ChatChat" />

# ChatChat

### **You propose. Independent AIs consult as equals.**

Bring the AI accounts already signed in to your browser into one local consultation.
Ask once. Let them think independently, challenge claims, share evidence, revise positions, and finish with their own final views.

[中文](README.zh-CN.md) · [Browser Extension](docs/BROWSER_EXTENSION.md) · [Consultation Protocol](docs/CONSULTATION_PROTOCOL.md)

</div>

---

## What is ChatChat?

Most multi-model tools look like this:

```text
You
 ├─ ask Model A
 ├─ ask Model B
 └─ ask Model C
        ↓
compare answers yourself
```

ChatChat turns those AI products into one **consultation conference**:

```text
                    USER PROPOSAL
                         │
                         ▼
              ┌────────────────────┐
              │   AI CONSULTATION  │
              └────────────────────┘
               GPT  Claude  Gemini …
                 │     │      │
                 └─────┼──────┘
                       ▼
             INDEPENDENT VIEWS
                 Round 1 sealed
                       ▼
              OPEN CONSULTATION
        challenge · evidence · support
        defense · question · revision
        concede · uncertainty
                       ▼
                FINAL POSITIONS
                       ▼
             CONSULTATION OUTCOME
        alignment + confidence +
        different positions preserved
```

There is **no chair model** and no privileged participant. Each AI source joins as an independent, equal peer.

> **Independent first. Equal throughout. Revise when the evidence earns it. Keep disagreement visible.**

---

## Browser-first

ChatChat's primary product is a Chromium Side Panel extension.

Your browser already contains the hard part: your normal AI sessions and logins.

```text
Chrome / Edge / Chromium
  ├── ChatGPT tab      signed in normally
  ├── Claude tab       signed in normally
  ├── Gemini tab       signed in normally
  ├── DeepSeek tab     signed in normally
  ├── Yuanbao / Tongyi / Grok / Qwen / …
  └── ChatChat Side Panel
```

ChatChat does not ask you to copy passwords, cookies, or session tokens into another service.

---

## The experience

### 1. Add AI participants

Open your usual AI websites, then attach them from the ChatChat Side Panel.

You can:

- attach the current AI tab;
- pick from discovered AI tabs;
- paste an AI URL;
- use Quick Open for recognized providers.

The built-in catalog currently recognizes entry points for:

**ChatGPT · Claude · Gemini · DeepSeek · Yuanbao · Tongyi · Grok · Qwen**

Ordinary custom `http/https` AI websites can also try the generic browser adapter flow.

### 2. Teach the page once

Web AI products do not share one universal DOM contract. For each site, ChatChat asks you to identify three surfaces:

```text
Input / Composer
Send
Response
```

Then **Verify participant** runs a connection test and a structured consultation handshake.

### 3. Write one proposal

A proposal can be a question, plan, claim, architecture decision, research problem, product strategy, or anything worth examining from more than one perspective.

Example:

> For an open-source, local-first multi-AI browser project, what should we prioritize first to maximize usefulness and adoption? Examine the trade-offs and challenge unsupported assumptions.

### 4. Start consultation

The rest is automatic:

```text
Independent views
      ↓
Shared consultation
      ↓
Final positions
      ↓
Outcome
```

You do not manually send Round 2.

---

## Equal AI participants

The primary consultation mode gives **one equal participant slot to each AI origin**.

```text
ChatGPT   1 participant
Claude    1 participant
Gemini    1 participant
DeepSeek  1 participant
```

Opening five ChatGPT tabs does not give ChatGPT five times the authority.

ChatChat is designed to compare and combine **independent AI sources**, not manufacture a majority by duplicating one provider.

A consultation currently supports up to **8 equal participants**.

---

## Round 1 is actually independent

The first views are sealed.

Every participant receives the same User Proposal without seeing the other AIs' answers. Only after the entire first batch finishes are those events published to the shared consultation space.

Later rounds follow a synchronous snapshot model:

```text
consultation snapshot N
        │
   ┌────┼────┐
   ▼    ▼    ▼
  AI A AI B AI C
   │    │    │
   └────┼────┘
        ▼
publish one batch
        ▼
snapshot N + 1
```

The fastest website does not get hidden first-mover authority.

---

## A shared space with structure

ChatChat does not store the meeting as only a stream of chat bubbles.

The shared Blackboard contains typed events:

```text
argument
challenge
evidence
support
defense
question
revision
concede
uncertain
final_position
```

That makes moments such as these explicit:

```text
Gemini challenges a claim
        ↓
Claude supplies evidence
        ↓
ChatGPT revises its position
        ↓
↻ CHANGED MIND
```

A revision is progress, not defeat.

---

## No chair model writes the verdict

ChatChat does not ask one AI to become a chairman and rewrite everyone else's views into a privileged final answer.

Each participant submits its own `final_position`.

The interface then shows:

- current alignment / consensus ratio;
- confidence;
- every participant's final position;
- explicit revisions;
- different/minority positions that remain.

If the AIs still disagree, ChatChat shows the disagreement.

---

## 中文 + English

ChatChat is international from the start.

The primary Side Panel ships with:

- **English**
- **简体中文**

Switch language from the header. The event protocol stays language-neutral, so future translations do not require a new consultation engine.

[中文 README](README.zh-CN.md)

---

## Local-first privacy model

ChatChat itself has **no relay server**.

```text
Your Browser
  ├── ChatChat Side Panel
  ├── extension-local configuration
  ├── ChatGPT tab ─────→ OpenAI
  ├── Claude tab ──────→ Anthropic
  ├── Gemini tab ──────→ Google
  └── other AI tabs ───→ their providers
```

There is no:

```text
User → ChatChat Server → AI Provider
```

The boundary is important: online AI providers still receive the proposal and consultation context that ChatChat sends to their webpages. Local-first means ChatChat does not add a central ChatChat server in the middle.

Provider-site access is requested as **optional host permission** when you choose to attach an AI origin.

---

## Install the browser extension

Requirements: Node.js 20+ and a Chromium browser.

```bash
npm install
npm run build:extension
```

Then:

```text
chrome://extensions
→ Developer mode
→ Load unpacked
→ select dist-extension/
```

Click the ChatChat toolbar action to open the Side Panel.

For contributors, CI also uploads the exact unpacked extension artifact built from each pull request.

[Full Browser Extension guide](docs/BROWSER_EXTENSION.md)

---

## How ChatChat talks to an AI tab

```text
ChatChat Side Panel
      │
      │ optional permission for the chosen AI origin
      ▼
isolated content-script bridge
      │
      ├─ taught input surface
      ├─ taught send control
      └─ taught response surface
      │
      ▼
existing signed-in AI webpage
```

The generic bridge is intentionally narrow. It does not need your password or authentication token.

Remote AI webpages and peer messages are treated as untrusted external content.

---

## Open-source architecture

```text
extension-public/
  manifest.json
  service-worker.js
  content-script.js

extension/
  sidepanel.html

src/
  consultation/     equal-participant semantics
  i18n/             English + Chinese product strings
  extension/        Side Panel product
  core/             Blackboard + orchestrator + event protocol
  provider-sdk/     URL catalog + Teach + structured bridge
  validation/       privacy-safe validation metadata
  theater/          influence/replay foundations
  history/          local event history foundations
```

The older experimental desktop/Tauri code remains in the repository, but the **browser extension is the primary product and default CI target**.

---

## Product principles

1. **The user proposes once.**
2. **Every AI participant is an equal peer.**
3. **Round 1 is sealed.**
4. **Accuracy over persuasion.**
5. **Majority is information, not authority.**
6. **Changing your mind is a feature.**
7. **Different final positions remain visible.**
8. **Browser first.**
9. **Local-first, not magically offline.**
10. **English and Chinese are first-class interfaces.**
11. **The UI may be playful; the protocol must stay sober.**

[Product principles](docs/PRODUCT_PRINCIPLES.md) · [Consultation protocol](docs/CONSULTATION_PROTOCOL.md)

---

## Contributing

ChatChat is built to welcome new AI websites, new languages, better consultation mechanics, influence/replay visualizations, and safer browser adapters.

```bash
npm install
npm run check
npm test
npm run build:extension
```

Primary Side Panel changes should keep English and Chinese in sync and preserve equal-participant semantics.

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

<div align="center">

**ChatChat — one proposal, many independent minds.**

---

## Assistance

This project was completed with the assistance of chatGPT and codex from **openai**.

MIT

</div>
