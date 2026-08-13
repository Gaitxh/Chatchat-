import type { CouncilReport } from "../../core/types.js";
import { confidencePercent } from "../council-view.js";

interface CouncilReportPanelProps {
  report: CouncilReport;
}

export function CouncilReportPanel({ report }: CouncilReportPanelProps) {
  const consensusPercent = Math.round(report.consensusRatio * 100);

  return (
    <section className="council-report">
      <div className="report-heading">
        <div>
          <span className="panel-kicker">AI COUNCIL REPORT</span>
          <h2>最终奏议</h2>
        </div>
        <div className="report-seal">♛</div>
      </div>

      <div className="verdict-block">
        <span>COUNCIL VERDICT</span>
        <strong>{report.consensusStance ?? "No consensus"}</strong>
        <p>
          {consensusPercent}% 的智囊最终站在这一立场；少数意见不会被抹去。
        </p>
      </div>

      <div className="meter-group">
        <div className="meter-row">
          <span>Consensus</span>
          <strong>{consensusPercent}%</strong>
          <div className="meter-track">
            <i style={{ width: `${consensusPercent}%` }} />
          </div>
        </div>
        <div className="meter-row">
          <span>Winning confidence</span>
          <strong>{confidencePercent(report.confidence)}</strong>
          <div className="meter-track">
            <i style={{ width: confidencePercent(report.confidence) }} />
          </div>
        </div>
      </div>

      <div className="final-position-grid">
        {report.positions.map((position) => (
          <article key={position.participant.id}>
            <header>
              <strong>{position.participant.name}</strong>
              <span>{confidencePercent(position.confidence)}</span>
            </header>
            <b>{position.stance}</b>
            <p>{position.content}</p>
          </article>
        ))}
      </div>

      {report.disagreements.length > 0 ? (
        <div className="minority-report">
          <span>🛡️ MINORITY REPORT</span>
          {report.disagreements.map((position) => (
            <p key={position.participant.id}>
              <strong>{position.participant.name}</strong> 保留「{position.stance}」：
              {position.content}
            </p>
          ))}
        </div>
      ) : null}

      <footer>
        {report.rounds} rounds · {report.eventCount} council events · local session
      </footer>
    </section>
  );
}
