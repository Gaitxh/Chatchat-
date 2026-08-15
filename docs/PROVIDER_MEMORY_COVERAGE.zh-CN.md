# Provider 上下文记忆收据

ChatChat 的 Provider Memory Coverage（上下文记忆收据）只回答一个非常具体的问题：

> 对于这一轮 Provider，哪些**公共 Blackboard 事件**真的进入了有上限的 consultation Prompt？为什么某些旧事件会被重新带回来？哪些普通历史因为预算被省略？同一轮的平等 AI 是否真的拿到了同一份公共 memory deck？

它是一套**公共 Prompt provenance**。它不展示、也不推断模型隐藏的思维、注意力权重、embedding、内部记忆或 chain-of-thought。

## 公共上下文有硬上限

Provider consultation Prompt 的公共事件预算是硬限制：

```text
DEFAULT_PROVIDER_CONTEXT_EVENTS = 12
```

确定性 selector 的顺序是：

1. 先保护最新已经公开的一轮；
2. 用剩余容量恢复与**仍未解决的结构化会议问题**有关的旧事件组；
3. 再用剩余容量放普通近期公共事件；
4. 12 个槽用满后，更旧的普通历史会被省略。

这个 hard cap 是真的。ChatChat 不能把它宣传成“无限记忆”，也不能声称所有历史争议一定都塞得进去。

## 争议感知 pinning

一个旧问题只有在**仍然结构化未决**时，才有资格被恢复。它使用与 Open Issues 相同的 canonical resolver。

可能触发 pin 的 source 包括：

- 等待被点名 AI 回答的直接追问；
- 尚未被目标观点持有人明确回应的 challenge；
- 等待结构化回应的 evidence；
- 尚未被合格 revision / final position 超越的明确 uncertainty。

为了让旧问题重新进入上下文后仍然可理解，ChatChat 还可以把它引用的目标事件一并带回来。

pin 的预算同样有硬上限：

```text
DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6
```

这是“恢复事件数”的上限，不是“保证记住 6 个问题”。一个 issue group 本身可能需要占多个事件槽。

## 被 pin 不代表更有权威

pin 只改变**记忆覆盖优先级**。

它不会赋予：

- 更高投票权；
- 更高发言优先级；
- 真理状态；
- 自动证据验证；
- 强迫其他 AI 同意的权利；
- 覆盖最新一轮的权力；
- 任何 Provider / 模型特权。

Prompt 会明确告诉参与者：pin 是 attention，不是新证据，更不是 truth verdict。

## 记住，直到结构化解决

目标生命周期是：

```text
某个旧公共问题仍未决
        ↓
公共历史增长到超过 12 个事件
        ↓
旧 issue group 被恢复进后续 Provider Prompt
        ↓
出现精确结构化 resolver
        ↓
canonical Open Issues resolver 关闭 obligation
        ↓
再后面的轮次不再为这个 source 占用 pinned slot
```

“已经解决”绝不会从相似 prose 推断。Open Issues 和 Conflict Resolution Ledger 使用的同一套精确 resolver，决定它是否还具有后续 pin 资格。

## actual Prompt 票据 vs selector audit

Provider Memory Coverage 会把两种证据强度分开。

### `actual_prompt`

对于新的浏览器会议，ChatChat 会直接从真正交给 `RUN_SPEECH` 的 Prompt 字符串中解析：

```text
PUBLIC_SNAPSHOT_EVENT_IDS_JSON
PINNED_OPEN_ISSUE_EVENT_IDS_JSON
PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON
LATEST_ROUND_EVENT_IDS_JSON
```

最外层 Prompt-memory observer 会在调用现有 transport wrapper 之前记录这些字段，随后 durable transport receipt 会用这份**实际 Prompt metadata**补全。

这是 ChatChat 能提供的最强“这一轮到底发了哪些公共记忆”的证明。

### `selector_audit`

较老的历史 archive 可能早于 actual-Prompt memory metadata。它们仍然可以从冻结的 execution audit 重建 deterministic selector 的结果。

但这种旧记录会明确标为 selector-audit fallback；ChatChat 不能在会后把它升级成“当时真实 Prompt 已被观察”的证据。

## 两种不同的一致性

Memory Coverage 把两个故障域分开。

### Provider ↔ Provider 公共记忆公平性

同一个 immutable public round 中，平等参与者应该拿到同一份公共 memory deck。

如果同一轮两个 Provider 的**实际 Prompt receipt**不同，这是 **peer-memory fairness violation**。

### selector ↔ actual Prompt 一致性

内部 deterministic selector 算出的 deck，也应该与真正发出去的 Prompt metadata 一致。

如果 Provider A 和 B 实际收到的 Prompt 完全相同，但 ChatChat 的 selector audit 却说其中一份应该不同，那么 Provider 公平性可能仍然成立，但 **selector-to-Prompt integrity 已经坏了**。

这两个事实不能压成一个模糊的绿灯。

## Hard cap 下仍然可能有 coverage gap

12-event hard cap 意味着：即使某些问题仍未决，它们仍可能没有出现在某一轮后续 Prompt 中。

例如：

- 最新一轮自己就占满 12 个槽；
- 未决 issue group 多到超过剩余 pin budget；
- 某个 issue group 需要多个事件，但剩余容量不够。

因此“conflict-aware pinning”不能被宣传成无限记忆，也不能被宣传成绝对零遗忘。

后续产品层应该把这些情况明确显示成 **memory coverage gaps**：在该轮开始时仍然结构化未决、但没有进入真实公共 Prompt deck 的 source events。

## 历史回放

Durable execution history 按 session 保存原始 transport 和 execution audit。

历史 Provider Memory Coverage 从以下冻结数据重建：

- Blackboard 公开事件；
- execution selector audit；
- 如果当时已经支持，则还有 transport 中冻结的 actual Prompt memory metadata。

历史回放产生 **0 次 Provider 调用**。

## Synthetic Chromium 证明

`?showcase=consultation&memory-proof=coverage` 使用 deterministic synthetic Provider response 制造真实的 bounded-memory 压力，但不会冒充第三方模型真实参会。

专用真实 Chromium 门禁要求证明：

- R3 之前公共历史已经超过 12 个事件；
- 实际 R3 Prompt 仍严格只有 12 个公共事件；
- 某条旧未决 source 被恢复；
- 某些普通旧历史真的因为预算被省略；
- 同轮平等参与者拿到同一份 actual public Prompt deck；
- deterministic selector 与 actual Prompt metadata 一致；
- 被 pin 的 source 后来出现精确 structural resolver；
- R4 历史仍然超过 12，但同一个已解决 source 已经不再被 pin。

这证明的是 ChatChat 的 memory-selection / provenance 机制，而不是任何第三方模型隐藏的注意力或推理过程。
