# Real Provider Manual Validation

ChatChat CI can compile the Browser Adapter host, but CI cannot sign into a user's external AI account or click a live Provider UI.

That creates two distinct quality gates:

```text
Gate A — CI
TypeScript + tests + Vite + Rust/Tauri compile

Gate B — User-local Provider validation
real login + taught recipe + explicit Test Speech
```

A Provider should not be treated as execution-verified until both gates pass.

## v0.8 Test Speech checklist

Run the Tauri desktop app:

```bash
npm install
npm run tauri:dev
```

Then, for one Provider:

1. `+ INVITE AI` and enter its URL.
2. Click `LOGIN`.
3. Sign in directly on the Provider page. Do not paste credentials into ChatChat itself.
4. Return to the Provider's normal chat page after any third-party OAuth flow.
5. Run `御前试音` and confirm the page probe succeeds.
6. Teach all three Recipe roles:
   - Composer
   - Send
   - Response
7. Confirm the profile shows `RECIPE 3/3`.
8. Review the visible Test Speech message.
9. Click `试奏`.
10. Watch the Provider WebView and confirm:
    - the test text appears in the intended composer;
    - the intended send control activates;
    - the Provider generates a new response;
    - ChatChat shows the same new response under `真实网页回复`;
    - the profile displays `TEST PASSED`.

## If Test Speech fails

Do not mark the Provider READY. Record which stage failed:

- composer selector no longer resolves;
- composer value appears but Provider framework does not recognize it;
- send selector is missing or disabled;
- send clicks but generation does not begin;
- response selector does not match the newly generated response;
- response changes but never reaches the generic stable-text heuristic;
- Provider navigates away from the expected host;
- timeout or callback error.

Re-teach a selector when the page layout changed. If the selector is correct but the generic writer/click/poll behavior is incompatible with the Provider framework, that is evidence that this Provider needs a provider-specific adapter operation rather than a more permissive generic scraper.

## What to report in a GitHub issue

Useful diagnostics:

- Provider name and URL host;
- OS and ChatChat version;
- which step failed (login / probe / teach / compose / send / response);
- taught selectors **only if they contain no private identifiers**;
- error text shown by ChatChat;
- whether the Provider page recently changed layout.

Do not post:

- passwords;
- session cookies;
- access tokens;
- private conversation content;
- personal account identifiers.

## Passing v0.8 still does not create a CouncilAgent

`TEST PASSED` proves that one explicit browser round trip works with the current local recipe. v0.9 must still add a structured Council bridge and phase-aware prompts before a real Provider is allowed to participate automatically in sealed/debate/final Council turns.
