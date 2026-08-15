# 会议公共记忆协议完整性

ChatChat 现在已经有足够的执行 provenance，可以把另一个问题从普通 Provider 出席中独立出来：

> 即使每个 Provider 页面都正常返回了结构化发言，平等参与者这一轮是否真的收到同一份**有上限的公共会议记忆**？deterministic selector 与实际 Prompt 是否一致？12-event hard cap 是否让仍未决的 obligation 没能进入某些 Prompt？

这就是 **Memory Protocol Integrity / 公共记忆协议完整性**。

它不是立场对齐度、不是模型 confidence、不是答案正确率、不是证据真值，也不是隐藏推理质量评分。

## 四类事实必须分开

同一场会议完全可能同时是：

```text
立场对齐度：               83%
执行完整性：               12/12 Provider 轮次已验证
公共记忆协议完整性：       bounded coverage
答案正确率：               unknown / ChatChat 不打分
```

这四件事之间没有一个合理公式可以压成“综合可信度 91 分”。

## 协议状态

Memory Protocol Integrity 有四种确定性状态。

### `verified`

- 同一 immutable public round 中，各 Provider 的 actual Prompt memory deck 一致；
- 有 actual Prompt 票据时，deterministic selector audit 与真正发出的 Prompt metadata 一致；
- 在已审计的 bounded memory turn 中，没有已知 canonical-open source 因硬预算而缺席。

这仍然不代表答案正确。

### `bounded_coverage`

协议本身一致，平等参与者也仍然收到同一份 deck，但由于公共上下文 hard cap 是有限的，至少有一个 canonical-open source 没能进入某一轮 Provider Prompt。

这是**已知覆盖限制**，不是公平性违例，也不表示被省略的问题“语义上更重要”。

### `selector_drift`

各 Provider 实际收到的 Prompt 仍然一致，但 ChatChat 内部 deterministic selector 的 audit 结果与真正发出的 Prompt 不一致。

这是实现完整性问题。如果 actual peer Prompt decks 仍然相同，它不应该被冒充成 Provider 不公平。

### `peer_fairness_violation`

同一个 immutable public round 中，两个平等参与者实际收到不同的公共 memory deck；或者 actual deck 的差异导致它们面对不同的已知 unresolved coverage-gap 集合。

这是最强的公共记忆协议违例，优先级高于 selector drift 或普通 bounded coverage。

## 证据强度是另一条轴

协议状态和证据强度不能混在一起。

Memory evidence strength 分为：

- `actual_prompt`：所有已审计轮次都有从真正 `RUN_SPEECH` Prompt 字符串解析出的 memory metadata；
- `mixed`：部分轮次是 actual Prompt proof，部分轮次只能退回 selector audit；
- `selector_audit`：旧历史早于 actual Prompt metadata，只能从冻结 deterministic selector 记录重建；
- `none`：没有可审计 memory turn。

因此一条旧 archive 可以是：

```text
protocol state: verified
proof strength: selector_audit
```

它的含义只是“冻结 selector 记录里没有观察到违例”，**不代表 ChatChat 当时真的观察过每一份旧 Prompt 字符串**。

## Memory Coverage Gap

只有同时满足下面条件，才会形成一条 Memory Coverage Gap：

1. source event 在该 Provider turn 之前已经存在；
2. turn 开始时，这条 source 仍然是 canonical-open；
3. 这条 source event 没有出现在这一轮有上限的公共 memory snapshot 中。

Gap derivation 不判断“它是不是重要”。它不使用 embedding、semantic similarity、confidence 排名、Provider 身份、多数 stance 或额外 AI 总结。

每条 gap 保留精确 provenance：

- turn / actor / phase / round；
- Open Issue source event ID；
- issue kind；
- source actor，以及存在时的 target actor；
- opened round；
- 有上限的 source excerpt；
- 证据强度（`actual_prompt` 或 `selector_audit`）。

## Gap 公平性

如果同一轮所有平等参与者实际收到同一份 memory deck，它们面对的已知 unresolved coverage-gap 集合也应该一致。

如果 gap set 不同，ChatChat 不会把它自动“归一化”。这意味着 actual memory deck 或 provenance 存在差异，应进入 peer-fairness violation。

## 与 Meeting Execution Integrity 的关系

Meeting Execution Integrity 回答：

> 这一轮有没有完成 页面响应 → structured parse → Blackboard publication？

Memory Protocol Integrity 回答：

> 这一轮到底收到了哪些有上限的公共会议记忆？这些记忆在平等参与者之间是否一致？selector 与实际 Prompt 是否一致？canonical-open source 是否因为 hard cap 没有覆盖？

所以一个 Provider turn 完全可能是 execution-verified，但 memory protocol 已降级。最终产品必须同时披露这两个事实，不能让一条绿色 execution chain 把 memory fairness / bounded coverage 问题盖住。

## 与 Conflict Resolution 的关系

Conflict Resolution Ledger 与 Open Issues 共享同一个 canonical structural resolver。

Provider memory pinning 和 coverage-gap derivation 也消费这同一套 open/closed 状态，因此形成一致生命周期：

```text
open issue
→ 有资格成为旧 memory pin
→ 精确 resolver
→ 不再 open
→ 后续不再有 pin 资格
```

Memory 层不允许通过相似 prose 偷偷把 issue 销账。

## 历史回放

历史 Memory Protocol Integrity 只使用冻结的公共 Blackboard events 与冻结 execution / transport sidecar 重建。

整个过程产生 **0 次 Provider 调用**，并保留原 session 当时的 evidence-strength 边界。
