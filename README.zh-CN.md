<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — 一个提案，多种独立思想，共同协商" />

  <p><strong>你只提交一次提案。接下来，让一桌 AI 自己把会开完。</strong><br />ChatChat 自动召集平等参与者：先独立思考，再分工研究、公开质疑、拿出证据、直接追问、明确回应、修正立场，并把仍未解决的问题原样留给你。</p>

  <p><em>不是三个答案并排。是一场可以围观、追溯、回放的 AI 协商大会。</em></p>

  <p><a href="README.md">English</a> · <a href="docs/BROWSER_EXTENSION.zh-CN.md">浏览器扩展</a> · <a href="docs/CONSULTATION_PROTOCOL.zh-CN.md">协商协议</a> · <a href="docs/MEETING_SECRETARIAT.zh-CN.md">大会秘书处</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">想法与问题</a></p>
</div>

---

## 三个独白，不叫协商

普通多模型界面往往停在这里：

```text
你 → ChatGPT
你 → Claude
你 → Gemini
```

ChatChat 现在真实运行的是另一条链：

```text
一个提案
   ↓
自动召集平等 AI + 干净会话
   ↓
R1 · 密封独立意见
   + Live Research Desk 自动分研究任务
   ↓
共享 Blackboard
   + Live Agenda 告诉你“为什么还有下一轮”
   ↓
challenge · evidence · question · support · defense
   ↓
Peer Exchange Queue
   “谁点名了谁？谁下一轮必须接住？”
   ↓
replyToEventId / targetEventId / causedBy
   精确证明“谁在回答谁、什么促成了改口”
   ↓
revision · concede · surviving minority
   ↓
Open Issues
   “哪些问题到现在仍没有得到明确回应？”
   ↓
最终结果 · 本地回放 · 下一步协商 · 可分享收据
```

这里**没有议长 AI**、没有模型特权、没有多数票自动变成真理。用户是提案人；每个 AI 都是平等参与者；ChatChat 只协调公开协议和确定性视图。

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat 真实协商大会总览" /></p>

> README 里的这张图不是未来概念图。它只画已经进入生产代码、并被真实 Chromium 产品门禁验证过的会议能力。

---

## 01 · 每个 AI 都像一个正在办案的人

大会进行时，你可以同时看到不同层面的“活人感”，但这些 UI 都只读取公开结构化事实，不展示或伪造模型的私有思维链。

<table>
<tr><td><strong>LIVE PARTICIPANTS</strong><br/>谁在独立分析、研究、公开回应、完成或失败。</td><td><strong>Live Research Desk</strong><br/>每个 AI 自动领取不同研究任务，例如主源核验、最强反例、现实约束；任务不同，权力相同。</td></tr>
<tr><td><strong>LIVE DISCUSSION STREAM</strong><br/>逐轮阅读 argument / challenge / evidence / support / defense / revision / question。</td><td><strong>Peer Exchange Queue</strong><br/>直接追问、定向质疑和定向证据不会淹没在人群里；被点名的 AI 下一公开轮必须优先接住。</td></tr>
<tr><td><strong>RELATIONSHIP MAP</strong><br/>支持、质疑、证据、直接回复、明确改口会长成可点击的关系边。</td><td><strong>Meeting Secretariat</strong><br/>Live Agenda 解释为什么会议继续；Open Issues 列出仍未得到结构化回应的问题。</td></tr>
</table>

同一轮中的 AI 读取同一个不可变公共快照，并行工作。网站响应更快不会获得更高权力；某个模型更会说话也不会自动获得主持权。

---

## 02 · 一段真实的会议链

当前 Chromium showcase 会真实走过类似这样的过程：

```text
R1 · SEALED

ChatGPT  → Browser Extension
Claude   → Web + Extension
Gemini   → Browser Extension

Research lanes
ChatGPT  → 核验主源 / 核心前提
Claude   → 寻找最强反例
Gemini   → 检查实现与现实约束

        ↓

R2 · OPEN CONSULTATION

⚔ ChatGPT → Claude
  “同时维护两个产品核心，有什么证据值得这个成本？”

? Claude → ChatGPT
  “如果扩展隐藏成基础设施，ChatGPT 需要重新登录时，
   Web Room 应该怎样恢复这场会？”

📎 Gemini → Blackboard
  developer.chrome.com

        ↓

Live Agenda
FRESH SIGNAL FOLLOW-UP
“上一公开批次出现了同行不可能在同批次提前看到的新问题 / 证据，
所以必须再给一次回应机会。”

        ↓

R3

↪ ChatGPT → Claude
  “Web Room 只暴露恢复时刻：打开 Provider 登录，
   检测 READY，然后自动续接原协商。”

replyToEventId: Claude 的 question event

🔎 ChatGPT 继续质疑 Gemini 证据的适用范围
↻ Claude 根据明确事件修改立场
🤝 其他 AI 可以支持，也可以继续反对
```

这里的“直接回答”不是 ChatChat 从普通文本里猜出来的。`replyToEventId` 必须引用当前公共快照中真正存在的同行事件；编造 ID、引用自己的事件、在不允许的阶段伪造 reply 都会进入现有协议修复流程。

所以 `Claude → ChatGPT → 回答` 可以同时出现在：

- Live Discussion Stream 的回答卡；
- Peer Exchange Queue 的 `已排队 → 目标 AI 接手 → 已回答` 生命周期；
- Relationship Map 的 `reply` 箭头；
- 原始事件详情里的精确 provenance。

这才叫“互相说服”，而不是三个模型各写各的。

---

## 03 · 大会自己知道“为什么还要继续”

ChatChat 的**大会秘书处**不是一个隐藏主持人，也不是第四个 AI。它只是协商协议之上的确定性视图。

**Live Agenda** 的继续原因由 orchestrator 直接发布，例如：

```text
sealed_start                 → 开始彼此不可见的独立第一轮
initial_debate               → 独立意见进入共享快照
fresh_signal_follow_up       → 新问题 / 新证据 / 新修正需要同行再回应一次
minimum_debate_rounds        → 当前模式要求更多公开讨论
alignment_not_reached        → 描述性的立场对齐度仍低于阈值
finalizing_stable_alignment  → 已稳定且没有新鲜待回应信号
finalizing_round_budget      → 达到硬轮次边界，停止但不抹掉剩余分歧
```

当原因是 `fresh_signal_follow_up` 时，Agenda 会带上真正触发下一轮的 `triggerEventIds`，用户可以点回原始 Evidence / Challenge / Question，而不是看一段会后编出来的解释。

详细规则见 [大会秘书处协议](docs/MEETING_SECRETARIAT.zh-CN.md)。

---

## 04 · 闭会，不等于所有问题都解决了

**Open Issues** 直接从公开 Blackboard 事件图推导。ChatChat 不会再问一个模型：“你觉得这个问题是不是差不多解决了？”

下面这些都可以保持开放：

```text
?  直接追问仍未得到被点名 AI 的明确回答
⚔  定向质疑仍未被原观点持有人答辩 / 让步 / 修正
📎 定向证据已经上桌，但目标参与者还没有公开回应
≈  某个 AI 明确标记了不确定性，之后仍没有更高置信度的修正
```

普通 prose 里写“我已经回答 Claude”**不能销账**；第三方替答也不能。只有共享的 structured-response 规则认可的精确事件关系才算真正接住。

因此，一场会完全可能以这样的状态结束：

```text
领先立场：Browser Extension first
对齐度：80%

仍然存在：
- 1 个未回应的直接问题
- 1 条仍被质疑的关键主张
- 1 个明确不确定项

会议结束原因：达到 round budget
```

ChatChat 会把这些缺口原样留下，而不是用一个漂亮的“共识”数字把它们盖掉。

---

## 05 · 证据可以改变人，但不能自动成为权威

一条来源进入大会后，ChatChat 会把不同事实拆开：

```text
来源是否可达？
页面时间信号是什么？
有限摘录是什么？
是否仍有人公开质疑它？
是否有 revision / concede 明确把它列为原因？
```

所以同一条 Evidence 可以同时是：**来源可达、仍然有争议、而且确实促成了改口**。`reachable` 从来不等于“主张已经被证明”。

`Evidence Gap Radar` 继续负责找来源、时间、争议和证据链缺口；`NEXT MOVE` 可以把这些缺口变成下一轮提案，但只会填入提案框、预选建议模式，**不会自动发送**。

---

## 06 · 五种会议模式，但每场会都有研究分工

<table>
<tr><td><strong>◉ 平衡</strong><br/>实用默认：允许分歧和改口，然后给出结果。</td><td><strong>🌿 探索</strong><br/>让更多候选方案活得久一点。</td><td><strong>⚖ 决策</strong><br/>强调约束、取舍和可执行建议。</td></tr>
<tr><td><strong>🔎 核验</strong><br/>重点追事实、来源范围、日期和不确定性。</td><td><strong>🧨 压力测试</strong><br/>寻找最强反例和失败条件。</td><td><strong>研究任务 ≠ 权力</strong><br/>不同 Research Lane 只是分工，不改变任何 AI 的地位。</td></tr>
</table>

Balanced 也会自动分 Research Lanes；研究不是特殊模式才有的装饰能力。

---

## 07 · 把整场会带走，而不是只复制最后一句

会议结束后，ChatChat 可以生成本地 **Consultation Receipt / 协商收据**，并从本地保存的结构化事件做 **Consultation Theater / 协商剧场** 回放。

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat 本地协商收据" /></p>

你可以看到：

- 最终立场与仍然存活的少数意见；
- challenge / evidence / revision 数量；
- 明确的 evidence → revision / concede 影响链；
- 谁回答了谁，以及精确引用了哪条公共事件；
- 来源观察与证据状态；
- 会后本地回放，不重新调用任何 Provider。

复制 Markdown 和导出 SVG 都在浏览器本地完成，ChatChat 不会自动上传内容。

---

## 默认零配置：用户不应该“配置一场 AI 会议”

Full Room 是主产品入口。普通用户第一次使用，应该只感觉到：

```text
1 · 点 ChatChat
2 · 浏览器需要站点权限时确认一次
3 · 哪个 AI 没登录，就正常登录；ChatChat 自动续接
4 · 写下一个提案
5 · 开会
```

如果浏览器里已有至少两个已知 AI 来源，ChatChat 会优先使用它们；数量不足时才准备小型起步团队，并为 ChatChat 打开**专用干净会话**，不会劫持用户原来的私人 AI 对话。

底层页面识别 → 连通握手 → consultation readiness → 登录恢复都由 ChatChat 自己处理。工具栏直接打开或聚焦 Full Room；Side Panel 是可选紧凑控制器。Selector、手工 URL 和 Teach 工具只留在 **高级修复**。

Provider 账号仍留在各自浏览器标签页中；ChatChat 没有中转服务器。历史与证据快照保存在本地；Replay 不会自动重新调用 AI，也不会拿今天的网页改写昨天的会议。

---

## 真实产品门禁

当前生产 CI 不只检查 TypeScript。双语真实 Chromium showcase 还必须在运行中的产品 DOM 里观察到：

```text
sealed Round 1
+ Live Research Desk / Research Lane
+ challenge
+ evidence
+ revision
+ direct reply with replyToEventId
+ Peer Exchange Queue 的完整回答轨迹
+ Live Agenda fresh_signal_follow_up + trigger event
+ Open Issues + source event
+ Relationship Map reply edge
```

除此之外还有独立的 **Zero-config UI、Login Concierge UI、Real Provider Proof UI** 门禁。

README 自己也受 `scripts/check-readme-product-truth.mjs` 约束：上面这些核心能力如果没有对应生产实现和 Chromium proof，产品检查就不能通过。

---

## 快速开始

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm ci
npm run build:extension
```

随后打开 `chrome://extensions` 或 `edge://extensions`，启用**开发者模式**，选择**加载已解压的扩展程序**，并加载 `dist-extension/`。

```bash
npm run check
npm test
npm run dev:web
```

更多细节见 [浏览器扩展指南](docs/BROWSER_EXTENSION.zh-CN.md)、[协商协议](docs/CONSULTATION_PROTOCOL.zh-CN.md) 与 [大会秘书处](docs/MEETING_SECRETARIAT.zh-CN.md)。

---

## 人类主导，AI 协作

ChatChat 由 **Gaitxh** 发起并独立维护；项目开发过程中使用了 **OpenAI 的 ChatGPT 与 Codex** 协助产品构思、界面与视觉设计、代码实现、调试、测试和文档打磨。

<div align="center"><strong>一个提案，多种独立思想，共同协商。</strong><br /><sub>可以热闹，可以改口，可以留下异议；不能编造关系，也不能把多数包装成权威。</sub></div>
