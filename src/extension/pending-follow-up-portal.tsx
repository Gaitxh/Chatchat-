import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PendingInvestigationFollowUp } from "../history/investigation-trail.js";
import { consultationModeDefinition } from "../consultation/modes.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { BrowserInvestigationTrailStore } from "./investigation-trail-store.js";
import {
  clearInvestigationFollowUp,
  INVESTIGATION_FOLLOW_UP_CHANGED_EVENT,
  type InvestigationFollowUpChangedDetail,
} from "./investigation-trail-wire.js";
import "./pending-follow-up-portal.css";

const store = new BrowserInvestigationTrailStore();

function PendingFollowUpPortal() {
  const [pending, setPending] = useState<PendingInvestigationFollowUp | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    void store.getPending().then(setPending).catch(() => setPending(null));
    const onChanged = (event: Event) => {
      setPending((event as CustomEvent<InvestigationFollowUpChangedDetail>).detail?.pending ?? null);
    };
    window.addEventListener(INVESTIGATION_FOLLOW_UP_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INVESTIGATION_FOLLOW_UP_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("follow-up-link-root");
    if (!root) return;
    const mount = () => {
      const proposal = document.querySelector(".consultation-app .proposal-card");
      const textarea = proposal?.querySelector("textarea");
      if (!proposal) return false;
      const modeRoot = document.getElementById("proposal-mode-root");
      if (modeRoot?.parentElement === proposal) {
        proposal.insertBefore(root, modeRoot.nextSibling);
      } else if (textarea) {
        proposal.insertBefore(root, textarea);
      } else {
        proposal.append(root);
      }
      return true;
    };
    if (mount()) return;
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pending]);

  const mode = useMemo(
    () => pending ? consultationModeDefinition(pending.modeHint) : null,
    [pending],
  );

  if (!pending || !mode) return null;
  const zh = locale === "zh-CN";
  const label = zh ? pending.labelZhCN : pending.labelEn;
  const modeLabel = zh ? mode.zhCN.label : mode.en.label;

  return (
    <aside className="pending-follow-up" aria-label={zh ? "下一场会议关联" : "Follow-up link"}>
      <div className="pending-follow-up__mark">↳</div>
      <div className="pending-follow-up__body">
        <span>{zh ? "下一场将作为 FOLLOW-UP" : "NEXT MEETING WILL BE A FOLLOW-UP"}</span>
        <strong>{label}</strong>
        <p>{zh
          ? `来自：“${pending.parentProposalPreview}”`
          : `From: “${pending.parentProposalPreview}”`}</p>
        <small>{mode.icon} {modeLabel} · {zh
          ? "只有下一场成功完成后才会写入本地调查链，不会自动发送。"
          : "The local trail is written only after the next meeting completes. Nothing auto-sends."}</small>
      </div>
      <button type="button" onClick={clearInvestigationFollowUp}>
        {zh ? "取消关联" : "Clear link"}
      </button>
    </aside>
  );
}

const root = document.getElementById("follow-up-link-root");
if (!root) throw new Error("ChatChat follow-up link root is missing.");
createRoot(root).render(
  <StrictMode>
    <PendingFollowUpPortal />
  </StrictMode>,
);
