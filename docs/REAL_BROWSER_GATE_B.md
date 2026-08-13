# Real Browser Gate B Runbook 👑🔥

This is the maintainer runbook for a **real**, privacy-reviewed Browser House validation using an ordinary Chromium profile that is already signed into multiple AI products.

It is not a deterministic showcase. Anything marked PASS here must come from real Provider tabs on the user's machine.

## Best first pair

Start with two Providers, not seven.

Recommended first attempt:

```text
ChatGPT + DeepSeek
```

Why:

- two sources are enough to unlock a real-only LIVE Council;
- failure diagnosis stays understandable;
- the Browser Gate B Proof Pack has a simple 2-row expected shape;
- once this passes, add Gemini / Tongyi / Yuanbao / Grok / Qwen as separate compatibility experiments.

This is a test-order recommendation, not an Official Support claim.

## 0. Build and load the exact commit

```bash
npm install
npm run check
npm test
npm run build:extension
```

Then in Chromium:

```text
chrome://extensions
→ Developer mode
→ Load unpacked
→ choose dist-extension/
```

Record the exact ChatChat commit used for the run.

## 1. Prepare Provider tabs

Open normal fresh-chat landing pages in the already logged-in browser profile.

For example:

```text
https://chatgpt.com/
https://chat.deepseek.com/
```

Do not use a tab that contains sensitive conversation history for demo media.

Confirm each Provider is actually usable before ChatChat touches it.

## 2. 👑 SUMMON THE HOUSE

Open the ChatChat Side Panel.

The top companion should detect catalog-recognized open AI tabs.

Click:

```text
👑 SUMMON THE HOUSE · 召集诸卿
```

Expected immediately after summon:

```text
seat exists
BUT
Test ≠ PASS
Gate ≠ PASS
READY ≠ true
```

Bulk summon is attach-only. If a newly attached seat appears READY without Test/Gate, stop the validation and file a bug.

## 3. Teach one origin at a time

For Provider A:

```text
Composer → Teach
Send     → Teach
Response → Teach
```

Review the generated selectors.

Prefer stable semantic surfaces where possible:

```text
data-testid
aria-label
role
short readable id
```

Avoid treating a brittle `nth-child` chain as long-term compatibility evidence.

If a known-good Recipe Candidate is available, import it only as a map:

```text
IMPORT · TEST REQUIRED
```

The imported map must not import trust.

Repeat for Provider B.

## 4. Test Speech — per independent tab

Run Test Speech on Provider A.

Verify on the real Provider page:

- ChatChat wrote into the intended Composer;
- the intended Send control fired;
- a *new* Provider response appeared;
- ChatChat captured only the taught Response surface;
- status became Test PASS.

Repeat independently for Provider B.

If five ChatGPT tabs are present, five tab seats require independent runtime Test/Gate. One origin-level Recipe does not turn five samples into one trusted super-seat.

## 5. Council Gate — per tab

Open Council Gate for Provider A.

Expected:

```text
real Provider returns valid ChatChat Council envelope
→ strict parser accepts it
→ Gate PASS
```

Repeat for Provider B.

Do not proceed to the release-validation run while either seat is failing closed into `uncertain`.

## 6. Confirm real-only admission

Before the King sends the validation question, verify the House shows at least two ready seats from real Providers.

For the first release gate, prefer two different Provider delegations:

```text
ChatGPT ×1 READY
DeepSeek ×1 READY
```

Repeated seats from one Provider are useful samples, but do not substitute for source diversity.

## 7. 👑 King speaks once

Use a non-sensitive question that naturally permits disagreement and revision.

A good launch-demo prompt:

> We are building a local-first open-source desktop AI product. Compare Tauri, Electron, and native development for the first release. Separate verifiable facts from engineering judgment, challenge unsupported claims, and explicitly revise your position if another advisor changes your conclusion.

Then click **Convene** once.

Do not manually send Round 2.

Expected protocol:

```text
Round 1 — sealed / independent
Round 2 — automatic open debate
Round 3 — final positions
```

## 8. Watch the live Council, not just the final answer

Record the moments that prove ChatChat is more than parallel fan-out:

```text
⚔ challenge
📎 evidence
🛡 defense
🔄 revision / changed mind
🏳 concede
minority opinion survives
```

Council Theater should derive influence only from typed event references. A visually exciting arrow is not allowed to invent persuasion.

## 9. Browser Royal Proof Pack

After a successful Council, the Side Panel should freeze a metadata-only Browser Gate B panel.

For a clean first two-Provider run, expect something like:

```text
✓ GATE B CANDIDATE

openai-chatgpt    Recipe ✓ Test ✓ Gate ✓ Host ✓
deepseek-chat     Recipe ✓ Test ✓ Gate ✓ Host ✓

REAL       2
ROUNDS     3
UNCERTAIN  0
FINAL      2
ZERO FINAL 0
```

Use:

```text
COPY ISSUE MARKDOWN
```

Review the copied text before posting it to issue #12.

## 10. Stale-proof test

Immediately after a successful Gate B run, start another Council and deliberately make it fail or stop one Provider.

Expected:

```text
new Council starts
→ old Browser Proof disappears immediately
```

The previous candidate certificate must not remain attached to the new run.

## 11. Provider health test

After a successful run:

- close one Provider tab, or
- navigate it to an external/auth origin.

The next validation must treat that seat as unhealthy.

A closed/off-origin Provider must never count as healthy Gate B proof.

## 12. Privacy review before sharing media

Before committing a screenshot/GIF/video, inspect every frame for:

- account email/name/avatar;
- Provider sidebar/history titles;
- private chat content;
- browser bookmarks/profile details;
- tokens/cookies/devtools output;
- notification popups;
- unrelated tabs.

Prefer a dedicated clean browser profile for public release media even if the first engineering Gate B run uses an existing logged-in profile.

## PASS evidence for issue #12

A release-quality Browser Gate B record should have:

```text
[ ] exact ChatChat commit
[ ] OS / Chromium version
[ ] Provider A host
[ ] Provider B host
[ ] Recipe 3/3 for both
[ ] Test PASS for both
[ ] Council Gate PASS for both
[ ] 2 healthy real seats admitted
[ ] Round 1 sealed
[ ] Round 2 automatic
[ ] final positions from both
[ ] uncertain = 0
[ ] zero-confidence final = 0
[ ] Provider proof rows = real participants
[ ] Royal Proof Pack = gate-b-candidate
[ ] privacy-reviewed demo asset
```

## What does NOT count as v1 Gate B

These are useful development evidence, but not the real release gate:

- deterministic showcase screenshots;
- Mock Council;
- a URL detector unit test;
- Recipe import alone;
- Test Speech alone;
- one real Provider plus mocks;
- two tabs from one Provider presented as two independent model families;
- a Council that completed only because a real advisor degraded to `uncertain`;
- a stale Proof Pack left over from an older run.

The launch story can be theatrical. The release evidence must be boringly specific.
