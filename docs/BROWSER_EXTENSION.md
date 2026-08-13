# ChatChat Browser Extension

**You propose. Independent AIs consult as equals.**

ChatChat is designed to live beside the AI websites people already use. Instead of asking users to create another account or route conversations through a ChatChat server, the extension attaches to AI tabs that are already open in the browser.

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

Click the ChatChat toolbar action to open the Side Panel.

## Add AI participants

You can:

- open an AI website and choose **Attach current tab**;
- choose a discovered AI tab;
- paste an AI URL and let ChatChat open it;
- use Quick Open for recognized providers.

The current catalog recognizes:

- ChatGPT
- Claude
- Gemini
- DeepSeek
- Yuanbao / 元宝
- Tongyi / 通义
- Grok
- Qwen

Other ordinary `http/https` AI sites can still enter through the generic browser adapter flow.

Recognition is convenience, not a claim that a remote website will never change.

## One equal participant per AI origin

The primary consultation experience intentionally avoids duplicate weighted seats.

```text
ChatGPT      1 participant
Claude       1 participant
Gemini       1 participant
DeepSeek     1 participant
```

Opening five ChatGPT tabs does not make ChatGPT five times more authoritative.

This keeps the product focused on **independent AI sources consulting as peers**.

The default cap is 8 equal participants in one consultation.

## Teach a page

AI websites do not expose one universal DOM/API contract, so ChatChat has a small local Teach flow.

For each AI page, teach:

```text
1. Input / Composer
2. Send control
3. Response surface
```

The recipe stores element selectors, not the text of the user's conversations.

Then run **Verify participant**:

```text
connection test
   ↓
structured consultation handshake
   ↓
READY
```

Only verified participants can enter a real consultation.

## Start a consultation

Enter one User Proposal and choose **Start consultation**.

ChatChat automatically runs:

```text
Independent views
      ↓
Shared consultation
      ↓
Final positions
      ↓
Consultation outcome
```

The user does not need to resend a Round 2 prompt manually.

## What the AIs can do

The shared space contains structured events:

```text
Position
Challenge
Evidence
Support
Defense
Question
Revision
Concede
Uncertain
Final position
```

A participant can explicitly revise its own view after another participant supplies a better argument or evidence.

## No chair model

ChatChat does not appoint one model to write a privileged final verdict.

The outcome is calculated from the participants' own final positions, while different positions remain visible.

Theatrical UI is welcome; hidden hierarchy is not.

## Language

The Side Panel ships with:

- English
- 简体中文

The language can be switched at the top of the panel and is stored in extension-local storage.

## Permissions and privacy

The extension declares Provider origins as **optional host permissions**.

When you attach an AI origin, ChatChat asks the browser for access to that origin. It then communicates with the AI page using an isolated content-script bridge.

ChatChat itself has no relay server.

Online AI providers still receive the proposal and consultation context that ChatChat sends to their pages. Local-first means ChatChat does not add another central server in the middle.

## Development showcase

The production extension includes a deterministic showcase mode used by CI only:

```text
extension/sidepanel.html?showcase=consultation&lang=en
extension/sidepanel.html?showcase=consultation&lang=zh
```

It simulates three already-connected participants and runs the real Side Panel through:

```text
verify
→ independent views
→ open consultation
→ visible revision
→ final positions
```

This lets CI render the actual built interface in both languages without logging into real third-party accounts or publishing private conversations.

## Protocol

- English: [`CONSULTATION_PROTOCOL.md`](CONSULTATION_PROTOCOL.md)
- 中文: [`CONSULTATION_PROTOCOL.zh-CN.md`](CONSULTATION_PROTOCOL.zh-CN.md)
