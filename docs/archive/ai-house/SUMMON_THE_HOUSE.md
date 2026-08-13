# Summon the House 👑

`SUMMON THE HOUSE / 召集诸卿` is the fast path for people who already use several AI products in the same Chromium browser.

Instead of attaching every Provider tab one by one:

```text
open / logged-in AI tabs
        ↓
ChatGPT · Gemini · DeepSeek · Yuanbao · Tongyi · Grok · Qwen ...
        ↓
👑 SUMMON THE HOUSE
        ↓
one browser tab = one House seat
        ↓
group by Provider delegation
        ↓
Recipe / Test / Council Gate still required
```

## What the button scans

The bulk action considers ordinary `http/https` tabs but automatically selects **only catalog-recognized AI Providers**.

Current catalog examples include:

- ChatGPT — `chatgpt.com`
- Claude — `claude.ai`
- Gemini — `gemini.google.com`
- DeepSeek — `chat.deepseek.com`
- Tencent Yuanbao — `yuanbao.tencent.com`
- Tongyi — `tongyi.aliyun.com`
- Grok — `grok.com`
- Qwen — `chat.qwen.ai` / `qwen.ai`

An unknown/custom page is never silently bulk-attached. Use **当前标签页入席** for an intentional Custom Provider experiment.

## One click does not mean one trust bypass

Bulk summon performs only the boring setup work:

1. detect eligible open tabs;
2. request optional host permission for the detected Provider origins;
3. ping/inject the existing local content bridge;
4. create one session-local seat per actual tab;
5. group seats into Provider delegations;
6. reload the Side Panel.

It does **not** manufacture readiness.

Every new seat still starts without runtime proof and must pass the normal path:

```text
Teach Recipe 3/3
      ↓
Test Speech
      ↓
Council Gate
      ↓
READY seat
```

If a page is logged out, its UI changed, its recipe is stale, or its model cannot produce the Council envelope, validation fails normally.

## Independent seats

Bulk summon respects the House invariants:

```text
1 tab = 1 seat
16 seats max per delegation
64 seats max per House
```

Five existing ChatGPT tabs can therefore become `ChatGPT ×5`, but they remain five independent samples from one Provider source rather than five independent model families.

ChatChat reports both seat-level and delegation-level consensus so repeated sampling cannot masquerade as source diversity.

## Privacy / permission boundary

The extension still has no ChatChat relay server.

The bulk action requests origin access only after the user clicks **召集**. It does not request passwords, cookies, auth tokens, or unrelated page content.

The same content bridge used by normal single-tab attach remains responsible for Composer / Send / Response interaction.

## Deterministic showcase

CI has a special non-live page:

```text
extension/sidepanel.html?showcase=summon
```

It simulates seven **open tab metadata records** only:

```text
ChatGPT
Gemini
DeepSeek
Yuanbao
Tongyi
Grok
Qwen
```

No real account or Provider conversation is used.

The screenshot Gate asserts that the production Side Panel shows:

```text
SUMMON THE HOUSE
召集 7 席
新席位仍需 Test + Gate
```

and explicitly asserts that the fixture does **not** display a fabricated `COUNCIL GATE ✓` state.

## The intended real demo

On a browser that is already logged into several AI services:

```text
open the AI tabs normally
      ↓
open ChatChat Side Panel
      ↓
👑 召集诸卿
      ↓
seven tabs appear as seven seats
      ↓
Teach once per Provider origin
      ↓
validate each real seat
      ↓
🔥 convene a cross-provider House
      ↓
sealed opinions → debate → final
      ↓
Council Theater shows who influenced whom
```

The fun part should be one click. The trust checks should remain visible.
