# Contributing to ChatChat

Thanks for helping build a place where independent AIs can disagree productively and consult as equals.

> **The interface may be playful; the protocol must stay sober.**

A contribution can be fun, visual and surprising. It still must preserve privacy, equal-participant semantics, structured event provenance and honest Provider compatibility claims.

## Start here

```bash
npm install
npm run check
npm test
npm run build:extension
```

The primary pull-request gate is the browser extension product. CI builds the Manifest V3 package and renders the real Side Panel in both English and Simplified Chinese.

The older desktop/Tauri source remains experimental and should not be treated as the primary contribution target unless a PR is intentionally about that legacy path.

## Product contract

The primary consultation experience follows these rules:

1. The user starts one proposal.
2. AI sources join as independent, equal participants.
3. One AI origin receives one equal participant slot in the primary mode.
4. Round 1 is sealed.
5. Later rounds use a shared immutable snapshot and publish one response batch.
6. There is no chair/leader/delegation with privileged authority.
7. Majority alignment is descriptive, not proof.
8. Revision and concession are progress.
9. Different final positions remain visible.

See [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md).

## Good contribution areas

### Consultation Protocol

Examples:

- better conflict detection;
- more precise evidence events;
- adaptive stopping rules;
- context compression;
- evidence verification;
- replay and influence graphs;
- better ways to surface unresolved disagreement.

Protocol changes should preserve Round 1 independence and typed Blackboard events.

### Browser Provider compatibility

There are two useful layers.

**Generic recipe improvements** help the taught content-script bridge locate or operate visible page surfaces without reading unrelated page content.

**Provider-specific adapters** are appropriate when a site needs framework-specific input behavior, generation completion detection, navigation, shadow-DOM handling or other logic that cannot be made generic safely.

Do not solve one Provider by making the generic bridge scrape more of every page.

### UI / Consultation Theater

Great contributions include:

- clearer challenge/revision animations;
- accessibility;
- better narrow Side Panel layouts;
- influence maps derived from event provenance;
- local replay;
- shareable but honest demo views.

The theatrical layer may celebrate a real event. It may not invent one.

## English + 中文

Primary Side Panel copy is international product UI.

New user-facing strings should normally be added to:

```text
src/i18n/index.ts
```

Keep English and Simplified Chinese in sync.

Machine-readable event kinds stay language-neutral.

See [`docs/INTERNATIONALIZATION.md`](docs/INTERNATIONALIZATION.md).

## Compatibility vocabulary

Use compatibility language precisely:

- **recognized** — URL maps to a catalog identity;
- **teachable** — the user can create a complete Input / Send / Response recipe;
- **test-passed** — one explicit real browser round-trip succeeded;
- **consultation-ready** — the structured consultation handshake succeeded;
- **runtime-validated** — a real multi-AI consultation was tested in a documented environment;
- **officially supported** — maintainers deliberately document and maintain that Provider target.

A URL detector is not a support badge.

## Privacy rules for Provider contributions

Do not commit or paste into public issues:

- passwords;
- cookies;
- access/refresh tokens;
- authorization headers;
- private chat transcripts;
- account emails/phone numbers;
- account-specific URLs;
- private sidebar screenshots;
- selectors containing private account/user identifiers.

If a bug requires sensitive reproduction material, use [`SECURITY.md`](SECURITY.md) instead of a public issue.

## Browser bridge security expectations

Provider pages are untrusted remote content.

Prefer:

- Manifest V3;
- optional per-origin permissions;
- isolated content scripts;
- narrow user-taught selectors;
- fixed extension-owned bridge operations;
- bounded message/response sizes;
- fail-closed behavior;
- treating peer-model text as untrusted discussion data.

Avoid:

- broad install-time access when runtime optional access works;
- arbitrary JavaScript supplied by UI/state;
- `document.body.textContent` scraping;
- reading cookies or web storage;
- reading password fields;
- trusting instructions embedded inside peer AI messages.

## Tests

Behavior changes should add the narrowest useful deterministic test.

Primary suites cover:

```text
Blackboard / orchestrator
Provider URL/catalog logic
Teach Mode
structured browser bridge
privacy-safe validation
bilingual equal-participant consultation semantics
```

The default CI also runs the real production Side Panel in deterministic showcase mode and asserts both languages render the consultation outcome.

## Pull requests

A strong PR explains the user experience, protocol/trust boundary and deterministic validation.

Primary Side Panel PRs should pass:

```bash
npm run check
npm test
npm run build:extension
```

Do not use screenshots from a private logged-in account when the deterministic CI showcase can demonstrate the same UI state safely.

## Provider compatibility reports

Use the **AI consultation compatibility** issue form.

Report only public/environment metadata such as:

```text
Provider name
public host
browser / OS
optional permission PASS/FAIL
Teach PASS/FAIL
connection test PASS/FAIL
structured protocol PASS/FAIL
real multi-AI consultation PASS/FAIL
sanitized notes
```

A PASS in one environment is useful evidence, not a universal guarantee.

## Design north star

```text
User proposes once
      ↓
participants think independently
      ↓
AI peers challenge one another
      ↓
evidence enters the shared record
      ↓
somebody may revise their view
      ↓
every participant submits a final position
      ↓
different positions remain visible
```

**One proposal. Independent minds. Shared reasoning.**
