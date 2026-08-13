# Browser Court Chronicle · 私人本地史册 📚

ChatChat's Browser House now has two very different kinds of records:

```text
Royal Proof Pack
→ deliberately metadata-only
→ safe to review/share after the user checks it

Court Chronicle
→ full private Council content
→ local browser history only
→ never auto-exported
```

Do not confuse them.

## What Chronicle stores

A successful Browser Council may be archived as:

```ts
{
  sessionId,
  createdAt,
  question,
  report,
  events,
  participants
}
```

That means Chronicle may contain:

- the King's full question;
- model answers;
- challenges/evidence/revisions;
- final positions;
- minority opinions.

The UI therefore labels the section:

> **PRIVATE LOCAL HISTORY**

## Storage

Browser Chronicle uses extension-origin IndexedDB:

```text
DB: chatchat-browser-chronicle
version: 1

councils
  keyPath: sessionId
  full private archive

summaries
  keyPath: sessionId
  index: createdAt
  cheap local list metadata
```

The list does not load every full transcript just to render recent Council titles.

A summary contains:

- question preview;
- timestamp;
- rounds;
- event count;
- participant count;
- consensus stance/ratio;
- changed-mind count;
- minority flag.

It does not copy model event bodies into the list store.

## Automatic capture

Court Chronicle wraps the same successful `CouncilOrchestrator.run()` result used by the Browser House.

After a successful verdict:

```text
Council completes
      ↓
createBrowserChronicleArchive(report, events)
      ↓
IndexedDB transaction
  ├── full archive
  └── summary
```

A history-write failure is shown locally in Chronicle but **does not turn a successful Council into a failed Council**.

## Local replay

Each archive row has:

> **▶ REPLAY LOCALLY**

Chronicle loads that record from IndexedDB and dispatches a local extension-page event:

```text
chatchat:theater-load-archive
```

Browser Council Theater validates the payload and switches to:

```text
📚 ARCHIVE REPLAY · 0 PROVIDER CALLS
```

It reuses the same deterministic influence graph:

- revision.causedBy = strong influence;
- concede.targetEventId = strong influence;
- challenge/evidence/support/defense = interaction only;
- broken references remain unresolved instead of invented.

No old Council replay asks any AI to regenerate its answer.

## Current vs archive

Theater exposes:

```text
data-theater-source="current"
```

for the just-completed Council and:

```text
data-theater-source="archive"
```

for a Court Chronicle replay.

A newly completed live/current Council always takes the Theater back to `current` mode.

## User controls

Chronicle provides:

- replay one archive;
- delete one archive;
- clear the full local Chronicle;
- refresh the list.

`Clear Chronicle` requires an explicit confirmation because the history cannot be recovered from ChatChat servers — there are none.

The UI may render only the newest N summaries for convenience. That display limit is **not** a silent retention policy and does not delete older IndexedDB records.

## Corruption behavior

Archive records are structurally validated before Theater accepts them.

A corrupt/missing record becomes a local replay error. It does not crash the Side Panel and does not cause ChatChat to contact a Provider to “reconstruct” the missing history.

## Proof Pack separation

Chronicle content must never be automatically merged into Gate B / Provider Compatibility evidence.

Proof Pack remains a separate metadata-only schema and explicitly excludes:

- King's question;
- event text;
- model responses;
- selectors/profile keys/credentials.

Chronicle has the opposite purpose: preserve the user's complete private Council history locally.

## Production showcase

The focused Browser Chronicle workflow:

1. builds the real extension;
2. runs the canonical deterministic Browser House;
3. lets Chronicle save the completed Council into real IndexedDB;
4. waits for the local archive row;
5. clicks `REPLAY LOCALLY`;
6. verifies Theater changes to `archive` source;
7. captures the actual production Side Panel PNG + DOM;
8. asserts replay remains zero-call.

Synthetic showcase content proves UI/storage behavior only. It is not a real Provider compatibility claim.

## Principle

> **The Court remembers locally. The Providers do not need to be summoned again to replay history.**
