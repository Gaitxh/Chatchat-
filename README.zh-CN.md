<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — 一个提案，多种独立思想，共同协商" />

  <p><strong>打开你本来就在用的 AI。ChatChat 把它们的干净会话拉进同一场本地会议。</strong><br />你只提问一次。看不同 AI 先独立判断，再公开质疑、提交证据、改变立场，并保留各自最终意见。</p>

  <p><em>一场礼貌、热闹、带证据、还能回放的思想碰撞。</em></p>

  <p><a href="README.md">English</a> · <a href="docs/BROWSER_EXTENSION.zh-CN.md">浏览器扩展</a> · <a href="docs/CONSULTATION_PROTOCOL.zh-CN.md">协商协议</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">想法与问题</a></p>
</div>

---

## 第一次开会：只做四件事

你**不需要**配置 selector、adapter、API、模型 Key，也不需要注册 ChatChat 账号。

| 你要做的 | ChatChat 自动完成的 |
| --- | --- |
| **1 · 打开你平时使用的 AI 网站**，正常登录。 | 持续扫描浏览器中已知的 AI 网站。 |
| **2 · 点击 ChatChat 扩展图标。** | 打开完整的 **Web Room**。窄 Side Panel 只保留为本地扩展入口和兼容界面。 |
| **3 · 点击「自动召集我的 AI 团队」。** | 一次请求你选中的站点权限；为每个 AI 新开一个**干净会话**；自动识别消息输入区域；执行连通握手；验证结构化协商协议。你原来的聊天不会被拿来做初始化。 |
| **4 · 看到至少 2/2 READY 后，写一个提案。** | 自动执行密封第一轮、开放协商、结构化事件记录、最终立场和回放。 |

如果某个 Provider 停在登录页面，你只需要完成它自己的正常登录。页面加载后，Web Room 会找到对应参与者并**自动继续验证**。**手动 Teach 只属于 Advanced Repair，不是正常上手流程。**

```text
打开 / 登录你常用的 AI
          ↓
      点击 ChatChat
          ↓
      完整 WEB ROOM
          ↓
   自动召集我的 AI 团队
          ↓
  为每个 AI 创建干净会话
          ↓
识别页面 → 连通握手 → 协议检查
          ↓
     ✓ READY   ✓ READY
          ↓
        写下提案
```

## 为什么是 Web Room + 浏览器扩展？

ChatChat 刻意同时使用两者：

```text
┌────────────────────────────────────────────────────┐
│                    全页 WEB ROOM                   │
│ 提案 · AI 队伍 · 会议直播 · 证据                  │
│ 关系图 · 最终结果 · 协商剧场                       │
└─────────────────────────┬──────────────────────────┘
                          │ 本地 Extension APIs
                    ┌─────▼─────┐
                    │ MV3 Bridge │
                    └──┬──┬──┬──┘
                       │  │  │
                 ┌─────┘  │  └─────┐
                 ▼        ▼        ▼
             ChatGPT    Claude    Gemini   ...
              浏览器     浏览器     浏览器
              标签页     标签页     标签页
```

**Web Room** 给会议足够大的视觉空间，让多 AI 的互动真的“活起来”；**Manifest V3 扩展**负责本地连接你已经登录的 Provider 标签页。ChatChat 不需要一个中转服务器来保管这些 AI 账号会话。

## 三个独白，不叫协商

普通的多模型工具通常停在并排回答：

```text
你 ── 问 ChatGPT
你 ── 问 Claude
你 ── 问 Gemini
```

ChatChat 把它们带进一间真正的 AI 协商会议室：

```text
一个提案
   ↓
密封独立意见
   ↓
共享 Blackboard
   ↓
质疑 · 证据 · 支持 · 答辩
   ↓
明确修正 / 让步
   ↓
最终立场 · 少数意见 · 可追溯回放
```

这里**没有议长 AI**，不强迫所有模型最后说同一句话。每个参与者保留自己的身份和最终立场。

## 把 AI 协商变成一场可以看的“智力直播”

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat 三幕式协商演示" /></p>

协商过程应该展示，而且这正是 ChatChat 最有意思的部分。但展示的是**协议真实产生的公开结构化事件**，不是模型隐藏的思维链，也不会为了好看编剧情。

| 直播层 | 它真实表示什么 |
| --- | --- |
| **Room Pulse / 会议脉搏** | 当前已提交立场、阶段、公开事件和对齐度。对齐不等于正确。 |
| **Live Moments / 关键时刻** | 由事件触发的 **CLASH 正面交锋、EVIDENCE DROP 证据空投、PLOT TWIST 剧情反转、CONCESSION 公开让步、LONE VOICE 孤独反对者** 等。没有事件就不会凭空出现戏剧性。 |
| **Room Heat / 会议热度** | 只表示互动强度，绝不冒充答案质量。 |
| **Relationship Map / AI 关系战场** | 只有明确的 `targetEventId`、`targetActorId`、`revision.causedBy` 等结构化引用才能形成 AI→AI 连线；普通文字提及不算。 |
| **Evidence Ledger / 证据账本** | 记录主张、来源、谁提交、谁质疑、是否影响修正，并可做受限的公开来源可达性检查。**能访问 ≠ 主张是真的。** |
| **Blackboard** | 所有视觉效果背后的可检查结构化事件流。 |
| **Consultation Theater / 协商剧场** | 会后回放：谁质疑了谁、哪条证据产生影响、哪个明确事件导致 AI 改口。 |

核心原则很简单：**让真实发生的协商足够戏剧化，但永远不制造假的戏剧性。**

## AI 改口，必须有“票据”

仅仅说一句“你说得对”不算可追溯影响。强影响必须来自明确的协议关系，例如：

```text
Gemini 证据 #18
        ↓
Claude 修正 #23
causedBy: [#18]
        ↓
AI 关系图产生连线
        ↓
直播事件：证据让 AI 改口
        ↓
协商剧场回放
```

找不到的事件引用不会被系统猜出来；多数支持也不会把一条证据自动升级成“真相”。

## 快速安装

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm install
npm run build:extension
```

打开 `chrome://extensions` 或 `edge://extensions`，启用**开发者模式**，选择**加载已解压的扩展程序**，加载 `dist-extension/`。随后打开你平时使用的 AI 网站、正常登录，再点击 ChatChat 扩展图标即可。

开发者验证：

```bash
npm run check
npm test
npm run dev:web
```

## 信任边界

- 第一轮默认密封、独立。
- 多数支持是信息，不是权威。
- Provider 登录会话仍留在 Provider / 浏览器自己的上下文里。
- ChatChat 在运行时请求你实际选择的 Provider 站点权限，不在安装时获得全站访问。
- 自动上手使用新建干净会话，避免在你的旧聊天里发送初始化握手。
- 公共来源检查不携带登录凭证，并有时间/大小边界；它报告“可访问性”，不宣称“主张为真”。
- 可以可视化公开结构化事件；不要求、也不伪造隐藏思维链。
- 本地回放读取保存的结构化事件，不重新召开会议。

## 现在真正已经有什么

**`main` 已经具备：** 完整 Web Room、窄 Side Panel 兼容入口、中英零配置召集、自动页面识别和协议验证、登录后自动续跑、密封第一轮、Room Pulse、事件驱动 Live Moments、Room Heat、明确引用驱动的 Relationship Map、Evidence Ledger + 受限来源可达性检查、最终报告、少数意见与 Consultation Theater。

**仍在真实验证 / 扩展：** [真实双 Provider 浏览器验收](https://github.com/Gaitxh/Chatchat-/issues/12)、[持久化协商记录](https://github.com/Gaitxh/Chatchat-/issues/57)、[Community Recipes](https://github.com/Gaitxh/Chatchat-/issues/37)，以及更深入的[证据验证](https://github.com/Gaitxh/Chatchat-/issues/53)。

CI 的 deterministic showcase 使用合成的浏览器 / Provider 状态驱动**真实构建出来的 UI**，所以不会暴露私人账号。它是产品回归证据，不代表 CI 真的登录并调用了外部 Provider。真实登录 Provider 的验收单独记录在 Gate B。

## 人类主导，AI 协作

ChatChat 由 **Gaitxh** 发起并独立维护；项目开发过程中使用了 **OpenAI 的 ChatGPT 与 Codex** 协助产品构思、界面与视觉设计、代码实现、调试、测试和文档打磨。所有方向与最终变更仍由人类审阅和决定。

本项目是独立开源项目，**不代表 OpenAI 官方，也未获得 OpenAI 的赞助、背书或运营支持**。

---

<div align="center"><strong>一个提案，多种独立思想，共同协商。</strong><br /><sub>One proposal. Independent minds. Shared reasoning.</sub></div>
