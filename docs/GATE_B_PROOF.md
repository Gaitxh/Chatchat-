# Royal Proof Pack · Gate B Evidence

ChatChat v1.0 should be released because real Providers were actually validated, not because a README says they were.

The **Royal Proof Pack** is a deliberately small, privacy-safe evidence format generated from a completed local Council.

It is designed for one job:

> Prove the shape of a real Provider/Council run without publishing the conversation.

## What it can prove

A Proof Pack records:

- ChatChat package version;
- a user-editable public environment label;
- public Provider hostnames and Provider/Adapter ids;
- whether each frozen real seat had:
  - Recipe 3/3;
  - Test Speech PASS;
  - Council Gate PASS;
  - healthy Provider-host WebView;
  - active seat;
- Council mode (`demo`, `hybrid`, `live`);
- number of real participants;
- round count;
- total and real-provider event counts;
- count of each typed Blackboard event kind;
- final-position count;
- consensus ratio;
- whether a minority opinion survived;
- coarse Council duration;
- a short random session fingerprint.

## What it intentionally cannot prove

A Proof Pack does not prove that:

- the Provider's answer was factually correct;
- debate improved the answer;
- every account or OS will behave the same;
- a Provider UI will remain compatible after a website update;
- a Provider is officially supported by ChatChat maintainers.

It is environment-specific runtime evidence.

## What is forbidden from the schema

The v1 schema has no fields for:

- King's Command / question text;
- model response text;
- Council event content;
- evidence/source text;
- taught CSS selectors;
- Provider display names;
- local Provider profile ids/keys;
- cookies;
- tokens;
- passwords;
- account emails;
- sidebar or conversation history.

This is not just a UI convention. The export data model itself omits these values.

The automated privacy regression test inserts fake secrets into every nearby runtime object and fails if the exported JSON/Markdown contains them.

## Frozen-at-completion semantics

When a current Council completes, ChatChat freezes the Provider gate/health/seat booleans used for its Proof Pack.

Why freeze them?

A useful Gate B demo includes a later failure test:

```text
🔥 LIVE COUNCIL complete
      ↓
close Provider B window
      ↓
Provider B seat revoked
      ↓
⚗️ HYBRID
```

The seat revocation should not retroactively rewrite the evidence describing the already-completed LIVE run.

The Proof Pack therefore represents the Provider state captured at Council completion.

## Archive playback is not fresh evidence

The Court Chronicle can replay old structured Council sessions.

However, ChatChat disables Proof Pack export while viewing an archive. Otherwise it would be too easy to combine:

```text
old Council history
+
current Provider runtime state
```

and accidentally produce a misleading compatibility report.

To generate new Gate B evidence, complete a new current Council.

## Verdicts

### `demo-only`

The Council was a deterministic Mock Demo. Useful for screenshots and protocol testing, but never real Provider evidence.

### `incomplete`

At least one expected local Gate B condition is missing. Examples:

- only one real Provider;
- Hybrid rather than LIVE mode;
- incomplete Recipe/Test/Gate/Host/Seat state;
- incomplete final positions;
- Council did not reach the expected round structure.

### `gate-b-candidate`

The local evidence shape satisfies the Proof Pack's v1 structural rule:

- at least two frozen real seats;
- every frozen seat passed Recipe/Test/Gate/Host/Seat checks;
- Council mode was LIVE;
- at least two real participants;
- at least two final positions;
- expected Council rounds completed.

`gate-b-candidate` means **ready for maintainer review**. It does not automatically promote a Provider to Officially Supported.

## Export formats

The UI provides:

- **COPY ISSUE MARKDOWN** — paste directly into a Provider Compatibility Issue;
- **COPY JSON** — structured representation;
- **DOWNLOAD JSON** — local evidence artifact.

The JSON schema is versioned at:

```text
schemas/gate-b-proof-v1.schema.json
```

Schema name in Markdown:

```text
gate-b-proof/v1
```

## Recommended v1.0 Gate B procedure

For Provider A and Provider B:

1. Invite public Provider URL.
2. Login inside isolated local WebView.
3. Confirm Provider Window Health = Provider host.
4. Probe DOM metadata.
5. Teach Composer / Send / Response.
6. Pass Test Speech.
7. Pass Council Gate.
8. Take a healthy seat.

Then:

9. Confirm UI enters `🔥 LIVE COUNCIL`.
10. Run a fresh Council.
11. Confirm sealed Round 1, automatic debate and final positions complete.
12. Review the visible Council result privately.
13. Export Royal Proof Pack.
14. Review the Proof Pack itself before posting it publicly.
15. Paste the Markdown into the compatibility Issue.
16. Optionally close one Provider window and verify the seat is revoked; this does not alter the frozen Proof Pack for step 10.

## Compatibility matrix policy

A Proof Pack can support promotion to **Runtime-Validated** when a maintainer reviews it together with any necessary sanitized notes.

A compatibility row should still include a date, because remote Provider UIs are unstable dependencies.

The hierarchy remains:

```text
recognized
→ teachable
→ test-passed
→ council-ready
→ runtime-validated
→ officially supported
```

The Proof Pack makes the `runtime-validated` step easier to document; it does not collapse the hierarchy.
