# AI House Committees

Large Houses should not spend all of their extra seats repeating the same generic analysis.

ChatChat therefore separates three orthogonal ideas:

```text
Delegation = where a seat comes from
Committee  = what a seat investigates
Caucus     = what a seat finally supports
```

Example:

```text
GPT-01
├─ Delegation: ChatGPT
├─ Committee: Evidence
└─ Final Caucus: Tauri

Qwen-03
├─ Delegation: Qwen
├─ Committee: Security & Privacy
└─ Final Caucus: Tauri
```

A Provider delegation is provenance. A committee is temporary work allocation. A caucus is an emergent position after deliberation.

None of those concepts should secretly force the others.

---

## Free Parliament is the default

Committee mode is optional.

```text
Free Parliament
→ every seat receives the neutral Council protocol

Committee Parliament
→ selected seats additionally receive one neutral investigative task
```

An empty committee list means no assignments at all. Existing Council behavior remains unchanged.

---

## Built-in Committees v1

### 📎 Evidence Committee

Separate factual claims from assumptions and unsupported assertions. Identify evidence that should be verified or requested.

### 🛡️ Security & Privacy Committee

Investigate trust boundaries, authentication, privacy, abuse paths, security risk and mitigations.

### 💰 Cost & Economics Committee

Investigate time, cost, operational burden, opportunity cost and sensitivity to scale.

### 🧱 Engineering Committee

Investigate technical feasibility, maintainability, reliability, failure modes and escape hatches.

### 👥 User Experience Committee

Investigate onboarding, accessibility, workflow friction, learnability and adoption risk.

### 😈 Counterexample Committee

Assume an emerging consensus could be wrong and search for the strongest counterexamples or reversal conditions. It must concede when an objection does not survive scrutiny.

### 📜 Requirements Committee

Track the King's explicit requirements and flag arguments that optimize variables the King did not actually prioritize.

---

## Committees never receive a desired answer

Good committee instruction:

> Investigate deployment and maintenance risk. Identify claims that depend on untested operational assumptions.

Bad committee instruction:

> Prove Electron is safer than Tauri.

The first asks a seat to investigate a dimension.

The second creates an advocate with a predetermined conclusion.

Committee Parliament v1 therefore ships only a fixed, reviewable set of built-in neutral tasks. Custom committee prompts can be considered later with explicit bias controls instead of quietly turning the House into role-play.

---

## Cross-delegation assignment

Committee assignment should not accidentally recreate Provider echo chambers.

For example:

```text
Evidence Committee
├─ GPT-01
├─ Qwen-02
├─ Gemini-03
└─ DeepSeek-01

Security Committee
├─ GPT-02
├─ Qwen-03
├─ Gemini-01
└─ DeepSeek-02
```

The v1 assignment algorithm is deterministic.

For every seat it prefers, in order:

1. the committee with the fewest seats from that same delegation;
2. then the committee with the fewest total seats;
3. then the configured committee order as a stable tie-breaker.

This makes test/replay output reproducible while discouraging unnecessary same-Provider clustering.

---

## Round 1 independence still matters

A committee assignment is not permission to start an internal committee chat before the sealed round.

In v1:

```text
GPT-01 · Evidence
Qwen-02 · Evidence
Gemini-03 · Evidence
```

still think independently during Round 1.

They know the same committee mission, but they do not see one another's sealed answer.

After the sealed batch is published, open Council proceeds through the normal structured Blackboard.

A later explicit `committee-prebrief` protocol could be explored, but it must be a named extra phase rather than a hidden leak across Round 1.

---

## Public metadata

Committee assignment is public/auditable seat metadata:

```ts
participant.committeeId
participant.committeeName
participant.committeeTask
```

It is not hidden persuasion state.

This matters for two reasons:

1. the UI can explain why a seat focused on security or evidence;
2. archived Councils can replay the exact investigative assignment that existed at the time.

---

## Provider prompt integration

The shared-core assignment engine deliberately does **not** rewrite the King's question.

The next integration layer should expose the task separately, for example:

```text
KING_QUESTION_JSON: "..."
COMMITTEE_TASK_JSON: {
  "id": "evidence",
  "name": "Evidence Committee",
  "task": "Identify factual claims ..."
}
```

The Provider should then be told:

- committee task is an investigative lens, not a desired conclusion;
- King's constraints still outrank committee convenience;
- final position remains the individual seat's position;
- seats may disagree with members of their own committee or delegation.

This separation is preferable to concatenating committee instructions into `KING_QUESTION_JSON`, which would blur user intent and system coordination.

---

## What the UI may show

For a large House:

```text
GPT ×5        Qwen ×5       Gemini ×3

Committees
📎 Evidence        4 seats · 4 delegations
🛡 Security        3 seats · 3 delegations
🧱 Engineering     3 seats · 3 delegations
😈 Counterexample  3 seats · 3 delegations
```

A seat card may display all three axes:

```text
GPT-02
ChatGPT Delegation
📎 Evidence Committee
Final: Tauri Caucus
```

The theatrical language can be fun, but it must describe real protocol state.

---

## Metrics worth adding later

- committee size;
- delegation diversity inside a committee;
- committee-originated evidence/challenges;
- how often committee members disagree with one another;
- whether a committee surfaced the argument that caused a later revision;
- whether extra committee structure improves benchmarks versus Free Parliament.

Do **not** invent a `Best Committee` award from prose similarity or an LLM judge. If a metric cannot be traced to protocol events, leave it out.

---

## Principle

> **Committees investigate a dimension. They never prescribe a winner.**

Or, in House language:

> Delegation tells you where the member came from. Committee tells you what they were asked to inspect. Caucus tells you where they ended up.
