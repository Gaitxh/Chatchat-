<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑🏛️

**You ask. They debate.**

一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

</div>

ChatChat 不是把几个模型的回答并排放在一起，而是把 AI 变成一群会独立思考、公开质疑、举证、改口并保留少数意见的智囊。

用户是“国王”。你只下达一次命令，之后由系统自动主持整场廷议：

```text
👑 King's Command
      ↓
🕯️ Round 1 · Sealed Opinions
      ↓
🔔 Open Council
      ↓
⚔️ Challenge   📎 Evidence
🛡️ Defense     🤝 Support
      ↓
🔄 Revision / Concede
      ↓
📜 Final Positions
      ↓
⚖️ Council Report + Minority Report
      ↓
📚 Local Chronicle
```

> **共识不是目的，接近事实才是目的。**

## v0.4 — Invite Advisors

ChatChat 现在已经有了真正的 **Provider Profile / 智囊名册**：

- ✅ 输入 AI 网站 URL
- ✅ 识别 ChatGPT / Claude / Gemini / DeepSeek
- ✅ 未知 HTTP(S) URL 自动变成 Custom AI
- ✅ 为每个 Provider 创建独立本地 profile key
- ✅ Provider Profile 写入本机 SQLite
- ✅ 浏览器开发模式使用 localStorage fallback
- ✅ `+ INVITE AI` 邀请界面
- ✅ `LOGIN REQUIRED / ADAPTER NEEDED / READY / ERROR` 状态模型
- ✅ Provider Adapter SDK 契约
- ✅ Provider SDK 自动测试
- ✅ 完整 Council 历史仍然本地保存
- ✅ 没有 ChatChat 中央服务器

**重要：v0.4 还没有伪装成“真实网页模型已经接入”。**

现在圆桌上的 GPT / Claude / Gemini / DeepSeek 仍然是 deterministic mock council。邀请进来的真实 Provider 会先进入候场区；只有后续 Adapter 真能把它转换成 `CouncilAgent`，它才允许入席。

```text
Provider Manifest
      ↓
Provider Profile
      ↓
Provider Adapter
      ↓
CouncilAgent
      ↓
AI takes a seat
```

## 试玩网页版

需要 Node.js 20+：

```bash
npm install
npm run check
npm test
npm run dev
```

网页版会使用浏览器本地存储保存 Council 历史和 Provider Profiles。

## 运行桌面版

准备 Rust 与 Tauri 2 的系统依赖后：

```bash
npm install
npm run tauri:dev
```

桌面版使用 Tauri 2 + React/Vite + SQLite。`sqlite:chatchat.db` 当前保存 Council Sessions、完整 Blackboard Events、Council Reports 和 Provider Profiles。

## Provider SDK

详细设计见 [`docs/PROVIDER_SDK.md`](docs/PROVIDER_SDK.md)。社区 Adapter 最终实现：

```ts
interface ProviderAdapter {
  readonly manifest: ProviderAdapterManifest;
  matches(url: URL): boolean;
  open(profile: ProviderProfile): Promise<ProviderAdapterSession>;
}

interface ProviderAdapterSession {
  readonly profile: ProviderProfile;
  getAuthState(): Promise<ProviderAuthState>;
  createCouncilAgent(): Promise<CouncilAgent>;
}
```

因此未来同一个 Council 可以混合网页模型、官方 API、OpenAI-compatible endpoint、Ollama、LM Studio、vLLM、企业内部 AI 和社区自定义 Adapter。

## Council Protocol

Blackboard 不是普通 Chat Log，而是结构化事件流：

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

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。Round 1 完全封存，Round 2+ 使用 `snapshot → parallel turns → publish batch`，尽量降低最先发言者的锚定效应。

## Local First

```text
┌──────────── User Computer ────────────┐
│ ChatChat                             │
│  ├── Council Engine                 │
│  ├── Blackboard                     │
│  ├── Council Chamber                │
│  ├── SQLite Chronicle               │
│  ├── Provider Profiles              │
│  └── Provider Adapters              │
└──────────┬─────────┬─────────┬───────┘
           │         │         │
           ▼         ▼         ▼
       Provider   Provider  Local Model
```

没有 `User → ChatChat Server → Providers` 这一层。但隐私边界必须说清楚：未来如果用户把在线模型加入会议，发给那个模型的内容仍然会直接发送给对应 AI 服务商。

## Roadmap

- ✅ **v0.1 — Council Protocol**：sealed Round 1、Blackboard、自动廷议、Council Report
- ✅ **v0.2 — Council Chamber**：Tauri + React 圆桌 UI、可视化 Challenge / Evidence / Revision
- ✅ **v0.3 — The Historian**：SQLite Council archive、完整事件保存、历史廷议重开
- ✅ **v0.4 — Invite Advisors**：Provider SDK、Provider Profiles、URL detection、Advisor Roster、Custom AI fallback
- 🚧 **v0.5 — First Real Advisor**：本地隔离 Provider WebView、用户自己登录、登录状态检测、第一份真实网页 Adapter、`ProviderProfile → CouncilAgent`
- 🔭 **Later — Teach ChatChat**：对未知 AI URL 可视化标注输入框、发送按钮、回答区域等，在本地生成 Custom Adapter

## 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Verify what can be verified.**
7. **Local first.**
8. **Recognized is not the same as integrated.**
9. **Provider pages are untrusted external content.**
10. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## Status

🚧 **Very early / playable / provider foundation in place**

下一件真正刺激的事：让第一位真实 AI 智囊通过本地网页登录，然后正式坐上圆桌。

## License

MIT
