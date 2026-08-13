# ChatChat Browser Extension — Side Panel + AI House

The browser extension is the easiest ChatChat entry point for people who already use multiple AI websites in Chrome/Chromium.

Instead of opening a second embedded browser and logging into every provider again, the extension opens ordinary browser tabs in the user's current browser profile. Existing site login state is therefore naturally reused by the browser.

> ChatChat still does not read or export cookies, passwords or browser history.

## Load the development extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the repository's `extension/` directory.
5. Pin ChatChat if desired.
6. Click the ChatChat toolbar icon. Chrome opens the ChatChat Side Panel.

The current MVP targets Chromium browsers with Manifest V3 Side Panel support.

## First Provider

In the Side Panel:

```text
+ 添加
→ choose ChatGPT / Claude / Gemini / DeepSeek / 元宝 / Qwen / Grok
  or enter any http/https AI URL
→ 设置
→ 连接
```

`连接` is the moment ChatChat asks Chrome for that site's host permission.

The manifest keeps provider origins in `optional_host_permissions`; installing ChatChat does not immediately grant access to every site.

ChatChat then opens a normal provider tab. If that browser profile is already logged in, the site's existing login session is reused automatically. If not, the user logs in on the provider's own page.

## Teach once

Expand that Provider's setup row:

```text
Composer
Send
Response
```

For each item ChatChat activates the provider tab. The user clicks the corresponding page element.

The content bridge:

- refuses password fields;
- derives one DOM selector;
- stores the selector in extension-local storage;
- does not store page HTML;
- does not read arbitrary document body text.

A fresh chat page may legitimately contain zero response nodes before the first response. ChatChat therefore validates the Response selector syntax at fresh-session preparation time and waits for matching response content after a message is actually sent.

## Test Speech and Council Gate

Teach 3/3 is not enough.

```text
Teach 3/3
  ↓
Test Speech
  ↓
Council Gate
  ↓
Council Ready
```

Test Speech proves the current page + recipe can complete one normal browser round trip.

Council Gate sends a structured ChatChat handshake and requires the Provider to return a valid `CHATCHAT_COUNCIL_JSON` contribution whose stance is `READY`.

Runtime Test/Gate proof is intentionally reset after extension/browser restart because remote AI UIs can change independently of ChatChat.

## Roundtable vs AI House

A delegation is one Provider/model identity. A seat is one independent conversation/session sample.

Example:

```text
GPT delegation × 5
├─ GPT-1
├─ GPT-2
├─ GPT-3
├─ GPT-4
└─ GPT-5

Qwen delegation × 5
├─ Qwen-1
├─ Qwen-2
├─ Qwen-3
├─ Qwen-4
└─ Qwen-5
```

The current extension caps:

- 8 seats per delegation;
- 24 seats total.

These are resource-safety limits, not protocol limits.

## Independence rule

Multiple seats from one Provider are useful independent sessions/samples, but they are **not independent model sources**.

ChatChat keeps that distinction explicit.

Round 1 remains sealed even inside one delegation:

```text
GPT-1 cannot see GPT-2
GPT-2 cannot see GPT-3
Qwen-1 cannot see Qwen-2
...
```

During the open-council round every seat receives the same immutable Blackboard snapshot.

The model prompt explicitly says:

> Do not assume your delegation should vote together.

A GPT seat may support Qwen, challenge another GPT seat, revise because of Gemini, or remain a minority opinion.

The UI only computes delegation statistics **after** final positions exist.

## Delegation cohesion

If five GPT seats end as:

```text
3 × Tauri
2 × Electron
```

then:

```text
GPT cohesion = 60%
```

If five Qwen seats all select Tauri:

```text
Qwen cohesion = 100%
```

This is descriptive, not an instruction to coordinate.

## Temporary Council tabs

When the King convenes the House, ChatChat creates a fresh temporary tab for every seat.

All seats in one debate round use the same Blackboard snapshot, but the underlying webpage conversations are separate.

When the Council finishes, those temporary tabs are closed automatically.

Temporary tab ids are recorded in extension-local storage while a run is active. If the Side Panel/browser interrupts a run, the next ChatChat startup cleans up any surviving temporary Council tabs.

The Provider's setup/lab tab is separate and is not removed as part of Council cleanup.

## Permission model

The extension manifest requests:

```text
sidePanel
storage
scripting
```

Provider origins are optional host permissions requested individually at runtime.

The extension does **not** request:

```text
cookies
history
```

The content bridge executes only after the user grants the relevant provider host.

## Privacy boundary

There is still no ChatChat relay server.

```text
Browser
├─ ChatChat Side Panel
├─ local extension storage
├─ ChatGPT tab(s)
├─ Qwen tab(s)
├─ Gemini tab(s)
└─ ...
```

When a Provider takes a Council seat, that Provider receives the King's question and the Council context that ChatChat sends to it. Local-first means ChatChat itself does not add a central relay server; it does not mean remote AI websites are offline.

## Development validation

The main repository checks now include:

```bash
npm run check
npm test
```

Extension checks cover:

- JavaScript syntax;
- manifest JSON parsing;
- strict Council response parsing;
- sealed Round 1;
- same-snapshot debate rounds;
- invented event-id rejection;
- delegation split/cohesion behavior;
- explicit anti-herd prompt wording.

CI also renders `extension/sidepanel.html?demo=1` in headless Chromium and uploads a Side Panel screenshot artifact, so visual regressions are visible without logging into third-party AI websites.

## Product principle

The browser UI should feel light and obvious:

```text
Ask
→ choose your House
→ convene
→ watch disagreement
→ read the report
```

Teach/Test/Gate are necessary engineering controls, but they stay collapsed behind each Provider's **设置** control instead of dominating the first screen.

**The palace can be theatrical. The controls should feel calm.**
