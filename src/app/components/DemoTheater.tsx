import type { CouncilRunMode } from "../useCouncilSession.js";
import type {
  AdapterRecipe,
  AdapterSpeechResult,
  CouncilBridgeVerificationResult,
  ProviderProfile,
} from "../../provider-sdk/index.js";
import { adapterRecipeComplete } from "../../provider-sdk/index.js";
import "../demo.css";

interface DemoTheaterProps {
  profiles: readonly ProviderProfile[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  loginWindowProfileIds: readonly string[];
  providerHostProfileIds: readonly string[];
  speechResults: Readonly<Record<string, AdapterSpeechResult>>;
  bridgeResults: Readonly<Record<string, CouncilBridgeVerificationResult>>;
  liveSeatCount: number;
  mode: CouncilRunMode;
  disabled: boolean;
  onLoadQuestion(question: string): void;
}

const SCENARIOS = [
  {
    label: "⚙️ Architecture War",
    title: "技术路线之争",
    question:
      "我们要做一个 local-first、开源、跨平台的桌面 AI 工具。请比较 Tauri、Electron 和原生开发，给出推荐方案；如果你不同意其他智囊，请明确指出它们忽略了什么。",
  },
  {
    label: "🚀 Startup Council",
    title: "产品战略会",
    question:
      "一个两人团队只有 6 个月 runway，要做面向开发者的 AI 产品。应该优先做开源增长、付费 SaaS，还是本地优先桌面产品？请从增长、现金流、护城河、执行风险四个角度互相质询。",
  },
  {
    label: "🔎 Evidence Trial",
    title: "证据审判",
    question:
      "Rust 是否真的比 Go 更适合构建高可靠的本地 AI 基础设施？不要只讲偏好：请区分可验证事实、工程经验和主观判断，并主动挑战没有证据的论点。",
  },
];

export function DemoTheater(props: DemoTheaterProps) {
  const invited = props.profiles.length;
  const openWindows = props.loginWindowProfileIds.length;
  const healthyWindows = props.providerHostProfileIds.length;
  const taught = props.profiles.filter((profile) =>
    adapterRecipeComplete(props.recipes[profile.profileId]),
  ).length;
  const tested = props.profiles.filter((profile) => props.speechResults[profile.profileId]?.ok).length;
  const gated = props.profiles.filter((profile) => profile.authState === "ready" || props.bridgeResults[profile.profileId]?.ok).length;
  const liveUnlocked = props.liveSeatCount >= 2;

  const steps = [
    { key: "invite", icon: "➕", title: "Invite URL", detail: `${invited} advisor profile${invited === 1 ? "" : "s"}`, done: invited > 0 },
    { key: "login", icon: "🔐", title: "Provider Health", detail: `${healthyWindows} healthy · ${openWindows} open`, done: healthyWindows > 0 },
    { key: "teach", icon: "🧩", title: "Teach 3 selectors", detail: `${taught} recipe${taught === 1 ? "" : "s"} 3/3`, done: taught > 0 },
    { key: "test", icon: "🎻", title: "Test Speech", detail: `${tested} real round-trip${tested === 1 ? "" : "s"}`, done: tested > 0 },
    { key: "gate", icon: "⚖️", title: "Council Gate", detail: `${gated} structured advisor${gated === 1 ? "" : "s"}`, done: gated > 0 },
    { key: "seat", icon: "🪑", title: "Healthy Seat", detail: `${props.liveSeatCount}/4 live seats`, done: props.liveSeatCount > 0 },
    { key: "live", icon: "🔥", title: "LIVE COUNCIL", detail: liveUnlocked ? "real advisors only" : "needs 2 healthy live seats", done: liveUnlocked },
  ];

  return (
    <section className="demo-theater">
      <header className="demo-theater__header">
        <div>
          <span className="eyebrow">DEMO THEATER · 真实演示台</span>
          <h2>Watch the palace come alive</h2>
          <p>
            这里不伪造“已连接”状态：绿灯来自当前 Provider / WebView Health / Recipe / Test / Gate / Seat 的真实运行状态。
            如果真实 Provider 窗口被关掉或离开预期 host，席位会自动熄灭，Demo Theater 也会同步退回。
          </p>
        </div>
        <ModeOrb mode={props.mode} liveSeatCount={props.liveSeatCount} />
      </header>

      <div className="demo-journey" aria-label="Real provider operation progress">
        {steps.map((step, index) => (
          <div className={`demo-step ${step.done ? "demo-step--done" : ""}`} key={step.key}>
            <div className="demo-step__icon">{step.done ? "✓" : step.icon}</div>
            <div className="demo-step__copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
            {index < steps.length - 1 ? <i className="demo-step__connector" /> : null}
          </div>
        ))}
      </div>

      <div className="demo-theater__body">
        <div className="demo-script">
          <span className="eyebrow">WHAT TO RECORD</span>
          <h3>90 秒真实 Demo 剧本</h3>
          <ol>
            <li><b>0:00</b><span>点击 <strong>+ INVITE AI</strong>，粘贴一个真实 AI URL。</span></li>
            <li><b>0:10</b><span>打开隔离 WebView，用户自己登录；回到 Provider chat host 后健康灯变绿。</span></li>
            <li><b>0:20</b><span>三次 <strong>教我</strong>：点输入框、发送按钮、回答区域。</span></li>
            <li><b>0:35</b><span>点击 <strong>试奏</strong>，真实网页回一句话，出现 TEST PASSED。</span></li>
            <li><b>0:45</b><span>打开 <strong>Council Gate</strong>，AI 返回结构化 ChatChat envelope。</span></li>
            <li><b>0:55</b><span>点击 <strong>TAKE A SEAT</strong>；第二个健康真实 AI 同样入席。</span></li>
            <li><b>1:05</b><span>国王只下令一次。Round 1 密封，然后真实 AI 自动互相质询。</span></li>
            <li><b>1:25</b><span>展示 Changed Mind / Minority Report / Court Chronicle；顺手关一个 Provider 窗口，展示席位自动被撤销。</span></li>
          </ol>
        </div>

        <div className="demo-scenarios">
          <span className="eyebrow">LOAD A REAL QUESTION</span>
          <h3>一键装填 Demo 议题</h3>
          <div className="demo-scenario-grid">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.label}
                type="button"
                disabled={props.disabled}
                onClick={() => props.onLoadQuestion(scenario.question)}
              >
                <span>{scenario.label}</span>
                <strong>{scenario.title}</strong>
                <small>{scenario.question}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="demo-theater__footer">
        <span>DEMO = mocks</span>
        <span>HYBRID = 1 healthy live + mocks</span>
        <span>LIVE = 2–4 healthy real web advisors</span>
        <span>GHOST SEATS = EVICTED</span>
        <span>NO CHATCHAT SERVER</span>
      </footer>
    </section>
  );
}

function ModeOrb({ mode, liveSeatCount }: { mode: CouncilRunMode; liveSeatCount: number }) {
  const copy = mode === "live"
    ? { icon: "🔥", title: "LIVE COUNCIL", detail: `${liveSeatCount} healthy real advisors` }
    : mode === "hybrid"
      ? { icon: "⚗️", title: "HYBRID", detail: "1 healthy real + mock sparring" }
      : { icon: "🎭", title: "DEMO", detail: "deterministic mocks" };
  return (
    <div className={`mode-orb mode-orb--${mode}`}>
      <b>{copy.icon}</b>
      <div><strong>{copy.title}</strong><span>{copy.detail}</span></div>
    </div>
  );
}
