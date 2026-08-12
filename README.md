<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="180" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑🏛️

**You ask. They debate.**

一个本地优先、开源的 **AI 圆桌会议 / AI Council**。

</div>

ChatChat 把多个 AI 变成一个会独立奏议、互相质疑、举证、改口并保留少数意见的智囊团。用户是“国王”：你只下达一次命令，后续廷议自动进行。

```text
👑 King's Command
      ↓
🕯️ Sealed Opinions
      ↓
🔔 Open Council
      ↓
⚔️ Challenge · 📎 Evidence · 🔄 Revision
      ↓
⚖️ Council Report + Minority Report
      ↓
📚 Local Chronicle
```

> **共识不是目的，接近事实才是目的。**

## v0.5 — Login Gate

真实 Provider 页面现在第一次进入 ChatChat 桌面应用。

- ✅ `+ INVITE AI` 创建本地 Provider Profile
- ✅ 识别 ChatGPT / Claude / Gemini / DeepSeek
- ✅ Custom AI URL fallback
- ✅ Provider Profiles + Council History 存在本机 SQLite
- ✅ 点击 `LOGIN` 打开真实 Provider URL
- ✅ 每个 Provider 使用独立、持久化的本地 WebView profile
- ✅ Windows / Linux 使用独立 webview data directory
- ✅ macOS 使用独立 WebKit data-store identifier
- ✅ 已打开的登录窗口会被重新聚焦，而不是重复创建
- ✅ 只允许 HTTP(S) 导航
- ✅ Rust 后端验证登录命令只能由 ChatChat `main` 窗口发起
- ✅ Provider 远程页面不获得 ChatChat remote capability
- ✅ ChatChat 不要求用户粘贴密码或 Cookie

### 仍然没有假装完成的部分

`LOGIN WINDOW OPEN` **不等于** `READY`。

当前圆桌仍使用 deterministic mock council。真实 Provider 虽然可以在本地独立 WebView 中完成登录，但它还需要 Provider-specific Adapter 去：

1. 验证登录状态；
2. 创建/切换会话；
3. 发送 Council turn；
4. 捕获完整回答；
5. 转换成 `CouncilContribution[]`；
6. 最终产出真正的 `CouncilAgent`。

只有做到这一步，真实智囊才允许从候场区正式入席。

```text
Provider URL
    ↓
Provider Profile
    ↓
LOGIN · isolated WebView
    ↓
Provider Adapter
    ↓
CouncilAgent
    ↓
🪑 TAKE A SEAT
```

## 运行

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

网页版可以试玩 Council、史册与 Provider 名册，但受浏览器环境限制，不会开启托管的桌面登录窗口。

桌面版：

```bash
npm install
npm run tauri:dev
```

桌面版才会启用真正的 Provider Login Gate。

## Local First

```text
┌──────────── User Computer ────────────┐
│ ChatChat                             │
│  ├── Council Engine                 │
│  ├── Blackboard                     │
│  ├── Council Chamber                │
│  ├── SQLite Chronicle               │
│  ├── Provider Profiles              │
│  └── Isolated Provider WebViews     │
└──────────┬─────────┬─────────┬───────┘
           │         │         │
           ▼         ▼         ▼
       Provider   Provider  Local Model
```

不存在 `User → ChatChat Server → Providers` 这一层。在线模型仍然会收到用户主动发给它们的内容，但 ChatChat 自己不增加中央中转服务。

## Provider SDK

详见 [`docs/PROVIDER_SDK.md`](docs/PROVIDER_SDK.md)。

核心边界：

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

> **A provider is not a seat. A provider becomes a seat only when an adapter can create a CouncilAgent.**

## Council Protocol

Blackboard 使用结构化事件，而不是一大串无法分析的 chat message：

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

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。

## Roadmap

- ✅ **v0.1 — Council Protocol**
- ✅ **v0.2 — Council Chamber**
- ✅ **v0.3 — The Historian**
- ✅ **v0.4 — Invite Advisors**
- 🚧 **v0.5 — Login Gate**：真实 Provider 登录 WebView + 本地隔离 profile
- 🔜 **v0.6 — First Speaking Advisor**：第一份 Provider-specific Adapter，真实 `ProviderProfile → CouncilAgent`
- 🔭 **Later — Teach ChatChat**：让用户对未知 AI URL 可视化标注输入框、发送按钮、回答区域，在本地生成 Custom Adapter

## 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Local first.**
7. **Recognized is not integrated.**
8. **Logged in is not verified.**
9. **Provider pages are untrusted external content.**
10. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## License

MIT
