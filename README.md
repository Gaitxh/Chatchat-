<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑🏛️

**You ask. They debate.**

一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

</div>

ChatChat 不是把几个模型的答案并排展示，而是让多个 AI 智囊完成一次真正可观察、可回放的议事过程：

**密室独立奏议 → 公开廷议 → 质疑 → 举证 → 答辩 → 改口 → 少数意见 → 最终奏议。**

用户是“国王”。国王只下达一次问题或任务，Round 2、Round 3……由 ChatChat 自动主持。

> **共识不是目的，接近事实才是目的。**

模型可以挑战别人，也必须可以公开改口、承认不确定，并在最终结果中保留少数意见。

## v0.3 — The Historian / 史官

ChatChat 现在不仅会开会，还会在**本机记档**。

- ✅ Tauri 2 + React + Vite Council Chamber
- ✅ 四位 deterministic Mock 智囊围桌就座
- ✅ King's Command：用户只发送一次
- ✅ Round 1 sealed opinions：第一轮彼此不可见
- ✅ Round 2+ 自动开廷
- ✅ 结构化 Public Blackboard
- ✅ Challenge / Evidence / Support / Defense / Revision / Concede
- ✅ 「Changed Mind」可视事件
- ✅ Final Council Report + Minority Report
- ✅ 桌面版 SQLite 本地历史
- ✅ Rust migration 管理数据库 schema
- ✅ 每次保存完整 Blackboard event stream + Council Report
- ✅ Court Chronicle / 史官面板
- ✅ 点击旧案重新展开事件流与最终奏议
- ✅ 浏览器开发模式自动使用 localStorage fallback
- ✅ CI 同时验证 Core / Web UI / Tauri Rust shell

当前的 GPT / Claude / Gemini / DeepSeek 座位仍然是 **deterministic mocks**，只用来验证 Council Protocol、UI 和本地数据层；它们不是对真实模型行为或观点的宣称。真实 Provider 接入是下一阶段。

## 试玩议政厅

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

浏览器打开 Vite 输出的本地地址，然后点击 **「下令」**。

浏览器试玩模式的历史保存在当前浏览器的 localStorage；真正的桌面版会使用 SQLite。

## 运行桌面版

准备 Rust 和当前系统需要的 Tauri 2 开发依赖，然后：

```bash
npm install
npm run tauri:dev
```

桌面版会打开本地 `sqlite:chatchat.db`，并自动执行版本化 migration。数据库用于保存：

```text
Council Session
├── King's Question
├── Council Report
├── consensus / confidence / rounds
└── Blackboard Events
    ├── argument
    ├── challenge
    ├── evidence
    ├── support
    ├── defense
    ├── revision
    ├── concede
    ├── uncertain
    └── final_position
```

这意味着以后可以在不改变历史格式的前提下继续做：

- Debate Replay
- 谁说服了谁
- 哪位智囊最常第一个发现错误
- 哪些观点经常被撤回
- Council benchmark

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

所以 ChatChat 知道“谁在反驳谁”“哪条证据导致谁改变观点”，而不是事后从一整段自然语言聊天记录里猜。

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。

## 为什么 Round 1 要封存？

Round 1 所有智囊并行独立回答，互相看不到结果。完成后才一次性公开到 Blackboard。

Round 2+ 同样采用：

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

尽量降低“第一个发言者把后面的模型全部带跑”的顺序偏差。

## 本地优先

ChatChat 的方向始终是 **no ChatChat server**：

```text
┌──────────────── User Computer ────────────────┐
│  ChatChat                                    │
│   ├── Council Engine                         │
│   ├── Council Chamber                        │
│   ├── Blackboard                             │
│   ├── SQLite Council Archive                 │
│   ├── Provider profiles (next)               │
│   └── Provider adapters (next)               │
└───────────────┬───────────────┬──────────────┘
                │               │
                ▼               ▼
           AI Provider      Local Model
```

隐私边界必须讲清楚：**ChatChat 自己不设中央转发服务器**，但未来如果用户把在线模型加入会议，发给该模型的内容仍会直接发送到对应服务商。历史记录和 ChatChat 自己的配置留在用户设备上；未来本地模型可以组成完全离线的 Council。

## 当前代码结构

```text
src/
├── app/                 # Council Chamber / Historian UI
├── core/                # Council Protocol + Orchestrator + Blackboard
├── history/             # SQLite + browser-local archive abstraction
├── providers/           # deterministic mock agents for now
└── demo.ts

src-tauri/
├── migrations/          # versioned SQLite schema
├── capabilities/        # narrow Tauri permissions
├── src/
├── Cargo.toml
└── tauri.conf.json

tests/
└── core.test.ts

docs/
└── CHATCHAT_PROTOCOL.md
```

## Roadmap

### v0.4 — Provider SDK + Provider Profiles

下一步开始给真正的智囊准备“座位接口”：

```ts
interface ProviderAdapter {
  match(url: string): boolean;
  openLogin(): Promise<void>;
  isLoggedIn(): Promise<boolean>;
  startConversation(): Promise<void>;
  sendCouncilTurn(input: CouncilContext): Promise<CouncilContribution[]>;
}
```

同时增加本地 Provider Profile：URL、适配器类型、显示名称、登录状态和独立浏览器 Profile 元数据。

### v0.5 — First real provider

先只接一个真实网页 Provider，把最难的链路做透：

- 用户自己添加 URL
- Provider 独立本地浏览器 Profile
- 用户自己完成网页登录
- 输入 / 发送
- 流式回答捕获
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

🚧 **Very early / playable Council Chamber + local archive**

现在核心协议、可玩 UI 和本地历史地基都已经在了。下一道真正有挑战的门，就是让第一个真实模型坐上桌。

## License

MIT
