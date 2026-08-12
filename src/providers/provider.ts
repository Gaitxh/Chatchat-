import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilParticipant,
} from "../core/types.js";

export type CouncilResponder = (
  context: CouncilContext,
) =>
  | readonly CouncilContribution[]
  | Promise<readonly CouncilContribution[]>;

export class ScriptedCouncilAgent implements CouncilAgent {
  readonly participant: CouncilParticipant;
  readonly #responder: CouncilResponder;

  constructor(participant: CouncilParticipant, responder: CouncilResponder) {
    this.participant = participant;
    this.#responder = responder;
  }

  async respond(
    context: CouncilContext,
  ): Promise<readonly CouncilContribution[]> {
    return this.#responder(context);
  }
}
