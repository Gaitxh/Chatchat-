# ChatChat Browser Extension · Side Panel Council

The desktop app remains ChatChat's most controlled runtime.

The browser extension is the **lowest-friction door into the Council**:

```text
install extension
      ↓
open ChatGPT / Claude / Gemini / ... normally
      ↓
login normally in the browser
      ↓
open ChatChat Side Panel
      ↓
attach the current AI tab
      ↓
Teach once → Test Speech → add seats → convene
```

ChatChat does not receive the user's password and does not create a second Provider account system.

## Why Side Panel

The Council should live beside the user's normal browsing context instead of replacing it.

The Side Panel is deliberately small and calm:

```text
ChatChat

You ask. They debate.

AI House
GPT     ×3   − +
Claude  ×2   − +
Qwen    ×4   − +

[ King's Command................ ]
[ Convene the House             ]

sealed  →  debate  →  final

House Verdict
Tauri
Seat Majority       11/16
Delegation Consensus 3/4

▸ Advanced · Teach / tabs / Blackboard
```

The default view should never look like an operations dashboard.

## Permission model

The manifest does **not** request install-time `host_permissions`.

It declares Provider access as `optional_host_permissions`.

When a user explicitly attaches a Provider tab, ChatChat requests permission for that origin only.

Example:

```text
https://chatgpt.com/*
```

This keeps installation understandable and makes the relationship explicit:

> ChatChat may interact with the AI sites the user chose to invite.

The extension currently requests these core browser capabilities:

- Side Panel;
- extension-local storage;
- scripting injection;
- tab management;
- optional Provider-origin access.

## One tab = one seat

The browser extension maps a Council delegate to a browser tab.

```text
GPT-01 → tab 104
GPT-02 → tab 117
GPT-03 → tab 131
```

Authentication cookies may be shared by the browser, but active conversation state is separated by tab/session.

ChatChat refuses the conceptual shortcut of drawing five seat cards on top of one live conversation and calling that `GPT ×5`.

## Adding seats

After the first Provider tab joins, the delegation row exposes:

```text
−  GPT ×1  +
```

`+` opens another Provider start tab and attaches it as a new delegate channel.

The current implementation treats this as an **experimental fresh-tab channel**. Real compatibility still depends on the Provider's routing/UI behavior and must be tested.

## Teach Mode in a normal Provider page

The extension injects a small local content bridge only after the user grants that site's permission.

Teach Mode never scrapes the whole page into ChatChat.

For each Provider origin, the user teaches three elements:

1. Composer;
2. Send button;
3. AI response element.

The injected page helper highlights the hovered target. The user clicks the desired element and ChatChat builds a selector.

Password fields are explicitly rejected.

Recipes are stored in extension-local storage and can be reused by other seats on the same Provider origin.

## Test Speech

Before a delegation can join a live extension Council, its origin must pass a small Test Speech.

The current test asks for:

```text
CHATCHAT_READY
```

A completed Recipe is not the same as a working Provider transport.

## Council transport

The side panel creates the normal ChatChat `CouncilOrchestrator` and wraps each attached Provider tab as a `CouncilAgent`.

Each Council session:

1. navigates a seat to its configured Provider start URL;
2. waits for the taught recipe to become available;
3. sends the sealed Council prompt;
4. waits for the taught response element to change and stabilize;
5. parses the normal structured ChatChat Council envelope;
6. proceeds automatically into debate and final position.

The same typed Blackboard protocol is therefore used by desktop and extension modes.

## Failure behavior

A Provider tab may fail because:

- the site UI changed;
- a selector drifted;
- the Provider requires login again;
- the response never stabilized;
- the model did not produce valid Council JSON;
- the Provider rate-limited many simultaneous seats.

The Council bridge must expose failure as `uncertain` / zero-confidence fallback rather than fabricating a position.

## AI House in the extension

The extension is a natural host for multi-seat delegations:

```text
GPT ×5 = five GPT tabs
Qwen ×5 = five Qwen tabs
```

The final UI can show both:

```text
Seat Majority
11 / 16 Tauri

Delegation Consensus
3 / 4 Tauri
```

See [`AI_HOUSE.md`](AI_HOUSE.md).

## Privacy boundary

There is no ChatChat relay server.

However, a Provider seat is still a remote AI webpage. The King's prompt and Council context sent to that seat are transmitted to that Provider through its normal webpage.

ChatChat extension-local state includes things such as:

- taught selectors;
- attached tab ids for the current browser session;
- Council UI state.

It should never persist:

- passwords;
- cookies;
- auth tokens;
- full unrelated page/sidebar contents.

## Development install

Build:

```bash
npm install
npm run build:extension
```

The build creates:

```text
dist-extension/
├── manifest.json
├── service-worker.js
├── content-script.js
├── extension/sidepanel.html
└── assets/...
```

Then in a Chromium browser:

```text
Extensions
→ Developer mode
→ Load unpacked
→ choose dist-extension/
```

Click the ChatChat toolbar action to open the Side Panel.

CI also uploads `chatchat-browser-extension-unpacked` so contributors can test the exact packaged PR artifact.

## First-release scope

The first extension target is Chromium Manifest V3 (Chrome/Edge and compatible browsers).

Firefox/WebExtension support should use the same core Council/House logic, but browser-specific sidebar and permission behavior should be validated separately rather than claimed in advance.
