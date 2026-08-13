import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilRunOptions,
  CouncilToolFact,
  CouncilToolFactsRequest,
} from "../core/types.js";
import { browserEvidenceToolFacts } from "./evidence-tool-provider.js";

const PATCH_MARKER = "__chatchatEvidenceToolFactsV1" as const;

type ObservablePrototype = typeof CouncilOrchestrator.prototype & {
  [PATCH_MARKER]?: true;
};

installEvidenceToolFacts();

function installEvidenceToolFacts() {
  const prototype = CouncilOrchestrator.prototype as ObservablePrototype;
  if (prototype[PATCH_MARKER]) return;
  prototype[PATCH_MARKER] = true;

  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = (async function (
    this: CouncilOrchestrator,
    question: string,
    options: CouncilRunOptions = {},
  ) {
    const upstream = options.toolFactsProvider;
    const toolFactsProvider = async (
      request: CouncilToolFactsRequest,
    ): Promise<readonly CouncilToolFact[]> => {
      const baseFacts = upstream ? await upstream(request) : [];
      const browserFacts = await browserEvidenceToolFacts(request);
      const deduped = new Map<string, CouncilToolFact>();
      for (const fact of [...baseFacts, ...browserFacts]) deduped.set(fact.id, fact);
      return [...deduped.values()];
    };

    return originalRun.call(this, question, {
      ...options,
      toolFactsProvider,
    });
  }) as typeof originalRun;
}
