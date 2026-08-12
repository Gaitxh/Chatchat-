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

## v0.7 — Teach Mode · 教会 ChatChat

现在用户可以在自己的 Provider 页面里，亲手教 ChatChat 三件事：

```text
✍️ 输入框 / Composer
➤ 发送按钮 / Send
💬 回答区域 / Response
```

流程：

```text
Provider URL
    ↓
Local Provider Profile
    ↓
LOGIN · isolated WebView
    ↓
🎙 御前试音
    ↓
教我 Composer → user clicks
教我 Send     → user clicks
教我 Response → user clicks
    ↓
🧩 Adapter Recipe · 3/3
    ↓
Browser Adapter execution layer
    ↓
CouncilAgent
    ↓
🪑 TAKE A SEAT
```

当前已完成：

- ✅ Council Protocol / Blackboard / 自动廷议
- ✅ Tauri + React Council Chamber
- ✅ 本地 SQLite 史册
- ✅ Provider Profile / URL detection / Custom AI fallback
- ✅ 真实 Provider Login WebView
- ✅ 每个 Provider 独立持久化 WebView profile
- ✅ Provider 远程页面不获得 ChatChat remote capability
- ✅ metadata-only `御前试音` DOM probe
- ✅ Teach Mode 点选高亮
- ✅ `composer / send / response` 三步教学
- ✅ 自动生成本地 CSS selector recipe
- ✅ SQLite `adapter_recipes` + browser-local fallback
- ✅ Profile 删除时同步删除 Recipe
- ✅ 密码字段双层拒绝
- ✅ TypeScript / Provider SDK / Teach Mode / Council / Tauri CI

### Teach Mode 不读取什么？

它的目的只是生成定位配方，不是抓取用户隐私。

不会故意读取或保存：

- `document.cookie`
- localStorage / sessionStorage
- 输入框当前值
- 密码内容
- 页面正文
- 聊天消息正文

被选中的元素会记录 selector 和少量结构属性，例如 `id`、`data-testid`、`aria-label`、`data-message-author-role`。密码输入框会在注入脚本和 TypeScript Recipe 校验两层被拒绝。

详见 [`docs/TEACH_MODE.md`](docs/TEACH_MODE.md) 和 [`docs/ADAPTER_HARNESS.md`](docs/ADAPTER_HARNESS.md)。

### 仍然没有假装完成的部分

**3/3 Recipe 不等于真实 AI 已经能在 Council 发言。**

当前圆桌仍使用 deterministic mock council。Teach Mode 解决了“元素在哪里”，下一阶段的 Browser Adapter 还必须真正完成：

1. 验证三个 selector 仍然存在；
2. 把 Council turn 写进 taught composer；
3. 正确触发页面输入事件；
4. 点击 taught send；
5. 判断生成开始与结束；
6. 只从 taught response surface 读取最新 AI 回答；
7. 做 timeout / size limit / failure handling；
8. 转换成 `CouncilContribution[]`；
9. 最终才允许 `ProviderProfile → CouncilAgent`。

## 运行

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

网页版可以试玩 Council、史册与 Provider 名册；托管 Provider WebView、登录、御前试音和 Teach Mode 需要 Tauri 桌面版：

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
│  ├── Adapter Lab                    │
│  └── Local Adapter Recipes          │
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
- ✅ **v0.7 — Teach Mode**：3 次点选 → 本地 Adapter Recipe
- 🔜 **v0.8 — Test Speech / 试奏**：通用 Browser Adapter 用 Recipe 发送一条测试消息并读取 taught response
- 🔜 **v0.9 — First Speaking Advisor**：真实 `ProviderProfile → CouncilAgent`，第一位真人模型正式入席
- 🔭 **Later**：社区 Recipe / Adapter、Provider health tests、Council replay、persuasion graph

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
10. **Taught is not executable until validated.**
11. **Provider pages are untrusted external content.**
12. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## License

MIT
