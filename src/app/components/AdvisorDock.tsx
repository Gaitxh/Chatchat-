import { FormEvent, useMemo, useState } from "react";
import {
  BUILT_IN_PROVIDER_MANIFESTS,
  adapterRecipeComplete,
  detectProviderUrl,
  recipeProgress,
  type AdapterRecipe,
  type AdapterSpeechResult,
  type CouncilBridgeVerificationResult,
  type ProviderDetection,
  type ProviderPageProbe,
  type ProviderProfile,
  type ProviderProfileBackend,
  type TeachRole,
} from "../../provider-sdk/index.js";
import { TestSpeechPanel } from "./TestSpeechPanel.js";
import "../provider.css";

interface AdvisorDockProps {
  profiles: readonly ProviderProfile[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  backend: ProviderProfileBackend | null;
  error: string | null;
  loginError: string | null;
  loginWindowProfileIds: readonly string[];
  probeResults: Readonly<Record<string, ProviderPageProbe>>;
  probingProfileId: string | null;
  teaching: { profileId: string; role: TeachRole } | null;
  speechResults: Readonly<Record<string, AdapterSpeechResult>>;
  testingProfileId: string | null;
  bridgeResults: Readonly<Record<string, CouncilBridgeVerificationResult>>;
  verifyingProfileId: string | null;
  liveSeatCount: number;
  canOpenLogin: boolean;
  disabled: boolean;
  onInvite(url: string, displayName?: string): Promise<ProviderProfile>;
  onLogin(profile: ProviderProfile): Promise<void>;
  onProbe(profile: ProviderProfile): Promise<ProviderPageProbe>;
  onTeach(profile: ProviderProfile, role: TeachRole): Promise<void>;
  onCancelTeach(profile: ProviderProfile): Promise<void>;
  onTestSpeech(profile: ProviderProfile, message: string): Promise<AdapterSpeechResult>;
  onVerifyCouncil(profile: ProviderProfile): Promise<CouncilBridgeVerificationResult>;
  onToggleSeat(profile: ProviderProfile): Promise<void>;
  onRemove(profileId: string): Promise<void>;
}

export function AdvisorDock(props: AdvisorDockProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://chatgpt.com");
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const detection = useMemo<ProviderDetection | null>(() => {
    try { return detectProviderUrl(url); }
    catch { return null; }
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

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try { await action(); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : String(caught)); }
  };

  return (
    <section className="advisor-dock">
      <header className="advisor-dock__header">
        <div>
          <span className="eyebrow">ADVISOR ROSTER · 智囊名册</span>
          <h2>Summon → Teach → Gate → Seat</h2>
          <p>
            真实 URL 现在走完整入席链：登录 → 御前试音 → 3/3 Teach Recipe → 试奏 → Council Gate → TAKE A SEAT。
            内置品牌和任意 Custom http/https AI 页面都使用同一套本地 Browser Council Bridge。
          </p>
        </div>
        <div className="advisor-dock__tools">
          <span className="provider-backend">
            {props.backend === "sqlite" ? "SQLITE · LOCAL" : "BROWSER · LOCAL"}
          </span>
          <span className="live-seat-counter">🪑 {props.liveSeatCount}/4 LIVE</span>
          <button type="button" className="invite-button" onClick={() => setOpen(true)} disabled={props.disabled}>
            + INVITE AI
          </button>
        </div>
      </header>

      {props.error ? <div className="provider-error">Provider profiles: {props.error}</div> : null}
      {props.loginError ? <div className="provider-error">Adapter lab: {props.loginError}</div> : null}
      {actionError ? <div className="provider-error">Council gate: {actionError}</div> : null}

      <div className="advisor-roster">
        {props.profiles.length === 0 ? <EmptyRoster /> : props.profiles.map((profile) => {
          const loginOpen = props.loginWindowProfileIds.includes(profile.profileId);
          const probe = props.probeResults[profile.profileId];
          const recipe = props.recipes[profile.profileId];
          const probing = props.probingProfileId === profile.profileId;
          const teaching = props.teaching?.profileId === profile.profileId ? props.teaching : null;
          const speechResult = props.speechResults[profile.profileId];
          const testing = props.testingProfileId === profile.profileId;
          const bridgeResult = props.bridgeResults[profile.profileId];
          const verifying = props.verifyingProfileId === profile.profileId;
          const recipeReady = adapterRecipeComplete(recipe);
          const testPassed = Boolean(speechResult?.ok);
          const gatePassed = profile.authState === "ready" || Boolean(bridgeResult?.ok);
          const seated = profile.seatState === "seated";
          const channelBusy = Boolean(
            props.testingProfileId || props.verifyingProfileId || props.teaching,
          );

          return (
            <article className={`advisor-profile ${seated ? "advisor-profile--seated" : ""}`} key={profile.profileId}>
              <div className="advisor-profile__avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="advisor-profile__body">
                <div className="advisor-profile__title">
                  <strong>{profile.displayName}</strong>
                  <span className={`auth-state auth-state--${profile.authState}`}>{authLabel(profile.authState)}</span>
                  {loginOpen ? <span className="login-window-badge">WEBVIEW OPEN</span> : null}
                  {probe?.ok ? <span className="audition-badge">DOM PROBED</span> : null}
                  {recipeReady ? <span className="recipe-ready-badge">RECIPE 3/3</span> : null}
                  {testPassed ? <span className="recipe-ready-badge">TEST PASSED</span> : null}
                  {gatePassed ? <span className="council-gate-badge">COUNCIL GATE ✓</span> : null}
                  {seated ? <span className="seated-badge">🪑 SEATED</span> : null}
                </div>
                <span className="advisor-origin">{profile.origin}</span>
                <small>{profile.adapterId} · isolated local profile {shortKey(profile.profileKey)}</small>
                {probe ? <ProbeSummary probe={probe} /> : null}
                {loginOpen ? (
                  <RecipeCard
                    profile={profile}
                    recipe={recipe}
                    teaching={teaching}
                    disabled={props.disabled || channelBusy}
                    onTeach={props.onTeach}
                    onCancel={props.onCancelTeach}
                  />
                ) : null}
                {loginOpen && recipe && recipeReady ? (
                  <TestSpeechPanel
                    profile={profile}
                    recipe={recipe}
                    result={speechResult}
                    testing={testing}
                    disabled={props.disabled || Boolean(props.teaching) || Boolean(props.verifyingProfileId) || Boolean(props.testingProfileId && !testing)}
                    onRun={props.onTestSpeech}
                  />
                ) : null}
                {testPassed ? (
                  <div className={`council-gate ${gatePassed ? "council-gate--passed" : ""}`}>
                    <div>
                      <strong>⚖️ Council Gate · 议会门</strong>
                      <span>
                        {gatePassed
                          ? `结构化协议已通过${bridgeResult ? ` · ${bridgeResult.contributionCount} contribution · ${Math.round(bridgeResult.elapsedMs / 100) / 10}s` : ""}`
                          : "向真实网页发送一次 sealed-phase 结构化握手；只有能返回合法 CouncilContribution 的智囊才能 READY。"}
                      </span>
                    </div>
                    {!gatePassed ? (
                      <button
                        type="button"
                        disabled={props.disabled || !loginOpen || verifying || channelBusy}
                        onClick={() => void run(() => props.onVerifyCouncil(profile))}
                      >
                        {verifying ? "验身中…" : "OPEN COUNCIL GATE"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={seated ? "leave-seat" : "take-seat"}
                        disabled={props.disabled || !loginOpen || channelBusy}
                        onClick={() => void run(() => props.onToggleSeat(profile))}
                      >
                        {seated ? "LEAVE SEAT" : "TAKE A SEAT"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="advisor-profile__actions">
                <button
                  type="button"
                  className="login-advisor"
                  disabled={props.disabled || !props.canOpenLogin || channelBusy}
                  onClick={() => void run(() => props.onLogin(profile))}
                >
                  {loginOpen ? "FOCUS WEBVIEW" : "LOGIN"}
                </button>
                <button
                  type="button"
                  className="probe-advisor"
                  disabled={props.disabled || !loginOpen || probing || channelBusy}
                  onClick={() => void run(() => props.onProbe(profile))}
                >
                  {probing ? "试音中…" : "御前试音"}
                </button>
                <button
                  type="button"
                  className="remove-advisor"
                  onClick={() => void run(() => props.onRemove(profile.profileId))}
                  disabled={props.disabled || channelBusy}
                >
                  移除
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="provider-catalog-strip">
        {BUILT_IN_PROVIDER_MANIFESTS.map((manifest) => (
          <span key={manifest.id}>{manifest.monogram} · {manifest.displayName}</span>
        ))}
        <span>? · ANY HTTP(S) AI</span>
        <span>Teach Mode · 3 clicks</span>
        <span>Council Gate · structured handshake</span>
        <span>LIVE COUNCIL · ≥2 real seats</span>
      </div>

      {open ? (
        <InviteModal
          url={url}
          name={name}
          detection={detection}
          saving={saving}
          error={submitError}
          onUrl={setUrl}
          onName={setName}
          onClose={() => setOpen(false)}
          onSubmit={submit}
        />
      ) : null}
    </section>
  );
}

function RecipeCard({
  profile,
  recipe,
  teaching,
  disabled,
  onTeach,
  onCancel,
}: {
  profile: ProviderProfile;
  recipe: AdapterRecipe | undefined;
  teaching: { profileId: string; role: TeachRole } | null;
  disabled: boolean;
  onTeach(profile: ProviderProfile, role: TeachRole): Promise<void>;
  onCancel(profile: ProviderProfile): Promise<void>;
}) {
  const progress = recipeProgress(recipe);
  return (
    <div className="recipe-card">
      <div className="recipe-card__header"><strong>🧩 Adapter Recipe</strong><span>{progress}/3 taught</span></div>
      <div className="recipe-steps">
        {(["composer", "send", "response"] as const).map((role) => {
          const selector = role === "composer" ? recipe?.composerSelector : role === "send" ? recipe?.sendSelector : recipe?.responseSelector;
          const active = teaching?.role === role;
          return (
            <div className={`recipe-step ${selector ? "recipe-step--done" : ""} ${active ? "recipe-step--active" : ""}`} key={role}>
              <div><b>{roleIcon(role)} {roleLabel(role)}</b><code>{selector ?? "not taught"}</code></div>
              <button type="button" disabled={disabled || Boolean(teaching && !active)} onClick={() => active ? void onCancel(profile) : void onTeach(profile, role)}>
                {active ? "取消点选" : selector ? "重教" : "教我"}
              </button>
            </div>
          );
        })}
      </div>
      {teaching ? (
        <div className="teach-banner">✨ Provider 窗口已进入点选模式。点击目标元素只记录定位，不保存内容。</div>
      ) : adapterRecipeComplete(recipe) ? (
        <div className="recipe-complete">✓ 三个定位已齐，可以进行真实 Test Speech。</div>
      ) : null}
    </div>
  );
}

function ProbeSummary({ probe }: { probe: ProviderPageProbe }) {
  return (
    <div className={`probe-card ${probe.ok ? "probe-card--ok" : "probe-card--error"}`}>
      <div className="probe-card__summary">
        <strong>🎙 御前试音</strong>
        <span>{probe.ok ? `${probe.composerCandidates.length} composer · ${probe.actionCandidates.length} actions` : probe.error ?? "Probe failed"}</span>
      </div>
      <small>{probe.title || "Untitled page"} · {probe.readyState}</small>
    </div>
  );
}

function roleLabel(role: TeachRole): string {
  return role === "composer" ? "输入框 / Composer" : role === "send" ? "发送按钮 / Send" : "回答区域 / Response";
}
function roleIcon(role: TeachRole): string { return role === "composer" ? "✍️" : role === "send" ? "➤" : "💬"; }
function EmptyRoster() {
  return <div className="advisor-empty"><strong>圆桌外还没有真实智囊。</strong><span>邀请任意 AI URL，然后亲手教 ChatChat 怎么和它说话。</span></div>;
}

function InviteModal(props: {
  url: string;
  name: string;
  detection: ProviderDetection | null;
  saving: boolean;
  error: string | null;
  onUrl(v: string): void;
  onName(v: string): void;
  onClose(): void;
  onSubmit(e: FormEvent<HTMLFormElement>): Promise<void>;
}) {
  return (
    <div className="provider-modal-backdrop" role="presentation" onMouseDown={() => !props.saving && props.onClose()}>
      <div className="provider-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="provider-modal__heading">
          <div><span className="eyebrow">SUMMON AN ADVISOR</span><h2>邀请一位 AI 智囊</h2></div>
          <button type="button" className="modal-close" onClick={props.onClose}>×</button>
        </div>
        <form onSubmit={(e) => void props.onSubmit(e)}>
          <label><span>Model URL</span><input value={props.url} onChange={(e) => props.onUrl(e.target.value)} autoFocus /></label>
          <label><span>Display name <small>optional</small></span><input value={props.name} onChange={(e) => props.onName(e.target.value)} placeholder={props.detection?.displayName ?? "My AI"} /></label>
          <DetectionCard detection={props.detection} />
          <div className="local-profile-note"><strong>🔒 Local WebView</strong><span>登录态、Recipe 和议会配置都留在本机。ChatChat 没有中转服务器。</span></div>
          {props.error ? <div className="provider-error">{props.error}</div> : null}
          <div className="provider-modal__actions"><button type="button" onClick={props.onClose}>取消</button><button type="submit" className="invite-confirm" disabled={!props.detection || props.saving}>{props.saving ? "召集中…" : "INVITE TO COURT"}</button></div>
        </form>
      </div>
    </div>
  );
}

function DetectionCard({ detection }: { detection: ProviderDetection | null }) {
  if (!detection) return <div className="provider-detection provider-detection--invalid">等待有效 URL…</div>;
  return (
    <div className={`provider-detection provider-detection--${detection.kind}`}>
      <div className="provider-detection__mark">{detection.manifest?.monogram ?? "?"}</div>
      <div>
        <strong>{detection.kind === "known" ? `${detection.displayName} detected` : "Custom AI detected"}</strong>
        <span>{detection.origin}</span>
        <small>{detection.kind === "known" ? `${detection.adapterId} · isolated WebView + taught Browser Council Bridge` : "custom.browser · teach 3 selectors, pass Council Gate, then take a seat"}</small>
      </div>
    </div>
  );
}

function authLabel(state: ProviderProfile["authState"]): string {
  switch (state) {
    case "ready": return "COUNCIL READY";
    case "adapter_required": return "LEGACY PROFILE";
    case "error": return "ERROR";
    default: return "LOGIN / GATE";
  }
}
function shortKey(key: string): string { return key.slice(-7).toUpperCase(); }
