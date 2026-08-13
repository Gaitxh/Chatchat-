import { FormEvent, StrictMode, useEffect, useMemo, useState } from "react";
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
  deriveHouseSummary,
  MAX_DELEGATION_SEATS,
  MAX_HOUSE_SEATS,
} from "../house/delegations.js";
import {
  BrowserCouncilAgent,
  buildProviderCouncilPrompt,
  parseProviderCouncilResponse,
} from "../provider-sdk/council-agent.js";
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
import "./sidepanel.css";

declare const chrome: any;
declare const __CHATCHAT_VERSION__: string;

const RECIPES_KEY = "chatchat.extension.recipes.v1";
const SEATS_KEY = "chatchat.extension.seats.v1";
const DEFAULT_QUESTION = "ChatChat 应该优先做浏览器插件还是桌面应用？请给出一个实际可执行的判断。";

interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
}

interface ExtensionSeat {
  seatId: string;
  tabId: number;
  url: string;
  origin: string;
  hostname: string;
  providerId: string;
  providerName: string;
  delegationId: string;
  delegationName: string;
  startUrl: string;
  createdByChatChat: boolean;
}

interface SeatView extends ExtensionSeat {
  seatIndex: number;
  seatCount: number;
  displayName: string;
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

type CouncilStage = "idle" | "sealed" | "debate" | "final" | "complete" | "error";
type TestState = "idle" | "running" | "pass" | "fail";

function ExtensionApp() {
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [seats, setSeats] = useState<ExtensionSeat[]>([]);
  const [recipes, setRecipes] = useState<Record<string, AdapterRecipe>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [gates, setGates] = useState<Record<string, TestState>>({});
  const [candidateTabs, setCandidateTabs] = useState<BrowserTab[]>([]);
  const [stage, setStage] = useState<CouncilStage>("idle");
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
    void refreshCandidateTabs();
  }, []);

  const seatViews = useMemo(() => numberSeats(seats), [seats]);
  const delegations = useMemo(() => groupSeats(seatViews), [seatViews]);
  const house = useMemo(
    () => (report ? deriveHouseSummary(report) : null),
    [report],
  );
  const changedMinds = events.filter((event) => event.kind === "revision");

  async function hydrate() {
    try {
      const recipeState = await chrome.storage.local.get(RECIPES_KEY);
      setRecipes(recipeState[RECIPES_KEY] ?? {});

      const sessionStore = chrome.storage.session ?? chrome.storage.local;
      const seatState = await sessionStore.get(SEATS_KEY);
      const restored = Array.isArray(seatState[SEATS_KEY])
        ? (seatState[SEATS_KEY] as ExtensionSeat[])
        : [];
      const alive: ExtensionSeat[] = [];
      for (const seat of restored) {
        try {
          const tab = await chrome.tabs.get(seat.tabId);
          if (tab?.id && tab?.url) alive.push({ ...seat, url: tab.url });
        } catch {
          // Stale tab ids are expected after a browser restart.
        }
      }
      setSeats(alive);
      await persistSeats(alive);
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function refreshCandidateTabs() {
    try {
      const tabs: BrowserTab[] = await chrome.tabs.query({});
      const known = tabs.filter((tab) => {
        if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) return false;
        try {
          return detectProviderUrl(tab.url).kind === "known";
        } catch {
          return false;
        }
      });
      setCandidateTabs(known);
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function attachActiveTab() {
    const [tab] = (await chrome.tabs.query({ active: true, currentWindow: true })) as BrowserTab[];
    if (!tab?.id || !tab.url) {
      setError("当前标签页无法加入 ChatChat。");
      return;
    }
    await attachTab(tab, false);
  }

  async function attachTab(tab: BrowserTab, createdByChatChat: boolean) {
    if (!tab.id || !tab.url) return;
    if (!/^https?:/i.test(tab.url)) {
      setError("只有普通 http/https AI 页面可以入席。");
      return;
    }
    if (seats.some((seat) => seat.tabId === tab.id)) return;
    if (seats.length >= MAX_HOUSE_SEATS) {
      setError(`当前版本最多允许 ${MAX_HOUSE_SEATS} 个独立议员席位。`);
      return;
    }

    setBusy(`attach:${tab.id}`);
    setError(null);
    try {
      const detection = detectProviderUrl(tab.url);
      const sameDelegation = seats.filter(
        (seat) =>
          seat.providerId === detection.providerId &&
          seat.origin === detection.origin,
      ).length;
      if (sameDelegation >= MAX_DELEGATION_SEATS) {
        throw new Error(
          `${detection.displayName} 代表团当前最多允许 ${MAX_DELEGATION_SEATS} 席。`,
        );
      }

      await requestOriginPermission(detection.origin);
      await ensureBridge(tab.id);
      const next: ExtensionSeat = {
        seatId: `extension:${detection.providerId}:${tab.id}`,
        tabId: tab.id,
        url: detection.normalizedUrl,
        origin: detection.origin,
        hostname: detection.hostname,
        providerId: detection.providerId,
        providerName: detection.displayName,
        delegationId: `${detection.providerId}@${detection.origin}`,
        delegationName: `${detection.displayName} Delegation`,
        startUrl: detection.manifest?.defaultUrl ?? `${detection.origin}/`,
        createdByChatChat,
      };
      const nextSeats = [...seats, next];
      setSeats(nextSeats);
      await persistSeats(nextSeats);
      await refreshCandidateTabs();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function addSeat(delegationId: string) {
    const anchor = seats.find((seat) => seat.delegationId === delegationId);
    if (!anchor) return;
    const delegationSeats = seats.filter((seat) => seat.delegationId === delegationId).length;
    if (delegationSeats >= MAX_DELEGATION_SEATS) {
      setError(`${anchor.providerName} 代表团已经达到 ${MAX_DELEGATION_SEATS} 席上限。`);
      return;
    }
    if (seats.length >= MAX_HOUSE_SEATS) {
      setError(`众议院已经达到 ${MAX_HOUSE_SEATS} 席上限。`);
      return;
    }

    setBusy(`new-seat:${delegationId}`);
    setError(null);
    try {
      await requestOriginPermission(anchor.origin);
      const tab: BrowserTab = await chrome.tabs.create({
        url: anchor.startUrl,
        active: false,
      });
      if (!tab.id) throw new Error("Browser did not return a new tab id.");
      await waitForTabComplete(tab.id, 30_000);
      const fresh = (await chrome.tabs.get(tab.id)) as BrowserTab;
      await attachTab(fresh, true);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function removeSeat(seatId: string) {
    const next = seats.filter((seat) => seat.seatId !== seatId);
    setSeats(next);
    setTests((current) => withoutKey(current, seatId));
    setGates((current) => withoutKey(current, seatId));
    await persistSeats(next);
  }

  async function teachSeat(seat: SeatView, role: TeachRole) {
    setBusy(`teach:${seat.seatId}:${role}`);
    setError(null);
    try {
      await chrome.tabs.update(seat.tabId, { active: true });
      await ensureBridge(seat.tabId);
      const selection = await sendBridge<TeachSelection>(seat.tabId, {
        type: "TEACH",
        role,
      });
      const current = recipes[seat.origin] ?? createEmptyAdapterRecipe(seat.origin);
      const nextRecipe = applyTeachSelection(current, seat.origin, selection);
      const next = { ...recipes, [seat.origin]: nextRecipe };
      setRecipes(next);
      await chrome.storage.local.set({ [RECIPES_KEY]: next });

      const affectedIds = new Set(
        seats.filter((candidate) => candidate.origin === seat.origin).map((candidate) => candidate.seatId),
      );
      setTests((currentTests) => resetKeys(currentTests, affectedIds));
      setGates((currentGates) => resetKeys(currentGates, affectedIds));
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function verifyDelegation(delegationId: string) {
    const members = seatViews.filter((item) => item.delegationId === delegationId);
    const first = members[0];
    if (!first) return;
    const recipe = recipes[first.origin];
    if (!adapterRecipeComplete(recipe)) {
      setError("先完成 Composer / Send / Response 三步 Teach Mode。");
      return;
    }

    setBusy(`verify:${delegationId}`);
    setError(null);
    const failures: string[] = [];

    for (const seat of members) {
      setTests((current) => ({ ...current, [seat.seatId]: "running" }));
      setGates((current) => ({ ...current, [seat.seatId]: "idle" }));
      try {
        await ensureBridge(seat.tabId);
        const speech = await sendBridge<SpeechResult>(seat.tabId, {
          type: "RUN_SPEECH",
          recipe,
          prompt:
            "ChatChat connection test. Reply with exactly CHATCHAT_READY and nothing else.",
          timeoutMs: 90_000,
        });
        if (!speech.responseText.toLocaleUpperCase().includes("CHATCHAT_READY")) {
          throw new Error("Test Speech did not return CHATCHAT_READY.");
        }
        setTests((current) => ({ ...current, [seat.seatId]: "pass" }));

        setGates((current) => ({ ...current, [seat.seatId]: "running" }));
        await verifySeatCouncilGate(seat, recipe);
        setGates((current) => ({ ...current, [seat.seatId]: "pass" }));
      } catch (caught) {
        const reason = message(caught);
        failures.push(`${seat.displayName}: ${reason}`);
        setTests((current) => ({
          ...current,
          [seat.seatId]: current[seat.seatId] === "pass" ? "pass" : "fail",
        }));
        setGates((current) => ({ ...current, [seat.seatId]: "fail" }));
      }
    }

    if (failures.length) {
      setError(`有 ${failures.length}/${members.length} 个席位未通过独立验证。${failures[0]}`);
    }
    setBusy(null);
  }

  async function convene(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || stage === "sealed" || stage === "debate" || stage === "final") return;

    const ready = seatViews.filter((seat) => isSeatReady(seat, recipes, tests, gates));
    if (ready.length < 2) {
      setError("至少需要 2 个独立标签页席位分别通过 Recipe 3/3、Test Speech 和 Council Gate。不同席位必须是不同 tab。");
      return;
    }

    setStage("sealed");
    setEvents([]);
    setReport(null);
    setActiveActorId(null);
    setError(null);
    setBusy("council");

    try {
      const agents = ready.map((seat) => createTabCouncilAgent(seat, recipes[seat.origin]!));
      const orchestrator = new CouncilOrchestrator(agents);
      const result = await orchestrator.run(question.trim(), {
        maxRounds: 2,
        minDebateRounds: 1,
        convergenceThreshold: 0.75,
        onPhase: ({ phase }) => {
          setStage(phase);
          setActiveActorId(null);
        },
        onEvent: (councilEvent) => {
          setEvents((current) => [...current, councilEvent]);
          setActiveActorId(councilEvent.actorId);
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

  async function openProvider(url: string) {
    await chrome.tabs.create({ url, active: true });
    await refreshCandidateTabs();
  }

  return (
    <div className="side-app">
      <header className="side-header">
        <div className="brand-mark">♛</div>
        <div className="brand-copy">
          <strong>ChatChat</strong>
          <span>AI Council · local browser edition</span>
        </div>
        <span className="local-pill">LOCAL</span>
      </header>

      <section className="hero-copy">
        <h1>你下令，<br />让 AI 们自己议。</h1>
        <p>直接使用浏览器里已经登录的 AI 标签页。一个 tab，就是一个独立席位。</p>
      </section>

      <section className="panel-card delegates-card">
        <div className="section-head">
          <div>
            <span className="section-kicker">THE HOUSE</span>
            <h2>参会 AI</h2>
          </div>
          <span className="seat-total">{seatViews.length} 席</span>
        </div>

        {delegations.length ? (
          <div className="delegation-list">
            {delegations.map((delegation) => {
              const first = delegation.seats[0]!;
              const recipe = recipes[first.origin];
              const progress = recipeProgress(recipe);
              const readyCount = delegation.seats.filter((seat) =>
                isSeatReady(seat, recipes, tests, gates),
              ).length;
              return (
                <div className="delegation-row" key={delegation.id}>
                  <div className="delegate-avatar">{monogram(first.providerName)}</div>
                  <div className="delegate-main">
                    <strong>{first.providerName}</strong>
                    <span>{progress}/3 taught · {readyCount}/{delegation.seats.length} ready</span>
                  </div>
                  <div className="seat-stepper" aria-label={`${first.providerName} seat count`}>
                    <button
                      type="button"
                      onClick={() => void removeSeat(delegation.seats.at(-1)!.seatId)}
                      disabled={Boolean(busy) || delegation.seats.length <= 1}
                    >−</button>
                    <b>×{delegation.seats.length}</b>
                    <button
                      type="button"
                      onClick={() => void addSeat(delegation.id)}
                      disabled={
                        Boolean(busy) ||
                        delegation.seats.length >= MAX_DELEGATION_SEATS ||
                        seatViews.length >= MAX_HOUSE_SEATS
                      }
                    >＋</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-orbit"><span>G</span><span>C</span><span>Q</span></div>
            <strong>先邀请第一位智囊</strong>
            <p>打开一个已经登录的 AI 页面，然后点“当前标签页入席”。</p>
          </div>
        )}

        <div className="primary-actions">
          <button className="soft-button" type="button" onClick={() => void attachActiveTab()} disabled={Boolean(busy)}>
            ＋ 当前标签页入席
          </button>
          <button className="ghost-button" type="button" onClick={() => void refreshCandidateTabs()} disabled={Boolean(busy)}>
            刷新发现
          </button>
        </div>

        {candidateTabs.filter((tab) => tab.id && !seats.some((seat) => seat.tabId === tab.id)).length ? (
          <div className="discovered-tabs">
            {candidateTabs
              .filter((tab) => tab.id && !seats.some((seat) => seat.tabId === tab.id))
              .slice(0, 5)
              .map((tab) => (
                <button type="button" key={tab.id} onClick={() => void attachTab(tab, false)}>
                  <span>{tab.title || tab.url}</span><b>入席</b>
                </button>
              ))}
          </div>
        ) : null}
      </section>

      <form className="command-card" onSubmit={convene}>
        <div className="section-head compact">
          <div><span className="section-kicker">KING'S COMMAND</span><h2>今天议什么？</h2></div>
          <span className={`stage-pill stage-${stage}`}>{stageLabel(stage)}</span>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          disabled={busy === "council"}
          placeholder="把问题交给众议院……"
        />
        <button className="convene-button" type="submit" disabled={!question.trim() || Boolean(busy)}>
          <span>{busy === "council" ? "廷议进行中" : seatViews.length > 4 ? "召开众议院" : "开廷"}</span>
          <b>{busy === "council" ? "···" : "→"}</b>
        </button>
      </form>

      {stage !== "idle" ? (
        <section className="progress-card">
          <div className="phase-line">
            <Phase name="密室" active={stage === "sealed"} done={stage !== "sealed" && stage !== "error"} />
            <i />
            <Phase name="廷议" active={stage === "debate"} done={stage === "final" || stage === "complete"} />
            <i />
            <Phase name="表态" active={stage === "final"} done={stage === "complete"} />
          </div>
          <div className="live-note">
            <span className="pulse-dot" />
            {activeActorId
              ? `${participantName(seatViews, activeActorId)} 正在发言`
              : stage === "complete"
                ? "议会已经形成奏议"
                : "等待下一批独立发言"}
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="result-card">
          <span className="section-kicker">HOUSE VERDICT</span>
          <div className="verdict-row">
            <div>
              <h2>{report.consensusStance ?? "No consensus"}</h2>
              <p>{Math.round(report.consensusRatio * 100)}% 当前席位支持</p>
            </div>
            <div className="verdict-ring">{Math.round(report.confidence * 100)}</div>
          </div>

          {house && house.delegationCount > 1 ? (
            <div className="dual-consensus">
              <Metric
                label="席位多数"
                value={house.seatMajority.stance ?? "Tie"}
                detail={`${house.seatMajority.support}/${house.seatMajority.total} · ${Math.round(house.seatMajority.ratio * 100)}%`}
              />
              <Metric
                label="代表团共识"
                value={house.delegationConsensus.stance ?? "Split"}
                detail={`${house.delegationConsensus.support}/${house.delegationConsensus.total} · ${Math.round(house.delegationConsensus.ratio * 100)}%`}
              />
            </div>
          ) : null}

          {changedMinds.length ? (
            <div className="changed-note">↻ {changedMinds.length} 位议员在讨论中公开修改了立场</div>
          ) : null}

          {report.disagreements.length ? (
            <div className="minority-note">
              <strong>少数意见仍保留</strong>
              <span>{report.disagreements.map((item) => `${item.participant.name}: ${item.stance}`).join(" · ")}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <div className="error-note">{error}</div> : null}

      <details className="advanced-card">
        <summary>
          <span>高级 · Teach / 席位验证 / 标签页 / 议政板</span>
          <b>⌄</b>
        </summary>

        <div className="advanced-body">
          {delegations.map((delegation) => {
            const first = delegation.seats[0]!;
            const recipe = recipes[first.origin];
            const readyCount = delegation.seats.filter((seat) =>
              isSeatReady(seat, recipes, tests, gates),
            ).length;
            return (
              <div className="teach-group" key={delegation.id}>
                <div className="teach-head">
                  <strong>{first.providerName}</strong>
                  <span>{recipeProgress(recipe)}/3 · {readyCount}/{delegation.seats.length} seats ready</span>
                </div>
                <div className="teach-actions">
                  {(["composer", "send", "response"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => void teachSeat(first, role)}
                      disabled={Boolean(busy)}
                      className={recipeFieldReady(recipe, role) ? "is-ready" : ""}
                    >
                      {teachLabel(role)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={readyCount === delegation.seats.length ? "is-ready" : ""}
                    onClick={() => void verifyDelegation(delegation.id)}
                    disabled={Boolean(busy) || !adapterRecipeComplete(recipe)}
                  >验证席位</button>
                </div>
                <div className="tab-list">
                  {delegation.seats.map((seat) => (
                    <div key={seat.seatId}>
                      <span>{seat.displayName}</span>
                      <small>
                        T:{stateGlyph(tests[seat.seatId])} G:{stateGlyph(gates[seat.seatId])} · tab {seat.tabId}
                      </small>
                      <button type="button" onClick={() => void chrome.tabs.update(seat.tabId, { active: true })}>打开</button>
                      <button type="button" onClick={() => void removeSeat(seat.seatId)}>移除</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {events.length ? (
            <div className="event-mini-list">
              <div className="teach-head"><strong>议政板</strong><span>{events.length} events</span></div>
              {events.slice(-18).map((item) => (
                <div key={item.id} className={`mini-event mini-${item.kind}`}>
                  <b>{participantName(seatViews, item.actorId)}</b>
                  <span>{item.kind.replaceAll("_", " ")}</span>
                  <small>R{item.round}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      {!seats.length ? (
        <section className="quick-open">
          <span>快速打开</span>
          <div>
            {BUILT_IN_PROVIDER_MANIFESTS.map((provider) => (
              <button type="button" key={provider.id} onClick={() => void openProvider(provider.defaultUrl)}>
                {provider.displayName}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="side-footer">
        <span>ChatChat {__CHATCHAT_VERSION__}</span>
        <span>无中转服务器 · 每个 tab 独立验席</span>
      </footer>
    </div>
  );

  async function persistSeats(next: ExtensionSeat[]) {
    const store = chrome.storage.session ?? chrome.storage.local;
    await store.set({ [SEATS_KEY]: next });
  }
}

function Phase({ name, active, done }: { name: string; active: boolean; done: boolean }) {
  return (
    <div className={`phase ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}>
      <span>{done ? "✓" : active ? "•" : ""}</span>
      <b>{name}</b>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function groupSeats(seats: readonly SeatView[]) {
  const groups = new Map<string, SeatView[]>();
  for (const seat of seats) {
    const current = groups.get(seat.delegationId) ?? [];
    current.push(seat);
    groups.set(seat.delegationId, current);
  }
  return [...groups.entries()].map(([id, members]) => ({ id, seats: members }));
}

function numberSeats(seats: readonly ExtensionSeat[]): SeatView[] {
  const groups = new Map<string, ExtensionSeat[]>();
  for (const seat of seats) {
    const current = groups.get(seat.delegationId) ?? [];
    current.push(seat);
    groups.set(seat.delegationId, current);
  }

  return seats.map((seat) => {
    const group = groups.get(seat.delegationId) ?? [seat];
    const sorted = [...group].sort((a, b) => a.tabId - b.tabId);
    const seatIndex = sorted.findIndex((candidate) => candidate.seatId === seat.seatId) + 1;
    return {
      ...seat,
      seatIndex,
      seatCount: sorted.length,
      displayName: `${seat.providerName} · ${String(seatIndex).padStart(2, "0")}`,
    };
  });
}

function createTabCouncilAgent(seat: SeatView, recipe: AdapterRecipe): CouncilAgent {
  const profile = profileForSeat(seat);
  const seatRecipe: AdapterRecipe = { ...recipe, profileId: seat.seatId };
  const inner = new BrowserCouncilAgent(
    profile,
    seatRecipe,
    async (_profile, currentRecipe, prompt) => {
      await ensureBridge(seat.tabId);
      const result = await sendBridge<SpeechResult>(seat.tabId, {
        type: "RUN_SPEECH",
        recipe: currentRecipe,
        prompt,
        timeoutMs: 120_000,
      });
      return { responseText: result.responseText, elapsedMs: result.elapsedMs };
    },
    async () => {
      await chrome.tabs.update(seat.tabId, { url: seat.startUrl });
      await waitForTabComplete(seat.tabId, 35_000);
      await ensureBridge(seat.tabId);
      await sendBridge(seat.tabId, {
        type: "AWAIT_RECIPE",
        recipe: seatRecipe,
        timeoutMs: 35_000,
      });
    },
  );
  const participant: CouncilParticipant = participantForSeat(seat);
  return {
    participant,
    respond: (context) => inner.respond(context),
  };
}

async function verifySeatCouncilGate(
  seat: SeatView,
  recipe: AdapterRecipe,
): Promise<void> {
  await ensureBridge(seat.tabId);
  const context: CouncilContext = {
    sessionId: `extension-council-gate:${seat.seatId}`,
    question:
      "Protocol handshake only. If you can follow the requested structured Council format, return one argument whose stance is exactly READY. Otherwise use stance NOT_READY and explain why.",
    phase: "sealed",
    round: 1,
    participant: participantForSeat(seat),
    publicEvents: [],
    ownEvents: [],
  };
  const prompt = buildProviderCouncilPrompt(context);
  const result = await sendBridge<SpeechResult>(seat.tabId, {
    type: "RUN_SPEECH",
    recipe,
    prompt,
    timeoutMs: 90_000,
  });
  const contributions = parseProviderCouncilResponse(result.responseText, context);
  const ready = contributions.some(
    (item) =>
      item.kind === "argument" &&
      item.stance.trim().toLocaleLowerCase() === "ready",
  );
  if (!ready) {
    throw new Error("Council Gate returned valid structured data but did not declare stance READY.");
  }
}

function profileForSeat(seat: SeatView): ProviderProfile {
  const now = new Date().toISOString();
  return {
    profileId: seat.seatId,
    providerId: seat.providerId,
    adapterId: "extension.tab",
    displayName: seat.displayName,
    url: seat.url,
    origin: seat.origin,
    profileKey: `tab:${seat.tabId}`,
    authState: "ready",
    seatState: "seated",
    createdAt: now,
    updatedAt: now,
  };
}

function participantForSeat(seat: SeatView): CouncilParticipant {
  return {
    id: seat.seatId,
    name: seat.displayName,
    provider: seat.providerId,
    role: "Browser Tab Delegate",
    delegationId: seat.delegationId,
    delegationName: seat.delegationName,
    seatIndex: seat.seatIndex,
    seatCount: seat.seatCount,
  };
}

function isSeatReady(
  seat: SeatView,
  recipes: Readonly<Record<string, AdapterRecipe>>,
  tests: Readonly<Record<string, TestState>>,
  gates: Readonly<Record<string, TestState>>,
): boolean {
  return Boolean(
    adapterRecipeComplete(recipes[seat.origin]) &&
    tests[seat.seatId] === "pass" &&
    gates[seat.seatId] === "pass",
  );
}

async function ensureBridge(tabId: number) {
  try {
    await sendBridge(tabId, { type: "PING" });
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    await sleep(80);
    await sendBridge(tabId, { type: "PING" });
  }
}

async function sendBridge<T = unknown>(tabId: number, payload: Record<string, unknown>): Promise<T> {
  const response = (await chrome.tabs.sendMessage(tabId, {
    __chatchat: true,
    ...payload,
  })) as BridgeResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "Provider tab did not answer ChatChat.");
  return response.result as T;
}

async function requestOriginPermission(origin: string) {
  const pattern = `${origin}/*`;
  const descriptor = { origins: [pattern] };
  if (await chrome.permissions.contains(descriptor)) return;
  const granted = await chrome.permissions.request(descriptor);
  if (!granted) throw new Error(`ChatChat needs permission for ${origin} before this AI tab can join.`);
}

async function waitForTabComplete(tabId: number, timeoutMs: number) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the Provider tab to load."));
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

function recipeFieldReady(recipe: AdapterRecipe | undefined, role: TeachRole): boolean {
  if (!recipe) return false;
  if (role === "composer") return Boolean(recipe.composerSelector);
  if (role === "send") return Boolean(recipe.sendSelector);
  return Boolean(recipe.responseSelector);
}

function teachLabel(role: TeachRole): string {
  if (role === "composer") return "输入框";
  if (role === "send") return "发送";
  return "回答";
}

function stateGlyph(state: TestState | undefined): string {
  if (state === "pass") return "✓";
  if (state === "running") return "…";
  if (state === "fail") return "×";
  return "·";
}

function stageLabel(stage: CouncilStage): string {
  if (stage === "sealed") return "密室奏议";
  if (stage === "debate") return "公开廷议";
  if (stage === "final") return "最终表态";
  if (stage === "complete") return "完成";
  if (stage === "error") return "中断";
  return "待命";
}

function participantName(seats: readonly SeatView[], actorId: string): string {
  return seats.find((seat) => seat.seatId === actorId)?.displayName ?? actorId;
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen/i.test(name)) return "Q";
  if (/gpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function resetKeys<T>(
  record: Readonly<Record<string, T>>,
  keys: ReadonlySet<string>,
): Record<string, T> {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const root = document.getElementById("extension-root");
if (!root) throw new Error("ChatChat extension root is missing.");
createRoot(root).render(
  <StrictMode>
    <ExtensionApp />
  </StrictMode>,
);
