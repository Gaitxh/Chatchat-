# Provider Memory Coverage / Provider 公共记忆覆盖

Provider Memory Coverage 只回答一个很窄、但非常重要的问题：

> **ChatChat 在某个 Provider 回合的有界协商 Prompt 里，究竟真正放进了哪些公共 Blackboard 事件？**

它**不**声称读取模型的私有注意力、隐藏思维链、内部记忆、训练数据，也不判断答案是否正确。

## 为什么需要这层证明

ChatChat 会在本地保留完整公共 Blackboard，但 Provider Prompt 的公共上下文不是无限的。当前选择器每轮最多携带 12 条公共事件。

如果只做简单的“最近 12 条”，一个很早提出、但仍没有结构化解决的直接追问、质疑、定向证据或明确不确定项，可能会随着会议增长悄悄掉出 Provider 可见 Prompt。为避免这种遗忘，ChatChat 使用确定性的有界选择规则：

1. 先保护最新一轮已经公开的事件；
2. 如果还有容量，把即将老化、但 canonical Open Issues 仍判定为未决的旧 obligation 带回来；
3. 剩余槽位填充普通近期公共事件；
4. 最终恢复为 Blackboard 原始时间顺序。

被 pin 的事件只获得**记忆覆盖优先级**。它不会获得更高权威、真理地位、票权、发言优先级、置信度加成，也没有强迫别人同意的资格。

## 两条彼此独立的证据来源

现代 Provider Memory 审计故意保留两条不同证据线，不把它们偷偷揉成一条。

### Selector audit

`ProviderExecutionAuditEvent` 记录 ChatChat 在回合开始时由确定性 selector 计算出的选择结果：

- 精确公共 snapshot event IDs；
- 被恢复的旧 pinned event IDs；
- 真正导致 pin 的 canonical source event IDs；
- 被保护的 latest-round event IDs。

现代记录会显式携带 `contextSelectionObserved: true`，并且即使没有 pin，也保存明确的空数组。这样可以区分：

- “这是一轮现代会议，而且确实 0 pin”；
- “这是一份老 archive，当时根本还没有 memory provenance 字段”。

### Actual Prompt evidence

`prompt-memory-observer.ts` 是现有浏览器 `RUN_SPEECH` transport 上的一层只读观察器。它只解析真正发送出去的 Prompt 字符串里由 ChatChat 写入的显式协议 metadata：

- `SESSION_ID`
- `PHASE`
- `ROUND`
- `YOUR_ACTOR_ID`
- `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`
- `PINNED_OPEN_ISSUE_EVENT_IDS_JSON`
- `PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON`
- `LATEST_ROUND_EVENT_IDS_JSON`

观察器不会修改 Prompt、Provider 返回值、retry 行为、timeout 或网页交互。

能够与这条实际 Prompt 观察结果对应上的 transport receipt 会得到 `promptMemoryObserved: true`。Provider Memory Coverage 在重建“到底发送了什么”时优先采用这条 **actual Prompt** 证据，同时仍保留 selector audit，用于发现二者是否漂移。

## Provider 公平与 Selector 漂移不是一回事

这两个错误必须分开。

如果同一轮的平等参与者实际收到的是同一份公共 Prompt deck，那么 Provider-to-Provider 的公共记忆公平仍然成立，即使 ChatChat 自己记录的 selector audit 与实际 Prompt 不一致。

如果同一轮平等参与者真正收到的公共 Prompt deck 不同，才是 `peer_fairness_violation`。

这个“同一公共 deck”只约束共享 Blackboard 部分。以下 participant-specific 区块本来就可以不同：自己的 prior events、Research Lane、Direct Peer Inbox。它们的差异不等于公共记忆不公平。

## Memory Coverage Gap

当同时满足以下条件时，会形成 Memory Coverage Gap：

1. 某个 canonical Open Issue 在该 Provider 回合开始时仍然存在；
2. 它的 source event 没有进入该回合的有界公共 snapshot。

这只是一个**覆盖事实**，不是重要性评分。

Coverage Gap 不表示：

- 被省略的问题比已包含内容更重要；
- Provider 如果看到它就一定会改变答案；
- 会议结果自动变成错误；
- 另一个 Provider 获得了偏袒。

“是否存在 hard-cap gap”和“同一轮不同 Provider 的 gap 集合是否一致”会分别记录。

## Meeting Memory Integrity 状态

Memory protocol integrity 用可解释的离散状态表示，而不是制造一个综合信任分：

- `verified`：同轮公共 deck 一致，selector audit 与 actual Prompt 没有发现漂移，也没有发现 canonical-open source 因有界上下文缺席；
- `bounded_coverage`：Provider 之间交付一致，但至少一个 canonical-open source 因公共上下文有限而没有进入某些回合；
- `selector_drift`：actual Prompt 与确定性 selector audit 不一致；
- `peer_fairness_violation`：同一轮平等参与者没有收到相同公共 deck，或者同轮 coverage-gap 集合不同；
- `legacy_unverified`：这份历史产生在现代 memory provenance 之前，因此不会事后升级成现代证明。

证据强度另外单独记录：`actual_prompt`、`mixed`、`selector_audit`、`legacy_selector_audit`、`none`。

## Durable history / 本地历史

ChatChat 不为 Memory 再建一套独立数据库。现有 execution sidecar 已经冻结原始 transport 与 execution audit records；Provider Memory Coverage 只根据这些冻结记录和已经冻结的 Blackboard archive 确定性重建。

Full Room 打开历史会议时不会调用任何 Provider。历史浏览器证明只有在以下两条都完成后，才把 History 标记为 complete：

- Provider Attendance 已经根据冻结收据重建至少一个拥有非零 snapshot 与非零 Blackboard publication 的历史回合；
- Provider Memory 已经根据同一个 session 的冻结 execution receipt 重建 `archive` 视图，并保留现代回合的 actual-Prompt 证据强度。

Side Panel 本来就没有 Consultation History UI，因此只证明持久化存在，并把历史 replay 明确标成 `not-applicable`。

## 实际保存什么

Memory audit 保存的是协议 metadata，例如 event IDs、phase/round、选择分类、transport 状态，以及 execution receipt 本来就保存的执行信息。

Prompt-memory observer**不会**把原始 `RUN_SPEECH` Prompt 文本持久化到 execution sidecar。公共事件正文属于另外已经保存的 consultation Blackboard archive。

## 结果应该怎么解释

这四个维度必须分开：

- **立场对齐度**：最终 participant-authored stance 是怎么分布的；
- **执行完整性**：Provider 回合是否完成 page response → structured parse → Blackboard publication；
- **记忆协议完整性**：真正有哪些有界公共上下文进入了这些回合，以及同轮平等参与者是否公平获得同一公共 deck；
- **答案正确性**：ChatChat 不会凭空给一个百分比。

一场会议完全可能同时满足：100% 立场一致、100% 执行完整、Memory Protocol verified——但结论仍然事实错误。

## Chromium 压力证明

专用 synthetic `memory-proof=coverage` fixture 不会直接写自己的成功 marker。它只通过正常的结构化 Provider 回包制造真实协议压力：

- R1 留下一个较早的明确 uncertainty；
- R2 增加足够多的普通公开材料，使 R3 开始前的公共历史超过 12 条；
- 生产 context selector 必须把那个仍未决的旧 source 恢复进**恰好 12 条**的 R3 Prompt；
- R3 每个平等席位都必须有 actual Prompt 证据，并获得相同公共 deck；
- 部分普通旧历史必须因为 hard cap 被明确省略；
- R3 一个精确 revision 必须按照 canonical Open Issues resolver 的规则真正解决旧 uncertainty；
- R4 的历史仍然超过 hard cap，但同一个已解决 source 不得继续占用 pin。

只有生产 Provider Memory DOM 真正表现出上述事实，guard 才会写入 success marker。DOM 和 PNG 来自同一个 Chromium DevTools Protocol 页面，PNG 还必须通过仓库已有的非空白像素内容检查。

这个 fixture 明确属于 **DEMO · SYNTHETIC**。它证明的是 ChatChat 的 memory-selection / provenance 机制，而不是第三方模型真实推理。
