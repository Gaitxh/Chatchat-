# Real Provider Proof · Gate B Evidence

ChatChat v1.0 should be released because real Providers were actually validated in the current browser product — not because a README says they work.

**Real Provider Proof** is a deliberately small, privacy-safe evidence format frozen from a completed local Browser Consultation.

It has one job:

> Prove the shape and health of one real multi-Provider ChatChat run without publishing the conversation.

## Current Gate B path

The acceptance path follows the same zero-config Full Room experience used by ordinary users:

```text
Open ChatChat Full Room
      ↓
automatic diverse AI team planning
      ↓
optional Provider-site permissions
      ↓
clean Provider conversations open
      ↓
automatic page recognition
+ connection check
+ structured Consultation Gate
      ↓
if a Provider needs login:
  user signs in on that Provider
  → ChatChat resumes automatically
      ↓
2+ distinct Provider sources READY
      ↓
run one fresh real consultation
      ↓
sealed → consult → final
      ↓
Real Provider Proof frozen locally
```

Manual Teach/selectors are an **Advanced repair fallback**, not the normal Gate B procedure.

## What a Proof Pack records

The v1 metadata model records:

- ChatChat version;
- coarse browser surface / OS environment label;
- public Provider ids and hostnames;
- whether each frozen participant had:
  - a complete local page map/recipe;
  - a successful automatic connection state;
  - a successful structured Consultation Gate;
  - a healthy Provider-origin tab;
  - an admitted room participant;
- run mode (`demo`, `hybrid`, `live`);
- number of real participants;
- round count;
- total and real-participant event counts;
- count of each typed consultation event kind;
- final-position count;
- zero-confidence final count;
- consensus ratio;
- whether a minority opinion survived;
- coarse consultation duration;
- a short non-content session fingerprint.

## What it intentionally cannot prove

A Real Provider Proof does **not** prove that:

- a Provider's answer was factually correct;
- deliberation improved the answer;
- consensus means truth;
- every account, OS, locale or browser version will behave the same;
- a remote Provider UI will remain compatible after a website update;
- a Provider is officially supported forever.

It is environment-specific runtime evidence from one concrete browser run.

## Privacy boundary

The schema intentionally has no export fields for:

- the user proposal;
- model response text;
- structured event/message bodies;
- evidence/source page text;
- page mappings or taught selectors;
- Provider display names tied to local accounts;
- local profile ids/keys;
- account identifiers or emails;
- cookies;
- tokens;
- passwords or other credentials;
- Provider sidebars or conversation history.

This is not just a UI promise. The export data model itself omits these values, and privacy regression tests inject fake secrets into nearby runtime objects and fail if JSON/Markdown contains them.

## Real runtime vs deterministic showcase

A critical truth boundary is enforced by the active observer:

```text
chrome-extension: real product runtime
        ↓
may generate LIVE proof

http(s) deterministic CI/showcase
        ↓
may render DEMO-ONLY proof previews
        ↓
can never auto-generate a live Gate B candidate
```

A screenshot test is useful product evidence, but it is **not** real Provider acceptance evidence.

## Frozen-at-completion semantics

When a fresh real consultation completes, ChatChat freezes the Provider readiness/health metadata used for that Proof Pack.

That matters because runtime state can change afterwards:

```text
real consultation completes
      ↓
Real Provider Proof frozen
      ↓
user later closes Provider B tab
      ↓
future runtime state changes
      ↓
frozen proof for the completed run remains historical evidence
```

A later failure must not retroactively rewrite what was true at the moment the completed run was captured.

## Archive replay is not fresh evidence

Opening an old Consultation History record does not run the orchestrator again and therefore does not generate new Real Provider Proof.

A historical replay must never combine:

```text
old consultation events
+
current Provider runtime state
```

and pretend that mixture is fresh compatibility evidence.

To generate new Gate B evidence, complete a new real Browser Consultation.

## Verdicts

### `demo-only`

A deterministic browser preview or Mock run. Useful for screenshots, UI regression and protocol development; never real Provider acceptance evidence.

### `incomplete`

At least one required real-run condition is missing. Examples:

- fewer than two Provider proof rows;
- fewer than two distinct Provider hosts;
- incomplete page map;
- participant was not READY;
- Provider tab moved off the expected origin or closed;
- consultation contains an `uncertain` fallback event;
- a final position has zero confidence because a transport/parser fallback occurred;
- not every real participant produced a final position;
- event stream contains non-real/mock actors;
- the expected minimum round structure was not completed.

### `gate-b-candidate`

The local evidence shape satisfies the structural v1 rule:

- at least two distinct Provider hosts;
- every frozen participant has complete page-map, connection, protocol, host-health and room-admission evidence;
- mode is LIVE;
- all consultation participants are real Browser participants;
- all events belong to those real participants;
- every participant produced a non-zero-confidence final position;
- no uncertainty fallback event occurred;
- at least three consultation/final rounds are represented.

`gate-b-candidate` means **ready for maintainer review**. It does not automatically promote a Provider to universal or official support.

## Export formats

The current UI provides:

- **COPY GITHUB MARKDOWN** — paste into a compatibility / v1 acceptance issue;
- **COPY JSON** — metadata-only structured representation.

The JSON schema remains versioned at:

```text
schemas/gate-b-proof-v1.schema.json
```

Markdown identifies it as:

```text
gate-b-proof/v1
```

## Recommended v1 acceptance run

For two or more real Provider sources:

1. Open ChatChat Full Room from the extension toolbar.
2. Let zero-config onboarding plan or restore a diverse Provider team.
3. Grant only the requested optional Provider-site permissions.
4. If a Provider asks for login, sign in on that Provider page; do not manually retry ChatChat.
5. Wait until at least two distinct Provider participants show READY.
6. Confirm the Provider tabs remain on their expected Provider origins.
7. Write one fresh proposal.
8. Let ChatChat complete sealed independent opinions, automatic consultation and final positions.
9. Reject the run as Gate B evidence if a participant falls back to uncertainty or a zero-confidence final.
10. Review the visible result privately.
11. Review the generated **Real Provider Proof** card.
12. Copy the privacy-safe GitHub Markdown or metadata-only JSON.
13. Review the exported proof itself before posting it publicly.
14. Attach it to the v1 Gate B / compatibility issue.

## Compatibility policy

A reviewed Real Provider Proof can support a **runtime-validated** compatibility claim for the exact environment/date that produced it.

Remote Provider UIs are unstable dependencies, so compatibility evidence should always remain dated.

A useful maturity ladder is:

```text
recognized
→ auto-connected
→ protocol-ready
→ real-run Gate B candidate
→ maintainer-reviewed runtime validation
```

Real Provider Proof documents that ladder. It does not create a new AI hierarchy and it does not turn one successful run into permanent authority.
