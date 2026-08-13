import type { Locale } from "../../i18n/index.js";
import { sourceAgeDays, type EvidenceSourceObservation } from "../../evidence/source-metadata.js";

export function SourceObservationDetail({ observation, locale }: {
  observation: EvidenceSourceObservation | undefined;
  locale: Locale;
}) {
  if (!observation || observation.state !== "reachable") return null;
  const zh = locale === "zh-CN";
  const ageDays = sourceAgeDays(observation.pageDate, observation.observedAt);
  const hasDetail = Boolean(
    observation.description ||
    observation.excerpt ||
    observation.pageDate ||
    observation.bodyHash ||
    observation.textCharacters,
  );
  if (!hasDetail) return null;

  return (
    <details className="source-observation">
      <summary>
        <span>⌁</span>
        <strong>{zh ? "来源观察" : "SOURCE OBSERVATION"}</strong>
        <small>{zh ? "机器读取的有限页面信息，不是事实裁决" : "bounded machine-observed page data · not a truth verdict"}</small>
      </summary>
      <div className="source-observation__body">
        {observation.description ? (
          <section>
            <b>{zh ? "页面描述" : "PAGE DESCRIPTION"}</b>
            <p>{observation.description}</p>
          </section>
        ) : null}
        {observation.excerpt ? (
          <section>
            <b>{zh ? "有限正文片段" : "BOUNDED TEXT EXCERPT"}</b>
            <p>{observation.excerpt}</p>
          </section>
        ) : null}
        <dl>
          {observation.pageDate ? (
            <div>
              <dt>{zh ? "页面日期信号" : "PAGE DATE SIGNAL"}</dt>
              <dd>{observation.pageDate}<small>{dateKind(observation.pageDateKind, locale)}</small></dd>
            </div>
          ) : null}
          {ageDays !== null ? (
            <div>
              <dt>{zh ? "与检查时间相差" : "AGE AT OBSERVATION"}</dt>
              <dd>{ageDays} {zh ? "天" : "days"}<small>{zh ? "仅表示日期距离，不自动判定过时" : "age signal only · not automatically stale"}</small></dd>
            </div>
          ) : null}
          {observation.bodyHash ? (
            <div>
              <dt>{zh ? "内容指纹" : "CONTENT FINGERPRINT"}</dt>
              <dd><code>{observation.bodyHash}</code><small>{zh ? "用于判断同一来源之后是否发生变化" : "helps detect later source changes"}</small></dd>
            </div>
          ) : null}
          {typeof observation.textCharacters === "number" ? (
            <div>
              <dt>{zh ? "可读文本规模" : "READABLE TEXT"}</dt>
              <dd>{observation.textCharacters.toLocaleString()} {zh ? "字符" : "characters"}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </details>
  );
}

function dateKind(kind: EvidenceSourceObservation["pageDateKind"], locale: Locale): string {
  const zh = locale === "zh-CN";
  if (kind === "published") return zh ? "发布信号" : "published signal";
  if (kind === "modified") return zh ? "修改信号" : "modified signal";
  return zh ? "页面日期信号" : "page date signal";
}
