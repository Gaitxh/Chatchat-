# Convergence Response Rule

ChatChat may use stance alignment as a signal that open debate can end early, but alignment is not authority.

## Rule

After the minimum open-debate depth for the selected Proposal Mode has been reached, the consultation may converge early only when both are true:

1. the latest participant positions meet the mode's convergence threshold; and
2. the current debate round introduced no fresh unresolved signal that still deserves peer visibility.

Fresh unresolved signals are:

- `challenge`
- `evidence`
- `revision`
- `question`
- `uncertain`

If one of those appears and another public debate round remains within the mode's existing `maxRounds`, ChatChat keeps the next debate round so peers receive that event in the shared snapshot before the meeting can move to final positions.

## What this does not mean

This is **not** an unbounded debate loop. Proposal Mode pacing remains the hard outer bound. If the mode has no debate round left, the consultation proceeds to final positions even when a fresh signal appeared in the last allowed round.

Support, defense, and concession events do not automatically force an extra debate round by themselves; they remain part of the public record and can affect later participant responses when a round remains for other reasons.

## Why

A 75% or 90% alignment meter should not be able to silence a serious new counterexample, evidence item, or explicit change of mind in the same breath it appears. Majority is evidence to inspect, not a chair's authority to close the room.
