# ChatChat Test Speech / 试奏

v0.8 is the first execution harness that intentionally sends a visible user-approved test message to a real Provider page.

It is **not** automatic Council participation.

## Preconditions

A profile must have:

1. an open managed Provider WebView;
2. a complete local Adapter Recipe:
   - composer selector;
   - send selector;
   - response selector.

The user then sees and may edit the Test Speech message before clicking `试奏`.

## Execution scope

The main ChatChat window sends a structured request to Rust containing only:

- Provider profile id and expected origin;
- the three taught selectors;
- the explicit test message.

The UI cannot submit arbitrary JavaScript.

Rust validates message/selector size, verifies the command caller is `main`, verifies the Provider WebView is on the expected host, and then executes fixed host-owned scripts.

## Sequence

```text
capture taught response baseline
       ↓
write explicit message into taught composer
       ↓
dispatch input/change events
       ↓
wait briefly for UI state
       ↓
click taught send control
       ↓
poll taught response selector only
       ↓
changed + non-empty + stable for ~3 seconds
       ↓
TEST PASSED
```

The harness waits up to 120 seconds. It captures at most 100,000 characters from the latest matching response surface.

## What is read now?

Unlike the metadata-only Adapter Lab, Test Speech must read actual response text in order to verify a real round trip.

That read is deliberately scoped to the **response selector explicitly taught by the user**. The harness does not search `document.body.textContent` or inspect unrelated account/page content.

The captured test response is kept in the current UI state; v0.8 does not add it to Council history or mark the Provider profile READY.

## Why stable-text detection?

Generic websites do not expose one universal “generation complete” signal. v0.8 uses a diagnostic heuristic: the taught response must change from baseline and remain identical for four 750ms polls.

This is useful for testing but not sufficient for production Council turns. Provider-specific adapters can later replace this heuristic with better generation state signals.

## Framework caveat

The generic composer writer uses native input/textarea value setters plus `input`/`change` events, and contenteditable text + an input event. Some provider frameworks may require provider-specific event behavior.

That is exactly what Test Speech is meant to reveal: failure becomes a diagnosable adapter problem instead of a fake READY state.

## TEST PASSED != READY

A successful Test Speech proves only that one explicit message made a real browser round trip using the current local recipe.

The next step still needs a response parser / Council bridge that turns the provider's natural-language response into structured `CouncilContribution[]`, with appropriate prompts, error handling and phase semantics.
