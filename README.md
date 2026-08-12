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

## v0.8 — Test Speech · 试奏

现在一个真实 Provider 可以走到这一步：

```text
Provider URL
    ↓
Local Provider Profile
    ↓
LOGIN · isolated WebView
    ↓
🎙 御前试音
    ↓
3 次点选 → Adapter Recipe 3/3
    ↓
🎻 Test Speech
    ↓
写入 taught composer
点击 taught send
只观察 taught response
    ↓
TEST PASSED
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
- ✅ Teach Mode 三次点选生成本地 Adapter Recipe
- ✅ **用户显式触发的 Test Speech**
- ✅ 固定 host-owned scripts；UI 不能提交任意 JavaScript
- ✅ taught composer 写入 + input/change event
- ✅ taught send 点击
- ✅ 只轮询 taught response selector
- ✅ response baseline / stable-text detection
- ✅ 120 秒 timeout / 100k response capture limit
- ✅ 缺失 selector / disabled send / host mismatch 等显式失败
- ✅ TypeScript / Provider SDK / Teach Mode / Test Speech / Council / Tauri CI

### Test Speech 的隐私边界

v0.8 第一次需要读取真实 AI 回复，因为它必须验证一次真实网页往返。但读取范围被限定为**用户自己在 Teach Mode 点选过的 Response selector**。

它不会去扫描 `document.body.textContent`，也不会读取 Cookie、localStorage、密码或其他账户页面内容。

测试消息始终显示在 UI 中，用户可以编辑；只有用户点击 **「试奏」** 才会发送。

详见 [`docs/TEST_SPEECH.md`](docs/TEST_SPEECH.md)。

### TEST PASSED 仍然不等于 READY

`TEST PASSED` 只证明：当前登录状态 + 当前页面 + 当前 3/3 Recipe 可以完成一次显式浏览器往返。

当前正式圆桌仍使用 deterministic mock council。下一阶段还必须增加一个 **Council Bridge**：

1. 给真实 Provider 构造 sealed / debate / final 的阶段化 prompt；
2. 把 Provider 自然语言输出转换成可校验的 `CouncilContribution[]`；
3. 做 malformed output / timeout / selector drift 的降级；
4. 让 Provider session 实现真正的 `CouncilAgent`；
5. 只有这些都通过后，智囊才会显示 `READY` 并正式入席。

## 两道质量门槛

GitHub CI 能验证代码，但不能替用户登录外部 AI 网站。因此 ChatChat 明确区分：

```text
Gate A — CI
TypeScript + tests + Vite + Rust/Tauri compile

Gate B — User-local Provider validation
real login + probe + Teach Recipe + Test Speech
```

真实 Provider 的手动验收步骤见 [`docs/MANUAL_PROVIDER_TEST.md`](docs/MANUAL_PROVIDER_TEST.md)。

## 运行

需要 Node.js 20+。

```bash
npm install
npm run check
npm test
npm run dev
```

网页版可以试玩 Council、史册与 Provider 名册；托管 Provider WebView、登录、御前试音、Teach Mode 和 Test Speech 需要 Tauri 桌面版：

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
│  ├── Adapter Lab / Teach Mode       │
│  ├── Local Adapter Recipes          │
│  └── Test Speech Harness            │
└──────────┬─────────┬─────────┬───────┘
           │         │         │
           ▼         ▼         ▼
       Provider   Provider  Local Model
```

不存在 `User → ChatChat Server → Providers` 这一层。在线模型仍然会收到用户主动发给它们的内容，但 ChatChat 自己不增加中央中转服务。

## Provider SDK

详见 [`docs/PROVIDER_SDK.md`](docs/PROVIDER_SDK.md)。

> **A provider is not a seat. A provider becomes a seat only when an adapter can create a CouncilAgent.**

## Roadmap

- ✅ **v0.1 — Council Protocol**
- ✅ **v0.2 — Council Chamber**
- ✅ **v0.3 — The Historian**
- ✅ **v0.4 — Invite Advisors**
- ✅ **v0.5 — Login Gate**
- ✅ **v0.6 — Adapter Lab / 御前试音**
- ✅ **v0.7 — Teach Mode**：3 次点选 → Adapter Recipe
- ✅ **v0.8 — Test Speech / 试奏**：显式测试消息 → 真实网页回复
- 🔜 **v0.9 — Council Bridge**：阶段 prompt + 结构化输出 parser + Browser CouncilAgent
- 🔜 **v1.0 — First Real Council**：首批真实智囊自动完成 sealed → debate → final
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
11. **TEST PASSED is not READY.**
12. **Provider pages are untrusted external content.**
13. **The UI can be theatrical; the protocol must stay sober.**

> **外面是宫廷，里面是科研。**

## License

MIT
