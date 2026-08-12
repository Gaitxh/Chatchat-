import { useCallback, useMemo, useState } from "react";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilPhase,
  CouncilReport,
} from "../core/types.js";
import { createMockCouncil } from "../providers/mock-council.js";

export type CouncilUiStage =
  | "idle"
  | "sealed"
  | "debate"
  | "final"
  | "complete"
  | "error";

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function phaseToStage(phase: CouncilPhase): CouncilUiStage {
  return phase;
}

export function useCouncilSession() {
  const participants = useMemo<readonly CouncilParticipant[]>(
    () => createMockCouncil().map((agent) => agent.participant),
    [],
  );
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [stage, setStage] = useState<CouncilUiStage>("idle");
  const [round, setRound] = useState(0);
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const convene = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isRunning) return;

    setEvents([]);
    setReport(null);
    setError(null);
    setRound(0);
    setActiveActorId(null);
    setActiveQuestion(trimmed);
    setIsRunning(true);
    setStage("sealed");

    try {
      const orchestrator = new CouncilOrchestrator(createMockCouncil());
      const result = await orchestrator.run(trimmed, {
        maxRounds: 3,
        minDebateRounds: 1,
        convergenceThreshold: 0.75,
        onPhase: async ({ phase, round: phaseRound }) => {
          setStage(phaseToStage(phase));
          setRound(phaseRound);
          setActiveActorId(null);
          await pause(420);
        },
        onEvent: async (event) => {
          setEvents((current) => [...current, event]);
          setActiveActorId(event.actorId);
          const delay =
            event.kind === "revision"
              ? 900
              : event.kind === "final_position"
                ? 520
                : event.round === 1
                  ? 430
                  : 600;
          await pause(delay);
        },
      });

      setReport(result.report);
      setStage("complete");
      setRound(result.report.rounds);
      setActiveActorId(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStage("error");
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  const reset = useCallback(() => {
    if (isRunning) return;
    setEvents([]);
    setReport(null);
    setError(null);
    setStage("idle");
    setRound(0);
    setActiveActorId(null);
    setActiveQuestion("");
  }, [isRunning]);

  return {
    participants,
    events,
    report,
    stage,
    round,
    activeActorId,
    activeQuestion,
    error,
    isRunning,
    convene,
    reset,
  };
}
