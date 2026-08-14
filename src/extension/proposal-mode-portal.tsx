import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilConsultationMode } from "../core/types.js";
import { consultationModeRunPolicy } from "../consultation/mode-policy.js";
import {
  CONSULTATION_MODES,
  consultationModeDefinition,
} from "../consultation/modes.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import {
  announceProposalMode,
  isConsultationMode,
  PROPOSAL_MODE_SELECT_EVENT,
  PROPOSAL_MODE_STORAGE_KEY,
  type ProposalModeSelectionDetail,
} from "./proposal-mode-wire.js";
import "./proposal-mode-portal.css";

declare const chrome: any;

const DEFAULT_MODE: CouncilConsultationMode = "balanced";

function ProposalModePortal() {
  const [mode, setMode] = useState<CouncilConsultationMode>(DEFAULT_MODE);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [source, setSource] = useState<ProposalModeSelectionDetail["source"]>("restore");

  useEffect(() => {
    void chrome.storage.local.get(PROPOSAL_MODE_STORAGE_KEY).then((value: Record<string, unknown>) => {
      const stored = value[PROPOSAL_MODE_STORAGE_KEY];
      const restored = isConsultationMode(stored) ? stored : DEFAULT_MODE;
      setMode(restored);
      setSource("restore");
      announceProposalMode(restored, "restore");
    }).catch(() => announceProposalMode(DEFAULT_MODE, "restore"));

    const onSelect = (event: Event) => {
      const detail = (event as CustomEvent<ProposalModeSelectionDetail>).detail;
      if (!isConsultationMode(detail?.mode)) return;
      void choose(detail.mode, detail.source ?? "user");
    };
    window.addEventListener(PROPOSAL_MODE_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(PROPOSAL_MODE_SELECT_EVENT, onSelect);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("proposal-mode-root");
    if (!root) return;

    const mount = () => {
      const proposal = document.querySelector(".consultation-app .proposal-card");
      const textarea = proposal?.querySelector("textarea");
      if (!proposal) return false;
      if (textarea) proposal.insertBefore(root, textarea);
      else proposal.append(root);
      return true;
    };

    if (mount()) return;
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function choose(next: CouncilConsultationMode, nextSource: ProposalModeSelectionDetail["source"]) {
    setMode(next);
    setSource(nextSource);
    await chrome.storage.local.set({ [PROPOSAL_MODE_STORAGE_KEY]: next });
    announceProposalMode(next, nextSource);
  }

  const definition = useMemo(() => consultationModeDefinition(mode), [mode]);
  const copy = locale === "zh-CN" ? definition.zhCN : definition.en;
  const policy = consultationModeRunPolicy(mode);
  const zh = locale === "zh-CN";

  return (
    <section className="proposal-mode-selector" aria-label={zh ? "协商模式" : "Consultation mode"}>
      <div className="proposal-mode-topline">
        <span>{zh ? "这场会议怎么开？" : "HOW SHOULD THIS MEETING THINK?"}</span>
        <small>{source === "next-move" ? (zh ? "由下一步建议预选 · 你仍可修改" : "Preselected by Next Move · you can change it") : (zh ? "所有 AI 使用同一模式" : "Same mode for every AI")}</small>
      </div>
      <div className="proposal-mode-options" role="radiogroup">
        {CONSULTATION_MODES.map((item) => {
          const label = locale === "zh-CN" ? item.zhCN.label : item.en.label;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={item.id === mode}
              className={item.id === mode ? "is-active" : ""}
              key={item.id}
              onClick={() => void choose(item.id, "user")}
              title={locale === "zh-CN" ? item.zhCN.short : item.en.short}
            >
              <b>{item.icon}</b><span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="proposal-mode-description">
        <div><strong>{definition.icon} {copy.label}</strong><span>{copy.short}</span></div>
        <p>{copy.goal}</p>
        <small>{zh
          ? `公开节奏：最多 ${policy.maxRounds} 个协商轮次 · 至少 ${policy.minDebateRounds} 轮公开讨论 · 收敛阈值 ${Math.round(policy.convergenceThreshold * 100)}%`
          : `Visible pacing: up to ${policy.maxRounds} consultation rounds · at least ${policy.minDebateRounds} open debate round${policy.minDebateRounds === 1 ? "" : "s"} · convergence ${Math.round(policy.convergenceThreshold * 100)}%`}</small>
      </div>
    </section>
  );
}

const root = document.getElementById("proposal-mode-root");
if (!root) throw new Error("ChatChat Proposal Mode root is missing.");
createRoot(root).render(<StrictMode><ProposalModePortal /></StrictMode>);
