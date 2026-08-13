import { FormEvent, useEffect, useState } from "react";
import avatarUrl from "../../assets/chatchat-avatar-pixel.png";
import { captureProviderProofSnapshot, type ProviderProofSnapshot } from "../validation/proof-pack.js";
import { AdvisorDock } from "./components/AdvisorDock.js";
import { CouncilReportPanel } from "./components/CouncilReportPanel.js";
import { CouncilTheater } from "./components/CouncilTheater.js";
import { DemoTheater } from "./components/DemoTheater.js";
import { EventFeed } from "./components/EventFeed.js";
import { FreshVerdict } from "./components/FreshVerdict.js";
import { GateBProofPanel } from "./components/GateBProofPanel.js";
import { HistorianPanel } from "./components/HistorianPanel.js";
import { RoundTable } from "./components/RoundTable.js";
import { useCouncilSession } from "./useCouncilSession.js";
import { useProviderProfiles } from "./useProviderProfiles.js";

const DEMO_QUESTION =
  "如果 ChatChat 要做 local-first 桌面客户端，Tauri 和 Electron 哪个更适合作为第一版技术底座？";

export default function App() {
  const [question, setQuestion] = useState(DEMO_QUESTION);
  const [proofSnapshot, setProofSnapshot] = useState<ProviderProofSnapshot[] | null>(null);
  const providers = useProviderProfiles();
  const council = useCouncilSession(providers.seatedAgents);
  const theaterShowcase =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("showcase") === "theater";

  useEffect(() => {
    if (!council.report || council.resultSource !== "current") {
      setProofSnapshot(null);
      return;
    }

    setProofSnapshot(
      captureProviderProofSnapshot({
        profiles: providers.profiles,
        recipes: providers.recipes,
        speechResults: providers.speechResults,
        bridgeResults: providers.bridgeResults,
        providerHostProfileIds: providers.providerHostProfileIds,
      }),
    );
    // Freeze Provider state at Council completion. Later window-health changes
    // must not rewrite evidence for the already-completed run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [council.report?.sessionId, council.resultSource]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void council.convene(question);
  };

  const openArchive = async (sessionId: string) => {
    const archive = await council.openHistory(sessionId);
    if (archive) setQuestion(archive.question);
  };

  const viewMode = council.report
    ? council.lastCompletedMode ?? council.mode
    : council.mode;
  const modeLabel = council.resultSource === "archive"
    ? `ARCHIVE · ${viewMode.toUpperCase()}`
    : council.mode === "live"
      ? `LIVE · ${providers.liveSeatCount} REAL`
      : council.mode === "hybrid"
        ? "HYBRID · 1 REAL"
        : "DEMO · MOCK";

  return (
    <div className="fresh-app-shell">
      <header className="fresh-topbar">
        <div className="fresh-brand">
          <img src={avatarUrl} alt="ChatChat pixel council avatar" />
          <div><strong>ChatChat</strong><span>Your local AI Council</span></div>
        </div>
        <div className="fresh-top-actions">
          <span className={`fresh-mode fresh-mode--${viewMode}`}>{modeLabel}</span>
          <span className="fresh-local"><i /> LOCAL-FIRST</span>
        </div>
      </header>

      <main className="fresh-main">
        <section className="fresh-hero-card">
          <div className="fresh-hero-copy">
            <span className="fresh-eyebrow">YOU ASK · THEY DEBATE</span>
            <h1>把问题交给你的<br />AI 议会。</h1>
            <p>
              你只需要下令一次。密室独立思考、公开廷议、质疑、改口与最终表态都会自动完成。
            </p>
          </div>

          <div className="fresh-advisor-bar">
            <div className="fresh-advisor-bar__head">
              <span>本次席位</span>
              <button
                type="button"
                onClick={() => document.getElementById("provider-settings")?.scrollIntoView({ behavior: "smooth" })}
              >
                管理 AI
              </button>
            </div>
            <div className="fresh-advisors">
              {council.participants.slice(0, 10).map((participant, index) => (
                <div className="fresh-advisor" key={participant.id} title={participant.name}>
                  <b>{monogram(participant.name)}</b>
                  <span>{participant.name}</span>
                  <small>{participant.delegationName ? `Seat ${participant.seatIndex ?? index + 1}` : participant.provider === "mock" ? "Mock" : "Live"}</small>
                </div>
              ))}
              {council.participants.length > 10 ? (
                <div className="fresh-advisor fresh-advisor--more">
                  <b>+{council.participants.length - 10}</b><span>more seats</span>
                </div>
              ) : null}
            </div>
          </div>

          <form className="fresh-command" onSubmit={submit}>
            <label htmlFor="king-command">KING'S COMMAND · 今天议什么？</label>
            <textarea
              id="king-command"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={council.isRunning}
              rows={3}
              placeholder="把问题、需求或一个艰难的决定交给 AI 议会……"
            />
            <div className="fresh-command__footer">
              <span>{commandCopy(council.mode, providers.liveSeatCount)}</span>
              <button type="submit" disabled={council.isRunning || !question.trim()}>
                <strong>{council.isRunning ? "廷议中" : council.mode === "live" ? "LIVE 开廷" : "开廷"}</strong>
                <b>{council.isRunning ? "···" : "→"}</b>
              </button>
            </div>
            <div className="fresh-command__links">
              <button type="button" onClick={() => setQuestion(DEMO_QUESTION)} disabled={council.isRunning}>
                载入示例
              </button>
              {council.stage === "complete" || council.stage === "error" ? (
                <button type="button" onClick={council.reset} disabled={council.isRunning}>
                  新的廷议
                </button>
              ) : null}
            </div>
          </form>

          <FreshStage stage={council.stage} round={council.round} />
        </section>

        {council.error ? (
          <div className="fresh-error"><strong>廷议中断</strong><span>{council.error}</span></div>
        ) : null}

        {council.report ? <FreshVerdict report={council.report} /> : null}

        <details className="fresh-disclosure" defaultOpen={theaterShowcase}>
          <summary>
            <div>
              <b>查看议会过程</b>
              <span>圆桌 · Blackboard · 谁说服了谁 · 完整奏议</span>
            </div>
            <small>{council.events.length ? `${council.events.length} events` : "等待开廷"}</small>
          </summary>
          <div className="fresh-disclosure__body">
            <div className="fresh-process-grid">
              <div>
                <RoundTable
                  participants={council.participants}
                  events={council.events}
                  stage={council.stage}
                  mode={viewMode}
                  round={council.round}
                  activeActorId={council.activeActorId}
                  question={council.activeQuestion}
                />
              </div>
              <EventFeed
                events={council.events}
                participants={council.participants}
                stage={council.stage}
              />
            </div>

            {council.report ? <CouncilReportPanel report={council.report} /> : null}
            {council.report ? (
              <CouncilTheater
                participants={council.participants}
                events={council.events}
                report={council.report}
              />
            ) : null}
          </div>
        </details>

        <details className="fresh-disclosure fresh-disclosure--advanced" id="provider-settings">
          <summary>
            <div>
              <b>AI 与高级设置</b>
              <span>Provider · Teach · Test/Gate · Proof · 史官</span>
            </div>
            <small>{providers.profiles.length} providers</small>
          </summary>
          <div className="fresh-disclosure__body fresh-advanced-stack">
            <DemoTheater
              profiles={providers.profiles}
              recipes={providers.recipes}
              loginWindowProfileIds={providers.loginWindowProfileIds}
              providerHostProfileIds={providers.providerHostProfileIds}
              speechResults={providers.speechResults}
              bridgeResults={providers.bridgeResults}
              liveSeatCount={providers.liveSeatCount}
              mode={council.mode}
              disabled={council.isRunning || providers.isLoading}
              onLoadQuestion={setQuestion}
            />

            <AdvisorDock
              profiles={providers.profiles}
              recipes={providers.recipes}
              backend={providers.backend}
              error={providers.error}
              loginError={providers.loginError}
              loginWindowProfileIds={providers.loginWindowProfileIds}
              providerHostProfileIds={providers.providerHostProfileIds}
              windowHealth={providers.windowHealth}
              probeResults={providers.probeResults}
              probingProfileId={providers.probingProfileId}
              teaching={providers.teaching}
              speechResults={providers.speechResults}
              testingProfileId={providers.testingProfileId}
              bridgeResults={providers.bridgeResults}
              verifyingProfileId={providers.verifyingProfileId}
              liveSeatCount={providers.liveSeatCount}
              canOpenLogin={providers.canOpenLogin}
              disabled={council.isRunning || providers.isLoading}
              onInvite={providers.invite}
              onLogin={providers.openLogin}
              onProbe={providers.probe}
              onTeach={providers.teach}
              onCancelTeach={providers.cancelTeach}
              onTestSpeech={providers.testSpeech}
              onVerifyCouncil={providers.verifyCouncil}
              onToggleSeat={providers.toggleSeat}
              onRemove={providers.remove}
            />

            <GateBProofPanel
              providerSnapshot={proofSnapshot}
              report={council.report}
              events={council.events}
              mode={council.lastCompletedMode ?? council.mode}
              currentRun={council.resultSource === "current"}
              chatChatVersion={__CHATCHAT_VERSION__}
            />

            <HistorianPanel
              entries={council.history}
              backend={council.historyBackend}
              error={council.historyError}
              activeSessionId={council.report?.sessionId ?? null}
              disabled={council.isRunning}
              onOpen={(id) => void openArchive(id)}
            />
          </div>
        </details>
      </main>

      <footer className="fresh-footer">
        <span>ChatChat has no relay server.</span>
        <span>Round 1 stays sealed until all advisors finish.</span>
        <span>Advanced evidence stays available when you want it.</span>
      </footer>
    </div>
  );
}

function FreshStage({
  stage,
  round,
}: {
  stage: ReturnType<typeof useCouncilSession>["stage"];
  round: number;
}) {
  const stages = [
    { id: "sealed", name: "密室奏议", hint: "独立思考" },
    { id: "debate", name: "公开廷议", hint: "质询与举证" },
    { id: "final", name: "最终表态", hint: "形成奏议" },
  ] as const;
  const order = stage === "idle" || stage === "error" ? 0 : stage === "sealed" ? 1 : stage === "debate" ? 2 : 3;

  return (
    <div className="fresh-stage" role="status" aria-live="polite">
      {stages.map((item, index) => {
        const position = index + 1;
        const active =
          (item.id === stage) ||
          (stage === "complete" && item.id === "final");
        const done = stage === "complete" || order > position;
        return (
          <div className={`fresh-stage__step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`} key={item.id}>
            <span>{done ? "✓" : active ? "•" : position}</span>
            <div><strong>{item.name}</strong><small>{active && round ? `Round ${round} · ` : ""}{item.hint}</small></div>
          </div>
        );
      })}
    </div>
  );
}

function commandCopy(mode: ReturnType<typeof useCouncilSession>["mode"], liveSeatCount: number): string {
  if (mode === "live") return `${liveSeatCount} 位真实网页智囊已入席。之后的讨论会自动进行。`;
  if (mode === "hybrid") return "当前是 1 位真实智囊 + Mock 陪练；再入席 1 位真实 AI 即解锁纯 LIVE。";
  return "当前使用 deterministic Mock Council，适合先体验完整流程。";
}

function monogram(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
