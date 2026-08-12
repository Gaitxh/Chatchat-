# ChatChat 👑🏛️

> **You ask. They debate.**
>
> 一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

ChatChat 的目标不是把几个模型的答案并排显示出来，而是让多个 AI 智囊真正完成一次可观察的议事过程：

**密室独立奏议 → 公开廷议 → 质疑 → 举证 → 答辩 → 改口 → 少数意见 → 最终奏议。**

用户是“国王”。国王只需要下达一次问题或任务，后续 Round 2、Round 3……由 ChatChat 自动主持。

## 为什么做这个？

单模型很容易漏掉条件、对错误事实过度自信，或者被自己的第一判断锚定。

ChatChat 想把不同模型变成一个智囊团，同时保留最重要的一点：

> **共识不是目的，接近事实才是目的。**

模型可以挑战别人，也必须可以公开改口、承认不确定、保留少数意见。

## v0.1 已经有什么

当前第一阶段先实现独立于任何真实模型网站的 **Council Core**：

- ✅ Round 1 sealed opinions：第一轮互相不可见
- ✅ 本地 Blackboard：结构化共享议政板
- ✅ 自动 Round 2+：用户不需要再次发送
- ✅ 同步批次讨论：降低“先说的人锚定所有人”的顺序偏差
- ✅ 结构化 Council Events
- ✅ Revision / Challenge / Evidence / Minority Report
- ✅ 简单自动收敛判断
- ✅ Final Council Report
- ✅ 确定性的 Mock Council 演示
- ✅ 零运行时依赖的 TypeScript 核心

下一阶段才会接真实网页 Provider、桌面 UI 和本地持久化。

## 事件不是普通聊天消息

Blackboard 使用事件协议：

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

这让 ChatChat 可以知道“谁在反驳谁”“谁因为哪条证据改口”，而不是事后从一大段自然语言聊天记录里猜。

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。

## 本地优先

ChatChat 的方向是 **no ChatChat server**：

```text
┌──────────────── User Computer ────────────────┐
│  ChatChat                                    │
│   ├── Council Engine                         │
│   ├── Blackboard                             │
│   ├── Local history / SQLite (planned)       │
│   ├── Provider profiles (planned)            │
│   └── Provider adapters (planned)            │
└───────────────┬───────────────┬──────────────┘
                │               │
                ▼               ▼
           AI Provider      Local Model
```

重要的隐私边界：**ChatChat 自己不设中央转发服务器**，但如果你把在线模型加入会议，发送给该模型的内容仍会直接发送到该模型服务商。未来本地模型可以组成完全离线的 Council。

## 跑一下现在的 Council

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run demo
```

Demo 会召开一场关于 **Tauri vs Electron** 的模拟圆桌会议，你会看到自动 challenge、公开 revision、需求证据、少数意见和最终 Council Report。

> 这些是 **deterministic mocks**，不是对真实模型行为或观点的宣称。它们只用来验证 ChatChat 协议。

## 当前代码

```text
src/
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

tests/
└── core.test.ts

docs/
└── CHATCHAT_PROTOCOL.md
```

## 接下来

### v0.2 — Desktop shell
- Tauri + React UI
- 王座 / AI Council room
- 实时事件动画
- Position / confidence 状态
- “谁说服了谁”的 revision 视图

### v0.3 — Local persistence
- SQLite
- Council Session
- Blackboard event store
- Local settings
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

先做少量官方/社区 Adapter，验证登录态本地保存、输入、发送、流式输出捕获、新会话和页面更新后的兼容性策略。

之后再考虑 **Teach ChatChat**：用户给一个未知 URL，通过可视化标注输入框、发送按钮、回答区域等，生成本地 Custom Adapter。

## 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Verify what can be verified.**
7. **Local first.**
8. **The UI can be theatrical; the protocol must stay sober.**

> 外面是宫廷，里面是科研。

## Status

🚧 **Very early / protocol-first**

现在最重要的不是支持十个模型网站，而是把 Council Protocol 做对。

## License

MIT
