# Security Policy

ChatChat touches logged-in AI webpages inside local managed WebViews, so security/privacy reports deserve extra care.

## Please do not report secrets publicly

Do **not** put any of the following in a public issue, discussion or pull request:

- passwords;
- session cookies;
- OAuth codes;
- access or refresh tokens;
- authorization headers;
- private Provider chat content;
- account identifiers that are not needed to reproduce the issue;
- screenshots showing sensitive sidebars, billing pages or profile details.

If a vulnerability requires sensitive material, use GitHub's private vulnerability reporting / Security Advisory flow for this repository when available, or contact the repository owner privately through an established GitHub contact channel.

## High-priority areas

Please report issues involving:

- a Provider page obtaining unintended Tauri/native capabilities;
- ChatChat exposing one Provider Profile's cookies/session data to another Provider;
- traversal or collision between isolated Provider data directories;
- arbitrary JavaScript execution that can be controlled by untrusted Provider/page content;
- selectors or Teach Mode capturing passwords/secret values;
- broad page-content collection outside the user-taught response surface;
- SQL injection or unsafe local history/profile persistence;
- Council parser bypasses that allow arbitrary model JSON to become privileged app actions;
- cross-agent prompt text escaping its intended untrusted-data boundary;
- URLs escaping expected Provider-host checks during automated browser actions;
- secrets accidentally written to logs, screenshots or GitHub Actions artifacts.

## Current trust boundary

ChatChat is local-first, not offline-by-definition.

- ChatChat itself has no central relay server.
- Provider WebViews are remote untrusted content.
- Online Providers receive the prompts/content that the user elects to send to them.
- Provider pages should not receive ChatChat/Tauri remote capabilities.
- Login is performed directly on the Provider page; ChatChat does not ask users to paste passwords or cookies.
- Generic browser automation should operate only on the user-taught composer/send/response surfaces.
- Peer-model content is treated as untrusted discussion data before being passed to another model.

## Responsible disclosure

A useful private report includes:

```text
ChatChat commit/version
OS
Provider host (no account identifiers)
security boundary affected
minimal reproduction steps
expected behavior
actual behavior
sanitized logs or screenshots if safe
```

Please give maintainers a reasonable opportunity to investigate before publishing exploit details that could expose user accounts or local data.

## Compatibility bugs are usually not security bugs

A changed DOM selector, failed Test Speech, or Provider login redirect normally belongs in the Provider compatibility issue template.

Escalate it as security-sensitive when the failure crosses a privacy/capability boundary—for example, ChatChat reads unrelated account content, mixes Provider sessions, leaks a secret, or allows remote content to execute unintended privileged operations.
