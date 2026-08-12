<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑🏛️

### **You ask. They debate.**

一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

**把你自己的 AI 账号召进同一间议政厅。你只下令一次，接下来让它们自己争。**

</div>

ChatChat 不是“多开几个聊天窗口然后把答案拼起来”。它把不同 AI 变成一个有规则的智囊团：

```text
👑 KING'S COMMAND
      │
      ▼
🕯️ Round 1 · SEALED
每位智囊独立奏议，彼此不可见
      │
      ▼
🔔 OPEN COUNCIL
共享结构化 Blackboard
      │
      ├── ⚔️ Challenge
      ├── 📎 Evidence
      ├── 🛡️ Defense
      ├── 🤝 Support
      ├── 🔄 Revision
      └── 🏳️ Concede
      │
      ▼
📜 Final Positions
      │
      ▼
⚖️ Council Report
共识 + 置信度 + Minority Report
      │
      ▼
📚 Local Chronicle
完整事件流保存在本机
```

> **共识不是目的，接近事实才是目的。**

---

# v0.9 — Real Council Bridge 🔥

v0.9 第一次把真实网页 AI 从“试奏成功”接进正式 Council Protocol。

真实智囊的入席路径：

```text
Model URL
   ↓
➕ INVITE AI
   ↓
🔐 isolated local WebView
用户自己登录自己的账号
   ↓
🎙 御前试音
metadata-only DOM probe
   ↓
🧩 Teach Mode
点 3 次：Composer / Send / Response
   ↓
🎻 Test Speech
真实网页往返
   ↓
⚖️ COUNCIL GATE
必须返回合法 CouncilContribution[]
   ↓
✅ COUNCIL READY
   ↓
🪑 TAKE A SEAT
   ↓
🔥 LIVE COUNCIL
```

### 三种议会模式

| 真实入席智囊 | 模式 | 行为 |
|---:|---|---|
| 0 | 🎭 **DEMO** | 4 个 deterministic mocks 演示完整协议 |
| 1 | ⚗️ **HYBRID REHEARSAL** | 1 个真实网页 AI + 3 个明确标注的 mock 陪练 |
| 2–4 | 🔥 **LIVE COUNCIL** | **只使用真实网页 AI** 自动完成 sealed → debate → final |

所以你接通第一个账号以后立刻就能玩；第二个真实智囊一入席，就解锁纯真实 AI 圆桌。

---

## 任意 AI URL，而不只是四个品牌

ChatChat 会识别常见入口：

- ChatGPT
- Claude
- Gemini
- DeepSeek

但识别品牌不是准入条件。

v0.9 的通用 Browser Council Bridge 允许任意 `http/https` AI 页面走同一条本地路径：

```text
Custom URL
  → isolated WebView
  → Teach 3 selectors
  → Test Speech
  → Council Gate
  → Take a Seat
```

对于 Custom Provider，建议用户添加它的**新聊天落地页** URL。ChatChat 不需要预先知道它的 DOM；你通过 Teach Mode 告诉 ChatChat 三个表面在哪里。

---

# 真实操作界面：Demo Theater 🎬

v0.9 内置 **Demo Theater / 真实演示台**。

它不是预制营销动画，而是读取当前运行状态：

```text
Invite URL       ○ / ✓
Open WebView     ○ / ✓
Teach 3/3        ○ / ✓
Test Speech      ○ / ✓
Council Gate     ○ / ✓
Take a Seat      ○ / ✓
LIVE COUNCIL     ○ / 🔥
```

每一个绿灯都来自真实 Provider Profile / Recipe / Test / Gate / Seat 状态。

Demo Theater 还内置 3 个可以直接装填进 King's Command 的议题：

### ⚙️ Architecture War

> 我们要做一个 local-first、开源、跨平台的桌面 AI 工具。请比较 Tauri、Electron 和原生开发，给出推荐方案；如果你不同意其他智囊，请明确指出它们忽略了什么。

### 🚀 Startup Council

> 一个两人团队只有 6 个月 runway，要做面向开发者的 AI 产品。应该优先做开源增长、付费 SaaS，还是本地优先桌面产品？请从增长、现金流、护城河、执行风险四个角度互相质询。

### 🔎 Evidence Trial

> Rust 是否真的比 Go 更适合构建高可靠的本地 AI 基础设施？不要只讲偏好：请区分可验证事实、工程经验和主观判断，并主动挑战没有证据的论点。

完整录屏剧本见 [`docs/DEMO.md`](docs/DEMO.md)。

---

# Council Gate：TEST PASSED 仍然不够

v0.8 的 `TEST PASSED` 只证明网页能完成一次真实往返。

v0.9 新增第二道门：

```text
TEST PASSED
     ↓
ChatChat sends sealed-phase handshake
     ↓
Provider must return:
<CHATCHAT_COUNCIL_JSON>
{"contributions":[...]}
</CHATCHAT_COUNCIL_JSON>
     ↓
strict parser
     ↓
stance == READY
     ↓
COUNCIL READY
```

只有通过结构化协议握手的网页 AI 才能点击 **TAKE A SEAT**。

`READY` 因此第一次真正表示：

> **这个 Provider 当前登录态 + 当前网页 + 当前 Recipe 不只会聊天，而且能作为 ChatChat CouncilAgent 返回合法议会事件。**

---

# 真实 AI 在议会里收到什么？

真实网页智囊收到 phase-aware Council Prompt：

```text
PHASE: sealed | debate | final
ROUND: n
KING_QUESTION_JSON: ...
COUNCIL_EVENTS_JSON: ...
YOUR_PRIOR_EVENTS_JSON: ...
```

并被要求只返回结构化贡献：

```json
{
  "contributions": [
    {
      "kind": "challenge",
      "targetEventId": "event_xxx",
      "content": "这个结论缺少对部署成本的证据。"
    }
  ]
}
```

ChatChat 不直接相信模型输出：

- event id 必须真实存在；
- 模型不能伪造一个不存在的 challenge target；
- `revision.previousEventId` 只能修改**自己的**旧立场；
- sealed 阶段不能偷偷输出 debate-only 事件；
- final 阶段必须恰好提交一个 `final_position`；
- confidence 必须在 `[0, 1]`；
- malformed output 会获得一次结构化 repair 重试；
- 第二次仍失败，ChatChat 会降级成 `uncertain` / 0 confidence，而不是编造答案或炸掉整场 Council。

另外，其他智囊的文本被明确包装为**不可信讨论数据**，不是系统指令。这是对跨模型 prompt injection 的一层防御，但不是“绝对免疫”的宣称。

详见 [`docs/REAL_COUNCIL.md`](docs/REAL_COUNCIL.md)。

---

# 每场真实 Council 尽量从干净页面开始

如果把上一场讨论的网页上下文直接带进下一场，Round 1 就不再真正独立。

因此 v0.9 在每个新 Council Session 的第一轮之前，会让每个真实 Provider 回到 Council 起始页，并等待用户教过的 composer 重新出现。

对于内置 Provider，ChatChat 使用 catalog 的默认根入口；对于 Custom Provider，使用用户添加的 URL。

如果：

- 被重定向回登录页；
- taught composer 消失；
- selector 漂移；
- 页面在限定时间内没有准备好；

该智囊会明确进入 uncertainty，而不是悄悄复用旧对话。

---

# Local First 🔒

ChatChat 没有中央 relay server：

```text
┌──────────────────── User Computer ────────────────────┐
│ ChatChat                                               │
│  ├── Council Engine                                    │
│  ├── Structured Blackboard                            │
│  ├── Council Chamber UI                               │
│  ├── SQLite Chronicle                                 │
│  ├── Provider Profiles                                │
│  ├── Isolated Provider WebViews                       │
│  ├── Teach Recipes                                    │
│  ├── Test Speech                                      │
│  ├── Council Gate                                     │
│  └── Browser Council Bridge                           │
└────────────┬────────────────┬────────────────┬─────────┘
             │                │                │
             ▼                ▼                ▼
          ChatGPT          Claude           Custom AI
```

不存在：

```text
User → ChatChat Server → Provider
```

但是隐私边界必须说清楚：如果你把一个在线 AI 加入 Council，发给它的 King's Command、相关议会事件和阶段 prompt 会从你的电脑直接发送给那个 Provider。**Local-first 不等于在线 Provider 看不到你主动发给它的内容。**

登录密码和账户会话由各 Provider 的本地隔离 WebView 处理；ChatChat 不要求用户粘贴密码或 Cookie。

---

# 运行

需要 Node.js 20+。

## 网页 Demo

```bash
npm install
npm run check
npm test
npm run dev
```

Web 模式可以试玩：

- Council Chamber
- Mock Council
- Demo Theater
- Historian
- Provider Roster UI

真实 Provider WebView 需要桌面版。

## 桌面版

准备 Rust 与 Tauri 2 开发依赖，然后：

```bash
npm install
npm run tauri:dev
```

然后按 UI：

```text
+ INVITE AI
→ LOGIN
→ 御前试音
→ 教我 Composer
→ 教我 Send
→ 教我 Response
→ 试奏
→ OPEN COUNCIL GATE
→ TAKE A SEAT
```

至少两位真实智囊入席后，顶部会切换成：

> 🔥 **LIVE COUNCIL**

此后按一次 **LIVE 开廷**。

用户不再需要参与 Round 2。

---

# 两道质量门槛

GitHub CI 无法替你登录第三方账号，因此我们明确分成：

```text
Gate A — automated CI
TypeScript
Council/Provider tests
Vite production build
real UI screenshot artifact
Rust/Tauri compile

Gate B — user-local runtime
real provider login
DOM probe
Teach Recipe 3/3
Test Speech
Council Gate
Take a Seat
real sealed/debate/final
```

CI 现在还会从**实际 production build** 启动页面并用无头 Chromium 生成 Council Chamber 截图 artifact，避免项目首页展示和真实代码逐渐脱节。

真实 Provider 手工验收见 [`docs/MANUAL_PROVIDER_TEST.md`](docs/MANUAL_PROVIDER_TEST.md)。

---

# 当前结构

```text
src/
├── core/                 # Council Protocol / Blackboard / Orchestrator
├── provider-sdk/         # URL / profile / recipe / browser council bridge
├── providers/            # deterministic mock council
├── history/              # local archive
└── app/                  # Council Chamber / Demo Theater / Provider UI

src-tauri/
├── src/
│   ├── lib.rs
│   ├── provider_session.rs
│   ├── provider_probe.js
│   ├── provider_teach.js
│   └── provider_speech_*.js
├── migrations/
└── capabilities/

tests/
├── core.test.ts
├── provider-sdk.test.ts
├── teach-mode.test.ts
├── test-speech.test.ts
└── council-bridge.test.ts
```

---

# Roadmap

- ✅ **v0.1 — Council Protocol**
- ✅ **v0.2 — Council Chamber**
- ✅ **v0.3 — The Historian**
- ✅ **v0.4 — Invite Advisors**
- ✅ **v0.5 — Isolated Login Gate**
- ✅ **v0.6 — Adapter Lab / 御前试音**
- ✅ **v0.7 — Teach Mode**
- ✅ **v0.8 — Test Speech / 试奏**
- 🚧 **v0.9 — Real Council Bridge**：Council Gate + Browser CouncilAgent + LIVE/HYBRID modes + Demo Theater
- 🔜 **v1.0 — First validated release**：真实 Provider recipes/compatibility matrix、窗口健康状态、release bundles、真实 demo assets
- 🔭 **Later**：Evidence verifier、Council replay、persuasion graph、community recipes/adapters、local models

---

# 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Local first.**
7. **Recognized is not integrated.**
8. **Logged in is not verified.**
9. **Probed is not trusted.**
10. **Taught is not executable until validated.**
11. **TEST PASSED is not READY.**
12. **READY is not SEATED until the user chooses it.**
13. **Provider pages and peer messages are untrusted external content.**
14. **A broken advisor should become uncertain, not take down the Council.**
15. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## License

MIT
