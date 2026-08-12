import { useCallback, useEffect, useMemo, useState } from "react";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
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
      setHistoryError(
        caught instanceof Error ? caught.message : String(caught),
      );
    }
  }, [historyStorePromise]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

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

      try {
        const store = await historyStorePromise;
        await store.save(createArchive(result.report, result.blackboard.events));
        await refreshHistory();
      } catch (caught) {
        setHistoryError(
          caught instanceof Error ? caught.message : String(caught),
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStage("error");
    } finally {
      setIsRunning(false);
    }
  }, [historyStorePromise, isRunning, refreshHistory]);

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
      setHistoryError(
        caught instanceof Error ? caught.message : String(caught),
      );
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
    history,
    historyBackend,
    historyError,
    convene,
    openHistory,
    reset,
  };
}
