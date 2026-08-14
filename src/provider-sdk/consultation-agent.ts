import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
} from "../core/types.js";
import { attachExplicitPeerReplies } from "../consultation/reply-provenance.js";
import { providerVisibleConsultationContext } from "./context-selection.js";
import {
  BROWSER_PROVIDER_EXECUTION_AUDIT,
  providerAuditBase,
  type ProviderExecutionAuditSink,
} from "./execution-audit.js";
import { buildModeAwareProviderConsultationPrompt } from "./consultation-mode-prompt.js";
import {
  parseProviderConsultationResponse,
  type ProviderConsultationSessionPreparer,
  type ProviderConsultationTransport,
} from "./consultation-protocol.js";
import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

const NOOP_PREPARE: ProviderConsultationSessionPreparer = async () => undefined;

/**
 * Public compatibility export used by product tests and protocol gates.
 * Keep one real prompt path so BrowserConsultationAgent and engine tests cannot drift.
 */
export function buildProviderConsultationPrompt(context: CouncilContext): string {
  return buildModeAwareProviderConsultationPrompt(context);
}

/**
 * Real Provider parse path: base schema validation and explicit-reply provenance
 * both use the exact same bounded public snapshot that was visible in the prompt.
 */
export function parseProviderConsultationTurn(
  raw: string,
  context: CouncilContext,
): readonly CouncilContribution[] {
  const visible = providerVisibleConsultationContext(context).context;
  const parsed = parseProviderConsultationResponse(raw, visible);
  return attachExplicitPeerReplies(raw, visible, parsed);
}

export class BrowserConsultationAgent implements CouncilAgent {
  readonly participant;
  readonly #profile: ProviderProfile;
  readonly #recipe: AdapterRecipe;
  readonly #transport: ProviderConsultationTransport;
  readonly #prepareSession: ProviderConsultationSessionPreparer;
  readonly #audit: ProviderExecutionAuditSink;
  #preparedSessionId: string | null = null;

  constructor(
    profile: ProviderProfile,
    recipe: AdapterRecipe,
    transport: ProviderConsultationTransport,
    prepareSession: ProviderConsultationSessionPreparer = NOOP_PREPARE,
    audit: ProviderExecutionAuditSink = BROWSER_PROVIDER_EXECUTION_AUDIT,
  ) {
    if (!adapterRecipeComplete(recipe)) {
      throw new Error("A real consultation participant requires a complete 3/3 Adapter Recipe.");
    }
    this.#profile = profile;
    this.#recipe = recipe;
    this.#transport = transport;
    this.#prepareSession = prepareSession;
    this.#audit = audit;
    this.participant = {
      id: profile.profileId,
      name: profile.displayName,
      provider: profile.providerId,
      role: "Independent AI Participant",
    };
  }

  async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
    const base = providerAuditBase(this.#profile, context);
    await this.#audit({ ...base, stage: "turn_started", observedAt: new Date().toISOString() });

    try {
      if (
        !context.sessionId.startsWith("extension-consultation-gate:") &&
        context.sessionId !== this.#preparedSessionId
      ) {
        await this.#prepareSession(this.#profile, this.#recipe);
        this.#preparedSessionId = context.sessionId;
        await this.#audit({ ...base, stage: "session_prepared", observedAt: new Date().toISOString() });
      }
      return await runConsultationTurn(
        this.#profile,
        this.#recipe,
        context,
        this.#transport,
        this.#audit,
      );
    } catch (caught) {
      const contribution = fallbackContribution(context, caught);
      await this.#audit({
        ...base,
        stage: "fallback_emitted",
        contributionKinds: contribution.map((item) => item.kind),
        error: truncate(errorMessage(caught), 600),
        observedAt: new Date().toISOString(),
      });
      return contribution;
    }
  }
}

async function runConsultationTurn(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  context: CouncilContext,
  transport: ProviderConsultationTransport,
  audit: ProviderExecutionAuditSink,
): Promise<readonly CouncilContribution[]> {
  const base = providerAuditBase(profile, context);
  const prompt = buildProviderConsultationPrompt(context);
  const first = await transport(profile, recipe, prompt);
  try {
    const parsed = parseProviderConsultationTurn(first.responseText, context);
    await audit({
      ...base,
      stage: "structured_parsed",
      attempt: 1,
      contributionKinds: parsed.map((item) => item.kind),
      observedAt: new Date().toISOString(),
    });
    return parsed;
  } catch (firstError) {
    await audit({
      ...base,
      stage: "repair_requested",
      attempt: 1,
      error: truncate(errorMessage(firstError), 600),
      observedAt: new Date().toISOString(),
    });
    const repairPrompt = [
      prompt,
      "",
      "REPAIR ATTEMPT:",
      `Your previous response was rejected by the structured consultation parser: ${JSON.stringify(errorMessage(firstError))}`,
      "Return the same consultation turn again as one corrected CHATCHAT_COUNCIL_JSON envelope. Do not discuss the parser error.",
    ].join("\n");
    const second = await transport(profile, recipe, repairPrompt);
    try {
      const repaired = parseProviderConsultationTurn(second.responseText, context);
      await audit({
        ...base,
        stage: "structured_parsed",
        attempt: 2,
        contributionKinds: repaired.map((item) => item.kind),
        observedAt: new Date().toISOString(),
      });
      return repaired;
    } catch (secondError) {
      await audit({
        ...base,
        stage: "structured_failed",
        attempt: 2,
        error: truncate(errorMessage(secondError), 600),
        observedAt: new Date().toISOString(),
      });
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
