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

## v0.6 — Adapter Lab · 御前试音

真实 Provider 现在不仅可以被邀请并在独立本地 WebView 中登录，ChatChat 的宿主还可以对它执行一个 **metadata-only DOM probe**，为真正的 Adapter 找到页面结构线索。

```text
Provider URL
    ↓
Local Provider Profile
    ↓
LOGIN · isolated WebView
    ↓
🎙 御前试音
    ↓
composer / action metadata
    ↓
Provider Adapter
    ↓
CouncilAgent
    ↓
🪑 TAKE A SEAT
```

当前已完成：

- ✅ `+ INVITE AI` 创建本地 Provider Profile
- ✅ ChatGPT / Claude / Gemini / DeepSeek URL detection
- ✅ Custom AI URL fallback
- ✅ SQLite Provider Profiles + Council history
- ✅ 真实 Provider Login WebView
- ✅ 每个 Provider 独立持久化 WebView profile
- ✅ Provider 远程页面不获得 ChatChat remote capability
- ✅ Host-side `WebviewWindow::eval_with_callback`
- ✅ `御前试音` / Adapter Lab UI
- ✅ 只在 Provider 返回预期 host 后允许 probe
- ✅ composer/action 结构候选展示
- ✅ Rust callback timeout / error handling
- ✅ TypeScript / Provider SDK / Council / Tauri CI

### Probe 明确不会读取

- `document.cookie`
- localStorage / sessionStorage
- input / textarea 的 `.value`
- 密码内容
- 页面正文
- 聊天消息正文

它只读取结构元数据，例如：`tag`、`id`、`role`、`aria-label`、`placeholder`、`data-testid`、input type、disabled/contenteditable 状态和元素数量。

详见 [`docs/ADAPTER_HARNESS.md`](docs/ADAPTER_HARNESS.md)。

### 仍然没有假装完成的部分

`LOGIN WINDOW OPEN` 不等于 `READY`，`DOM PROBED` 也不等于“已经能发言”。

当前圆桌仍使用 deterministic mock council。下一阶段要把 Adapter Lab 发展成 **Teach Mode**：让用户在自己的 Provider 页面上教 ChatChat 哪个是输入框、发送按钮、回答区域，再由通用 Browser Adapter 完成 `ProviderProfile → CouncilAgent`。

## 运行

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

网页版可以试玩 Council、史册与 Provider 名册，但托管 Provider WebView、登录和御前试音只在 Tauri 桌面版启用。

桌面版：

```bash
npm install
npm run tauri:dev
```

## Local First

```text
┌──────────── User Computer ────────────┐
│ ChatChat                             │
│  ├── Council Engine                 │
│  ├── Blackboard                     │
│  ├── Council Chamber                │
│  ├── SQLite Chronicle               │
│  ├── Provider Profiles              │
│  ├── Isolated Provider WebViews     │
│  └── Adapter Lab                    │
└──────────┬─────────┬─────────┬───────┘
           │         │         │
           ▼         ▼         ▼
       Provider   Provider  Local Model
```

不存在 `User → ChatChat Server → Providers` 这一层。在线模型仍然会收到用户主动发给它们的内容，但 ChatChat 自己不增加中央中转服务。

## Provider SDK

详见 [`docs/PROVIDER_SDK.md`](docs/PROVIDER_SDK.md)。

> **A provider is not a seat. A provider becomes a seat only when an adapter can create a CouncilAgent.**

## Council Protocol

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

协议草案见 [`docs/CHATCHAT_PROTOCOL.md`](docs/CHATCHAT_PROTOCOL.md)。

## Roadmap

- ✅ **v0.1 — Council Protocol**
- ✅ **v0.2 — Council Chamber**
- ✅ **v0.3 — The Historian**
- ✅ **v0.4 — Invite Advisors**
- ✅ **v0.5 — Login Gate**：真实 Provider WebView + 本地隔离登录 profile
- ✅ **v0.6 — Adapter Lab**：metadata-only DOM probe / 御前试音
- 🔜 **v0.7 — Teach Mode**：用户在页面上标注 composer / send / response，生成本地 Adapter Recipe
- 🔜 **v0.8 — First Speaking Advisor**：通用 Browser Adapter 驱动第一位真实 Advisor 正式入席
- 🔭 **Later**：社区 Adapter、Provider health tests、Council replay / persuasion graph

## 设计原则

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Local first.**
7. **Recognized is not integrated.**
8. **Logged in is not verified.**
9. **Probed is not trusted.**
10. **Provider pages are untrusted external content.**
11. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## License

MIT
