# ChatChat Real Demo Playbook 🎬

This is the recommended v0.9 recording flow. The goal is to show real state transitions, not a mocked marketing sequence.

## What the viewer should understand in 90 seconds

1. ChatChat has no central relay server.
2. The user brings their own AI website/account.
3. The user teaches ChatChat the page visually instead of writing selectors by hand.
4. One test message proves the browser path.
5. A separate structured Council Gate proves the AI can speak the Council protocol.
6. Two real advisors unlock a real-only automated Council.
7. The King speaks once; Round 2+ runs automatically.
8. Models are allowed to disagree and change their minds.
9. The final result preserves minority opinion and local history.

---

## Recording setup

Use the desktop runtime:

```bash
npm install
npm run tauri:dev
```

For the cleanest demo, prepare two AI Provider accounts you are comfortable showing on screen. Avoid exposing account email, billing, chat history, private sidebar items or sensitive browser data in the recording.

A practical first recording pair is any two Provider pages that successfully pass the local Teach/Test/Gate flow on your machine. Do not label a Provider as officially supported until you have actually validated it.

---

# 90-second script

## 0:00–0:08 — The throne room

Start on ChatChat with no live seats.

Point out:

```text
🎭 DEMO COUNCIL
NO CHATCHAT SERVER
```

The round table is visibly populated by mock advisors only.

## 0:08–0:16 — Summon a real advisor

Click:

```text
+ INVITE AI
```

Paste a real URL such as the Provider's new-chat landing page.

Show the automatic detection card. If it is a custom site, show that ChatChat still accepts it as `custom.browser`.

## 0:16–0:24 — User-controlled login

Click `LOGIN`.

The separate isolated Provider WebView opens.

Say/show:

> I log into the Provider directly. ChatChat does not ask me for my password or cookie.

After login, return to the chat page in that Provider window.

## 0:24–0:36 — Teach ChatChat

Click the three Teach controls one after another:

```text
✍️ 教我 Composer
➤ 教我 Send
💬 教我 Response
```

For each, click the matching element inside the real Provider WebView.

Back in ChatChat, the recipe should show:

```text
RECIPE 3/3
```

This is an especially strong visual moment because the audience can see ChatChat learn an unfamiliar page without hard-coded DOM selectors.

## 0:36–0:44 — Test Speech

Click `试奏`.

The visible test message is sent through the real page. When a stable response is captured from the taught response selector:

```text
TEST PASSED
```

Important narration:

> Test Passed still does not mean this AI gets a seat.

## 0:44–0:52 — Council Gate

Click:

```text
OPEN COUNCIL GATE
```

ChatChat sends a sealed-phase structured handshake. The Provider must return a legal `CouncilContribution` envelope with stance `READY`.

When it succeeds:

```text
COUNCIL GATE ✓
```

Then click:

```text
TAKE A SEAT
```

The real advisor appears on the round table with:

```text
LIVE WEB
```

The mode changes to:

```text
⚗️ HYBRID REHEARSAL
```

## 0:52–1:04 — Summon advisor #2

Repeat the already-prepared second Provider quickly.

As soon as the second real advisor takes a seat, linger on the mode transition:

```text
🔥 LIVE COUNCIL
```

The table now contains real web advisors only.

## 1:04–1:10 — The King speaks once

Use one of the built-in Demo Theater scenarios or type a question.

Click:

```text
LIVE 开廷
```

Do not touch the input again.

## 1:10–1:20 — Sealed opinions

Show:

```text
ROUND 1 · SEALED
```

Each real advisor receives the King's question independently.

Emphasize that peer outputs are not visible during this stage.

## 1:20–1:28 — The fight begins

The mode automatically transitions to:

```text
OPEN COUNCIL
```

Highlight event cards such as:

```text
⚔️ CHALLENGE
📎 EVIDENCE
🛡️ DEFENSE
🤝 SUPPORT
```

If a model revises itself, linger on:

```text
🔄 REVISION / CHANGED MIND
```

That is one of ChatChat's best shareable moments.

## 1:28–1:35 — The verdict

Show:

```text
Council Report
Consensus
Confidence
Minority Report
```

Then briefly show the Court Chronicle entry proving the event stream was archived locally.

End on:

> **You ask. They debate.**

---

# Demo scenario 1 — Architecture War

```text
我们要做一个 local-first、开源、跨平台的桌面 AI 工具。
请比较 Tauri、Electron 和原生开发，给出推荐方案；
如果你不同意其他智囊，请明确指出它们忽略了什么。
```

Good because:

- there are multiple defensible positions;
- technical facts and subjective tradeoffs can be separated;
- models often disagree on developer velocity versus footprint;
- revisions are plausible.

# Demo scenario 2 — Startup Council

```text
一个两人团队只有 6 个月 runway，要做面向开发者的 AI 产品。
应该优先做开源增长、付费 SaaS，还是本地优先桌面产品？
请从增长、现金流、护城河、执行风险四个角度互相质询。
```

Good because:

- no single factual answer dominates;
- different model styles become visible;
- minority opinions are useful.

# Demo scenario 3 — Evidence Trial

```text
Rust 是否真的比 Go 更适合构建高可靠的本地 AI 基础设施？
不要只讲偏好：请区分可验证事实、工程经验和主观判断，
并主动挑战没有证据的论点。
```

Good because it showcases the intended culture: challenge unsupported certainty.

---

# What not to fake

Do not edit a recording to imply:

- a Provider is READY before Council Gate succeeds;
- a custom site is officially supported just because Teach Mode can target it;
- a web login is local-only in the sense that the Provider does not receive data;
- evidence is independently verified when it only came from another LLM;
- all models reached consensus if a minority remains.

The fun comes from seeing the system actually work, including disagreement and occasional failure.

---

# Screenshot policy for the repository

CI generates a screenshot from the real production Vite build. Use that for general UI documentation.

For `LIVE COUNCIL` screenshots, capture them manually from a real local run after Gate B succeeds. Before committing one, inspect the image for account names, avatars, sidebar conversations, emails or other sensitive Provider data.

A good LIVE screenshot should show:

- `🔥 LIVE COUNCIL`;
- at least two `LIVE WEB` seats;
- one real Challenge or Revision event;
- no sensitive Provider-account UI;
- no claim that a provider is universally compatible beyond the tested configuration.
