import { FormEvent, useState } from "react";
import avatarUrl from "../../assets/chatchat-avatar-pixel.png";
import { CouncilReportPanel } from "./components/CouncilReportPanel.js";
import { EventFeed } from "./components/EventFeed.js";
import { RoundTable } from "./components/RoundTable.js";
import { StageRail } from "./components/StageRail.js";
import { useCouncilSession } from "./useCouncilSession.js";

const DEMO_QUESTION =
  "如果 ChatChat 要做 local-first 桌面客户端，Tauri 和 Electron 哪个更适合作为第一版技术底座？";

export default function App() {
  const [question, setQuestion] = useState(DEMO_QUESTION);
  const council = useCouncilSession();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void council.convene(question);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={avatarUrl} alt="ChatChat pixel council avatar" />
          <div>
            <span>LOCAL AI COUNCIL</span>
            <h1>ChatChat</h1>
          </div>
        </div>
        <div className="topbar-center">
          <span className="motto">YOU ASK · THEY DEBATE</span>
          <span className="build-badge">v0.2 COUNCIL CHAMBER</span>
        </div>
        <div className="privacy-badge" title="ChatChat itself has no relay server">
          <i />
          LOCAL-FIRST
        </div>
      </header>

      <StageRail stage={council.stage} />

      <main className="chamber-grid">
        <div className="council-column">
          <RoundTable
            participants={council.participants}
            events={council.events}
            stage={council.stage}
            round={council.round}
            activeActorId={council.activeActorId}
            question={council.activeQuestion}
          />

          {council.report ? (
            <CouncilReportPanel report={council.report} />
          ) : null}

          {council.error ? (
            <div className="error-banner">
              <strong>廷议中断</strong>
              <span>{council.error}</span>
            </div>
          ) : null}

          <form className="royal-command" onSubmit={submit}>
            <div className="command-heading">
              <span>👑 KING'S COMMAND</span>
              <small>
                v0.2 使用 deterministic mock council 演示协议；真实 Provider 在后续版本接入。
              </small>
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
              <button
                type="submit"
                disabled={council.isRunning || question.trim().length === 0}
              >
                <span>{council.isRunning ? "廷议中" : "下令"}</span>
                <b>{council.isRunning ? "···" : "↵"}</b>
              </button>
            </div>
            <div className="command-actions">
              <button
                type="button"
                className="text-action"
                onClick={() => setQuestion(DEMO_QUESTION)}
                disabled={council.isRunning}
              >
                载入演示问题
              </button>
              {council.stage === "complete" || council.stage === "error" ? (
                <button
                  type="button"
                  className="text-action"
                  onClick={council.reset}
                  disabled={council.isRunning}
                >
                  清空议场
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <EventFeed
          events={council.events}
          participants={council.participants}
          stage={council.stage}
        />
      </main>

      <footer className="app-footer">
        <span>NO CHATCHAT SERVER</span>
        <span>•</span>
        <span>Round 1 stays sealed from peer models</span>
        <span>•</span>
        <span>Minority opinions survive</span>
      </footer>
    </div>
  );
}
