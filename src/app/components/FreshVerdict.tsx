import type { CouncilReport } from "../../core/types.js";
import { deriveHouseSummary } from "../../house/delegations.js";

interface FreshVerdictProps {
  report: CouncilReport;
}

export function FreshVerdict({ report }: FreshVerdictProps) {
  const consensus = Math.round(report.consensusRatio * 100);
  const confidence = Math.round(report.confidence * 100);
  const house = deriveHouseSummary(report);
  const isHouse = report.positions.some(
    (position) => Boolean(position.participant.delegationId),
  );

  return (
    <section className="fresh-verdict" aria-label="Council result summary">
      <div className="fresh-verdict__topline">
        <span>COUNCIL VERDICT · 最终结论</span>
        <small>{report.rounds} rounds · {report.eventCount} events</small>
      </div>

      <div className="fresh-verdict__hero">
        <div>
          <h2>{report.consensusStance ?? "仍有分歧"}</h2>
          <p>
            {report.consensusStance
              ? `${consensus}% 的最终席位支持这个结论。少数意见仍然保留。`
              : "这场廷议没有形成单一多数结论，建议直接查看分歧。"}
          </p>
        </div>
        <div className="fresh-confidence" aria-label={`Winning confidence ${confidence}%`}>
          <strong>{confidence}</strong><span>%</span><small>confidence</small>
        </div>
      </div>

      {isHouse ? (
        <div className="fresh-dual-metrics">
          <Metric
            label="席位多数"
            value={house.seatMajority.stance ?? "Tie"}
            detail={`${house.seatMajority.support}/${house.seatMajority.total} · ${Math.round(house.seatMajority.ratio * 100)}%`}
          />
          <Metric
            label="代表团共识"
            value={house.delegationConsensus.stance ?? "Split"}
            detail={`${house.delegationConsensus.support}/${house.delegationConsensus.total} · ${Math.round(house.delegationConsensus.ratio * 100)}%`}
          />
        </div>
      ) : null}

      <div className="fresh-position-strip">
        {report.positions.slice(0, 8).map((position) => (
          <div className="fresh-position-chip" key={position.participant.id}>
            <span>{position.participant.name}</span>
            <strong>{position.stance}</strong>
            <small>{Math.round(position.confidence * 100)}%</small>
          </div>
        ))}
        {report.positions.length > 8 ? (
          <div className="fresh-position-chip fresh-position-chip--more">
            +{report.positions.length - 8} seats
          </div>
        ) : null}
      </div>

      {report.disagreements.length ? (
        <div className="fresh-minority">
          <span>🛡 少数意见</span>
          <p>
            {report.disagreements
              .slice(0, 4)
              .map((position) => `${position.participant.name}: ${position.stance}`)
              .join(" · ")}
            {report.disagreements.length > 4 ? ` · +${report.disagreements.length - 4}` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="fresh-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
