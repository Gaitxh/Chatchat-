<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑🏛️

**You ask. They debate.**

一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

</div>

ChatChat 不是把几个模型的答案并排展示，而是让多个 AI 智囊完成一次真正可观察的议事过程：

**密室独立奏议 → 公开廷议 → 质疑 → 举证 → 答辩 → 改口 → 少数意见 → 最终奏议。**

用户是“国王”。国王只下达一次问题或任务，Round 2、Round 3……由 ChatChat 自动主持。

> **共识不是目的，接近事实才是目的。**

模型可以挑战别人，也必须可以公开改口、承认不确定，并在最终结果中保留少数意见。

## v0.2 — Council Chamber

现在已经可以进入议政厅了。

- ✅ Tauri 2 桌面壳
- ✅ React + Vite Council Chamber
- ✅ 四位 Mock 智囊围桌就座
- ✅ King's Command：用户只发送一次
- ✅ Round 1 sealed opinions：第一轮彼此不可见
- ✅ Round 2+ 自动开廷
- ✅ 结构化 Public Blackboard
- ✅ Challenge / Evidence / Support / Defense / Revision / Concede
- ✅ 「Changed Mind」可视事件
- ✅ Position / confidence 状态
- ✅ Final Council Report
- ✅ Minority Report
- ✅ Council 生命周期 `onPhase` / `onEvent`
- ✅ CI：Core 类型检查、测试、前端构建

当前的 GPT / Claude / Gemini / DeepSeek 座位是 **deterministic mocks**，只用来验证 Council Protocol 和 UI 流程；它们不是对真实模型行为或观点的宣称。真实网页 Provider 仍在后续里程碑。

## 先试玩网页版议政厅

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

浏览器打开 Vite 输出的本地地址，然后点击 **「下令」**。

默认演示问题会让四位智囊讨论 ChatChat 自己应该选择 Tauri 还是 Electron。你会看到：

```text
👑 King's Command
      ↓
🕯️ 密室奏议
      ↓
🔔 Open Council
      ↓
⚔️ Challenge   📎 Evidence
🛡️ Defense     🤝 Support
      ↓
🔄 Changed Mind
      ↓
📜 Final Positions
      ↓
⚖️ Council Report + Minority Report
```

## 运行桌面版

先准备 Rust 和当前系统上的 Tauri 2 开发依赖，然后：

```bash
npm install
npm run tauri:dev
```

v0.2 暂时关闭 installer/bundle 输出；这一阶段先验证桌面窗口与 Council Chamber。正式安装包、平台图标和 release pipeline 会在后续打开。

## Council 不是普通 Chat Log

Blackboard 使用结构化事件：

```text
💬 ARGUMENT
⚔️ CHALLENGE
📎 EVIDENCE
🤝 SUPPORT
🛡️ DEFENSE
🔄 REVISION
🏳️ CONCEDE
❓ QUESTION
⚠️ UNCERTAIN
📜 FINAL_POSITION
```

所以 ChatChat 能知道“谁在反驳谁”“哪条证据导致谁改变观点”，而不是事后从一整段聊天文本里猜。

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。

## 为什么 Round 1 要封存？

Round 1 所有智囊并行独立回答，互相看不到结果。完成后才一次性公开到 Blackboard。

Round 2+ 也采用 **snapshot → parallel turns → publish batch**：

```text
Blackboard Snapshot N
          │
   ┌──────┼──────┐
   ▼      ▼      ▼
  GPT   Claude  Gemini ...
   │      │      │
   └──────┼──────┘
          ▼
     Publish Batch
          ▼
Blackboard Snapshot N+1
```

这样尽量降低“第一个发言者把后面的模型全部带跑”的顺序偏差。

## 本地优先

ChatChat 的方向是 **no ChatChat server**：

```text
┌──────────────── User Computer ────────────────┐
│  ChatChat                                    │
│   ├── Council Engine                         │
│   ├── Council Chamber                        │
│   ├── Blackboard                             │
│   ├── Local history / SQLite (planned)       │
│   ├── Provider profiles (planned)            │
│   └── Provider adapters (planned)            │
└───────────────┬───────────────┬──────────────┘
                │               │
                ▼               ▼
           AI Provider      Local Model
```

隐私边界必须讲清楚：**ChatChat 自己不设中央转发服务器**，但如果用户把在线模型加入会议，发给该模型的内容仍会直接发送到对应服务商。未来本地模型可以组成完全离线的 Council。

## 当前代码结构

```text
src/
├── app/
│   ├── components/
│   ├── App.tsx
│   ├── council-view.ts
│   ├── styles.css
│   └── useCouncilSession.ts
├── core/
│   ├── blackboard.ts
│   ├── format.ts
│   ├── ids.ts
│   ├── orchestrator.ts
│   └── types.ts
├── providers/
│   ├── provider.ts
│   └── mock-council.ts
└── demo.ts

src-tauri/
├── src/
├── capabilities/
├── Cargo.toml
└── tauri.conf.json

tests/
└── core.test.ts

docs/
└── CHATCHAT_PROTOCOL.md
```

## Roadmap

### v0.3 — Local persistence
- SQLite
- Council Session / Blackboard event store
- Local settings
- 本地议会历史
- Provider profiles

### v0.4 — Provider SDK

目标接口：

```ts
interface ProviderAdapter {
  match(url: string): boolean;
  openLogin(): Promise<void>;
  isLoggedIn(): Promise<boolean>;
  startConversation(): Promise<void>;
  sendCouncilTurn(input: CouncilContext): Promise<CouncilContribution[]>;
}
```

### v0.5 — Real providers

先做少量 Adapter，验证：

- 用户自己添加 URL
- 每个 Provider 独立本地浏览器 Profile
- 用户自己完成网页登录
- 输入 / 发送 / 流式回答捕获
- 新建会话
- 页面升级后的兼容性策略
- 登录态不上传到 ChatChat 服务器（因为根本没有 ChatChat 服务器）

### Later — Teach ChatChat

用户给一个未知 AI URL，通过可视化标注输入框、发送按钮、回答区域、新建聊天等元素，在本地生成 Custom Adapter。

## 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Verify what can be verified.**
7. **Local first.**
8. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## Status

🚧 **Very early / playable Council Chamber**

现在最重要的是把“议会体验”和本地基础设施做扎实，然后才让真实模型坐上这些座位。

## License

MIT
