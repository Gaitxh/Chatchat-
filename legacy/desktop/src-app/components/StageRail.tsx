import type { CouncilUiStage } from "../useCouncilSession.js";

interface StageRailProps {
  stage: CouncilUiStage;
}

const stages: Array<{
  id: "sealed" | "debate" | "final" | "complete";
  number: string;
  title: string;
}> = [
  { id: "sealed", number: "01", title: "密室奏议" },
  { id: "debate", number: "02", title: "公开廷议" },
  { id: "final", number: "03", title: "最终立场" },
  { id: "complete", number: "04", title: "Council Report" },
];

const order: Record<CouncilUiStage, number> = {
  idle: -1,
  sealed: 0,
  debate: 1,
  final: 2,
  complete: 3,
  error: -1,
};

export function StageRail({ stage }: StageRailProps) {
  const current = order[stage];

  return (
    <nav className="stage-rail" aria-label="Council progress">
      {stages.map((item, index) => (
        <div
          className={`stage-step ${index === current ? "is-current" : ""} ${index < current ? "is-done" : ""}`}
          key={item.id}
        >
          <span>{index < current ? "✓" : item.number}</span>
          <strong>{item.title}</strong>
        </div>
      ))}
    </nav>
  );
}
