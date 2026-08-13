# ChatChat Browser Extension · Side Panel Council 👑🌐

The **Browser Side Panel is ChatChat's primary product surface**.

The web demo remains a lightweight playground. The older Tauri desktop runtime is kept as an experimental/power-user path, but desktop packaging is no longer a default release or pull-request gate.

Why this direction is so natural:

```text
Chrome / Edge / Chromium
  ├── ChatGPT tab        already logged in
  ├── Claude tab         already logged in
  ├── Gemini tab         already logged in
  ├── DeepSeek tab       already logged in
  ├── Yuanbao / Qwen / Grok / ...
  └── ChatChat Side Panel 👑
```

The browser is already the user's universal AI account container. ChatChat should reuse that reality instead of asking the user to maintain a second set of WebViews and login sessions.

The lowest-friction path into the Council is therefore:

```text
install extension
      ↓
open AI products normally
      ↓
login normally in the browser
      ↓
open ChatChat Side Panel
      ↓
SUMMON THE HOUSE / attach current AI tab
      ↓
Teach once → Test Speech → Council Gate
      ↓
👑 King's Command
      ↓
sealed → debate → final
```

ChatChat does not receive the user's password and does not create a second Provider account system.

## Why Side Panel

The Council lives beside the user's normal browsing context instead of replacing it.

The default surface is deliberately small and calm:

```text
ChatChat

You ask. They debate.

AI House
GPT     ×3   − +
Claude  ×2   − +
Qwen    ×4   − +

Parliament Mode
[ Free ] [ Committee ]

[ King's Command................ ]
[ Convene the House             ]

sealed  →  debate  →  final

House Verdict
Tauri
Seat Majority        11/16
Delegation Consensus  3/4

▸ Advanced · Teach / tabs / Blackboard
```

The first minute should feel like a decision tool. The entire parliament remains available underneath it.

## Permission model

The manifest does **not** request blanket install-time Provider access.

Provider access is declared through `optional_host_permissions` and requested when the user explicitly attaches or summons a Provider origin.

Example:

```text
https://chatgpt.com/*
```

This keeps installation understandable:

> ChatChat may interact with the AI sites the user chose to invite.

The extension uses browser capabilities for:

- Side Panel;
- extension-local storage;
- scripting/content-bridge injection;
- tab discovery/management;
- optional Provider-origin access.

## SUMMON THE HOUSE · 召集诸卿

If the user's browser already has AI tabs open, ChatChat can scan those tab URLs and propose catalog-recognized Providers in one shot.

Current catalog/discovery work includes entry points such as:

- ChatGPT;
- Claude;
- Gemini;
- DeepSeek;
- Grok;
- Tencent Yuanbao;
- Qwen / Tongyi.

Bulk summon is **attach-only**. It does not convert a recognized tab into a trusted seat.

Every new seat still needs:

```text
Recipe 3/3
→ Test Speech
→ Council Gate
→ admitted seat
```

An unknown/custom HTTP(S) AI page remains an explicit single-tab attach rather than an automatic bulk-summon candidate.

## One tab = one seat

The browser extension maps a Council delegate to a browser tab.

```text
GPT-01 → tab 104
GPT-02 → tab 117
GPT-03 → tab 131
```

Authentication cookies may be shared by the browser, but active conversation state is separated by tab/session.

ChatChat refuses the shortcut of drawing five seat cards on top of one live conversation and calling that `GPT ×5`.

## Adding seats

After the first Provider tab joins, the delegation row exposes:

```text
−  GPT ×1  +
```

`+` opens another Provider start tab and attaches it as a fresh delegate channel.

Repeated seats are independent sessions/samples, **not independent model sources**. ChatChat therefore keeps both:

```text
Seat Majority
Delegation Consensus
```

so GPT ×10 cannot silently masquerade as ten independent model families.

See [`AI_HOUSE.md`](AI_HOUSE.md).

## Free Parliament vs Committee Parliament

Free Parliament remains the default:

```text
🗣️ Free Parliament
all admitted seats discuss the same question directly
```

Large Houses can optionally use:

```text
🏛️ Committee Parliament
cross-Provider seats investigate different neutral dimensions
```

Built-in investigative lenses include:

- 📎 Evidence;
- 🛡️ Security & Privacy;
- 💰 Cost & Economics;
- 🧱 Engineering;
- 👥 User Experience;
- 😈 Counterexample;
- 📜 Requirements.

A committee is not a faction and does not prescribe a winner. The King's original question remains a separate `KING_QUESTION_JSON` field; committee metadata is explicit adjacent system context.

See [`HOUSE_COMMITTEES.md`](HOUSE_COMMITTEES.md).

## Teach Mode in a normal Provider page

The extension injects a small local content bridge only after the user grants that site's permission.

Teach Mode never scrapes the whole page into ChatChat.

For each Provider origin, the user teaches three elements:

1. Composer;
2. Send button;
3. AI response element.

The injected helper highlights the hovered target. The user clicks the desired element and ChatChat stores a local selector recipe.

Password fields are explicitly rejected.

Recipes are stored in extension-local storage and may be reused as DOM-location knowledge by seats on the same Provider origin.

## Community Recipes

A selector map can be copied/imported as a **Recipe Candidate**.

The rule is:

> **Share the map, not the passport.**

A portable recipe may contain public Provider origin and selectors. It may **not** carry login/session state, Test Speech evidence, Council Gate evidence, READY state, account data, cookies or tokens.

Import always means:

```text
selector hint imported
→ Test required again
→ Council Gate required again
```

## Test Speech and Council Gate

Before a browser tab can join a real Council it must pass two runtime checks.

### Test Speech

The current transport test asks for:

```text
CHATCHAT_READY
```

A completed Recipe is not the same as a working Provider transport.

### Council Gate

The Provider must also return a valid structured ChatChat Council envelope.

A passing tab does **not** grant readiness to another tab from the same Provider. Runtime admission is per seat.

## Council transport

The Side Panel uses the normal shared `CouncilOrchestrator` and wraps each admitted Provider tab as a `CouncilAgent`.

Each real Council session:

1. starts from the seat's configured Provider start URL;
2. waits for the taught recipe to become available;
3. sends the sealed Council prompt;
4. waits for the taught response element to change and stabilize;
5. parses the structured ChatChat Council envelope;
6. runs later debate rounds automatically;
7. asks each seat for a final position.

The King does not press Send again for Round 2.

## Failure behavior

A Provider tab may fail because:

- the site UI changed;
- a selector drifted;
- login expired;
- generation never stabilized;
- the model did not produce valid Council JSON;
- many parallel seats hit Provider rate limits.

The Council bridge exposes failure as `uncertain` / zero-confidence fallback rather than fabricating a position.

A graceful fallback is useful runtime behavior, but it does **not** count as Provider compatibility success in the Royal Proof Pack.

## Browser Royal Proof Pack

Completed Browser-only Councils can produce privacy-safe Gate B evidence using the same strict shared Proof Pack semantics.

The evidence may include:

- Provider id + public host;
- Recipe/Test/Gate/Host booleans;
- real participant count;
- rounds and event-kind counts;
- zero-confidence/uncertain counts;
- consensus metadata.

It deliberately excludes:

- King's question;
- model replies / Blackboard body text;
- selectors;
- tab ids/titles;
- account identifiers;
- cookies/tokens/passwords.

## Privacy boundary

There is no ChatChat relay server.

A Provider seat is still a remote AI webpage, so the King's prompt and relevant Council context sent to that seat are transmitted to that Provider through its normal webpage.

ChatChat extension-local state may include:

- taught selectors;
- attached tab ids for the current browser session;
- Council/House UI state.

It should never persist:

- passwords;
- cookies;
- auth tokens;
- unrelated sidebar/page contents.

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
chrome://extensions
→ Developer mode
→ Load unpacked
→ choose dist-extension/
```

Click the ChatChat toolbar action to open the Side Panel.

CI uploads `chatchat-browser-extension-unpacked` so contributors can test the exact packaged PR artifact.

## Release scope

**Primary first-release target:** Chromium Manifest V3 (Chrome/Edge and compatible Chromium browsers).

Default PR CI must validate the Browser product and must not wait for desktop bundle compilation.

The Tauri source remains in the repository as an experimental/power-user path. Desktop bundle workflows are manual and may evolve independently.

Firefox/WebExtension support should reuse the same Council/House core, but browser-specific sidebar and permission behavior must be validated before support is claimed.

> **One browser. Many logged-in AIs. One King.**
