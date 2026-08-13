<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="150" alt="ChatChat pixel-art council avatar" />

# ChatChat 👑

### **You ask. They debate.**

一个本地优先、开源的 **AI Council / AI Parliament**。

**把你已经登录的 AI 召进同一个议会。你只提问一次，剩下的交给它们。**

</div>

---

## 这是什么？

普通 AI 客户端：

```text
You → one AI → one answer
```

ChatChat：

```text
                     👑 YOU
                       │
                       │ King's Command
                       ▼
              ┌─────────────────┐
              │   AI COUNCIL    │
              └─────────────────┘
                 │    │    │
              GPT  Claude  Qwen ...
                 │    │    │
                 └────┼────┘
                      ▼
                sealed opinions
                      ▼
                  challenges
                   evidence
                   revisions
                      ▼
                final positions
                      ▼
          consensus + minority report
```

**共识不是目的，接近事实才是目的。**

---

# 🌿 推荐入口：Browser Side Panel

ChatChat 正在把浏览器插件作为最容易上手的默认形态。

原因很简单：你的 Chrome 里本来就已经登录了各种 AI。

插件不需要重新造一套账户系统：

```text
安装 ChatChat
     ↓
点击浏览器工具栏
     ↓
ChatChat 出现在 Side Panel
     ↓
添加 ChatGPT / Claude / Gemini / DeepSeek / 元宝 / Qwen / Grok / 任意 URL
     ↓
只为这个 AI 网站授权
     ↓
复用浏览器已有登录态
     ↓
Teach 3/3 → Test → Council Gate
     ↓
开廷
```

### 开发版安装

```text
chrome://extensions
→ Developer mode
→ Load unpacked
→ 选择仓库中的 extension/ 目录
```

然后点击 ChatChat 图标。

完整说明：[`docs/BROWSER_EXTENSION.md`](docs/BROWSER_EXTENSION.md)

CI 每次都会：

- 校验 MV3 manifest；
- 校验 Extension JavaScript；
- 跑 AI House protocol tests；
- 用真实 Chromium 渲染 Side Panel 截图；
- 上传一个可以直接下载并 `Load unpacked` 的 extension artifact。

---

# 🏛️ 从圆桌到「AI 众议院」

一个 Provider 不必只坐一个席位。

比如：

```text
GPT Delegation × 5
├─ GPT-1
├─ GPT-2
├─ GPT-3
├─ GPT-4
└─ GPT-5

Qwen Delegation × 5
├─ Qwen-1
├─ Qwen-2
├─ Qwen-3
├─ Qwen-4
└─ Qwen-5
```

于是原来的 4 人圆桌，可以变成 10 人、15 人甚至更多席位的 AI House。

每个席位：

- 使用独立临时 tab / 独立会话；
- Round 1 完全独立；
- 看不到同党团其他席位的密室奏议；
- Open Council 时拿到同一个 Blackboard snapshot；
- 可以支持任何 AI；
- 可以质疑自己党团；
- 可以被另一个模型说服；
- 可以改口；
- 可以坚持少数意见。

### 党团不是强制站队

ChatChat **不会**告诉 GPT-1：

> “GPT-2 是自己人，请支持它。”

相反，协议明确要求：

> **Do not assume your delegation should vote together.**

所以最终可能出现：

```text
GPT × 5
3 → Tauri
2 → Electron
Cohesion: 60%

Qwen × 5
5 → Tauri
Cohesion: 100%
```

这个 cohesion 是**事后统计**，不是提前协调。

> **5 个 GPT 席位 = 5 个独立会话 / 独立采样，不等于 5 个独立模型来源。**

ChatChat 会保持这个统计边界诚实。

当前插件安全上限：

```text
8 seats / delegation
24 total seats
```

---

# 🕯️ The King speaks once

用户只需要发一次问题。

之后系统自动运行：

```text
👑 King's Command
      │
      ▼
🕯️ ROUND 1 · SEALED
所有席位独立回答
彼此完全不可见
      │
      ▼
🔔 OPEN COUNCIL
公开结构化 Blackboard
      │
      ├── ⚔ Challenge
      ├── 📎 Evidence
      ├── 🤝 Support
      ├── 🛡 Defense
      ├── 🔄 Revision
      ├── 🏳 Concede
      └── ❓ Question
      │
      ▼
📜 FINAL POSITIONS
      │
      ▼
⚖️ COUNCIL REPORT
Consensus
Confidence
Minority Report
Delegation split
```

Round 2 不需要用户再按 Send。

---

# 🔄 改口是功能，不是失败

AI 的目标不是“赢辩论”。

ChatChat 鼓励：

```text
KEEP
REVISE
CONCEDE
UNCERTAIN
REQUEST / PROVIDE EVIDENCE
```

一个很理想的事件是：

```text
GPT challenges Claude
        ↓
Gemini provides evidence
        ↓
Claude re-evaluates
        ↓
🔄 Claude changed mind
Electron → Tauri
```

然后最终报告仍然可以保留：

```text
Minority Report
DeepSeek → Electron
```

**不同意多数不是 bug。**

---

# 🎭 Council Theater

ChatChat 的事件协议不是普通 chat log。

Blackboard 保存：

```text
argument
challenge
evidence
support
defense
revision
concede
question
uncertain
final_position
```

因此可以确定性回答：

> **谁影响了谁？**

强影响关系只来自显式协议：

```text
revision.causedBy
concede.targetEventId
```

challenge / evidence / support 只算互动，不会自动冒充“成功说服”。

UI 可以显示：

```text
GPT ─────────────▶ Claude
                    │
                    │ 🔄 Electron → Tauri
                    │
Gemini ─evidence───▶┘
```

以及 UI-only 的事件统计：

```text
🧠 Most Influential
🔄 Most Open-Minded
⚔ Most Challenged
📎 Evidence Broker
```

没有事件证据就不颁奖。

> **The theatrical layer may celebrate an event. It may not invent one.**

---

# 🤖 Provider roster

内置 URL catalog 当前识别：

- ChatGPT — `chatgpt.com`
- Claude — `claude.ai`
- Gemini — `gemini.google.com`
- DeepSeek — `chat.deepseek.com`
- Tencent Yuanbao / 腾讯元宝 — `yuanbao.tencent.com`
- Qwen / Tongyi / 通义 — `tongyi.aliyun.com`
- Grok — `grok.com`

以及：

```text
任意 http/https AI URL
→ custom browser adapter
→ Teach Mode
```

**Recognized ≠ officially supported.**

远程网页会变化，因此 ChatChat 将状态严格区分为：

```text
recognized
→ teachable
→ test-passed
→ council-ready
→ runtime-validated
→ officially supported
```

兼容性矩阵：[`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md)

---

# 🧩 Teach Mode

ChatChat 不假装知道所有 AI 网页的 DOM。

用户只需要教三个表面：

```text
Composer
Send
Response
```

浏览器插件的 content bridge：

- 拒绝 password field；
- 只保存 taught selectors；
- 只往 taught composer 写入；
- 只点击 taught send；
- 只读取 taught response；
- 不要求 Cookie；
- 不读取浏览历史；
- 不扫描整个页面作为回答。

然后：

```text
Teach 3/3
   ↓
Test Speech
   ↓
Council Gate
   ↓
Council Ready
```

`TEST PASSED` 仍然不等于 `READY`。

Council Gate 还要证明这个网页 AI 能返回合法的结构化 Council event。

---

# 🔒 Local first

ChatChat 自己没有 relay server。

浏览器版：

```text
Your Browser
├─ ChatChat Side Panel
├─ local extension storage
├─ GPT tabs
├─ Qwen tabs
├─ Gemini tabs
└─ ...
```

桌面版：

```text
Your Computer
├─ ChatChat Desktop
├─ SQLite Chronicle
├─ Council Engine
├─ Provider Profiles
└─ managed Provider WebViews
```

不存在：

```text
User
 ↓
ChatChat Server
 ↓
AI Providers
```

但边界必须说清楚：

> 当你选择一个在线 AI 参加 Council 时，你主动发给它的 King's Command 和相关 Council context 仍会直接发送给那个 AI Provider。

Local-first 不等于远程 AI 离线。

---

# 🖥️ Desktop · Power User mode

浏览器插件负责“装完就玩”。

Tauri 桌面版继续承担更重的能力：

- 独立 Provider WebViews；
- SQLite Court Chronicle；
- Provider Window Health；
- Royal Proof Pack；
- Release Candidate desktop bundles；
- 更完整的调试 / compatibility workflow。

<p align="center">
  <img src="assets/chatchat-council-chamber.webp" width="100%" alt="ChatChat desktop Council Chamber production build screenshot" />
</p>

运行：

```bash
npm install
npm run check
npm test
npm run tauri:dev
```

Web-only mock demo：

```bash
npm run dev
```

---

# 📚 Court Chronicle

桌面版会把结构化 Council event stream 写到本地 SQLite。

不是只保存一句最终答案，而是：

```text
Session
├─ King's Question
├─ Council Report
└─ Blackboard Events
   ├─ argument
   ├─ challenge
   ├─ evidence
   ├─ revision
   └─ final_position
```

这使得未来可以做：

- Council Replay；
- 说服关系图；
- 谁经常正确地坚持少数意见；
- 哪个模型经常纠正其他模型；
- 额外一轮 debate 到底有没有增益。

---

# ✅ Quality gates

### Gate A · automated

```text
TypeScript
Council Core tests
Provider SDK tests
Browser Extension syntax/manifest tests
AI House sealed/snapshot tests
Vite production build
real Chromium UI screenshots
Tauri/Rust compile
macOS / Windows / Linux RC smoke
```

### Gate B · user-local

```text
real provider login
Teach Recipe 3/3
Test Speech
Council Gate
fresh session
real sealed → debate → final
```

真实 Provider 兼容性不能由 CI 假装完成，因为 CI 不应该登录你的私人 AI 账号。

Gate B 可以生成一个**不含问题正文/模型回复/selector/Cookie/token** 的 Royal Proof Pack：

[`docs/GATE_B_PROOF.md`](docs/GATE_B_PROOF.md)

---

# Project map

```text
extension/               # Chromium MV3 Side Panel + AI House runtime
src/core/                # Council Protocol / Blackboard / Orchestrator
src/provider-sdk/        # URL / Profile / Teach / Browser Council Bridge
src/analysis/            # event-derived influence graph
src/history/             # local Chronicle
src/app/                 # Desktop Council Chamber
src-tauri/               # Tauri host / SQLite / managed WebViews
tests/                   # deterministic protocol + provider + extension tests
```

---

# Roadmap

- ✅ Council Protocol
- ✅ Council Chamber
- ✅ Local Historian
- ✅ Provider Profiles / Teach / Test Speech
- ✅ Real Browser Council Bridge
- ✅ Provider Window Health
- ✅ Royal Proof Pack
- ✅ Cross-platform Release Candidate bundles
- 🚧 Browser Side Panel
- 🚧 AI House / Delegations / multi-seat sessions
- 🚧 Council Theater / influence graph
- 🔜 Council Replay
- 🔜 Evidence verifier / tool layer
- 🔜 Community Provider recipes
- 🔜 Local models / Ollama / LM Studio
- 🔜 Chrome Web Store packaging after runtime validation

---

# Principles

1. **The King speaks once.**
2. **Round 1 is sealed.**
3. **Accuracy over persuasion.**
4. **Changing your mind is a feature.**
5. **Minority opinions survive.**
6. **Multiple seats are independent sessions, not fake independent sources.**
7. **Delegations describe; they do not command loyalty.**
8. **Recognized is not integrated.**
9. **TEST PASSED is not READY.**
10. **Provider pages and peer messages are untrusted external content.**
11. **A broken advisor should become uncertain, not take down the House.**
12. **The UI can be theatrical; the protocol must stay sober.**

> **外面是议会，里面是科研。**

## License

MIT
