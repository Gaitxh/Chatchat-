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
  disabled: boolean;
  onInvite(url: string, displayName?: string): Promise<ProviderProfile>;
  onRemove(profileId: string): Promise<void>;
}

export function AdvisorDock({
  profiles,
  backend,
  error,
  disabled,
  onInvite,
  onRemove,
}: AdvisorDockProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://chatgpt.com");
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const detection = useMemo<ProviderDetection | null>(() => {
    try {
      return detectProviderUrl(url);
    } catch {
      return null;
    }
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
          <p>建立本地 Provider Profile。v0.4 不读取密码、Cookie，也不会假装已经登录。</p>
        </div>
        <div className="advisor-dock__tools">
          <span className="provider-backend">{backend === "sqlite" ? "SQLITE · LOCAL" : "BROWSER · LOCAL"}</span>
          <button type="button" className="invite-button" onClick={() => setOpen(true)} disabled={disabled}>
            + INVITE AI
          </button>
        </div>
      </header>

      {error ? <div className="provider-error">Provider profiles: {error}</div> : null}

      <div className="advisor-roster">
        {profiles.length === 0 ? (
          <div className="advisor-empty">
            <strong>圆桌外还没有真实智囊。</strong>
            <span>先邀请 ChatGPT、Claude、Gemini、DeepSeek，或任意自定义 AI URL。</span>
          </div>
        ) : (
          profiles.map((profile) => (
            <article className="advisor-profile" key={profile.profileId}>
              <div className="advisor-profile__avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="advisor-profile__body">
                <div className="advisor-profile__title">
                  <strong>{profile.displayName}</strong>
                  <span className={`auth-state auth-state--${profile.authState}`}>
                    {authLabel(profile.authState)}
                  </span>
                </div>
                <span className="advisor-origin">{profile.origin}</span>
                <small>{profile.adapterId} · local profile {shortKey(profile.profileKey)}</small>
              </div>
              <div className="advisor-profile__actions">
                <button type="button" disabled title="真实网页登录在 v0.5 接入">LOGIN · v0.5</button>
                <button type="button" className="remove-advisor" onClick={() => void onRemove(profile.profileId)} disabled={disabled}>
                  移除
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="provider-catalog-strip" aria-label="Built-in provider catalog">
        {BUILT_IN_PROVIDER_MANIFESTS.map((manifest) => (
          <span key={manifest.id}>{manifest.monogram} · {manifest.displayName}</span>
        ))}
        <span>+ Custom URL</span>
      </div>

      {open ? (
        <div className="provider-modal-backdrop" role="presentation" onMouseDown={() => !saving && setOpen(false)}>
          <div className="provider-modal" role="dialog" aria-modal="true" aria-labelledby="invite-advisor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="provider-modal__heading">
              <div>
                <span className="eyebrow">SUMMON AN ADVISOR</span>
                <h2 id="invite-advisor-title">邀请一位 AI 智囊</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setOpen(false)} disabled={saving}>×</button>
            </div>

            <form onSubmit={(event) => void submit(event)}>
              <label>
                <span>Model URL</span>
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://chatgpt.com" autoFocus />
              </label>
              <label>
                <span>Display name <small>optional</small></span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={detection?.displayName ?? "My AI"} />
              </label>

              <DetectionCard detection={detection} />

              <div className="local-profile-note">
                <strong>🔒 Local profile only</strong>
                <span>本版只保存 Provider 元数据和隔离 profile key；不会保存账户密码，也不会读取浏览器登录态。</span>
              </div>

              {submitError ? <div className="provider-error">{submitError}</div> : null}

              <div className="provider-modal__actions">
                <button type="button" onClick={() => setOpen(false)} disabled={saving}>取消</button>
                <button type="submit" className="invite-confirm" disabled={!detection || saving}>
                  {saving ? "召集中…" : "INVITE TO COURT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetectionCard({ detection }: { detection: ProviderDetection | null }) {
  if (!detection) {
    return <div className="provider-detection provider-detection--invalid">等待一个有效的 http/https URL…</div>;
  }
  return (
    <div className={`provider-detection provider-detection--${detection.kind}`}>
      <div className="provider-detection__mark">{detection.manifest?.monogram ?? "?"}</div>
      <div>
        <strong>{detection.kind === "known" ? `${detection.displayName} detected` : "Custom AI detected"}</strong>
        <span>{detection.origin}</span>
        <small>
          {detection.kind === "known"
            ? `${detection.adapterId} · login flow planned for v0.5`
            : "No built-in adapter yet · community/custom adapter required"}
        </small>
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

function shortKey(profileKey: string): string {
  return profileKey.slice(-7).toUpperCase();
}
