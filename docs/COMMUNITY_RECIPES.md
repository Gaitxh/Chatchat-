# Community Recipe Candidates 🗺️

> **Share the map, not the passport.**

ChatChat's Teach Mode learns three local surfaces:

```text
Composer
Send
Response
```

Those selectors are useful to other users, but the fact that a selector worked once on one machine does **not** make another user's Provider login or Council session trusted.

Community Recipes therefore use a deliberately weaker object: **Recipe Candidate**.

## Candidate v1

```json
{
  "schemaVersion": 1,
  "providerId": "openai-chatgpt",
  "origin": "https://chatgpt.com",
  "composerSelector": "textarea[data-testid='prompt-textarea']",
  "sendSelector": "button[aria-label='Send message']",
  "responseSelector": "[data-message-author-role='assistant']",
  "testedAt": "2026-08-13",
  "notes": "Optional sanitized public note"
}
```

Schema:

`schemas/recipe-candidate-v1.schema.json`

## What is intentionally missing

A portable candidate has no fields for:

- local `profileId` / profile key;
- browser tab id;
- cookies or session storage;
- access tokens;
- username / account email;
- Provider response text;
- Test Speech status;
- Council Gate status;
- READY / seated status;
- arbitrary JavaScript adapter operations.

An imported candidate can only create fresh local `AdapterRecipe` data.

It cannot import trust because that trust is not represented in the schema.

## Import rule

```text
community candidate
      ↓
strict parser
      ↓
origin + provider identity check
      ↓
selector safety checks
      ↓
fresh local AdapterRecipe
      ↓
TEST REQUIRED
      ↓
COUNCIL GATE REQUIRED
      ↓
READY only after local runtime proof
```

The receiving user must still prove the page works in their own browser session.

## Safety checks

Candidate v1 rejects selectors that obviously look unsuitable for sharing:

- password-field selectors;
- `[value=...]` selectors;
- actual email/account-like strings embedded in selectors;
- obvious `Bearer ...`, `sk-...`, or JWT-like credential fragments;
- control characters;
- selectors longer than the protocol limit;
- unsupported extra JSON fields.

Known Provider origins are also bound to their catalog identity. For example, a candidate for `https://chatgpt.com` cannot relabel itself as `google-gemini`.

These checks do not prove a selector is safe in every possible DOM. Users should still inspect shared candidates before importing them.

## Portability score

Remote AI websites change often. ChatChat therefore gives selector portability a deterministic risk score rather than a magical compatibility badge.

Lower-risk signals:

- `data-testid` / `data-test`;
- semantic `role` / `aria-label`;
- short readable ids.

Higher-risk signals:

- `:nth-child(...)` / `:nth-of-type(...)`;
- long DOM paths;
- many CSS class dependencies;
- UUID/hash-looking generated ids or classes;
- very long selectors.

Results:

```text
0–20   STABLE
21–50  CAUTION
51–100 BRITTLE
```

The score is only UX guidance. **Test Speech is the runtime truth.**

## Compatibility vocabulary remains separate

A shared candidate may help a Provider become easier to teach, but it does not move the Provider automatically through ChatChat's compatibility levels:

```text
Recognized
   ↓
Teachable
   ↓
Test-passed
   ↓
Council-ready
   ↓
Runtime-validated
   ↓
Officially supported
```

A recipe committed by the community is still only a candidate until local runtime gates pass.

## Future repository shape

A future curated directory can look like:

```text
recipes/
├── chatgpt/
├── claude/
├── gemini/
├── deepseek/
├── yuanbao/
├── tongyi/
├── grok/
└── qwen/
```

Each file should carry a date and sanitized environment note because third-party Provider DOMs are time-sensitive.

The directory must remain boring evidence, not a marketing support matrix.

## Browser House behavior

When Browser Side Panel import/export arrives:

- one candidate can populate the local recipe for a Provider origin;
- every independent tab seat still performs its own Test Speech and Council Gate;
- importing a recipe resets/does not inherit runtime proof;
- the UI shows portability warnings before import;
- Custom Provider recipes remain explicit user choices.

This keeps the fast onboarding experience without confusing selector portability with authentication or model compatibility.
