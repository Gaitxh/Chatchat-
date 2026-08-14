import { useMemo, type CSSProperties } from "react";
import type { Locale } from "../../i18n/index.js";
import {
  deriveInvestigationTrailForest,
  type InvestigationTrailEdge,
  type InvestigationTrailNode,
} from "../../history/investigation-trail.js";
import { consultationModeDefinition } from "../../consultation/modes.js";
import { requestOpenConsultationArchive } from "../history-wire.js";
import "./investigation-trail.css";

interface InvestigationTrailProps {
  edges: readonly InvestigationTrailEdge[];
  locale: Locale;
  knownSessionIds?: ReadonlySet<string>;
}

export function InvestigationTrail({
  edges,
  locale,
  knownSessionIds = new Set<string>(),
}: InvestigationTrailProps) {
  const forest = useMemo(() => deriveInvestigationTrailForest(edges), [edges]);
  const zh = locale === "zh-CN";
  if (!forest.length) return null;

  return (
    <section className="investigation-trail">
      <header>
        <div>
          <span>{zh ? "调查链" : "INVESTIGATION TRAIL"}</span>
          <h3>{zh ? "每一场 follow-up，都留下“为什么继续”。" : "Every follow-up keeps the reason it continued."}</h3>
          <p>{zh
            ? "这里只有用户明确从 NEXT MOVE 继续、并且下一场成功完成后才会出现连线。ChatChat 不会用文字相似度猜两个问题是不是同一条线。"
            : "A link appears only when you explicitly continue from NEXT MOVE and the next meeting completes. ChatChat never guesses relationships from text similarity."}</p>
        </div>
        <b>LOCAL · EXPLICIT</b>
      </header>

      <div className="investigation-trail__forest">
        {forest.slice(0, 3).map((root) => (
          <TrailNode
            key={root.sessionId}
            node={root}
            locale={locale}
            knownSessionIds={knownSessionIds}
            depth={0}
          />
        ))}
      </div>

      <small className="investigation-trail__boundary">{zh
        ? "调查链只记录会议之间的关系元数据；AI 全文仍然留在各自的本地会议档案里。"
        : "The trail stores relationship metadata only. Full AI event bodies remain inside each local consultation archive."}</small>
    </section>
  );
}

function TrailNode({
  node,
  locale,
  knownSessionIds,
  depth,
}: {
  node: InvestigationTrailNode;
  locale: Locale;
  knownSessionIds: ReadonlySet<string>;
  depth: number;
}) {
  const zh = locale === "zh-CN";
  const mode = consultationModeDefinition(node.mode);
  const modeLabel = zh ? mode.zhCN.label : mode.en.label;
  const canOpen = knownSessionIds.has(node.sessionId);
  const style = { "--trail-depth": String(Math.min(depth, 5)) } as CSSProperties;

  return (
    <div className="trail-node-wrap" style={style}>
      <article className="trail-node">
        <div className="trail-node__top">
          <span>{depth === 0 ? (zh ? "起点" : "ROOT") : (zh ? "会议" : "MEETING")}</span>
          <b>{mode.icon} {modeLabel}</b>
        </div>
        <strong>{node.proposalPreview}</strong>
        <small>{zh ? "结果" : "Outcome"}: {node.outcome}</small>
        {canOpen ? (
          <button type="button" onClick={() => requestOpenConsultationArchive(node.sessionId)}>
            {zh ? "打开本地回放" : "Open local replay"}
          </button>
        ) : null}
      </article>

      {node.children.map(({ edge, child }) => {
        const label = zh ? edge.labelZhCN : edge.labelEn;
        const suggestedMode = consultationModeDefinition(edge.modeHint);
        const suggestedLabel = zh ? suggestedMode.zhCN.label : suggestedMode.en.label;
        return (
          <div className="trail-branch" key={edge.childSessionId}>
            <div className="trail-branch__reason">
              <i>↳</i>
              <span>{label}</span>
              <em>{suggestedMode.icon} {suggestedLabel}</em>
            </div>
            <TrailNode
              node={child}
              locale={locale}
              knownSessionIds={knownSessionIds}
              depth={depth + 1}
            />
          </div>
        );
      })}
    </div>
  );
}
