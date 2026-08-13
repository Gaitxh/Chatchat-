# Browser House Gate B 👑🧾

The Chromium Side Panel uses the same **Royal Proof Pack** semantics as ChatChat Desktop.

The Browser path is intentionally implemented as an observer around the existing Council rather than a second Council engine.

## End-to-end flow

```text
real browser tabs
      ↓
Teach Recipe 3/3
      ↓
Test Speech PASS per independent tab
      ↓
Council Gate PASS per independent tab
      ↓
ready Browser Tab Delegates
      ↓
King asks once
      ↓
CouncilOrchestrator
sealed → debate → final
      ↓
post-run Provider-origin health check
      ↓
Royal Proof Pack
      ↓
COPY ISSUE MARKDOWN / COPY JSON
```

## The admission invariant

The Browser Side Panel filters seats before it constructs Council agents.

A tab seat is eligible only when:

```text
origin Recipe is complete
AND seat Test Speech == pass
AND seat Council Gate == pass
```

Therefore a participant that appears in a successfully returned Browser House `CouncilReport` has already crossed those two runtime gates in that Side Panel process.

The Browser Proof observer may use that admission fact to freeze:

```text
testPassed = true
councilGatePassed = true
```

**only for the exact participant seat ids returned by that Council.**

It still checks separately:

- a complete origin-level Recipe still exists;
- the participant seat can still be matched to browser-session storage;
- the tab still exists;
- the tab still ends on its expected Provider origin.

The shared Royal Proof Pack then applies the same global fail-closed rules as Desktop.

## Why this is not a trust shortcut

The observer does not scan arbitrary tabs and decide they are validated.

It starts from:

> “This exact seat was admitted into this exact Council by the existing ready-seat filter.”

If a future Browser Council path bypasses that ready-seat filter, it must not reuse the admitted-seat helper until it provides an equally strong admission invariant.

## Proof lifecycle

A Browser Royal Proof Pack represents the **most recent successfully completed observed Browser Council**.

At the start of every new Council:

```text
old Browser Proof → cleared immediately
```

Only after the new Council successfully returns does the observer freeze a replacement pack.

This prevents a failed new Council from leaving an old `GATE B CANDIDATE` visible as if it belonged to the current run.

## Observer failure is not Council failure

Proof capture is downstream of the Council result.

If storage, tab lookup, or proof generation fails:

```text
Council result stays valid
Proof observer logs a warning
no new proof is claimed
```

The historian may fail to write a certificate; it may not rewrite the vote.

## Provider-origin health

A Browser seat is healthy after the run only if its real tab is still on the expected Provider origin.

Examples:

```text
expected: https://chatgpt.com
current:  https://chatgpt.com/c/...      → healthy
current:  https://auth.openai.com/...    → unhealthy
current:  chrome://settings              → unhealthy
closed tab                              → unhealthy
```

An unhealthy row causes the shared Proof Pack to become `incomplete`.

## Shared Gate B candidate rule

The Browser path does not get a relaxed definition.

A candidate still requires, among other shared conditions:

- at least two real participants;
- a frozen Provider proof row for **every** real participant;
- Recipe/Test/Gate/Host/Seat all true;
- LIVE mode;
- all Council events from real participants;
- `uncertain = 0`;
- exactly one final position per real participant;
- no zero-confidence final;
- full expected round progression.

The Browser adapter changed the input source, not the release bar.

## Privacy boundary

The observer receives the real Council result briefly because it runs inside the local Side Panel process, but it stores only the already-sanitized `GateBProofPack`.

The stored/exported pack has no fields for:

- King's Command;
- Council/event body text;
- model response text;
- taught selectors;
- tab ids;
- tab titles;
- profile ids/keys;
- account email/name;
- cookies or tokens.

The visible Browser Proof panel consumes only that sanitized pack.

## Deterministic showcase

CI uses:

```text
extension/sidepanel.html?showcase=gate-b
```

The fixture supplies only a fake metadata-only proof object for:

```text
ChatGPT
DeepSeek
2 real participants
3 rounds
0 uncertain
2 final positions
```

It contains no real Provider account or conversation.

CI then renders the **real production Proof UI** and asserts machine-readable markers such as:

```text
data-proof-privacy="metadata-only"
data-proof-source="browser-house"
data-gate-b-verdict="gate-b-candidate"
data-gate-b-providers="2"
data-gate-b-rounds="3"
data-gate-b-uncertain="0"
```

This showcase proves the UI contract, not live Provider compatibility.

Real compatibility evidence still comes from user-local Gate B runs tracked in issue #12.
