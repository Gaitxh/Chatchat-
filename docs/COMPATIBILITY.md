# Provider Compatibility Matrix

ChatChat deliberately separates **catalog recognition** from **runtime support evidence**.

A green brand logo is not a compatibility claim.

## Vocabulary

| Level | Meaning |
|---|---|
| Recognized | URL maps to a known Provider identity in the built-in catalog. |
| Teachable | A user can create a local 3/3 Composer / Send / Response recipe. |
| Test-passed | One explicit real browser round-trip succeeds. |
| Council-ready | The structured Council Gate succeeds. |
| Runtime-validated | Real sealed → debate → final behavior was manually tested for a documented environment. |
| Officially supported | Maintainers intentionally document and maintain that Provider target. |

These levels are cumulative evidence, not synonyms.

## Built-in URL catalog

The v0.9/v1-readiness catalog recognizes these hosts so ChatChat can provide a name, icon/monogram and clean start URL behavior:

| Provider | Recognized host | Generic taught Browser Council Bridge | Runtime-validated environments | Official support status |
|---|---|---|---|---|
| ChatGPT | `chatgpt.com` | Available for local Teach/Test/Gate attempts | **No maintainer record committed yet** | Not claimed |
| Claude | `claude.ai` | Available for local Teach/Test/Gate attempts | **No maintainer record committed yet** | Not claimed |
| Gemini | `gemini.google.com` | Available for local Teach/Test/Gate attempts | **No maintainer record committed yet** | Not claimed |
| DeepSeek | `chat.deepseek.com` | Available for local Teach/Test/Gate attempts | **No maintainer record committed yet** | Not claimed |

This table should change only when there is real evidence. Do not turn a successful URL detector unit test into a Provider support badge.

## Custom URLs

Any `http/https` AI page may enter the generic flow as:

```text
custom.browser
```

That means ChatChat can attempt:

```text
isolated WebView
→ Teach 3/3
→ Test Speech
→ Council Gate
→ healthy seat
```

It does **not** mean arbitrary sites will work. A site may require a provider-specific adapter for framework input events, new-chat navigation, generation detection, shadow DOM, canvas UI, anti-automation behavior or other special cases.

## How a row earns Runtime-Validated

Use the GitHub **Provider compatibility report** form and include:

```text
Provider
host only
ChatChat version/commit
OS
Provider UI date tested
Invite
Login
Window Health
Probe
Teach 3/3
Test Speech
Council Gate
Fresh Session
Hybrid Council
LIVE Council (if tested)
sanitized notes
```

A maintainer can then add a concise row such as:

```text
Claude · claude.ai
ChatChat 0.9.x @ abc1234
macOS 15.x
Provider UI tested 2026-08-XX
Teach PASS · Test PASS · Gate PASS · Hybrid PASS · Live PASS
```

If the Provider UI later changes and breaks the recipe, keep the old dated evidence but mark current status accordingly. Compatibility with remote webpages is time-sensitive.

## Why the matrix is intentionally conservative

ChatChat's most viral demo will probably be two or more real models arguing in LIVE COUNCIL.

That is exactly why the compatibility page must be boring and specific.

The project should be able to say both of these sentences at the same time:

> “This is ridiculously fun when it works.”

and

> “Here is exactly what we tested, on which OS, against which Provider UI date.”

That combination is healthier for an open-source project than pretending a constantly-changing third-party webpage is a stable API.
