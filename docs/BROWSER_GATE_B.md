# Browser House Gate B 👑🧾

The Chromium Side Panel uses the same **Royal Proof Pack** release bar as ChatChat Desktop.

## Flow

```text
real browser tabs
→ Recipe 3/3
→ Test Speech PASS per tab
→ Council Gate PASS per tab
→ ready Browser Tab Delegates
→ CouncilOrchestrator: sealed → debate → final
→ post-run Provider-origin health check
→ Royal Proof Pack
→ COPY ISSUE MARKDOWN / COPY JSON
```

## Admission invariant

The Side Panel only passes a seat into `CouncilOrchestrator` when its origin Recipe is complete and that independent tab has already passed Test Speech plus Council Gate in the current runtime.

Therefore the proof observer may infer `testPassed=true` and `councilGatePassed=true` **only for the exact Browser Tab Delegate ids returned by that Council**. It still checks Recipe completeness and post-run Provider-origin health explicitly.

## Proof lifecycle

At the start of every new Council the previous Browser Proof is removed immediately. Only a successfully completed new Council can freeze a replacement. A failed new run therefore cannot leave an older `GATE B CANDIDATE` visually attached to it.

Proof capture is an observer: storage/tab/proof failure may log a warning, but must never rewrite or fail an already-completed Council.

## Provider-origin health

A participant is healthy only when its real tab still ends on the expected Provider origin. OAuth/external pages, `chrome://` pages, and closed tabs are unhealthy evidence and make the shared pack incomplete.

## Same fail-closed candidate rule

Browser does not receive a relaxed definition. A candidate still requires at least two real participants, one frozen Provider row for every real participant, all Recipe/Test/Gate/Host/Seat gates, LIVE mode, all events from real actors, `uncertain=0`, exactly one final per real participant, no zero-confidence final, and the full round progression.

> **The Browser adapter changed the input source, not the release bar.**

## Privacy

The observer briefly sees the local Council result but stores only the sanitized `GateBProofPack`. Exported proof has no King's Command, event/model body text, taught selectors, tab ids/titles, account identifiers, cookies, or tokens. The visible Proof panel consumes only this metadata-only pack.

## Deterministic showcase

CI renders `extension/sidepanel.html?showcase=gate-b` using a fake metadata-only ChatGPT + DeepSeek pack: 2 real participants, 3 rounds, 0 uncertain, 2 finals. It contains no real Provider account or conversation.

The production UI exposes machine markers including `data-proof-privacy="metadata-only"`, `data-proof-source="browser-house"`, candidate verdict, provider count, rounds, and uncertain count. This validates the UI contract; real Provider compatibility remains tracked in issue #12.
