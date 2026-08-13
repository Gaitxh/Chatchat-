# Royal Onboarding · 御前召集向导 👑

ChatChat's Browser product is deep enough that the next challenge is not “can it do this?” but “can a new user understand how to get there?”

Royal Onboarding turns first run into six operational acts plus one completion moment.

```text
ACT I    👑 Welcome
ACT II   🔭 Find open AIs
ACT III  🪑 Summon selected tabs
ACT IV   🧩 Teach / Test / Gate
ACT V    ⚖️ Admit the House
ACT VI   🔥 First Council
ACT VII  🎭 First Council complete
```

The guide simplifies navigation. It does **not** create a second Provider pipeline.

## Act I — Welcome

The first card explains only the product contract:

1. the user is the King and asks once;
2. ChatChat uses already logged-in browser AI tabs;
3. ChatChat has no relay server and does not ask for pasted passwords/cookies.

The main action is:

> **FIND MY AIs**

## Act II — Find open AI tabs

The guide reuses the existing deterministic `planOpenAiTabsForHouse()` planner.

Only catalog-recognized AI tabs appear in the bulk list. Unknown/custom sites remain explicit single-tab actions in the normal Side Panel.

Candidates are shown as:

```text
☑ ChatGPT
  chatgpt.com
  UNVERIFIED
```

All discovered candidates may be selected initially for convenience, but checkboxes are visible and the user must explicitly confirm.

Permission planning uses the selected set only:

```text
selected tab origins
→ de-duplicate
→ chrome.permissions.request(...)
```

Tests verify an unselected Provider origin is absent from the permission request.

## Act III — Summon

Selected real tabs are attached using the same Browser bridge contract as Summon the House:

```text
permission
→ PING / content bridge
→ one tab = one seat
→ extension session seat record
```

A newly attached seat is **not READY**.

The guide immediately transitions to validation.

## Act IV — Teach / Test / Gate

Royal Onboarding deliberately does not implement Teach Mode or Council Gate itself.

Instead it opens and highlights the existing Side Panel Advanced validation section.

The guide reads only public progress text already rendered by the primary UI:

```text
Recipe 3/3 taught
1/2 ready
```

The trust ladder remains:

```text
recognized
≠ attached
≠ recipe 3/3
≠ Test Speech
≠ Council Gate
≠ READY
```

A fully taught delegation with zero independently ready seats is intentionally displayed as **60% validation progress**, never 100%.

Test/Gate remains per tab even when selector mapping is shared by Provider origin.

## Act V — Admit the House

The guide advances only after runtime truth shows at least two independently READY seats.

One READY seat is not sufficient.

At this point the King may choose:

- 🗣️ Free Parliament;
- 🏛️ Committee Parliament.

The guide does not reproduce committee logic. It clicks the existing Committee Parliament companion control.

## Act VI — First Council

Royal Onboarding contains an editable first question.

When the King chooses to convene, the guide fills the existing controlled King's Command textarea and submits the existing Council form.

It does not call a Provider itself and does not implement Round 2.

The ordinary Browser House still executes:

```text
CouncilOrchestrator
→ sealed
→ automatic debate
→ final
→ House Verdict
```

## Act VII — Completion

The completion card only appears when the ordinary Side Panel has a completed Council and at least two READY seats remain represented in runtime state.

Celebration metrics are derived from visible current runtime truth:

- structured event count (prefer Browser Theater's completed event total);
- public revision / changed-mind count;
- whether a Minority Report exists.

No celebratory number is invented just to make the animation more exciting.

The user can:

- jump to Browser Council Theater Replay;
- dismiss onboarding and ask another question.

After completion the guide stays hidden on normal reloads, but a small **👑 新手向导** control in the footer can reopen it.

## Persistence boundary

Persistent onboarding state is intentionally tiny:

```ts
{
  version: 1,
  completed: boolean,
  act: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  dismissed: boolean
}
```

It contains no:

- Provider credentials;
- cookies/tokens;
- tab page content;
- King's questions;
- model replies;
- Teach selectors;
- account emails/usernames.

Seat and Recipe state remains owned by the existing Browser House subsystems.

## Deterministic showcase

The focused Browser onboarding workflow captures four real production Side Panel states:

1. scan/select;
2. validation;
3. House Ready;
4. first Council complete.

Showcase data is synthetic and explicitly labelled:

> **DETERMINISTIC ONBOARDING SHOWCASE · NO REAL ACCOUNT**

CI asserts that the early scan/validation screenshots never contain `COUNCIL GATE ✓` and that House Ready appears only in the ready-state showcase.

These screenshots verify UI and trust semantics. They do not claim compatibility with a third-party Provider website.

## Principle

> **Make the palace easy to enter. Never make the gates fake.**
