# Provider Compatibility Matrix

ChatChat deliberately separates **catalog recognition** from **real runtime evidence**.

A Provider logo in the Full Room is not a compatibility claim. A successful URL detector is not a compatibility claim. Even one successful browser run is dated, environment-specific evidence — not permanent authority.

## Current evidence vocabulary

| Level | Meaning |
|---|---|
| Recognized | ChatChat maps the URL to a known Provider identity and clean start URL. |
| Auto-detected | ChatChat can automatically identify a usable conversation surface in the current Provider UI. |
| Auto-connected | The automatic connection handshake completes in the user's browser. |
| Protocol-ready | The structured ChatChat Consultation Gate succeeds and the participant becomes READY. |
| Gate B candidate | A fresh real consultation across 2+ distinct Provider hosts satisfies the Real Provider Proof structural rule. |
| Runtime-validated | A maintainer reviewed a dated Gate B candidate for a documented environment. |
| Officially supported | Maintainers intentionally document and maintain the Provider target. |

These are cumulative evidence levels, not synonyms.

**Teach / manual selector repair is not a compatibility level.** It remains an Advanced recovery path when automatic page recognition cannot recover from a Provider UI change.

## Built-in Provider catalog

The current catalog recognizes these first-class Provider entry points:

| Provider | Recognized host | Zero-config browser attempt | Runtime-validated environments | Official support status |
|---|---|---|---|---|
| ChatGPT | `chatgpt.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Claude | `claude.ai` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Gemini | `gemini.google.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| DeepSeek | `chat.deepseek.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Yuanbao · 元宝 | `yuanbao.tencent.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Tongyi · 通义 | `tongyi.aliyun.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Grok | `grok.com` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |
| Qwen | `chat.qwen.ai` / `qwen.ai` | Automatic page recognition + connection + protocol Gate | **No maintainer-reviewed Real Provider Proof committed yet** | Not claimed |

Recognition means ChatChat knows how to label the Provider and where to open a clean conversation. It does **not** mean the remote webpage is guaranteed to remain compatible with ChatChat's browser automation.

## What zero-config means

For the normal Full Room path, the user should only choose the AI team and handle Provider-owned login when required.

ChatChat then attempts:

```text
Provider URL
   ↓
optional site permission
   ↓
clean Provider conversation
   ↓
automatic page recognition
   ↓
automatic connection handshake
   ↓
structured Consultation Gate
   ↓
READY
```

If the Provider redirects to login, the Login Concierge explains the state. After the user signs in, ChatChat automatically resumes — no manual Retry button is required.

If an existing page map becomes stale, ChatChat first retries automatic page recognition before exposing Advanced repair.

## Custom URLs

Ordinary `http/https` AI pages can still enter the generic browser flow as a custom Provider.

ChatChat may attempt automatic detection and connection, but arbitrary websites are not promised to work. Provider-specific behavior can break generic automation through framework input handling, shadow DOM, canvas UI, generation controls, anti-automation behavior, unusual routing, or future UI changes.

When automatic recovery is exhausted, Advanced repair can still teach the local Composer / Send / Response mapping. That mapping stays local and is never part of public compatibility evidence.

## Real Provider Proof — preferred Gate B evidence

A fresh real Browser Consultation can generate **Real Provider Proof** after completion.

The Proof Pack records only compatibility metadata such as:

```text
Provider id + public host
page-map / connection / protocol / host / room booleans
run mode
real participant count
round count
event-kind counts
final-position count
zero-confidence final count
consensus ratio
minority-opinion flag
coarse duration
ChatChat version
environment label
```

It intentionally excludes:

```text
user proposal
model answers
structured event/message text
page mappings / selectors
profile keys
account identifiers
cookies / tokens / passwords / credentials
```

Use **COPY GITHUB MARKDOWN** to paste the reviewed evidence into a Provider compatibility issue, or copy the metadata-only JSON.

The versioned JSON schema remains:

```text
schemas/gate-b-proof-v1.schema.json
```

Full format and truth-boundary rules: [`GATE_B_PROOF.md`](GATE_B_PROOF.md).

### Synthetic UI evidence is not real acceptance evidence

ChatChat's CI can render a deterministic `demo-only` Real Provider Proof preview to test the UI. The live observer itself refuses to generate live Gate B evidence outside the actual `chrome-extension:` runtime.

A `gate-b-candidate` verdict therefore means a real browser run satisfied the structural evidence rule. It is still **not** an automatic Official Support badge.

## How a Provider earns Runtime-Validated

Preferred path:

1. Open ChatChat Full Room.
2. Let zero-config onboarding restore or plan a diverse AI team.
3. Grant only the requested optional Provider-site permissions.
4. Sign in on the Provider page if requested; let ChatChat resume automatically.
5. Confirm at least two distinct Provider sources become READY.
6. Run one fresh real Browser Consultation.
7. Confirm no participant fell back to uncertainty or a zero-confidence final position.
8. Review the generated **Real Provider Proof** privately.
9. Copy the privacy-safe GitHub Markdown.
10. Review it once more before posting it to the Provider compatibility issue.
11. A maintainer reviews the dated environment-specific evidence before changing the compatibility matrix.

A concise reviewed record can look like:

```text
Claude · claude.ai
ChatChat 0.9.x @ abc1234
Windows 11 / Chromium
Provider UI tested 2026-08-14
Auto-detected ✓ · Auto-connected ✓ · Protocol-ready ✓
Real Provider Proof: gate-b-candidate
```

If the Provider UI later changes and breaks automatic recognition, keep the old dated evidence as historical evidence and update the current status rather than rewriting history.

## Why the matrix stays conservative

ChatChat's most fun demo is several real AIs independently thinking, challenging one another, changing their minds, and reaching final positions in one browser room.

That is exactly why the compatibility page must stay boring and precise.

The project should be able to say both:

> “This is ridiculously fun when it works.”

and

> “Here is exactly what this browser run proved, on which environment and Provider UI date.”

That combination is much healthier than pretending constantly-changing third-party webpages are stable APIs.
