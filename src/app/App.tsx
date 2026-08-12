import { FormEvent, useState } from "react";
import avatarUrl from "../../assets/chatchat-avatar-pixel.png";
import { AdvisorDock } from "./components/AdvisorDock.js";
import { CouncilReportPanel } from "./components/CouncilReportPanel.js";
import { DemoTheater } from "./components/DemoTheater.js";
import { EventFeed } from "./components/EventFeed.js";
import { HistorianPanel } from "./components/HistorianPanel.js";
import { RoundTable } from "./components/RoundTable.js";
import { StageRail } from "./components/StageRail.js";
import { useCouncilSession } from "./useCouncilSession.js";
import { useProviderProfiles } from "./useProviderProfiles.js";

const DEMO_QUESTION =
  "如果 ChatChat 要做 local-first 桌面客户端，Tauri 和 Electron 哪个更适合作为第一版技术底座？";

export default function App() {
  const [question, setQuestion] = useState(DEMO_QUESTION);
  const providers = useProviderProfiles();
  const council = useCouncilSession(providers.seatedAgents);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void council.convene(question);
  };

  const openArchive = async (sessionId: string) => {
    const archive = await council.openHistory(sessionId);
    if (archive) setQuestion(archive.question);
  };

  const modeLabel =
    council.mode === "live"
      ? `🔥 LIVE · ${providers.liveSeatCount} HEALTHY REAL`
      : council.mode === "hybrid"
        ? "⚗️ HYBRID · 1 HEALTHY REAL"
        : "🎭 DEMO · MOCK";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={avatarUrl} alt="ChatChat pixel council avatar" />
          <div><span>LOCAL AI COUNCIL</span><h1>ChatChat</h1></div>
        </div>
        <div className="topbar-center">
          <span className="motto">YOU ASK · THEY DEBATE</span>
          <span className="build-badge">v1 READINESS · PROVIDER HEALTH</span>
          <span className={`build-badge council-mode-badge council-mode-badge--${council.mode}`}>{modeLabel}</span>
        </div>
        <div className="privacy-badge" title="ChatChat itself has no relay server"><i />LOCAL-FIRST</div>
      </header>

      <StageRail stage={council.stage} />

      <main className="chamber-grid">
        <div className="council-column">
          <RoundTable
            participants={council.participants}
            events={council.events}
            stage={council.stage}
            mode={council.mode}
            round={council.round}
            activeActorId={council.activeActorId}
            question={council.activeQuestion}
          />

          {council.report ? <CouncilReportPanel report={council.report} /> : null}
          {council.error ? <div className="error-banner"><strong>廷议中断</strong><span>{council.error}</span></div> : null}

          <form className="royal-command" onSubmit={submit}>
            <div className="command-heading">
              <span>👑 KING'S COMMAND</span>
              <small>{commandCopy(council.mode, providers.liveSeatCount)}</small>
            </div>
            <div className="command-row">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={council.isRunning}
                rows={2}
                aria-label="Ask the AI Council"
                placeholder="向你的 AI 智囊团下令……"
              />
              <button type="submit" disabled={council.isRunning || !question.trim()}>
                <span>{council.isRunning ? "廷议中" : council.mode === "live" ? "LIVE 开廷" : "下令"}</span>
                <b>{council.isRunning ? "···" : "↵"}</b>
              </button>
            </div>
            <div className="command-actions">
              <button type="button" className="text-action" onClick={() => setQuestion(DEMO_QUESTION)} disabled={council.isRunning}>
                载入演示问题
              </button>
              {council.stage === "complete" || council.stage === "error" ? (
                <button type="button" className="text-action" onClick={council.reset} disabled={council.isRunning}>
                  清空议场
                </button>
              ) : null}
            </div>
          </form>

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

          <HistorianPanel
            entries={council.history}
            backend={council.historyBackend}
            error={council.historyError}
            activeSessionId={council.report?.sessionId ?? null}
            disabled={council.isRunning}
            onOpen={(id) => void openArchive(id)}
          />
        </div>

        <EventFeed
          events={council.events}
          participants={council.participants}
          stage={council.stage}
        />
      </main>

      <footer className="app-footer">
        <span>NO CHATCHAT SERVER</span><span>•</span>
        <span>ROUND 1 SEALED</span><span>•</span>
        <span>WINDOW HEALTH ENFORCED</span><span>•</span>
        <span>GHOST SEATS EVICTED</span><span>•</span>
        <span>{modeLabel}</span>
      </footer>
    </div>
  );
}

function commandCopy(mode: ReturnType<typeof useCouncilSession>["mode"], liveSeatCount: number): string {
  if (mode === "live") {
    return `${liveSeatCount} 位健康真实网页智囊已经入席。你只下令一次；之后 sealed → debate → final 全自动执行。任何 Provider 窗口掉线都会自动撤销该席位。`;
  }
  if (mode === "hybrid") {
    return "1 位健康真实网页智囊已入席：当前是 HYBRID REHEARSAL；再入席 1 位健康真实 AI 即解锁纯 LIVE COUNCIL。";
  }
  return "当前没有健康真实席位，所以自动退回 deterministic Mock Demo。下面的 Demo Theater 会显示真实 Provider 从 URL 到健康入席的每一道门。";
}
