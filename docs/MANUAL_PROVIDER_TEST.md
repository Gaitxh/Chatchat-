# Real Provider Manual Validation · v0.9

ChatChat CI can compile and test the Browser Council Bridge, but CI cannot sign into a user's external AI account or operate a private live Provider UI.

That creates two distinct quality gates:

```text
Gate A — automated CI
TypeScript + parser tests + Vite production build
+ real built UI screenshot + Rust/Tauri compile

Gate B — user-local Provider validation
real login
→ DOM probe
→ Teach Recipe 3/3
→ explicit Test Speech
→ Council Gate
→ Take a Seat
→ real Council turn(s)
```

A Provider should not be described as runtime-validated until both gates pass for a recorded configuration.

## Before testing

Run the Tauri desktop app:

```bash
npm install
npm run tauri:dev
```

Use a test account or an account whose visible screen content you are comfortable handling locally. Do not record or post private sidebars/account data.

For Custom Providers, invite a URL that lands on a clean/new chat surface when possible. ChatChat uses that URL as the fresh-session start page.

---

# Gate B checklist

## 1. Invite

1. Click `+ INVITE AI`.
2. Enter the Provider URL.
3. Confirm the detection card shows either a known catalog provider or `Custom AI / custom.browser`.
4. Confirm the profile appears on the local Advisor Roster.

Pass condition:

```text
Provider profile exists locally
```

## 2. Isolated login WebView

1. Click `LOGIN`.
2. Sign in directly in the Provider WebView.
3. Complete OAuth/MFA on the Provider's own pages if needed.
4. Return to the Provider's chat surface.

Pass condition:

```text
WEBVIEW OPEN
```

Important: ChatChat must never ask the user to paste a password, cookie or access token into its own UI.

## 3. 御前试音 / DOM probe

Click `御前试音`.

Confirm the metadata-only probe finds plausible composer/action candidates without reading chat body text or credential values.

Pass condition:

```text
DOM PROBED
```

## 4. Teach Recipe

Teach all three roles:

```text
✍️ Composer
➤ Send
💬 Response
```

For each role:

1. Click `教我` in ChatChat.
2. Click the intended element in the Provider window.
3. Return to ChatChat and confirm the selector appears.

Pass condition:

```text
RECIPE 3/3
```

Reject any recipe that targets a password field.

## 5. Test Speech

1. Review the visible test message.
2. Click `试奏`.
3. Watch the Provider window.
4. Confirm:
   - the text goes into the intended composer;
   - the intended send control activates;
   - a new model response is produced;
   - ChatChat displays the response captured from the taught response surface;
   - capture stops after stable output rather than arbitrary page scraping.

Pass condition:

```text
TEST PASSED
```

This still does **not** mean READY.

## 6. Council Gate

Click:

```text
OPEN COUNCIL GATE
```

ChatChat sends a real sealed-phase protocol handshake through the taught browser surfaces.

The Provider must return a valid structured response that parses into legal `CouncilContribution[]` and includes the required READY stance.

Pass condition:

```text
COUNCIL GATE ✓
COUNCIL READY
```

If the first response has only a formatting error, ChatChat performs one structured repair attempt. A second parser failure is a Gate failure.

## 7. Take a Seat

Click:

```text
TAKE A SEAT
```

Confirm:

- the Provider profile displays `SEATED`;
- the round table displays the advisor as `LIVE WEB`;
- with exactly one real seat, the chamber is clearly labelled `HYBRID REHEARSAL`.

Pass condition:

```text
🪑 SEATED
```

## 8. First real Council turn

With one live advisor, run a Hybrid rehearsal.

Confirm the real advisor:

1. prepares a fresh Provider start page for the new Council session;
2. finds the taught composer again;
3. receives a sealed-phase prompt;
4. produces a structured sealed contribution;
5. appears in the Blackboard with its real Provider profile id;
6. participates in later debate/final phases rather than only Test Speech.

If fresh-session preparation fails, ChatChat should emit uncertainty with confidence 0 rather than silently reusing stale chat context.

## 9. LIVE COUNCIL

Validate a second Provider using the same process and seat it.

Pass condition:

```text
🔥 LIVE COUNCIL
```

Now run one King's Command and verify the Council contains **real web advisors only**.

Confirm:

- Round 1 is sealed;
- both providers independently answer;
- Round 2 starts automatically;
- peer event references are real Blackboard ids;
- at least one legal debate event is produced;
- final phase produces one final position per advisor;
- the final report retains disagreement/minority opinion if present;
- the Court Chronicle stores the resulting structured event stream locally.

---

# Failure taxonomy

When a Provider fails, report the narrowest stage.

### Login / navigation

- provider WebView cannot load;
- authentication redirect never returns to the Provider host;
- fresh-session navigation returns to login;
- root/new-chat page is incompatible with the stored recipe.

### Recipe drift

- composer selector no longer resolves;
- send selector missing/disabled;
- response selector no longer matches new answers;
- a site update changes roles/DOM hierarchy.

### Input execution

- text visually appears but the Provider framework does not recognize it;
- input/change events are insufficient for the framework;
- the generic click path cannot activate send.

### Generation detection

- response does not change from baseline;
- response streaming never stabilizes under the generic heuristic;
- the selected response surface represents multiple conversations incorrectly;
- response exceeds the bounded capture path.

### Council protocol

- model refuses the machine-readable envelope;
- response contains invalid JSON twice;
- contribution kind is illegal for the phase;
- model invents event ids;
- model tries to revise another advisor's event;
- final phase returns zero or multiple final positions;
- Council prompt grows beyond the transport safety budget.

A recurring generic-bridge failure is evidence for a provider-specific adapter operation—not a reason to make the generic bridge read more of the page.

---

# Compatibility report template

Use this format in an issue/PR:

```text
Provider: <name>
Host: <host only>
ChatChat: v0.9.x
OS: <Windows/macOS/Linux + version>
Provider UI date tested: YYYY-MM-DD

Invite: PASS/FAIL
Login WebView: PASS/FAIL
DOM Probe: PASS/FAIL
Recipe 3/3: PASS/FAIL
Test Speech: PASS/FAIL
Council Gate: PASS/FAIL
Fresh Session: PASS/FAIL
Hybrid Turn: PASS/FAIL
Live Council with second provider: PASS/FAIL/NOT TESTED

Notes:
- selector drift or special framework behavior
- error messages with private data removed
```

Do not post:

- passwords;
- cookies;
- access/refresh tokens;
- private conversation text;
- account email/phone;
- screenshots containing sensitive sidebars or profile details;
- selectors that embed private user/account identifiers.

---

# What “supported” should mean

Use precise language:

- **recognized**: URL maps to a catalog entry;
- **teachable**: user can create a 3/3 recipe;
- **test-passed**: one explicit message round-trip works;
- **council-ready**: structured Council Gate passes;
- **runtime-validated**: a real sealed/debate/final run was manually tested on a specific environment;
- **officially supported**: maintainers choose to document/maintain that compatibility target.

This vocabulary prevents a cool demo from turning into accidental compatibility promises.
