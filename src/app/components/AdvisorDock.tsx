import { FormEvent, useMemo, useState } from "react";
import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
  type ProviderDetection,
  type ProviderPageProbe,
  type ProviderProfile,
  type ProviderProfileBackend,
} from "../../provider-sdk/index.js";
import "../provider.css";

interface AdvisorDockProps {
  profiles: readonly ProviderProfile[];
  backend: ProviderProfileBackend | null;
  error: string | null;
  loginError: string | null;
  loginWindowProfileIds: readonly string[];
  probeResults: Readonly<Record<string, ProviderPageProbe>>;
  probingProfileId: string | null;
  canOpenLogin: boolean;
  disabled: boolean;
  onInvite(url: string, displayName?: string): Promise<ProviderProfile>;
  onLogin(profile: ProviderProfile): Promise<void>;
  onProbe(profile: ProviderProfile): Promise<ProviderPageProbe>;
  onRemove(profileId: string): Promise<void>;
}

export function AdvisorDock(props: AdvisorDockProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://chatgpt.com");
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const detection = useMemo<ProviderDetection | null>(() => {
    try { return detectProviderUrl(url); } catch { return null; }
  }, [url]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSaving(true);
    try {
      await props.onInvite(url, name || undefined);
      setOpen(false);
      setName("");
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="advisor-dock">
      <header className="advisor-dock__header">
        <div>
          <span className="eyebrow">ADVISOR ROSTER · 智囊名册</span>
          <h2>Invite an AI to court</h2>
          <p>v0.6 加入「御前试音」：宿主可以安全探测已打开 Provider 页面的 DOM 结构，但不会读取 Cookie、密码或输入框值。</p>
        </div>
        <div className="advisor-dock__tools">
          <span className="provider-backend">{props.backend === "sqlite" ? "SQLITE · LOCAL" : "BROWSER · LOCAL"}</span>
          <button type="button" className="invite-button" onClick={() => setOpen(true)} disabled={props.disabled}>+ INVITE AI</button>
        </div>
      </header>

      {props.error ? <div className="provider-error">Provider profiles: {props.error}</div> : null}
      {props.loginError ? <div className="provider-error">Adapter lab: {props.loginError}</div> : null}

      <div className="advisor-roster">
        {props.profiles.length === 0 ? <EmptyRoster /> : props.profiles.map((profile) => {
          const loginOpen = props.loginWindowProfileIds.includes(profile.profileId);
          const probe = props.probeResults[profile.profileId];
          const adapterMissing = profile.authState === "adapter_required";
          const probing = props.probingProfileId === profile.profileId;
          return (
            <article className="advisor-profile" key={profile.profileId}>
              <div className="advisor-profile__avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="advisor-profile__body">
                <div className="advisor-profile__title">
                  <strong>{profile.displayName}</strong>
                  <span className={`auth-state auth-state--${profile.authState}`}>{authLabel(profile.authState)}</span>
                  {loginOpen ? <span className="login-window-badge">LOGIN WINDOW OPEN</span> : null}
                  {probe?.ok ? <span className="audition-badge">DOM PROBED</span> : null}
                </div>
                <span className="advisor-origin">{profile.origin}</span>
                <small>{profile.adapterId} · isolated local profile {shortKey(profile.profileKey)}</small>
                {probe ? <ProbeCard probe={probe} /> : loginOpen ? <span className="login-window-hint">登录完成后点击「御前试音」，ChatChat 只读取页面结构元数据，帮助 Adapter 找到 composer / action surface。</span> : null}
              </div>
              <div className="advisor-profile__actions">
                <button type="button" className="login-advisor" disabled={props.disabled || adapterMissing || !props.canOpenLogin} onClick={() => void props.onLogin(profile)}>
                  {loginOpen ? "FOCUS LOGIN" : "LOGIN"}
                </button>
                <button type="button" className="probe-advisor" disabled={props.disabled || !loginOpen || probing || adapterMissing} onClick={() => void props.onProbe(profile)} title="Probe DOM metadata only; never input values or cookies">
                  {probing ? "试音中…" : "御前试音"}
                </button>
                <button type="button" className="remove-advisor" onClick={() => void props.onRemove(profile.profileId)} disabled={props.disabled}>移除</button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="provider-catalog-strip" aria-label="Built-in provider catalog">
        {BUILT_IN_PROVIDER_MANIFESTS.map((manifest) => <span key={manifest.id}>{manifest.monogram} · {manifest.displayName}</span>)}
        <span>+ Custom URL</span>
        <span>Adapter Lab · metadata-only probe</span>
      </div>

      {open ? <InviteModal url={url} name={name} detection={detection} saving={saving} error={submitError} onUrl={setUrl} onName={setName} onClose={() => setOpen(false)} onSubmit={submit} /> : null}
    </section>
  );
}

function ProbeCard({ probe }: { probe: ProviderPageProbe }) {
  return (
    <div className={`probe-card ${probe.ok ? "probe-card--ok" : "probe-card--error"}`}>
      <div className="probe-card__summary">
        <strong>🎙 御前试音</strong>
        <span>{probe.ok ? `${probe.composerCandidates.length} composer · ${probe.actionCandidates.length} actions` : probe.error ?? "Probe failed"}</span>
      </div>
      <small>{probe.title || "Untitled page"} · {probe.readyState}</small>
      {probe.ok ? (
        <details>
          <summary>查看结构线索</summary>
          <div className="probe-elements">
            {probe.composerCandidates.map((candidate, index) => <code key={`composer-${index}`}>{describeElement(candidate)}</code>)}
            {probe.actionCandidates.slice(0, 8).map((candidate, index) => <code key={`action-${index}`}>{describeElement(candidate)}</code>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function describeElement(element: ProviderPageProbe["composerCandidates"][number]): string {
  const identity = element.dataTestId ? `[data-testid=${element.dataTestId}]` : element.id ? `#${element.id}` : element.ariaLabel ? `[aria-label=${element.ariaLabel}]` : "";
  return `${element.tag}${identity}${element.contentEditable ? " [contenteditable]" : ""}`;
}

function EmptyRoster() {
  return <div className="advisor-empty"><strong>圆桌外还没有真实智囊。</strong><span>先邀请 ChatGPT、Claude、Gemini、DeepSeek，或任意自定义 AI URL。</span></div>;
}

function InviteModal(props: { url: string; name: string; detection: ProviderDetection | null; saving: boolean; error: string | null; onUrl(value: string): void; onName(value: string): void; onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> }) {
  return (
    <div className="provider-modal-backdrop" role="presentation" onMouseDown={() => !props.saving && props.onClose()}>
      <div className="provider-modal" role="dialog" aria-modal="true" aria-labelledby="invite-advisor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="provider-modal__heading"><div><span className="eyebrow">SUMMON AN ADVISOR</span><h2 id="invite-advisor-title">邀请一位 AI 智囊</h2></div><button type="button" className="modal-close" onClick={props.onClose} disabled={props.saving}>×</button></div>
        <form onSubmit={(event) => void props.onSubmit(event)}>
          <label><span>Model URL</span><input value={props.url} onChange={(event) => props.onUrl(event.target.value)} placeholder="https://chatgpt.com" autoFocus /></label>
          <label><span>Display name <small>optional</small></span><input value={props.name} onChange={(event) => props.onName(event.target.value)} placeholder={props.detection?.displayName ?? "My AI"} /></label>
          <DetectionCard detection={props.detection} />
          <div className="local-profile-note"><strong>🔒 Local profile only</strong><span>网页登录发生在本机隔离 WebView。ChatChat 不要求你提交账户密码或 Session Cookie。</span></div>
          {props.error ? <div className="provider-error">{props.error}</div> : null}
          <div className="provider-modal__actions"><button type="button" onClick={props.onClose} disabled={props.saving}>取消</button><button type="submit" className="invite-confirm" disabled={!props.detection || props.saving}>{props.saving ? "召集中…" : "INVITE TO COURT"}</button></div>
        </form>
      </div>
    </div>
  );
}

function DetectionCard({ detection }: { detection: ProviderDetection | null }) {
  if (!detection) return <div className="provider-detection provider-detection--invalid">等待一个有效的 http/https URL…</div>;
  return <div className={`provider-detection provider-detection--${detection.kind}`}><div className="provider-detection__mark">{detection.manifest?.monogram ?? "?"}</div><div><strong>{detection.kind === "known" ? `${detection.displayName} detected` : "Custom AI detected"}</strong><span>{detection.origin}</span><small>{detection.kind === "known" ? `${detection.adapterId} · managed desktop login available` : "No built-in adapter yet · community/custom adapter required"}</small></div></div>;
}

function authLabel(state: ProviderProfile["authState"]): string { switch (state) { case "ready": return "READY"; case "adapter_required": return "ADAPTER NEEDED"; case "error": return "ERROR"; default: return "LOGIN REQUIRED"; } }
function shortKey(profileKey: string): string { return profileKey.slice(-7).toUpperCase(); }
