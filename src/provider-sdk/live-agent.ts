import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
} from "../core/types.js";
import { BrowserCouncilAgent } from "./council-agent.js";
import { type AdapterRecipe } from "./recipe.js";
import { prepareProviderCouncilSession } from "./session-runtime.js";
import type { ProviderProfile } from "./types.js";

export class PreparedBrowserCouncilAgent implements CouncilAgent {
  readonly participant;
  readonly #profile: ProviderProfile;
  readonly #recipe: AdapterRecipe;
  readonly #inner: BrowserCouncilAgent;
  #preparedSessionId: string | null = null;

  constructor(profile: ProviderProfile, recipe: AdapterRecipe) {
    this.#profile = profile;
    this.#recipe = recipe;
    this.#inner = new BrowserCouncilAgent(profile, recipe);
    this.participant = this.#inner.participant;
  }

  async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
    if (context.sessionId !== this.#preparedSessionId) {
      try {
        await prepareProviderCouncilSession(this.#profile, this.#recipe);
        this.#preparedSessionId = context.sessionId;
      } catch (caught) {
        return preparationFallback(context, caught);
      }
    }
    return this.#inner.respond(context);
  }
}

export function createPreparedBrowserCouncilAgent(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
): CouncilAgent {
  return new PreparedBrowserCouncilAgent(profile, recipe);
}

function preparationFallback(
  context: CouncilContext,
  caught: unknown,
): readonly CouncilContribution[] {
  const message = caught instanceof Error ? caught.message : String(caught);
  const safe = message.length <= 600 ? message : `${message.slice(0, 600)}…`;
  if (context.phase === "final") {
    return [
      {
        kind: "final_position",
        stance: "Uncertain",
        content: `The real advisor could not prepare a clean Provider session. ${safe}`,
        confidence: 0,
        caveats: ["Fresh-session preparation failed; ChatChat did not reuse stale chat context."],
      },
    ];
  }
  return [
    {
      kind: "uncertain",
      content: `The real advisor could not prepare a clean Provider session. ${safe}`,
      confidence: 0,
    },
  ];
}
