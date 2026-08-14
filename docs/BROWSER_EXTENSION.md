# ChatChat Browser Extension

**You propose. Independent AIs consult as equals.**

ChatChat lives beside the AI websites people already use. It does not require a ChatChat cloud account and it does not relay AI conversations through a ChatChat server. Provider sessions remain in their own browser tabs while ChatChat coordinates a local, structured multi-AI consultation.

## Install from source

```bash
npm install
npm run build:extension
```

Then in Chrome / Chromium:

```text
chrome://extensions
→ Developer mode
→ Load unpacked
→ select dist-extension/
```

Click the ChatChat toolbar action. The primary action opens or focuses the **Full Room** directly. The Side Panel remains available as an optional compact controller; it is no longer a required trampoline into the main product.

## Zero-config room assembly

The normal path does not begin with selectors, adapters or setup forms.

```text
Open ChatChat
    ↓
find AI sources already open in the browser
    ↓
plan a small diverse starter team if more are needed
    ↓
request only the optional Provider origins required by that plan
    ↓
open clean Provider conversations
    ↓
automatic page recognition
    ↓
automatic connection handshake
    ↓
structured Consultation Protocol Gate
    ↓
READY
```

If the required site permissions have already been granted, later room assembly can proceed with zero setup clicks.

The built-in Provider catalog currently recognizes:

- ChatGPT
- Claude
- Gemini
- DeepSeek
- Yuanbao / 元宝
- Tongyi / 通义
- Grok
- Qwen

Recognition gives ChatChat a stable Provider identity and clean start URL. It is **not** a permanent compatibility promise for a remote website that can change at any time.

## One equal participant per AI origin

The primary consultation deliberately avoids duplicate weighted seats.

```text
ChatGPT      1 participant
Claude       1 participant
Gemini       1 participant
DeepSeek     1 participant
```

Opening five ChatGPT tabs does not make ChatGPT five times more authoritative. ChatChat gives each AI origin one equal seat, up to the current consultation participant cap.

## Provider login is a resumable state

Provider authentication belongs to the Provider, not to ChatChat.

If automatic connection lands on a login/authentication page, **Login Concierge** distinguishes that state from an ordinary ChatChat setup failure:

```text
Provider needs sign-in
      ↓
ChatChat shows Sign in / 去登录
      ↓
user signs in normally on the Provider page
      ↓
Provider page loads again
      ↓
ChatChat resumes automatically
      ↓
connection + protocol verification
      ↓
READY
```

No Provider password is entered into ChatChat. No manual Retry click is required after a normal login navigation.

## Bounded Provider self-healing

Remote AI webpages drift. ChatChat therefore has a deliberately narrow recovery ladder before it asks the user to repair a page manually.

```text
saved page map
   ↓ fails
automatic rediscovery
   ↓ fails
privacy-safe page inspection
   ├─ login required      → Login Concierge
   ├─ off Provider origin → fail closed
   ├─ user-owned tab      → never auto-navigate it
   └─ ChatChat-owned clean tab
          ↓
      one safe fresh-session reset
          ↓
      existing automatic resume controller
          ↓
      automatic rediscovery
          ↓
      Consultation Protocol Gate
          ↓
      READY or Advanced repair
```

Important boundaries:

- **User-owned AI tabs are never auto-navigated for self-healing.**
- Only a clean conversation originally created and managed by ChatChat may receive the one automatic fresh-session reset.
- Full Room and Side Panel share one service-worker recovery claim, so two open ChatChat surfaces cannot both reset the same Provider participant.
- One failed recovery attempt becomes `exhausted`; ChatChat does not loop or periodically refresh the Provider page.
- If the post-reset reconnect still fails, the normal failure state returns and Advanced repair becomes the fallback.

While recovery is active, the participant shows **SELF-HEALING / 自动修复中** rather than simultaneously claiming that setup has already failed.

## Advanced repair

Manual page teaching still exists, but it is now a recovery tool rather than the normal onboarding path.

Open **Advanced repair** only when automatic recognition and the bounded self-healing ladder cannot adapt to a changed Provider UI.

The local repair mapping identifies:

```text
1. message box / composer
2. send control
3. AI response surface
```

Those selectors stay local. They are not exported in Real Provider Proof and they do not contain the user's chat transcript.

After a complete local mapping, ChatChat runs the same automatic connection handshake and structured Consultation Protocol Gate before the participant becomes READY.

## Start a consultation

Enter one User Proposal and choose **Start consultation**.

ChatChat runs:

```text
sealed independent views
      ↓
shared structured consultation
      ↓
challenge · evidence · support · defense
      ↓
revision · concede · uncertainty when necessary
      ↓
final positions
      ↓
consultation outcome
```

The user does not manually resend a Round 2 prompt. Every Provider participant receives the same meeting mode/goal and participates under the same public protocol.

## No chair model

ChatChat does not appoint one AI to write a privileged final verdict.

The outcome is derived from the participants' own final positions. Different or minority positions remain visible when they survive the final round.

Theatrical UI is welcome; hidden hierarchy is not.

## Language

Full Room and Side Panel provide:

- English
- 简体中文

The language preference is stored in extension-local storage and is shared by the current browser product surfaces.

## Permissions and privacy

Provider origins are declared as **optional host permissions**. ChatChat requests site access only for Provider origins the user is actually connecting.

Provider page inspection and self-healing use only bounded local signals such as:

- whether the tab remains on the expected Provider origin;
- counts of visible password/login controls;
- counts of plausible composer candidates;
- a derived login/not-login classification.

Raw page URL/title may be used transiently inside the classifier, but they are not returned to the recovery controller. Prompt text, model response text, account identifiers, cookies, tokens and credentials are not part of the recovery state.

Online AI Providers still receive the proposal and consultation context ChatChat sends through their own pages. Local-first means ChatChat does not add a central relay server in the middle.

## Real Provider Proof

A fresh real Browser Consultation can freeze a **Real Provider Proof / 真实 Provider 验收** snapshot after completion.

It records privacy-safe compatibility metadata such as:

- Provider id + public host;
- page-map / connection / protocol / host / room readiness;
- real participant and event counts;
- rounds and final-position counts;
- uncertainty / zero-confidence fallback counts;
- coarse environment and ChatChat version.

It intentionally excludes the user proposal, model replies, event/message bodies, page selectors, account identifiers, cookies, tokens and credentials.

Only the actual `chrome-extension:` runtime may generate live Gate B evidence. HTTP CI/showcase pages can render only an explicit `demo-only` preview and can never masquerade as real Provider acceptance evidence.

See [`GATE_B_PROOF.md`](GATE_B_PROOF.md) and [`COMPATIBILITY.md`](COMPATIBILITY.md).

## Development browser evidence

The production extension contains deterministic showcase entry points used by CI. They exercise the built product without logging into third-party accounts or publishing private conversations.

Examples include:

```text
app/app.html?showcase=consultation&lang=en
app/app.html?showcase=zero-config&lang=zh
app/app.html?showcase=login-concierge&journey=resume&lang=en
app/app.html?showcase=provider-self-healing&journey=resume&lang=zh
app/app.html?showcase=real-provider-proof&lang=en
```

The CI gates separately verify:

- zero-config fresh Full Room;
- Login Concierge and login → automatic resume → READY;
- Provider self-healing, one navigation maximum, exhausted recovery, and user-owned-tab safety;
- Real Provider Proof UI as `demo-only` evidence;
- the full bilingual consultation product.

These deterministic runs are regression evidence, not substitutes for the real signed-in two-Provider v1 Gate B acceptance run.

## Protocol

- English: [`CONSULTATION_PROTOCOL.md`](CONSULTATION_PROTOCOL.md)
- 中文: [`CONSULTATION_PROTOCOL.zh-CN.md`](CONSULTATION_PROTOCOL.zh-CN.md)
