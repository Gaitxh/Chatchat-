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
  if (
    !participant.committeeId ||
    !participant.committeeName ||
    !participant.committeeTask
  ) {
    return null;
  }

  return {
    id: participant.committeeId,
    name: participant.committeeName,
    task: participant.committeeTask,
    rules: COMMITTEE_RULES,
  };
}

/**
 * Produce an explicit block that Provider runtimes can insert next to — never
 * inside — KING_QUESTION_JSON.
 */
export function committeePromptLines(
  participant: CouncilParticipant,
): string[] {
  const descriptor = committeePromptDescriptor(participant);
  if (!descriptor) {
    return ["COMMITTEE_MODE: free-parliament"];
  }

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
 * Safe textual insertion helper for prompt runtimes. It deliberately refuses
 * to guess where KING_QUESTION_JSON lives: the caller chooses an explicit
 * marker and receives a new string only if that marker exists exactly once.
 */
export function insertCommitteePromptBlock(
  prompt: string,
  participant: CouncilParticipant,
  afterLinePrefix = "KING_QUESTION_JSON:",
): string {
  const lines = prompt.split("\n");
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(afterLinePrefix));

  if (matches.length !== 1) {
    throw new Error(
      `Committee prompt insertion expected exactly one ${afterLinePrefix} line, found ${matches.length}.`,
    );
  }

  const insertion = committeePromptLines(participant);
  lines.splice(matches[0]!.index + 1, 0, ...insertion);
  return lines.join("\n");
}
