import { useMemo, useState } from "react";
import type { CouncilEvent, CouncilReport } from "../../core/types.js";
import {
  buildGateBProofPack,
  coarsePlatformHint,
  gateBProofJson,
  gateBProofMarkdown,
  type GateBMode,
  type ProviderProofSnapshot,
} from "../../validation/proof-pack.js";
import "../proof-pack.css";

interface GateBProofPanelProps {
  providerSnapshot: readonly ProviderProofSnapshot[] | null;
  report: CouncilReport | null;
  events: readonly CouncilEvent[];
  mode: GateBMode;
  currentRun: boolean;
  chatChatVersion: string;
}

export function GateBProofPanel(props: GateBProofPanelProps) {
  const [environment, setEnvironment] = useState(() =>
    typeof navigator === "undefined"
      ? "Unknown OS"
      : `${coarsePlatformHint(navigator.userAgent)} · add OS version if filing an issue`,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const pack = useMemo(
    () =>
      buildGateBProofPack({
        providers: props.providerSnapshot ?? [],
        report: props.report,
        events: props.events,
        mode: props.mode,
        chatChatVersion: props.chatChatVersion,
        environment,
      }),
    [
      environment,
      props.chatChatVersion,
      props.events,
      props.mode,
      props.providerSnapshot,
      props.report,
    ],
  );

  if (!props.report) return null;

  const exportEnabled = props.currentRun && props.mode !== "demo";
  const verdictCopy =
    pack.verdict === "gate-b-candidate"
      ? { icon: "✅", label: "GATE B CANDIDATE", detail: "这场 LIVE Council 已满足本地证据包的结构条件。" }
      : pack.verdict === "demo-only"
        ? { icon: "🎭", label: "DEMO ONLY", detail: "Mock Council 不能作为真实 Provider 兼容性证据。" }
        : { icon: "⚠️", label: "EVIDENCE INCOMPLETE", detail: "至少还缺一个真实席位门槛，或这场不是完整 LIVE Council。" };

  const copy = async (format: "markdown" | "json") => {
    const text = format === "markdown" ? gateBProofMarkdown(pack) : gateBProofJson(pack);
    try {
      await writeClipboard(text);
      setNotice(format === "markdown" ? "Markdown 已复制，可直接贴到 Provider Compatibility Issue。" : "JSON Proof Pack 已复制。" );
    } catch (caught) {
      setNotice(`复制失败：${caught instanceof Error ? caught.message : String(caught)}`);
    }
  };

  const download = () => {
    const text = gateBProofJson(pack);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chatchat-gate-b-${pack.council?.sessionFingerprint ?? "evidence"}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("已生成本地 JSON 证据包。它不包含问题正文或模型回复。" );
  };

  return (
    <section className={`proof-pack proof-pack--${pack.verdict}`}>
      <header className="proof-pack__header">
        <div>
          <span className="eyebrow">ROYAL PROOF PACK · 御前验收证据</span>
          <h2>Turn a real Council into privacy-safe Gate B evidence</h2>
          <p>
            只导出 Provider host、门槛状态和 Council 统计。不会导出 King's Command、模型回复、Blackboard 正文、Teach selector、profile key、Cookie 或 token。
          </p>
        </div>
        <div className="proof-verdict">
          <b>{verdictCopy.icon}</b>
          <div><strong>{verdictCopy.label}</strong><span>{verdictCopy.detail}</span></div>
        </div>
      </header>

      <div className="proof-pack__grid">
        <div className="proof-card">
          <span className="eyebrow">FROZEN PROVIDER SNAPSHOT</span>
          <h3>{pack.providers.length} real seat{pack.providers.length === 1 ? "" : "s"} captured</h3>
          <div className="proof-provider-list">
            {pack.providers.length ? pack.providers.map((provider, index) => (
              <div className="proof-provider" key={`${provider.providerId}-${provider.host}-${index}`}>
                <div><strong>{provider.providerId}</strong><code>{provider.host}</code></div>
                <div className="proof-gates">
                  <span className={provider.recipeReady ? "is-pass" : ""}>Recipe</span>
                  <span className={provider.testPassed ? "is-pass" : ""}>Test</span>
                  <span className={provider.councilGatePassed ? "is-pass" : ""}>Gate</span>
                  <span className={provider.providerHostHealthy ? "is-pass" : ""}>Host</span>
                  <span className={provider.seated ? "is-pass" : ""}>Seat</span>
                </div>
              </div>
            )) : <p className="proof-empty">这场没有冻结真实席位，所以不能作为 Gate B Provider 证据。</p>}
          </div>
        </div>

        <div className="proof-card">
          <span className="eyebrow">COUNCIL METADATA ONLY</span>
          <h3>{pack.council ? `${pack.council.mode.toUpperCase()} · ${pack.council.rounds} rounds` : "No Council evidence"}</h3>
          {pack.council ? (
            <dl className="proof-stats">
              <div><dt>Real advisors</dt><dd>{pack.council.realParticipantCount}</dd></div>
              <div><dt>Real events</dt><dd>{pack.council.realEventCount}</dd></div>
              <div><dt>Challenges</dt><dd>{pack.council.eventKinds.challenge}</dd></div>
              <div><dt>Evidence</dt><dd>{pack.council.eventKinds.evidence}</dd></div>
              <div><dt>Revisions</dt><dd>{pack.council.eventKinds.revision}</dd></div>
              <div><dt>Final positions</dt><dd>{pack.council.finalPositionCount}</dd></div>
              <div><dt>Consensus</dt><dd>{Math.round(pack.council.consensusRatio * 100)}%</dd></div>
              <div><dt>Minority</dt><dd>{pack.council.minorityOpinionPresent ? "YES" : "NO"}</dd></div>
            </dl>
          ) : null}
        </div>
      </div>

      <div className="proof-environment">
        <label>
          <span>Public environment label</span>
          <input
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            maxLength={160}
            placeholder="macOS 15.x · Apple Silicon / Windows 11 / Ubuntu 24.04"
          />
        </label>
        <small>这是唯一允许你手工补充的环境文字。不要填写账号邮箱、用户名或私人会话信息。</small>
      </div>

      {!props.currentRun ? (
        <div className="proof-warning">📚 当前展示的是史册回放。为避免把“旧存档 + 当前 Provider 状态”混成伪证据，Proof Pack 导出已禁用。请完成一场新的本地 Council。</div>
      ) : props.mode === "demo" ? (
        <div className="proof-warning">🎭 Mock Demo 可以展示协议，但不能提交为真实 Provider Gate B 证据。</div>
      ) : null}

      <div className="proof-actions">
        <button type="button" disabled={!exportEnabled} onClick={() => void copy("markdown")}>COPY ISSUE MARKDOWN</button>
        <button type="button" disabled={!exportEnabled} onClick={() => void copy("json")}>COPY JSON</button>
        <button type="button" disabled={!exportEnabled} onClick={download}>DOWNLOAD JSON</button>
        <span>Schema: gate-b-proof/v{pack.schemaVersion} · ChatChat {pack.chatChatVersion}</span>
      </div>

      {notice ? <div className="proof-notice" role="status">{notice}</div> : null}
    </section>
  );
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Clipboard API unavailable.");
}
