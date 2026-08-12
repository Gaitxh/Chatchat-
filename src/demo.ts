import { CouncilOrchestrator } from "./core/orchestrator.js";
import { formatEvent, formatReport } from "./core/format.js";
import { createMockCouncil } from "./providers/mock-council.js";

const question =
  "Build ChatChat as a local-first desktop AI Council. For the first desktop shell, should we choose Tauri or Electron?";

const agents = createMockCouncil();
const names = new Map(
  agents.map((agent) => [agent.participant.id, agent.participant.name]),
);

console.log("👑 THE KING HAS SPOKEN");
console.log(question);
console.log("\n🕯️ Round 1 is sealed. The council is thinking independently...\n");

const orchestrator = new CouncilOrchestrator(agents);
let currentRound = 0;

const { report } = await orchestrator.run(question, {
  maxRounds: 3,
  minDebateRounds: 2,
  convergenceThreshold: 0.75,
  onEvent(event) {
    if (event.round !== currentRound) {
      currentRound = event.round;
      const title =
        event.round === 1
          ? "🔔 SEALED OPINIONS PUBLISHED"
          : event.kind === "final_position"
            ? "⚖️ FINAL POSITIONS"
            : `🏛️ COUNCIL ROUND ${event.round}`;
      console.log(`\n${title}\n`);
    }

    console.log(formatEvent(event, names.get(event.actorId) ?? event.actorId));
    console.log();
  },
});

console.log("\n" + "=".repeat(72) + "\n");
console.log(formatReport(report));
