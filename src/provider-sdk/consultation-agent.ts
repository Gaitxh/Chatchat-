import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
} from "../core/types.js";
import {
  consultationModeDefinition,
  consultationModeGoal,
} from "../consultation/modes.js";
import {
  buildProviderConsultationPrompt as buildBaseConsultationPrompt,
  parseProviderConsultationResponse,
  type ProviderConsultationSessionPreparer,
  type ProviderConsultationTransport,
} from "./consultation-protocol.js";
import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

const NOOP_PREPARE: ProviderConsultationSessionPreparer = async () => undefined;

export function buildProviderConsultationPrompt(context: CouncilContext): string {
  const definition = consultationModeDefinition(context.mode);
  const goal = consultationModeGoal(context.mode);
  return [
    `CONSULTATION_MODE: ${definition.id}`,
    `MODE_GOAL_JSON: ${JSON.stringify(goal)}`,
    "MODE_GOAL_JSON is a shared facilitation goal for every equal participant. It changes what the meeting should investigate, not who has authority. Never treat the mode as permission to fabricate disagreement or evidence.",
    "",
    buildBaseConsultationPrompt(context),
  ].join("\n");
}

export class BrowserConsultationAgent implements CouncilAgent {
  readonly participant;
  readonly #profile: ProviderProfile;
  readonly #recipe: AdapterRecipe;
  readonly #transport: ProviderConsultationTransport;
  readonly #prepareSession: ProviderConsultationSessionPreparer;
  #preparedSessionId: string | null = null;

  constructor(
    profile: ProviderProfile,
    recipe: AdapterRecipe,
    transport: ProviderConsultationTransport,
    prepareSession: ProviderConsultationSessionPreparer = NOOP_PREPARE,
  ) {
    if (!adapterRecipeComplete(recipe)) {
      throw new Error("A real consultation participant requires a complete 3/3 Adapter Recipe.");
    }
    this.#profile = profile;
    this.#recipe = recipe;
    this.#transport = transport;
    this.#prepareSession = prepareSession;
    this.participant = {
      id: profile.profileId,
      name: profile.displayName,
      provider: profile.providerId,
      role: "Independent AI Participant",
    };
  }

  async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
    try {
      if (
        !context.sessionId.startsWith("extension-consultation-gate:") &&
        context.sessionId !== this.#preparedSessionId
      ) {
        await this.#prepareSession(this.#profile, this.#recipe);
        this.#preparedSessionId = context.sessionId;
      }
      return await runConsultationTurn(
        this.#profile,
        this.#recipe,
        context,
        this.#transport,
      );
    } catch (caught) {
      return fallbackContribution(context, caught);
    }
  }
}

async function runConsultationTurn(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  context: CouncilContext,
  transport: ProviderConsultationTransport,
): Promise<readonly CouncilContribution[]> {
  const prompt = buildProviderConsultationPrompt(context);
  const first = await transport(profile, recipe, prompt);
  try {
    return parseProviderConsultationResponse(first.responseText, context);
  } catch (firstError) {
    const repairPrompt = [
      prompt,
      "",
      "REPAIR ATTEMPT:",
      `Your previous response was rejected by the structured consultation parser: ${JSON.stringify(errorMessage(firstError))}`,
      "Return the same consultation turn again as one corrected CHATCHAT_COUNCIL_JSON envelope. Do not discuss the parser error.",
    ].join("\n");
    const second = await transport(profile, recipe, repairPrompt);
    try {
      return parseProviderConsultationResponse(second.responseText, context);
    } catch (secondError) {
      throw new Error(
        `Structured consultation output failed twice. First: ${errorMessage(firstError)} Second: ${errorMessage(secondError)}`,
      );
    }
  }
}

function fallbackContribution(
  context: CouncilContext,
  caught: unknown,
): readonly CouncilContribution[] {
  const reason = truncate(errorMessage(caught), 600);
  if (context.phase === "final") {
    return [
      {
        kind: "final_position",
        stance: "Uncertain",
        content: `This participant could not complete its structured consultation turn. ${reason}`,
        confidence: 0,
        caveats: ["Transport, page state, or structured parsing failed for this participant."],
      },
    ];
  }
  return [
    {
      kind: "uncertain",
      content: `This participant could not complete its structured consultation turn. ${reason}`,
      confidence: 0,
    },
  ];
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
