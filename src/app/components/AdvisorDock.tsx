import { FormEvent, useMemo, useState } from "react";
import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
  type ProviderDetection,
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
  canOpenLogin: boolean;
  disabled: boolean;
  onInvite(url: string, displayName?: string): Promise<ProviderProfile>;
  onLogin(profile: ProviderProfile): Promise<void>;
  onRemove(profileId: string): Promise<void>;
}

export function AdvisorDock({
  profiles,
  backend,
  error,
  loginError,
  loginWindowProfileIds,
  canOpenLogin,
  disabled,
  onInvite,
  onLogin,
  onRemove,
}: AdvisorDockProps) {
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
      await onInvite(url, name || undefined);
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
          <p>
            v0.5 桌面版已经能打开真实 Provider 登录窗口；账户仍属于 Provider，ChatChat 不接收密码或 Cookie。
          </p>
        </div>
        <div className="advisor-dock__tools">
          <span className="provider-backend">{backend === "sqlite" ? "SQLITE · LOCAL" : "BROWSER · LOCAL"}</span>
          <button type="button" className="invite-button" onClick={() => setOpen(true)} disabled={disabled}>+ INVITE AI</button>
        </div>
      </header>

      {error ? <div className="provider-error">Provider profiles: {error}</div> : null}
      {loginError ? <div className="provider-error">Login gate: {loginError}</div> : null}

      <div className="advisor-roster">
        {profiles.length === 0 ? (
          <div className="advisor-empty">
            <strong>圆桌外还没有真实智囊。</strong>
            <span>先邀请 ChatGPT、Claude、Gemini、DeepSeek，或任意自定义 AI URL。</span>
          </div>
        ) : profiles.map((profile) => {
          const loginOpen = loginWindowProfileIds.includes(profile.profileId);
          const adapterMissing = profile.authState === "adapter_required";
          return (
            <article className="advisor-profile" key={profile.profileId}>
              <div className="advisor-profile__avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="advisor-profile__body">
                <div className="advisor-profile__title">
                  <strong>{profile.displayName}</strong>
                  <span className={`auth-state auth-state--${profile.authState}`}>{authLabel(profile.authState)}</span>
                  {loginOpen ? <span className="login-window-badge">LOGIN WINDOW OPEN</span> : null}
                </div>
                <span className="advisor-origin">{profile.origin}</span>
                <small>{profile.adapterId} · isolated local profile {shortKey(profile.profileKey)}</small>
                {loginOpen ? (
                  <span className="login-window-hint">请在独立窗口中亲自登录。登录成功并不等于 Adapter 已验证，因此暂时仍不会自动入席。</span>
                ) : null}
              </div>
              <div className="advisor-profile__actions">
                <button
                  type="button"
                  className="login-advisor"
                  disabled={disabled || adapterMissing || !canOpenLogin}
                  title={
                    adapterMissing
                      ? "Custom Provider 需要 Adapter"
                      : canOpenLogin
                        ? "Open an isolated local provider login window"
                        : "Provider login windows require the Tauri desktop app"
                  }
                  onClick={() => void onLogin(profile)}
                >
                  {loginOpen ? "FOCUS LOGIN" : "LOGIN"}
                </button>
                <button type="button" className="remove-advisor" onClick={() => void onRemove(profile.profileId)} disabled={disabled}>移除</button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="provider-catalog-strip" aria-label="Built-in provider catalog">
        {BUILT_IN_PROVIDER_MANIFESTS.map((manifest) => <span key={manifest.id}>{manifest.monogram} · {manifest.displayName}</span>)}
        <span>+ Custom URL</span>
        <span>{canOpenLogin ? "Desktop Login Gate · READY" : "Desktop Login Gate · Tauri only"}</span>
      </div>

      {open ? (
        <div className="provider-modal-backdrop" role="presentation" onMouseDown={() => !saving && setOpen(false)}>
          <div className="provider-modal" role="dialog" aria-modal="true" aria-labelledby="invite-advisor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="provider-modal__heading">
              <div><span className="eyebrow">SUMMON AN ADVISOR</span><h2 id="invite-advisor-title">邀请一位 AI 智囊</h2></div>
              <button type="button" className="modal-close" onClick={() => setOpen(false)} disabled={saving}>×</button>
            </div>
            <form onSubmit={(event) => void submit(event)}>
              <label><span>Model URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://chatgpt.com" autoFocus /></label>
              <label><span>Display name <small>optional</small></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={detection?.displayName ?? "My AI"} /></label>
              <DetectionCard detection={detection} />
              <div className="local-profile-note">
                <strong>🔒 Local profile only</strong>
                <span>ChatChat 保存本地 Provider 元数据与隔离 profile key。真正登录发生在独立 Provider WebView 内，不要求你把密码或 Cookie 粘贴给 ChatChat。</span>
              </div>
              {submitError ? <div className="provider-error">{submitError}</div> : null}
              <div className="provider-modal__actions">
                <button type="button" onClick={() => setOpen(false)} disabled={saving}>取消</button>
                <button type="submit" className="invite-confirm" disabled={!detection || saving}>{saving ? "召集中…" : "INVITE TO COURT"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetectionCard({ detection }: { detection: ProviderDetection | null }) {
  if (!detection) return <div className="provider-detection provider-detection--invalid">等待一个有效的 http/https URL…</div>;
  return (
    <div className={`provider-detection provider-detection--${detection.kind}`}>
      <div className="provider-detection__mark">{detection.manifest?.monogram ?? "?"}</div>
      <div>
        <strong>{detection.kind === "known" ? `${detection.displayName} detected` : "Custom AI detected"}</strong>
        <span>{detection.origin}</span>
        <small>{detection.kind === "known" ? `${detection.adapterId} · managed desktop login available` : "No built-in adapter yet · community/custom adapter required"}</small>
      </div>
    </div>
  );
}

function authLabel(state: ProviderProfile["authState"]): string {
  switch (state) {
    case "ready": return "READY";
    case "adapter_required": return "ADAPTER NEEDED";
    case "error": return "ERROR";
    default: return "LOGIN REQUIRED";
  }
}

function shortKey(profileKey: string): string { return profileKey.slice(-7).toUpperCase(); }
