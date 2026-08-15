<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — 一个提案，多种独立思想，共同协商" />

  <p><strong>你只提交一次提案。接下来，让一桌 AI 自己把会开完。</strong><br />正式模式会把协商 Prompt 发给你已经登录的真实 AI 浏览器标签页；每个参与者先独立回答，再读取同一个公共会议快照，继续研究、质疑、举证、直接回应、修正或保留分歧。</p>

  <p><em>不是三个答案并排。是一场可以围观、追溯、回放，而且能证明“谁真的收到哪一轮、看到了哪些公开事件、最后哪条内容真的进入会议”的 AI 协商大会。</em></p>

  <p><a href="README.md">English</a> · <a href="docs/BROWSER_EXTENSION.zh-CN.md">浏览器扩展</a> · <a href="docs/CONSULTATION_PROTOCOL.zh-CN.md">协商协议</a> · <a href="docs/MEETING_SECRETARIAT.zh-CN.md">大会秘书处</a> · <a href="docs/PROVIDER_ATTENDANCE_AUDIT.zh-CN.md">Provider 出席审计</a> · <a href="docs/MEETING_INTEGRITY.zh-CN.md">会议执行完整性</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">想法与问题</a></p>
</div>

---

## 先把最重要的边界说清楚

ChatChat 现在有两种完全不同的执行模式，**它们不能混为一谈**：

| 模式 | Provider 回答来自哪里 | 适合做什么 |
|---|---|---|
| **正式模式 · LIVE PROVIDER TABS** | 真实 `BrowserConsultationAgent → RUN_SPEECH → chrome.tabs.sendMessage(tabId)`，发送到用户已经登录的 AI 标签页 | 真正处理用户提案 |
| **Synthetic showcase · DEMO** | `?showcase=consultation` 下的 deterministic fixture，固定模拟标签页、READY 状态和会议回答 | CI / 截图 / UI 与协议可重复验证 |

**真实 Chromium 不等于真实 Provider 推理。** CI showcase 的浏览器、生产 UI、React 组件、Blackboard、provenance、Live Agenda、Conflict Board、Final Position Floor 等都是真实运行的；但其中模型“说了什么”是合成测试夹具，不是 ChatGPT、Claude、Gemini、DeepSeek、Grok 或元宝在线生成的答案。

因此 `?showcase=consultation` 会永久显示醒目的 **“合成演示模式 · 这不是一场真实 AI 协商”** 警告，锁住固定 Demo 提案，并隐藏会让人误以为正在连接真实 Provider 的添加/连接操作。若 synthetic prompt 不再包含固定 Demo 提案，fixture 会直接拒绝，而不是拿固定台词回答任意用户问题。

正式模式则同时给出两层执行证据：

- **LIVE PROVIDER RECEIPTS / 真实标签页传输收据**：证明哪个真实 Provider 标签页收到本轮 Prompt、是否返回页面响应、耗时与响应大小；
- **Provider Attendance & Execution Audit / 出席与执行审计**：继续追到这个响应是否通过 structured parse / repair，以及哪些精确事件 ID 最终进入 Blackboard。

只有“页面返回了一段文字”不算完成一轮会议发言。`response captured → structured parse → Blackboard publication` 真正闭环后，该轮才会标成 verified / repaired。这个审计证明执行 provenance，不读取模型隐藏思维链。

---

## 三个独白，不叫协商

普通多模型界面往往停在这里：

```text
你 → ChatGPT
你 → Claude
你 → Gemini
```

ChatChat 的正式协商链现在是：

```text
一个用户提案
   ↓
真实已登录 Provider 标签页
   ↓
R1 · 密封独立意见
   + Live Research Desk 自动分研究任务
   ↓
共享 Blackboard
   + Live Agenda 解释“为什么还有下一轮”
   ↓
challenge · evidence · question · support · defense
   ↓
Peer Exchange Queue
   “谁点名了谁？谁下一轮必须接住？”
   ↓
replyToEventId / targetEventId / causedBy
   ↓
Conflict Board
   “到底在争哪几条结构化线程？”
   + Conflict Resolution Ledger
   “哪些直接回应义务已经销账，哪些还没？”
   ↓
Explicit Stance Fronts
   “这个具体争议里，谁明确站过哪边？谁只是参与攻防？”
   ↓
Live Persuasion
   只有明确 revision / concede 才算强影响
   ↓
Open Issues
   “哪些问题仍没有得到结构化回应？”
   ↓
Final Position Floor
   “全场最终报告席位如何分布？每个 Final 真的由 Provider 完成了吗？”
   ↓
Meeting Execution Integrity
   “最终结果的 Provider 执行覆盖到底完整不完整？”
   ↓
最终结果 · 本地回放 · 下一步协商 · 可分享收据
```

这里**没有议长 AI**，没有模型特权，也没有“多数票自动变成真理”。用户是提案人；每个 AI 都是平等参与者；ChatChat 只协调公开协议和确定性视图。

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat 协商协议与产品能力总览" /></p>

> 这张总览图描述已经进入生产代码的会议能力。它不是“某一次真实 Provider 会话截图”。CI 中的 Chromium showcase 用合成 Provider fixture 重现这些能力，以保证门禁可重复。

---

## 01 · 每个 AI 都有独立回合，但没有隐藏主持人

正式模式中，每个参与者对应一个真实浏览器 Provider 标签页。`BrowserConsultationAgent` 为当前阶段生成结构化 consultation prompt，通过浏览器 bridge 执行 `RUN_SPEECH`，读取 Provider 页面回答，再进入结构化解析；若第一次格式不合法，同一个 Provider 会收到一次修复格式的重试，而不是由 ChatChat 编一个答案顶上去。

每个正式 Prompt 还会带上 `SESSION_ID`、`ROUND`、`YOUR_ACTOR_ID` 和 `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`。所以 ChatChat 能机械证明“Claude 的 R3 Prompt 里到底包含哪些已经公开的 R1/R2 事件”，但不会进一步声称知道 Claude 内部怎样思考它们。

大会进行时可以看到很多“活人感”，但 UI 只读取公开结构化事实，不展示、更不会伪造模型的私有思维链：

<table>
<tr><td><strong>LIVE PROVIDER RECEIPTS</strong><br/>证明真实标签页是否收到本轮 Prompt、是否返回响应、耗时与响应大小。</td><td><strong>Provider Attendance Audit</strong><br/>继续追到 parse / repair / fallback / Blackboard publication；页面返回不等于会议发言已经成立。</td></tr>
<tr><td><strong>Live Research Desk</strong><br/>每个 AI 领取不同研究任务，例如主源核验、最强反例、实现约束；任务不同，权力相同。</td><td><strong>LIVE DISCUSSION STREAM</strong><br/>逐轮阅读 argument / challenge / evidence / support / defense / revision / question。</td></tr>
<tr><td><strong>Peer Exchange Queue</strong><br/>直接追问、定向质疑和定向证据不会淹没在人群里。</td><td><strong>Conflict Board + Resolution Ledger</strong><br/>把真实事件图组织成争议线程，并精确显示哪些回应义务已经被哪条事件解决。</td></tr>
<tr><td><strong>Explicit Stance Fronts</strong><br/>只认参与者自己写出的 stance/revision；CURRENT / VACATED 战线和换边 provenance 都可追溯。</td><td><strong>Live Persuasion</strong><br/>只有 canonical influence graph 已证明的 `revision.causedBy` / `concede` 才显示“谁改变了谁”。</td></tr>
<tr><td><strong>Meeting Secretariat / 大会秘书处</strong><br/>Live Agenda 解释为什么会议继续；Open Issues 列出仍未解决的结构化问题。</td><td><strong>Final Position Floor</strong><br/>复现全场最终报告席位，并给每个 Final 标 verified / repaired / fallback / unknown 来源。</td></tr>
<tr><td><strong>Meeting Execution Integrity</strong><br/>把最终结果与 Provider 执行覆盖放在一起读；不把对齐度冒充正确率。</td><td><strong>CONSULTATION THEATER</strong><br/>会后回放公开事件、改口轨迹和精确影响来源，不重新调用 Provider。</td></tr>
</table>

同一轮中的 AI 读取同一个不可变公共快照，并行工作。网站响应更快不会获得更高权力；某个模型更会说话也不会自动得到主持权。

---

## 02 · AI 之间怎样真的“接话”

直接回答不能靠 ChatChat 从 prose 里猜。

```text
Claude → ChatGPT
question event: q-123

下一公开轮：
ChatGPT → Claude
replyToEventId: q-123
```

`replyToEventId` 必须引用当前公共快照中真实存在的同行事件；编造 ID、引用自己的事件或在错误阶段伪造 reply 都会进入协议修复流程。

Peer Exchange Queue 会把直接请求建模成明确回应义务：

```text
已排队 → 目标 AI 接手 → 已回答
```

只有精确结构化 provenance 才能把义务销账。第三方替答、普通文字里写“我已经回答了”都不算。

**Conflict Resolution Ledger** 会把同一套义务继续保留下来：哪条 question / challenge / targeted evidence 仍然 OPEN，哪条已经由哪个 `replyToEventId / targetEventId / causedBy` 事件明确 RESOLVED，以及每轮结束时还有多少未决项，都来自事件图，不来自摘要模型猜测。

---

## 03 · “被说服”必须有因果票据

**Live Persuasion** 不会因为某个 AI 写了一句“你说得对”就认定说服成功。

强影响只来自 canonical influence graph 已经确认的关系：

```text
revision.causedBy: [evidence-event, challenge-event]
concede.targetEventId: peer-event
```

所以你看到：

```text
Gemini ── evidence ──▶ Claude
ChatGPT ─ challenge ─▶ Claude
                         ↓
                 Claude revision
```

并不是 UI 自己编的剧情，而是 Claude 自己的结构化 revision 明确把这些事件列为原因。

**Explicit Stance Fronts / 明示立场战线**又多加一条限制：challenge / evidence / support 本身都不能把参与者自动塞进某个阵营。只有参与者自己公开提交的 stance-bearing event 才能占据战线。Claude 如果从 `Web UI` revision 到 `Browser Extension`，旧战线会保留为 `VACATED`，新战线显示 `CURRENT`，revision event 和 `causedBy` 原因都能点回原始事件。只是参与攻防、从未明示 stance 的 AI 会被单独列出来，而不是被 ChatChat 猜成某一派。

---

## 04 · 大会自己知道“为什么还要继续”

ChatChat 的**大会秘书处**不是隐藏主持人，也不是额外 AI，只是协议之上的确定性视图。

**Live Agenda** 的继续原因由 orchestrator 发布：

```text
sealed_start                 → 开始彼此不可见的独立第一轮
initial_debate               → 独立意见进入共享快照
fresh_signal_follow_up       → 新问题 / 新证据 / 新修正需要同行再回应一次
minimum_debate_rounds        → 当前模式要求更多公开讨论
alignment_not_reached        → 描述性的立场对齐度仍低于阈值
finalizing_stable_alignment  → 已稳定且没有新鲜待回应信号
finalizing_round_budget      → 达到硬轮次边界，但保留剩余分歧
```

`fresh_signal_follow_up` 会携带真正触发下一轮的 `triggerEventIds`，可以点回原始 Evidence / Challenge / Question。

详细规则见 [`docs/MEETING_SECRETARIAT.zh-CN.md`](docs/MEETING_SECRETARIAT.zh-CN.md)。

---

## 05 · 闭会，不等于所有问题都解决了

**Open Issues** 直接从公开 Blackboard 事件图推导：

```text
?  直接追问仍未得到被点名 AI 的明确回答
⚔  定向质疑仍未被原观点持有人回应
📎 定向证据已经上桌，但目标参与者仍未回应
≈  某个 AI 明确保留不确定性，之后也没有更高置信度修正
```

普通 prose 不能销账，第三方替答也不能。

**Conflict Board** 不会用 embedding、文本相似度或另一个“总结 AI”偷偷发明议题。每条 conflict thread 都锚定真实 Blackboard 事件，只沿 `targetEventId / replyToEventId / previousEventId / causedBy` 等结构化引用生长。因此你可以同时看到：

```text
某条争议线程：仍 OPEN
  ├─ 2 次 challenge
  ├─ 1 条 evidence
  ├─ Claude 明确 revision
  └─ 仍有 1 个直接回应义务未销账
```

“发生过改口”和“所有问题已经解决”是两件不同的事。

### Final Position Floor：最后到底谁站哪边？

闭会后，ChatChat 还会把 thread-local 战线和 meeting-wide Final 分开。

**Final Position Floor / 会议最终席位图**只复现 `CouncilReport.positions` 的最终报告席位，分组规则与 orchestrator 完全一致：`trim + lowercase`，不会把“Web+Extension”和“Web + Extension”靠语义相似度偷偷合并，也不会因为某个 AI challenge 了 A 就推断它支持 B。

每个 Final seat 同时显示自己的执行来源：

```text
provider_final        → Final turn verified / repaired，Provider 真正完成了执行链
fallback_placeholder  → ChatChat 因 Provider Final 失败写入的零置信度失败占位
unverified_record     → 执行票据不足，不能证明 Final 在 Provider 侧完成
```

因此 **fallback seat 仍然保留在现有 report / outcome 的席位会计中，但绝不会冒充模型自己的最终判断。**

Final Floor 还会把两种“改变”严格分开：

```text
明确 revision 票据：
Web UI → Browser Extension
revision event: r-17
causedBy: evidence-9

随后 verified Provider Final 又变成：
Browser Extension → Web + Extension
但没有 matching revision event
→ 保留 Final，但明确标“无 revision 票据，不推断原因”
```

如果 Final 本身是 fallback，则不会被误标成“模型神秘换边”；它的原因已经知道是执行失败。

所以一场会可以诚实地结束成：

```text
领先立场：A
对齐度：75%
执行完整性：11/12 Provider turns verified
停止原因：round budget
仍然存在：1 个未回答直接问题
Final 席位：1 个 fallback placeholder
```

多数是描述信息，不是权威。

---

## 06 · 证据可以影响人，但不能自动成为真理

Evidence 进入大会后，ChatChat 分开记录：

```text
来源是否可达？
页面时间信号是什么？
有限摘录是什么？
是否仍有人质疑？
是否有 revision / concede 明确把它列为原因？
```

因此同一条证据可以同时是：**来源可达、仍有争议、而且确实促成了改口**。`reachable` 从来不等于“主张已经被证明”。

`Evidence Gap Radar` 找来源、时间、争议和证据链缺口；`NEXT MOVE` 可以把缺口写入下一轮提案，但不会自动发送。

---

## 07 · 五种会议模式，每场会都有研究分工

<table>
<tr><td><strong>◉ 平衡</strong><br/>允许分歧和改口，然后给出结果。</td><td><strong>🌿 探索</strong><br/>让候选方案活得更久。</td><td><strong>⚖ 决策</strong><br/>强调约束、取舍和行动建议。</td></tr>
<tr><td><strong>🔎 核验</strong><br/>重点追来源、日期和事实范围。</td><td><strong>🧨 压力测试</strong><br/>寻找最强反例与失败条件。</td><td><strong>研究任务 ≠ 权力</strong><br/>Research Lane 只是分工，不改变参与者地位。</td></tr>
</table>

Balanced 也会分 Research Lanes；研究不是特殊模式才有的装饰能力。

---

## 08 · 怎么确认“这次真的调用了 AI”

这是现在最重要的可观测性之一。

正式模式顶部会显示 **LIVE PROVIDER RECEIPTS**。例如：

```text
LIVE · PROVIDER TABS

Claude · claude.ai
DEBATE · R2
PROMPT SENT
3,842 prompt chars

→ RESPONSE CAPTURED
2,917 response chars
18.4 s
```

但 ChatChat 不再把 `RESPONSE CAPTURED` 当成“已经成功出席”。同一轮还会进入 **Provider Attendance & Execution Audit**：

```text
Claude · DEBATE · R2
Prompt snapshot: 14 public event ids
        ↓
Provider page returned
        ↓
structured parser passed
        ↓
2 Blackboard events published
        ↓
✓ VERIFIED
```

若首答结构化格式错误，同一个 Provider 会收到唯一一次 repair；成功后标 `VERIFIED · REPAIRED`。如果 transport / page / parser 失败，ChatChat 会把这一轮标 `FALLBACK` 或 `FAILED`，而不是用漂亮动画掩盖。

这些原始 transport + parse / repair / fallback 票据在闭会时会与会议 archive、Evidence sidecar 一起冻结到本地 IndexedDB。打开历史会议时，ChatChat 用**冻结 execution receipt + 冻结 Blackboard events**重新推导出席审计，执行 **0 次 Provider 调用**。

最终结果旁边还有独立的 **Meeting Execution Integrity / 会议执行完整性**。请把三个概念彻底分开：

```text
83% 立场对齐度
→ 最终有多少席位落在同一个 stance group。

12/12 执行完整性
→ 有多少可审计 Provider turn 真正完成 页面响应 → parse → Blackboard publication。

答案正确率
→ ChatChat 不会编一个百分比。
   12/12 完整、100% 一致，也完全可能所有 AI 一起判断错。
```

如果标签页传输失败，会显示 **TRANSPORT FAILED**。如果顶部写的是：

```text
DEMO · SYNTHETIC
这里没有调用真实 AI
```

那就只是合成浏览器 Demo，不应该拿它判断某个模型是否真的研究了用户问题。

详细执行规则见 [`docs/PROVIDER_ATTENDANCE_AUDIT.zh-CN.md`](docs/PROVIDER_ATTENDANCE_AUDIT.zh-CN.md) 和 [`docs/MEETING_INTEGRITY.zh-CN.md`](docs/MEETING_INTEGRITY.zh-CN.md)。

---

## 09 · 把整场会带走，而不是只复制最后一句

会议结束后可以生成本地 **Consultation Receipt / 协商收据**，并通过 **Consultation Theater / 协商剧场** 回放保存的结构化事件。

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat 本地协商收据" /></p>

收据不再只分享“83% 对齐”。页面卡片、复制 Markdown、导出 SVG 都会同时携带 **Meeting Execution Integrity**：verified turns、完整席位、repair、fallback、failed / unresolved。这样一场执行覆盖不完整的会议在二次传播时不会被“洗成”完整共识。

历史收据使用闭会时冻结的 execution sidecar 重新推导，不会拿今天的页面状态补写昨天的会议，更不会重新调用 Provider。

Replay 同样不重新调用 Provider。复制 Markdown 和导出 SVG 都在浏览器本地完成。

---

## 默认零配置

Full Room 是主产品入口。普通用户第一次使用，应该只感觉到：

```text
1 · 点 ChatChat
2 · 浏览器需要站点权限时确认一次
3 · 哪个 AI 没登录，就正常登录；ChatChat 自动续接
4 · 写下一个提案
5 · 确认顶部是 LIVE · PROVIDER TABS
6 · 开会
```

如果浏览器里已有至少两个已知 AI 来源，ChatChat 优先使用它们；数量不足时才准备起步团队，并为 ChatChat 打开专用干净会话，不劫持用户原来的私人 AI 对话。

Provider 账号留在各自浏览器标签页中；ChatChat 没有中转服务器。历史、Evidence 快照与执行票据都保存在本地。

---

## 浏览器 UI / 协议门禁到底证明什么

CI 中的 `?showcase=consultation` 使用**真实 Chromium + 生产构建 + 合成 Provider fixture**。它现在验证的不只是 DOM marker，而是一整条可重复产品证据链：

```text
sealed Round 1
+ Live Research Desk / Research Lane
+ challenge / evidence / revision
+ direct reply with replyToEventId
+ Peer Exchange Queue 生命周期
+ Live Agenda fresh_signal_follow_up + trigger event
+ Open Issues + source event
+ Conflict Board + open / resolved obligations
+ Conflict Resolution Ledger + round trajectory
+ Explicit Stance Fronts: CURRENT + VACATED + movement + uncommitted
+ Live Persuasion strong moment + exact cause/change event ids
+ Final Position Floor: leading + minority groups + Final execution provenance
+ explicit revision receipts 与无 revision 的 verified Final shift 分开
+ Meeting Execution Integrity
+ durable execution history replay
+ Relationship Map reply edge
+ 合成演示警告
+ 锁定的 Demo 提案
+ synthetic provider receipt
```

### 截图证据也不再只检查“PNG 文件存在”

一次人工 artifact 审计曾发现：旧 workflow 可以出现**DOM 完整，但 Full Room / live-frame PNG 只是纯背景色**的假绿。现在这条漏洞已经被永久封死：

1. Chromium 通过 **Chrome DevTools Protocol** 打开一个页面；
2. 等精确 product ready marker；
3. 等两帧真实 paint；
4. 从**同一个页面 / 同一个 session**同时保存 PNG + `document.documentElement.outerHTML`；
5. `scripts/check-png-content.mjs` 自己解码 PNG，检查 sampled colors、channel range、luma variance；纯背景图直接失败；
6. `scripts/validate-product-evidence.mjs` 再验证 DOM 语义；
7. Final Position Floor 还有专门的中英文 close-up 和 `scripts/validate-final-position-evidence.mjs`，要求同一张真实浏览器证据里同时看见“明确 revision 票据”和“无 revision 的 Final 变化”。

因此**真实 Chromium 截图**现在意味着：真实生产 UI 已经到达被证明的状态，而且最终 PNG 也确实包含可见产品像素。它依然**不意味着 synthetic fixture 变成了第三方 Provider 推理**。

除此之外还有 **Zero-config UI、Login Concierge UI、Real Provider Proof UI** 等工作流。它们是产品行为门禁；不要只凭工作流名字把 synthetic / harness 证据误读成第三方线上模型推理。

README 和 Demo 继续受 `scripts/check-readme-product-truth.mjs`、`scripts/check-execution-boundary.mjs`、Conflict / Final Floor product guards 与 deterministic tests 约束。

---

## 快速开始

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm ci
npm run build:extension
```

打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，加载 `dist-extension/`。

```bash
npm run check
npm test
npm run demo
npm run dev:web
```

正式使用时不要带 `?showcase=consultation`。如果看到 `DEMO · SYNTHETIC`，点击“退出 Demo，进入真实模式”。

更多细节见 [浏览器扩展指南](docs/BROWSER_EXTENSION.zh-CN.md)、[协商协议](docs/CONSULTATION_PROTOCOL.zh-CN.md)、[大会秘书处](docs/MEETING_SECRETARIAT.zh-CN.md)、[Provider 出席审计](docs/PROVIDER_ATTENDANCE_AUDIT.zh-CN.md) 与 [会议执行完整性](docs/MEETING_INTEGRITY.zh-CN.md)。

---

## 人类主导，AI 协作

ChatChat 由 **Gaitxh** 发起并独立维护；项目开发过程中使用了 **OpenAI 的 ChatGPT 与 Codex** 协助产品构思、界面与视觉设计、代码实现、调试、测试和文档打磨。

<div align="center"><strong>一个提案，多种独立思想，共同协商。</strong><br /><sub>对齐度不是正确率；执行完整性不是正确率；浏览器是真的，也不代表 synthetic fixture 的回答来自真实第三方模型。</sub></div>
