import type { CouncilParticipant } from "../core/types.js";

export interface CommitteePromptDescriptor {
  id: string;
  name: string;
  task: string;
  rules: readonly string[];
}

const COMMITTEE_RULES = [
  "Treat the committee task as an investigative lens, never as a desired conclusion.",
  "The King's explicit requirements and evidence outrank committee convenience.",
  "You may disagree with seats in your own committee or Provider delegation.",
  "Your final position remains your own; committee membership does not cast a bloc vote.",
] as const;

export function committeePromptDescriptor(
  participant: CouncilParticipant,
): CommitteePromptDescriptor | null {
  if (!participant.committeeId || !participant.committeeName || !participant.committeeTask) {
    return null;
  }
  return {
    id: participant.committeeId,
    name: participant.committeeName,
    task: participant.committeeTask,
    rules: COMMITTEE_RULES,
  };
}

export function committeePromptLines(participant: CouncilParticipant): string[] {
  const descriptor = committeePromptDescriptor(participant);
  if (!descriptor) return ["COMMITTEE_MODE: free-parliament"];
  return [
    "COMMITTEE_MODE: committee-parliament",
    `COMMITTEE_TASK_JSON: ${JSON.stringify({
      id: descriptor.id,
      name: descriptor.name,
      task: descriptor.task,
    })}`,
    `COMMITTEE_RULES_JSON: ${JSON.stringify(descriptor.rules)}`,
  ];
}

/**
 * Insert committee metadata beside the King's question, never into it.
 * Fail closed when the canonical marker is absent or ambiguous.
 */
export function insertCommitteePromptBlock(
  prompt: string,
  participant: CouncilParticipant,
  afterLinePrefix = "KING_QUESTION_JSON:",
): string {
  const lines = prompt.split("\n");
  const indexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(afterLinePrefix))
    .map(({ index }) => index);
  if (indexes.length !== 1) {
    throw new Error(
      `Committee prompt insertion expected exactly one ${afterLinePrefix} line, found ${indexes.length}.`,
    );
  }
  lines.splice(indexes[0]! + 1, 0, ...committeePromptLines(participant));
  return lines.join("\n");
}
