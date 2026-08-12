import { useCallback, useEffect, useMemo, useState } from "react";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilEvent,
  CouncilParticipant,
  CouncilPhase,
  CouncilReport,
} from "../core/types.js";
import {
  createArchive,
  createCouncilHistoryStore,
  type ArchivedCouncil,
  type CouncilHistorySummary,
  type HistoryBackend,
} from "../history/index.js";
import { createMockCouncil } from "../providers/mock-council.js";

export type CouncilUiStage =
  | "idle"
  | "sealed"
  | "debate"
  | "final"
  | "complete"
  | "error";

export type CouncilRunMode = "demo" | "hybrid" | "live";

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function phaseToStage(phase: CouncilPhase): CouncilUiStage {
  return phase;
}

function composeCouncil(realAgents: readonly CouncilAgent[]): {
  agents: readonly CouncilAgent[];
  mode: CouncilRunMode;
} {
  if (realAgents.length === 0) {
    return { agents: createMockCouncil(), mode: "demo" };
  }
  if (realAgents.length === 1) {
    // A Council requires at least two agents. One live advisor is immediately
    // useful in a clearly-labelled hybrid rehearsal with deterministic mocks.
    return {
      agents: [realAgents[0]!, ...createMockCouncil().slice(0, 3)],
      mode: "hybrid",
    };
  }
  return { agents: realAgents.slice(0, 4), mode: "live" };
}

export function useCouncilSession(realAgents: readonly CouncilAgent[] = []) {
  const councilComposition = useMemo(
    () => composeCouncil(realAgents),
    [realAgents],
  );
  const participants = useMemo<readonly CouncilParticipant[]>(
    () => councilComposition.agents.map((agent) => agent.participant),
    [councilComposition.agents],
  );
  const historyStorePromise = useMemo(() => createCouncilHistoryStore(), []);
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [stage, setStage] = useState<CouncilUiStage>("idle");
  const [round, setRound] = useState(0);
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<CouncilHistorySummary[]>([]);
  const [historyBackend, setHistoryBackend] = useState<HistoryBackend | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const store = await historyStorePromise;
      setHistoryBackend(store.backend);
      setHistory(await store.list(12));
      setHistoryError(null);
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [historyStorePromise]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const convene = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isRunning) return;

    const { agents, mode } = councilComposition;
    if (agents.length < 2) {
      setError("至少需要两位智囊才能开廷。");
      return;
    }

    setEvents([]);
    setReport(null);
    setError(null);
    setRound(0);
    setActiveActorId(null);
    setActiveQuestion(trimmed);
    setIsRunning(true);
    setStage("sealed");

    const phasePause = mode === "demo" ? 420 : 80;

    try {
      const orchestrator = new CouncilOrchestrator(agents);
      const result = await orchestrator.run(trimmed, {
        maxRounds: 3,
        minDebateRounds: 1,
        convergenceThreshold: 0.75,
        onPhase: async ({ phase, round: phaseRound }) => {
          setStage(phaseToStage(phase));
          setRound(phaseRound);
          setActiveActorId(null);
          await pause(phasePause);
        },
        onEvent: async (event) => {
          setEvents((current) => [...current, event]);
          setActiveActorId(event.actorId);
          const delay =
            mode !== "demo"
              ? 90
              : event.kind === "revision"
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

      try {
        const store = await historyStorePromise;
        await store.save(createArchive(result.report, result.blackboard.events));
        await refreshHistory();
      } catch (caught) {
        setHistoryError(caught instanceof Error ? caught.message : String(caught));
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStage("error");
    } finally {
      setIsRunning(false);
    }
  }, [councilComposition, historyStorePromise, isRunning, refreshHistory]);

  const openHistory = useCallback(async (
    sessionId: string,
  ): Promise<ArchivedCouncil | null> => {
    if (isRunning) return null;

    try {
      const store = await historyStorePromise;
      const archive = await store.load(sessionId);
      if (!archive) return null;

      setEvents(archive.events);
      setReport(archive.report);
      setActiveQuestion(archive.question);
      setRound(archive.rounds);
      setStage("complete");
      setActiveActorId(null);
      setError(null);
      return archive;
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : String(caught));
      return null;
    }
  }, [historyStorePromise, isRunning]);

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
    mode: councilComposition.mode,
    realAdvisorCount: realAgents.length,
    history,
    historyBackend,
    historyError,
    convene,
    openHistory,
    reset,
  };
}
