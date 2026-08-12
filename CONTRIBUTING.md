# Contributing to ChatChat 👑🏛️

Thanks for helping build a place where AIs can disagree productively.

ChatChat is intentionally both theatrical and strict:

> **The UI can be theatrical; the protocol must stay sober.**

That means a fun contribution is welcome, but it must not blur privacy, Provider compatibility, or Council correctness.

## Start here

```bash
npm install
npm run check
npm test
npm run build:web
```

For desktop/Tauri work, also run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

For real Provider work, use the manual Gate-B checklist in [`docs/MANUAL_PROVIDER_TEST.md`](docs/MANUAL_PROVIDER_TEST.md).

## Good contribution areas

### Council Protocol

Examples:

- better conflict detection;
- more precise evidence events;
- convergence / stopping rules;
- context compression;
- judge / challenger roles;
- replay and persuasion graphs.

Protocol changes should preserve Round 1 sealing and typed Blackboard events.

### Provider compatibility

There are two useful layers.

**Generic recipe improvements** help the taught Browser Council Bridge locate or operate visible page surfaces without reading unrelated page content.

**Provider-specific adapters** are appropriate when a site needs framework-specific input behavior, generation completion detection, navigation, or other logic that cannot be made generic safely.

Do not solve one Provider by making the generic bridge scrape more of every page.

### UI / Demo Theater

Great contributions include:

- clearer challenge/revision animations;
- accessibility;
- responsive layouts;
- better local history exploration;
- shareable but honest demo views.

Never visually label a Provider `READY`, `LIVE`, or officially supported unless the runtime state actually justifies it.

## Compatibility vocabulary

Please use these terms precisely in issues, PRs and docs:

- **recognized** — URL maps to a catalog identity;
- **teachable** — user can create a 3/3 Adapter Recipe;
- **test-passed** — one explicit real browser round-trip succeeded;
- **council-ready** — structured Council Gate succeeded;
- **runtime-validated** — sealed/debate/final were manually tested on a real Provider configuration;
- **officially supported** — maintainers deliberately document and maintain that compatibility target.

`recognized ≠ supported` and `TEST PASSED ≠ READY` are project rules, not pedantry.

## Privacy rules for Provider contributions

Do not commit or paste into public issues:

- passwords;
- cookies;
- access/refresh tokens;
- authorization headers;
- private chat transcripts;
- account emails/phone numbers;
- private sidebar screenshots;
- selectors containing private account/user identifiers.

If a bug requires sensitive reproduction material, use the security process in [`SECURITY.md`](SECURITY.md) instead of a public issue.

## Browser bridge security expectations

Provider pages are untrusted remote content.

A Browser Adapter contribution should prefer:

- fixed host-owned scripts;
- JSON-encoded data passed into those scripts;
- narrow user-taught selectors;
- explicit host validation;
- bounded text/message sizes;
- fail-closed behavior;
- no remote Tauri capabilities for Provider pages.

Avoid:

- accepting arbitrary JavaScript from the UI;
- broad `document.body.textContent` scraping;
- reading cookies or web storage;
- reading password fields;
- treating peer-model text as trusted instructions.

## Tests

Every behavior change should add or update the narrowest useful test.

Current suites cover:

```text
Council Core
Provider URL/profile SDK
Teach Mode
Test Speech
Real Council Bridge
Provider Window Health
```

If a bug depends on a live third-party website, add deterministic tests for the local logic *and* document the Gate-B manual validation separately.

CI cannot replace real account testing.

## Pull requests

A strong PR explains:

1. what user-visible behavior changed;
2. which trust/privacy boundary is involved;
3. what CI can prove;
4. what still requires user-local Provider validation;
5. whether compatibility wording changed.

Keep `main` green. Prefer a focused PR over mixing unrelated protocol, UI and Provider experiments unless the feature genuinely crosses those layers.

## Sharing recipes

A future community recipe format is planned. Until it is stabilized, do not publish raw selectors that contain account-specific identifiers.

Useful recipe reports should include:

```text
Provider
host only
ChatChat version
OS
Provider UI date tested
Teach 3/3 status
Test Speech status
Council Gate status
Fresh Session status
Hybrid/Live status
sanitized notes
```

See the Provider compatibility issue template for the canonical checklist.

## Design north star

The best ChatChat contribution makes this moment more real:

```text
👑 User asks once
      ↓
🕯 independent opinions
      ↓
⚔ models challenge one another
      ↓
📎 evidence enters the record
      ↓
🔄 somebody changes their mind
      ↓
📜 minority opinion survives
```

Fun outside. Disciplined inside.
