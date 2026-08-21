import {
  FormEvent,
  StrictMode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";
import {
  MAX_CONSULTATION_PARTICIPANTS,
  canJoinConsultation,
  deriveConsultationOutcome,
  equalParticipantDisplayName,
  type ConsultationParticipantIdentity,
} from "../consultation/equality.js";
import {
  normalizeLocale,
  translate,
  type Locale,
  type MessageKey,
} from "../i18n/index.js";
import { BrowserConsultationAgent } from "../provider-sdk/consultation-agent.js";
import {
  buildProviderConsultationPrompt,
  parseProviderConsultationResponse,
} from "../provider-sdk/consultation-protocol.js";
import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
} from "../provider-sdk/catalog.js";
import {
  adapterRecipeComplete,
  applyTeachSelection,
  createEmptyAdapterRecipe,
  recipeProgress,
  type AdapterRecipe,
  type TeachRole,
  type TeachSelection,
} from "../provider-sdk/recipe.js";
import type { ProviderProfile } from "../provider-sdk/types.js";
import { AUTOMATIC_TEAM_ASSEMBLED_EVENT } from "./automatic-team-wire.js";
import {
  CONNECTION_RETRY_REQUESTED_EVENT,
  type ConnectionRetryRequestedDetail,
} from "./connection-retry-wire.js";
import {
  mayAutomaticallyNavigateProviderTab,
  mayAutomaticallyResumeProviderTab,
} from "./provider-tab-boundary.js";
import { createSerializedRecordMutation } from "./serialized-record-mutation.js";
import "./consultation-panel.css";
import "./consultation-live.css";

declare const chrome: any;
declare const __CHATCHAT_VERSION__: string;

const RECIPES_KEY = "chatchat.extension.recipes.v1";
const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1";
const LOCALE_KEY = "chatchat.locale.v1";
const CONNECTION_TOKEN = "CHATCHAT_READY";

interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
}

interface ExtensionParticipant extends ConsultationParticipantIdentity {
  seatId: string;
  url: string;
  hostname: string;
  startUrl: string;
  createdByChatChat: boolean;
}

interface BridgeResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface SpeechResult {
  responseText: string;
  elapsedMs: number;
  responseCount?: number;
  truncatedByTimeout?: boolean;
}

interface AutoSetupResult {
  recipe: AdapterRecipe;
  responseText: string;
  elapsedMs: number;
  diagnostics?: {
    mode?: string;
    composerScore?: number;
    sendScore?: number;
    responseStrategy?: string;
  };
}

type ConsultationStage = "idle" | "sealed" | "debate" | "final" | "complete" | "error";
type ConnectionState = "idle" | "connecting" | "ready" | "failed";

interface ParticipantConnection {
  state: ConnectionState;
  detail?: string;
  verifiedAt?: string;
  automatic?: boolean;
}

const recipeRecordMutation = createSerializedRecordMutation<AdapterRecipe>(
  async () => {
    const stored = await chrome.storage.local.get(RECIPES_KEY);
    return (stored[RECIPES_KEY] ?? {}) as Record<string, AdapterRecipe>;
  },
  async (next) => {
    await chrome.storage.local.set({ [RECIPES_KEY]: next });
  },
);

const connectionRecordMutation = createSerializedRecordMutation<ParticipantConnection>(
  async () => {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get(CONNECTIONS_KEY);
    return (stored[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnection>;
  },
  async (next) => {
    const store = chrome.storage.session ?? chrome.storage.local;
    await store.set({ [CONNECTIONS_KEY]: next });
  },
);

function ConsultationApp() {
  const initialLocale = normalizeLocale(
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [proposal, setProposal] = useState("");
  const [participants, setParticipants] = useState<ExtensionParticipant[]>([]);
  const [recipes, setRecipes] = useState<Record<string, AdapterRecipe>>({});
  const [connections, setConnections] = useState<Record<string, ParticipantConnection>>({});
  const [candidateTabs, setCandidateTabs] = useState<BrowserTab[]>([]);
  const [urlDraft, setUrlDraft] = useState("https://chatgpt.com/");
  const [stage, setStage] = useState<ConsultationStage>("idle");
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tr = (key: MessageKey, vars: Readonly<Record<string, string | number>> = {}) =>
    translate(locale, key, vars);

  useEffect(() => {
    void hydrate();
    void refreshCandidateTabs();
  }, []);

  useEffect(() => {
    const onAutomaticTeamAssembled = () => {
      void hydrate();
      void refreshCandidateTabs();
    };
    window.addEventListener(AUTOMATIC_TEAM_ASSEMBLED_EVENT, onAutomaticTeamAssembled);
    return () => window.removeEventListener(AUTOMATIC_TEAM_ASSEMBLED_EVENT, onAutomaticTeamAssembled);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onRetryRequested = (event: Event) => {
      const seatId = (event as CustomEvent<ConnectionRetryRequestedDetail>).detail?.seatId;
      if (!seatId) return;
      const participant = participants.find((item) => item.seatId === seatId);
      const connection = connections[seatId];
      if (!participant || connection?.state === "ready" || connection?.state === "connecting") return;
      void autoConnectParticipant(participant, recipes[participant.origin]);
    };
    window.addEventListener(CONNECTION_RETRY_REQUESTED_EVENT, onRetryRequested);
    return () => window.removeEventListener(CONNECTION_RETRY_REQUESTED_EVENT, onRetryRequested);
  }, [participants, recipes, connections]);

  const readyParticipants = useMemo(
    () => participants.filter((item) => isParticipantReady(item, recipes, connections)),
    [participants, recipes, connections],
  );
  const outcome = useMemo(
    () => (report ? deriveConsultationOutcome(report, events) : null),
    [report, events],
  );
  const availableCandidates = useMemo(
    () => uniqueCandidateTabs(candidateTabs, participants),
    [candidateTabs, participants],
  );

  async function hydrate() {
    try {
      const stored = await chrome.storage.local.get([RECIPES_KEY, LOCALE_KEY]);
      const storedRecipes = (stored[RECIPES_KEY] ?? {}) as Record<string, AdapterRecipe>;
      setRecipes(storedRecipes);
      if (stored[LOCALE_KEY]) setLocale(normalizeLocale(stored[LOCALE_KEY]));

      const sessionStore = chrome.storage.session ?? chrome.storage.local;
      const session = await sessionStore.get([PARTICIPANTS_KEY, CONNECTIONS_KEY, PROPOSAL_DRAFT_KEY]);
      if (typeof session[PROPOSAL_DRAFT_KEY] === "string") {
        setProposal(session[PROPOSAL_DRAFT_KEY] as string);
      }
      const restored = Array.isArray(session[PARTICIPANTS_KEY])
        ? (session[PARTICIPANTS_KEY] as ExtensionParticipant[])
        : [];
      const storedConnections = (session[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnection>;
      const alive: ExtensionParticipant[] = [];
      for (const participant of restored) {
        try {
          const tab = await chrome.tabs.get(participant.tabId);
          if (tab?.id && tab?.url) alive.push({ ...participant, url: tab.url });
        } catch {
          // Browser tab ids are runtime-local; stale participants disappear.
        }
      }
      const nextParticipants = dedupeByOrigin(alive);
      const nextConnections = Object.fromEntries(
        nextParticipants.map((participant) => [
          participant.seatId,
          storedConnections[participant.seatId] ?? { state: "idle" },
        ]),
      ) as Record<string, ParticipantConnection>;
      setParticipants(nextParticipants);
      const persistedConnections = await connectionRecordMutation.defaults(nextConnections);
      const hydratedConnections = Object.fromEntries(
        nextParticipants.map((participant) => [
          participant.seatId,
          persistedConnections[participant.seatId] ?? nextConnections[participant.seatId] ?? { state: "idle" },
        ]),
      ) as Record<string, ParticipantConnection>;
      setConnections(hydratedConnections);
      await persistParticipants(nextParticipants);

      for (const participant of nextParticipants) {
        const connection = hydratedConnections[participant.seatId];
        const recipe = storedRecipes[participant.origin];
        if (connection?.state === "ready" && adapterRecipeComplete(recipe)) continue;
        if (!mayAutomaticallyResumeProviderTab(participant)) continue;
        void autoConnectParticipant(participant, recipe);
      }
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function changeLocale(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    await chrome.storage.local.set({ [LOCALE_KEY]: next });
  }

  function updateProposal(next: string) {
    setProposal(next);
    const store = chrome.storage.session ?? chrome.storage.local;
    void store.set({ [PROPOSAL_DRAFT_KEY]: next }).catch(() => undefined);
  }

  async function refreshCandidateTabs() {
    try {
      const tabs: BrowserTab[] = await chrome.tabs.query({});
      setCandidateTabs(
        tabs.filter((tab) => {
          if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) return false;
          try {
            return detectProviderUrl(tab.url).kind === "known";
          } catch {
            return false;
          }
        }),
      );
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function attachActiveTab() {
    const [tab] = (await chrome.tabs.query({ active: true, currentWindow: true })) as BrowserTab[];
    if (!tab?.id || !tab.url) {
      setError(tr("invalidTab"));
      return;
    }
    await attachTab(tab, false);
  }

  async function attachDiscoveredAIs() {
    const candidates = availableCandidates.slice(
      0,
      Math.max(0, MAX_CONSULTATION_PARTICIPANTS - participants.length),
    );
    if (!candidates.length) return;
    setBusy("attach-all");
    setError(null);
    try {
      const detections = candidates.map((tab) => ({ tab, detection: detectProviderUrl(tab.url!) }));
      await requestOriginPermissions(detections.map((item) => item.detection.origin), locale);

      const current = [...participants];
      const added: ExtensionParticipant[] = [];
      for (const { tab, detection } of detections) {
        if (!tab.id) continue;
        const candidate = candidateIdentity(tab.id, detection);
        const join = canJoinConsultation(current, candidate);
        if (!join.ok) continue;
        await ensureBridge(tab.id);
        const participant = participantFromDetection(tab.id, detection, false);
        current.push(participant);
        added.push(participant);
      }

      setParticipants(current);
      await persistParticipants(current);
      const seededConnections = await connectionRecordMutation.merge(Object.fromEntries(
        added.map((participant) => [participant.seatId, { state: "connecting", automatic: true }]),
      ) as Record<string, ParticipantConnection>);
      setConnections(seededConnections);
      await refreshCandidateTabs();
      for (const participant of added) void autoConnectParticipant(participant, recipes[participant.origin]);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function attachTab(tab: BrowserTab, createdByChatChat: boolean) {
    if (!tab.id || !tab.url) return;
    if (!/^https?:/i.test(tab.url)) {
      setError(tr("httpOnly"));
      return;
    }
    if (participants.some((item) => item.tabId === tab.id)) return;

    setBusy(`attach:${tab.id}`);
    setError(null);
    try {
      const detection = detectProviderUrl(tab.url);
      const candidate = candidateIdentity(tab.id, detection);
      const join = canJoinConsultation(participants, candidate);
      if (!join.ok) {
        throw new Error(
          join.reason === "duplicate-origin"
            ? tr("duplicateParticipant")
            : tr("maxParticipants", { count: MAX_CONSULTATION_PARTICIPANTS }),
        );
      }
      await requestOriginPermissions([detection.origin], locale);
      await ensureBridge(tab.id);
      const participant = participantFromDetection(tab.id, detection, createdByChatChat);
      const nextParticipants = [...participants, participant];
      setParticipants(nextParticipants);
      await persistParticipants(nextParticipants);
      await setConnection(participant.seatId, { state: "connecting", automatic: true });
      await refreshCandidateTabs();
      void autoConnectParticipant(participant, recipes[participant.origin]);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function openUrl() {
    const draft = urlDraft.trim();
    if (!draft) return;
    setBusy("open-url");
    setError(null);
    try {
      const detection = detectProviderUrl(draft);
      await requestOriginPermissions([detection.origin], locale);
      const tab = await chrome.tabs.create({ url: detection.normalizedUrl, active: true });
      await waitForTabComplete(tab.id, 35_000);
      await attachTab(tab, true);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function quickOpenAndConnect(url: string) {
    setUrlDraft(url);
    setBusy("quick-open");
    setError(null);
    try {
      const detection = detectProviderUrl(url);
      await requestOriginPermissions([detection.origin], locale);
      const tab = await chrome.tabs.create({ url: detection.normalizedUrl, active: true });
      await waitForTabComplete(tab.id, 35_000);
      await attachTab(tab, true);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function removeParticipant(seatId: string) {
    const participant = participants.find((item) => item.seatId === seatId);
    const nextParticipants = participants.filter((item) => item.seatId !== seatId);
    setParticipants(nextParticipants);
    await persistParticipants(nextParticipants);
    const nextConnections = await connectionRecordMutation.remove(seatId);
    setConnections(nextConnections);
    if (participant?.createdByChatChat) {
      try { await chrome.tabs.remove(participant.tabId); } catch { /* tab may already be closed */ }
    }
  }

  async function autoConnectParticipant(
    participant: ExtensionParticipant,
    recipeHint?: AdapterRecipe,
  ) {
    await setConnection(participant.seatId, {
      state: "connecting",
      automatic: true,
      detail: tr("autoConnectingDetail"),
    });

    try {
      await ensureBridge(participant.tabId);
      let recipe = recipeHint;
      let connected = false;

      if (adapterRecipeComplete(recipe)) {
        try {
          const speech = await sendBridge<SpeechResult>(participant.tabId, {
            type: "RUN_SPEECH",
            recipe,
            prompt: connectionPrompt(),
            timeoutMs: 75_000,
          });
          connected = speech.responseText.toLocaleUpperCase().includes(CONNECTION_TOKEN);
        } catch {
          connected = false;
        }
      }

      if (!connected) {
        const setup = await sendBridge<AutoSetupResult>(participant.tabId, {
          type: "AUTO_SETUP",
          profileId: participant.origin,
          prompt: connectionPrompt(),
          expectedText: CONNECTION_TOKEN,
          timeoutMs: 90_000,
        });
        if (!setup.responseText.toLocaleUpperCase().includes(CONNECTION_TOKEN)) {
          throw new Error("Automatic connection handshake did not return CHATCHAT_READY.");
        }
        recipe = setup.recipe;
        await saveRecipe(participant.origin, recipe);
      }

      if (!adapterRecipeComplete(recipe)) {
        throw new Error("Automatic page setup did not produce a complete browser recipe.");
      }
      await verifyConsultationProtocol(participant, recipe);
      await setConnection(participant.seatId, {
        state: "ready",
        automatic: true,
        verifiedAt: new Date().toISOString(),
        detail: tr("autoReadyDetail"),
      });
    } catch (caught) {
      await setConnection(participant.seatId, {
        state: "failed",
        automatic: true,
        detail: message(caught),
      });
    }
  }

  async function teachParticipant(participant: ExtensionParticipant, role: TeachRole) {
    setBusy(`teach:${participant.seatId}:${role}`);
    setError(null);
    try {
      await chrome.tabs.update(participant.tabId, { active: true });
      await ensureBridge(participant.tabId);
      const selection = await sendBridge<TeachSelection>(participant.tabId, { type: "TEACH", role });
      const stored = await chrome.storage.local.get(RECIPES_KEY);
      const currentRecipes = (stored[RECIPES_KEY] ?? {}) as Record<string, AdapterRecipe>;
      const current = currentRecipes[participant.origin] ?? createEmptyAdapterRecipe(participant.origin);
      const nextRecipe = applyTeachSelection(current, participant.origin, selection);
      await saveRecipe(participant.origin, nextRecipe);
      await setConnection(participant.seatId, { state: "idle", detail: tr("manualRepairHint") });
      if (adapterRecipeComplete(nextRecipe)) void autoConnectParticipant(participant, nextRecipe);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function startConsultation(event: FormEvent) {
    event.preventDefault();
    if (!proposal.trim() || isRunningStage(stage)) return;
    if (readyParticipants.length < 2) {
      setError(tr("atLeastTwo"));
      return;
    }

    setStage("sealed");
    setEvents([]);
    setReport(null);
    setActiveActorId(null);
    setError(null);
    setBusy("consultation");

    try {
      const agents = readyParticipants.map((participant) =>
        createTabConsultationAgent(participant, recipes[participant.origin]!),
      );
      const orchestrator = new CouncilOrchestrator(agents);
      const result = await orchestrator.run(proposal.trim(), {
        maxRounds: 3,
        minDebateRounds: 1,
        convergenceThreshold: 0.75,
        onPhase: ({ phase }) => {
          setStage(phase);
          setActiveActorId(null);
        },
        onEvent: (consultationEvent) => {
          setEvents((current) => [...current, consultationEvent]);
          setActiveActorId(consultationEvent.actorId);
        },
      });
      setReport(result.report);
      setStage("complete");
      setActiveActorId(null);
    } catch (caught) {
      setStage("error");
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function saveRecipe(origin: string, recipe: AdapterRecipe) {
    const next = await recipeRecordMutation.upsert(origin, recipe);
    setRecipes(next);
  }

  async function setConnection(seatId: string, connection: ParticipantConnection) {
    const next = await connectionRecordMutation.upsert(seatId, connection);
    setConnections(next);
  }

  async function persistParticipants(next: ExtensionParticipant[]) {
    const store = chrome.storage.session ?? chrome.storage.local;
    await store.set({ [PARTICIPANTS_KEY]: next });
  }


  const stageText = stageLabel(stage, locale);
  const readyCount = readyParticipants.length;

  return (
    <div className="consultation-app">
      <header className="consultation-header">
        <div className="consultation-brand">
          <div className="consultation-logo">CC</div>
          <div>
            <strong>ChatChat</strong>
            <span>{tr("appSubtitle")}</span>
          </div>
        </div>
        <div className="consultation-header-actions">
          <div className="locale-switch" aria-label={tr("language")}>
            <button type="button" className={locale === "zh-CN" ? "is-active" : ""} onClick={() => void changeLocale("zh-CN")}>{tr("chinese")}</button>
            <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => void changeLocale("en")}>{tr("english")}</button>
          </div>
          <span className="local-badge">{tr("local")}</span>
        </div>
      </header>

      <section className="consultation-hero">
        <div className="hero-orbit" aria-hidden="true">
          <span>G</span><span>C</span><span>Gm</span><span>D</span><i>↔</i>
        </div>
        <h1>{tr("heroTitle").split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
        <p>{tr("heroBody")}</p>
        <div className="principle-strip">{tr("independentPrinciple")}</div>
      </section>

      <section className="consultation-card participants-card">
        <div className="section-heading">
          <div><span className="eyebrow">{tr("participantsKicker")}</span><h2>{tr("participantsTitle")}</h2></div>
          <div className="participant-counter"><b>{participants.length}</b><span>{tr("participantsCount", { count: participants.length })}</span></div>
        </div>
        <p className="section-description">{tr("participantRule")}</p>

        {participants.length ? (
          <div className="participant-list">
            {participants.map((participant) => {
              const connection = connections[participant.seatId] ?? { state: "idle" as const };
              const ready = isParticipantReady(participant, recipes, connections);
              return (
                <article className={`participant-row connection-${connection.state} ${ready ? "is-ready" : ""}`} key={participant.seatId}>
                  <div className="participant-avatar">{monogram(participant.providerName)}</div>
                  <div className="participant-main">
                    <div className="participant-title-line">
                      <strong>{equalParticipantDisplayName(participant.providerName)}</strong>
                      <span className={`connection-chip chip-${connection.state}`}>{connectionLabel(connection.state, locale)}</span>
                    </div>
                    <small>{participant.hostname}</small>
                    <div className="connection-friendly-status">
                      <span className="connection-dot" />
                      {connection.state === "ready"
                        ? tr("autoReadyDetail")
                        : connection.state === "connecting"
                          ? tr("autoConnectingDetail")
                          : connection.state === "failed"
                            ? tr("autoFailedDetail")
                            : tr("autoIdleDetail")}
                    </div>
                  </div>
                  <div className="participant-row-actions">
                    <button type="button" onClick={() => void chrome.tabs.update(participant.tabId, { active: true })}>{tr("open")}</button>
                    <button type="button" onClick={() => void removeParticipant(participant.seatId)} disabled={busy === "consultation"}>{tr("remove")}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="consultation-empty">
            <div className="empty-dots"><span>G</span><span>C</span><span>Q</span></div>
            <strong>{tr("noParticipantsTitle")}</strong>
            <p>{tr("noParticipantsBody")}</p>
          </div>
        )}

        {availableCandidates.length ? (
          <button className="connect-all-button" type="button" onClick={() => void attachDiscoveredAIs()} disabled={Boolean(busy)}>
            <span>✦</span><div><strong>{tr("connectDiscovered")}</strong><small>{tr("connectDiscoveredHint", { count: Math.min(availableCandidates.length, MAX_CONSULTATION_PARTICIPANTS - participants.length) })}</small></div><b>→</b>
          </button>
        ) : null}

        <div className="participant-actions">
          <button className="primary-soft" type="button" onClick={() => void attachActiveTab()} disabled={Boolean(busy)}>{tr("attachActive")}</button>
          <button className="secondary-soft" type="button" onClick={() => void refreshCandidateTabs()} disabled={Boolean(busy)}>{tr("refreshTabs")}</button>
        </div>

        <div className="url-opener">
          <label htmlFor="consultation-url">{tr("addByUrl")}</label>
          <div>
            <input id="consultation-url" value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} placeholder={tr("addByUrlPlaceholder")} />
            <button type="button" onClick={() => void openUrl()} disabled={Boolean(busy) || !urlDraft.trim()}>{tr("openAndAttach")}</button>
          </div>
        </div>

        {availableCandidates.length ? (
          <div className="discovered-section">
            <span className="eyebrow">{tr("discoveredTabs")}</span>
            {availableCandidates.slice(0, 6).map((tab) => (
              <button type="button" className="discovered-tab" key={tab.id} onClick={() => void attachTab(tab, false)}>
                <span>{tab.title || tab.url}</span><b>{tr("attach")}</b>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <form className="consultation-card proposal-card" onSubmit={startConsultation}>
        <div className="section-heading compact">
          <div><span className="eyebrow">{tr("proposalKicker")}</span><h2>{tr("proposalTitle")}</h2></div>
          <span className={`stage-badge stage-${stage}`}>{stageText}</span>
        </div>
        <textarea value={proposal} onChange={(event) => updateProposal(event.target.value)} rows={5} disabled={busy === "consultation"} placeholder={tr("proposalPlaceholder")} />
        <div className="proposal-footer">
          <span>{readyCount}/{participants.length} {tr("ready").toLocaleLowerCase()}</span>
          <button className="start-button" type="submit" disabled={!proposal.trim() || busy === "consultation" || readyCount < 2}>
            <span>{busy === "consultation" ? tr("consulting") : tr("startConsultation")}</span><b>{busy === "consultation" ? "···" : "→"}</b>
          </button>
        </div>
      </form>

      {stage !== "idle" ? (
        <section className="consultation-card consultation-progress">
          <div className="phase-track">
            <Phase label={tr("phaseIndependent")} active={stage === "sealed"} done={["debate", "final", "complete"].includes(stage)} />
            <i /><Phase label={tr("phaseConsult")} active={stage === "debate"} done={["final", "complete"].includes(stage)} />
            <i /><Phase label={tr("phaseFinal")} active={stage === "final"} done={stage === "complete"} />
          </div>
          <div className="active-line"><span className="activity-dot" />{activeActorId ? tr("participantSpeaking", { name: participantName(participants, activeActorId) }) : stage === "complete" ? tr("consultationComplete") : tr("waitingBatch")}</div>
        </section>
      ) : null}

      {stage !== "idle" ? (
        <LiveRoom participants={participants} events={events} activeActorId={activeActorId} locale={locale} />
      ) : null}

      {events.length ? (
        <section className="consultation-card shared-board-card">
          <div className="section-heading compact"><div><span className="eyebrow">BLACKBOARD</span><h2>{tr("sharedBoard")}</h2></div><span className="event-count">{events.length}</span></div>
          <div className="consultation-events">
            {events.slice(-14).map((item) => (
              <article className={`consultation-event event-${item.kind}`} key={item.id}>
                <div className="event-topline"><strong>{participantName(participants, item.actorId)}</strong><span>{eventKindText(item.kind, locale)}</span><small>R{item.round}</small></div>
                <p>{truncate(item.content, 320)}</p>
                {item.kind === "revision" ? <b className="changed-mind-badge">↻ {tr("eventRevision")}</b> : null}
              </article>
            ))}
          </div>
        </section>
      ) : stage !== "idle" ? (
        <section className="consultation-card shared-board-card is-empty"><h2>{tr("sharedBoard")}</h2><p>{tr("sharedBoardEmpty")}</p></section>
      ) : null}

      {report && outcome ? (
        <section className="consultation-card outcome-card">
          <span className="eyebrow">{tr("outcomeKicker")}</span>
          <div className="outcome-hero">
            <div><h2>{outcome.consensusStance ?? tr("noConsensus")}</h2><p>{tr("supportRatio", { ratio: Math.round(outcome.consensusRatio * 100) })}</p></div>
            <div className="confidence-orb"><b>{Math.round(outcome.confidence * 100)}</b><span>{tr("confidence")}</span></div>
          </div>
          <p className="no-chair-note">{tr("noChairNote")}</p>
          {outcome.changedMindCount ? <div className="changed-summary">↻ {tr("changedMinds", { count: outcome.changedMindCount })}</div> : null}
          <div className="final-position-list">
            <h3>{tr("finalPositions")}</h3>
            {outcome.finalPositions.map((position) => (
              <article key={position.participant.id}><div><strong>{position.participant.name}</strong><span>{position.stance}</span></div><p>{truncate(position.content, 420)}</p><small>{Math.round(position.confidence * 100)}% {tr("confidence")}</small></article>
            ))}
          </div>
          {report.disagreements.length ? <div className="minority-box"><strong>{tr("minorityTitle")}</strong><span>{report.disagreements.map((item) => `${item.participant.name}: ${item.stance}`).join(" · ")}</span></div> : null}
        </section>
      ) : null}

      {error ? <div className="consultation-error" role="alert">{error}</div> : null}

      <details className="consultation-card setup-card">
        <summary><div><span className="eyebrow">ADVANCED</span><strong>{tr("advanced")}</strong></div><b>⌄</b></summary>
        <div className="setup-body">
          <p>{tr("advancedHint")}</p>
          {participants.map((participant) => {
            const recipe = recipes[participant.origin];
            const connection = connections[participant.seatId] ?? { state: "idle" as const };
            const ready = isParticipantReady(participant, recipes, connections);
            return (
              <div className="setup-participant" key={participant.seatId}>
                <div className="setup-title"><div><strong>{participant.providerName}</strong><small>{participant.hostname}</small></div><span className={ready ? "is-pass" : ""}>{ready ? tr("verified") : `${recipeProgress(recipe)}/3`}</span></div>
                {connection.state === "failed" && connection.detail ? <p className="connection-diagnostic">{connection.detail}</p> : null}
                <button className={`verify-button ${ready ? "is-ready" : ""}`} type="button" disabled={busy === "consultation" || connection.state === "connecting"} onClick={() => void autoConnectParticipant(participant, recipe)}>
                  {ready ? `✓ ${tr("verified")}` : tr("retryAuto")}
                </button>
                <div className="manual-repair-divider"><span>{tr("manualRepair")}</span></div>
                <div className="teach-buttons">
                  {(["composer", "send", "response"] as const).map((role) => (
                    <button key={role} type="button" onClick={() => void teachParticipant(participant, role)} disabled={Boolean(busy)} className={recipeFieldReady(recipe, role) ? "is-ready" : ""}>{teachText(role, locale)}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {!participants.length ? (
        <section className="quick-open"><span>{tr("quickOpen")}</span><div>{BUILT_IN_PROVIDER_MANIFESTS.map((provider) => <button type="button" key={provider.id} onClick={() => void quickOpenAndConnect(provider.defaultUrl)}>{provider.displayName}</button>)}</div></section>
      ) : null}

      <section className="privacy-card"><strong>{tr("privacyTitle")}</strong><p>{tr("privacyBody")}</p></section>
      <footer className="consultation-footer"><span>ChatChat {__CHATCHAT_VERSION__}</span><span>{tr("footerPrivacy")}</span></footer>
    </div>
  );
}

function LiveRoom({
  participants,
  events,
  activeActorId,
  locale,
}: {
  participants: readonly ExtensionParticipant[];
  events: readonly CouncilEvent[];
  activeActorId: string | null;
  locale: Locale;
}) {
  const lastEvent = events.at(-1) ?? null;
  const alignment = liveAlignment(participants, events);
  return (
    <section className="consultation-card live-room-card">
      <div className="live-room-heading">
        <div><span className="eyebrow">{translate(locale, "roomPulseKicker")}</span><h2>{translate(locale, "roomPulseTitle")}</h2><p>{translate(locale, "roomPulseBody")}</p></div>
        <div className="alignment-meter"><b>{alignment}%</b><span>{translate(locale, "roomAlignment")}</span></div>
      </div>
      <div className="alignment-track"><i style={{ width: `${alignment}%` }} /></div>
      <div className="live-seat-grid">
        {participants.map((participant) => {
          const position = latestPosition(participant.seatId, events);
          const latest = [...events].reverse().find((item) => item.actorId === participant.seatId);
          return (
            <article className={`live-seat ${activeActorId === participant.seatId ? "is-speaking" : ""} ${latest?.kind === "revision" ? "is-revised" : ""}`} key={participant.seatId}>
              <div className="live-seat-avatar">{monogram(participant.providerName)}</div>
              <strong>{participant.providerName}</strong>
              <span>{position ?? translate(locale, "roomWaitingPosition")}</span>
              {latest ? <small>{eventIcon(latest.kind)} {eventKindText(latest.kind, locale)}</small> : <small>···</small>}
            </article>
          );
        })}
      </div>
      {lastEvent ? (
        <div className={`room-event-banner event-${lastEvent.kind}`}>
          <b>{eventIcon(lastEvent.kind)}</b>
          <div><strong>{eventHeadline(lastEvent, events, participants, locale)}</strong><span>{truncate(lastEvent.content, 220)}</span></div>
        </div>
      ) : <div className="room-event-banner is-waiting"><b>◌</b><div><strong>{translate(locale, "roomWaiting")}</strong><span>{translate(locale, "roomWaitingHint")}</span></div></div>}
    </section>
  );
}

function Phase({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return <div className={`phase-item ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}><span>{done ? "✓" : active ? "•" : ""}</span><b>{label}</b></div>;
}

function candidateIdentity(tabId: number, detection: ReturnType<typeof detectProviderUrl>): ConsultationParticipantIdentity {
  return {
    participantId: `extension:${detection.providerId}:${tabId}`,
    providerId: detection.providerId,
    providerName: detection.displayName,
    origin: detection.origin,
    tabId,
  };
}

function participantFromDetection(
  tabId: number,
  detection: ReturnType<typeof detectProviderUrl>,
  createdByChatChat: boolean,
): ExtensionParticipant {
  const candidate = candidateIdentity(tabId, detection);
  return {
    ...candidate,
    seatId: candidate.participantId,
    url: detection.normalizedUrl,
    hostname: detection.hostname,
    startUrl: detection.manifest?.defaultUrl ?? `${detection.origin}/`,
    createdByChatChat,
  };
}

function createTabConsultationAgent(participant: ExtensionParticipant, recipe: AdapterRecipe): CouncilAgent {
  const profile = profileForParticipant(participant);
  const participantRecipe: AdapterRecipe = { ...recipe, profileId: participant.seatId };
  const inner = new BrowserConsultationAgent(
    profile,
    participantRecipe,
    async (_profile, currentRecipe, prompt) => {
      await ensureBridge(participant.tabId);
      const result = await sendBridge<SpeechResult>(participant.tabId, {
        type: "RUN_SPEECH",
        recipe: currentRecipe,
        prompt,
        timeoutMs: 120_000,
      });
      return { responseText: result.responseText, elapsedMs: result.elapsedMs };
    },
    async () => {
      if (mayAutomaticallyNavigateProviderTab(participant)) {
        await chrome.tabs.update(participant.tabId, { url: participant.startUrl });
        await waitForTabComplete(participant.tabId, 35_000);
      }
      await ensureBridge(participant.tabId);
      await sendBridge(participant.tabId, { type: "AWAIT_RECIPE", recipe: participantRecipe, timeoutMs: 35_000 });
    },
  );
  return { participant: participantForExtension(participant), respond: (context) => inner.respond(context) };
}

async function verifyConsultationProtocol(participant: ExtensionParticipant, recipe: AdapterRecipe): Promise<void> {
  await ensureBridge(participant.tabId);
  const context: CouncilContext = {
    sessionId: `extension-consultation-gate:${participant.seatId}`,
    question: "Protocol handshake only. You are an equal participant in a ChatChat multi-AI consultation. If you can follow the requested structured format, return one argument whose stance is exactly READY. Otherwise use stance NOT_READY and explain why.",
    phase: "sealed",
    round: 1,
    participant: participantForExtension(participant),
    publicEvents: [],
    ownEvents: [],
  };
  const prompt = buildProviderConsultationPrompt(context);
  const result = await sendBridge<SpeechResult>(participant.tabId, { type: "RUN_SPEECH", recipe, prompt, timeoutMs: 90_000 });
  const contributions = parseProviderConsultationResponse(result.responseText, context);
  const ready = contributions.some((item) => item.kind === "argument" && item.stance.trim().toLocaleLowerCase() === "ready");
  if (!ready) throw new Error("Consultation protocol returned valid structured data but did not declare stance READY.");
}

function connectionPrompt(): string {
  return `ChatChat automatic connection handshake. Reply with exactly: ${CONNECTION_TOKEN}`;
}

function profileForParticipant(participant: ExtensionParticipant): ProviderProfile {
  const now = new Date().toISOString();
  return {
    profileId: participant.seatId,
    providerId: participant.providerId,
    adapterId: "extension.tab",
    displayName: equalParticipantDisplayName(participant.providerName),
    url: participant.url,
    origin: participant.origin,
    profileKey: `tab:${participant.tabId}`,
    authState: "ready",
    seatState: "seated",
    createdAt: now,
    updatedAt: now,
  };
}

function participantForExtension(participant: ExtensionParticipant): CouncilParticipant {
  return { id: participant.seatId, name: equalParticipantDisplayName(participant.providerName), provider: participant.providerId, role: "Independent AI Participant" };
}

function isParticipantReady(
  participant: ExtensionParticipant,
  recipes: Readonly<Record<string, AdapterRecipe>>,
  connections: Readonly<Record<string, ParticipantConnection>>,
): boolean {
  return Boolean(adapterRecipeComplete(recipes[participant.origin]) && connections[participant.seatId]?.state === "ready");
}

async function ensureBridge(tabId: number) {
  try {
    await sendBridge(tabId, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
    await sleep(80);
    await sendBridge(tabId, { type: "PING" });
  }
}

async function sendBridge<T = unknown>(tabId: number, payload: Record<string, unknown>): Promise<T> {
  const response = (await chrome.tabs.sendMessage(tabId, { __chatchat: true, ...payload })) as BridgeResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "Provider tab did not answer ChatChat.");
  return response.result as T;
}

async function requestOriginPermissions(origins: readonly string[], locale: Locale) {
  const unique = [...new Set(origins)].map((origin) => `${origin}/*`);
  if (!unique.length) return;
  const descriptor = { origins: unique };
  if (await chrome.permissions.contains(descriptor)) return;
  const granted = await chrome.permissions.request(descriptor);
  if (!granted) throw new Error(translate(locale, "permissionDenied", { origin: origins.join(", ") }));
}

async function waitForTabComplete(tabId: number, timeoutMs: number) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the AI tab to load."));
    }, timeoutMs);
    const listener = (updatedId: number, changeInfo: { status?: string }) => {
      if (updatedId !== tabId || changeInfo.status !== "complete") return;
      window.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function uniqueCandidateTabs(
  tabs: readonly BrowserTab[],
  participants: readonly ExtensionParticipant[],
): BrowserTab[] {
  const origins = new Set(participants.map((item) => item.origin.toLocaleLowerCase()));
  const seen = new Set<string>();
  const result: BrowserTab[] = [];
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    try {
      const detection = detectProviderUrl(tab.url);
      const key = detection.origin.toLocaleLowerCase();
      if (origins.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push(tab);
    } catch {
      // Ignore tabs that stopped matching while the list was open.
    }
  }
  return result;
}

function connectionLabel(state: ConnectionState, locale: Locale): string {
  if (state === "connecting") return translate(locale, "autoConnecting");
  if (state === "ready") return translate(locale, "ready");
  if (state === "failed") return translate(locale, "autoFailed");
  return translate(locale, "autoIdle");
}

function liveAlignment(participants: readonly ExtensionParticipant[], events: readonly CouncilEvent[]): number {
  const stances = participants.map((participant) => latestPosition(participant.seatId, events)).filter((value): value is string => Boolean(value));
  if (!stances.length) return 0;
  const counts = new Map<string, number>();
  for (const stance of stances) {
    const key = stance.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.round((Math.max(...counts.values()) / stances.length) * 100);
}

function latestPosition(actorId: string, events: readonly CouncilEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.actorId !== actorId) continue;
    if (event.kind === "argument" || event.kind === "revision" || event.kind === "final_position") return event.stance;
  }
  return null;
}

function eventHeadline(
  event: CouncilEvent,
  events: readonly CouncilEvent[],
  participants: readonly ExtensionParticipant[],
  locale: Locale,
): string {
  const actor = participantName(participants, event.actorId);
  const targetEventId = "targetEventId" in event ? event.targetEventId : undefined;
  const targetEvent = targetEventId ? events.find((item) => item.id === targetEventId) : undefined;
  const target = targetEvent ? participantName(participants, targetEvent.actorId) : null;
  if (event.kind === "challenge") return target ? `${actor} ⚔ ${target}` : `${actor} · ${translate(locale, "eventChallenge")}`;
  if (event.kind === "support") return target ? `${actor} 🤝 ${target}` : `${actor} · ${translate(locale, "eventSupport")}`;
  if (event.kind === "defense") return target ? `${actor} 🛡 ${target}` : `${actor} · ${translate(locale, "eventDefense")}`;
  if (event.kind === "concede") return target ? `${actor} 🏳 ${target}` : `${actor} · ${translate(locale, "eventConcede")}`;
  if (event.kind === "revision") return `${actor} ↻ ${translate(locale, "roomChangedPosition")}`;
  if (event.kind === "evidence") return `${actor} 📎 ${translate(locale, "eventEvidence")}`;
  if (event.kind === "question") return `${actor} ? ${translate(locale, "eventQuestion")}`;
  if (event.kind === "final_position") return `${actor} ✓ ${translate(locale, "eventFinal")}`;
  return `${actor} · ${eventKindText(event.kind, locale)}`;
}

function eventIcon(kind: CouncilEvent["kind"]): string {
  const icons: Record<CouncilEvent["kind"], string> = {
    argument: "◉",
    challenge: "⚔",
    evidence: "📎",
    support: "🤝",
    defense: "🛡",
    revision: "↻",
    concede: "🏳",
    question: "?",
    uncertain: "≈",
    final_position: "✓",
  };
  return icons[kind];
}

function recipeFieldReady(recipe: AdapterRecipe | undefined, role: TeachRole): boolean {
  if (!recipe) return false;
  if (role === "composer") return Boolean(recipe.composerSelector);
  if (role === "send") return Boolean(recipe.sendSelector);
  return Boolean(recipe.responseSelector);
}

function teachText(role: TeachRole, locale: Locale): string {
  if (role === "composer") return translate(locale, "teachComposer");
  if (role === "send") return translate(locale, "teachSend");
  return translate(locale, "teachResponse");
}

function stageLabel(stage: ConsultationStage, locale: Locale): string {
  if (stage === "sealed") return translate(locale, "stageSealed");
  if (stage === "debate") return translate(locale, "stageDebate");
  if (stage === "final") return translate(locale, "stageFinal");
  if (stage === "complete") return translate(locale, "stageComplete");
  if (stage === "error") return translate(locale, "stageError");
  return translate(locale, "stageIdle");
}

function eventKindText(kind: CouncilEvent["kind"], locale: Locale): string {
  const keys: Record<CouncilEvent["kind"], MessageKey> = {
    argument: "eventArgument",
    challenge: "eventChallenge",
    evidence: "eventEvidence",
    support: "eventSupport",
    defense: "eventDefense",
    revision: "eventRevision",
    concede: "eventConcede",
    question: "eventQuestion",
    uncertain: "eventUncertain",
    final_position: "eventFinal",
  };
  return translate(locale, keys[kind]);
}

function participantName(participants: readonly ExtensionParticipant[], actorId: string): string {
  return participants.find((item) => item.seatId === actorId)?.providerName ?? actorId;
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/yuanbao|元宝/i.test(name)) return "Y";
  if (/grok/i.test(name)) return "X";
  if (/gpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}

function dedupeByOrigin(items: readonly ExtensionParticipant[]): ExtensionParticipant[] {
  const seen = new Set<string>();
  const result: ExtensionParticipant[] = [];
  for (const item of items) {
    const key = item.origin.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, MAX_CONSULTATION_PARTICIPANTS);
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function isRunningStage(stage: ConsultationStage): boolean {
  return stage === "sealed" || stage === "debate" || stage === "final";
}

function truncate(value: string, max: number): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const root = document.getElementById("extension-root");
if (!root) throw new Error("ChatChat extension root is missing.");
createRoot(root).render(<StrictMode><ConsultationApp /></StrictMode>);