# 序列化公共记忆 Payload 完整性

Provider Memory Coverage 已经能证明某个 Provider turn 选中了哪些公共 event IDs。但这仍然不足以证明平等参与者真正收到的是完全相同的公共会议内容。

理论上，未来某个 compaction、mutation、wrapper 或 Prompt 构造 bug 可能让两份 Prompt 拥有相同 event IDs，却把 `CONSULTATION_EVENTS_JSON` 序列化成不同内容。因此 ChatChat 把 **deck identity / 事件牌组一致性** 与 **exact serialized payload equality / 精确序列化内容一致性** 当成两条独立可审计事实。

## Actual Prompt 观察

只读 Prompt memory observer 会直接读取真正经过 `RUN_SPEECH` 的 `CONSULTATION_EVENTS_JSON` **原始序列化文本**。JSON parse 只用于验证结构和计算公共事件数量；`eq64:` 是对协议字段冒号后那段原始 JSON 文本的 **UTF-8 bytes 计算 64-bit FNV-1a** 得到的相等性辅助值，**不会先 parse 再 stringify 做规范化**。

这个区别是故意的。两段 JSON 可以解析成相同 JavaScript 值，但在空白、escape、数字写法或其它序列化细节上不同。如果真正放进两个 Provider Prompt 的 UTF-8 文本不同，ChatChat 的 equality receipt 就应该允许把它们报告为不同，而不是先规范化后把差异吞掉。

`eq64` **故意不是密码学原语**。从 32-bit 提升到 64-bit 会降低这种工程收据发生偶然碰撞的概率，但它仍然不是签名、MAC、真实性保证、防篡改凭证、证据质量分，也不是答案正确率。它只用于同一场有界协商内部的“相等/不相等”机械对账，让 transport receipt 无需重复保存整份公共 payload。一个完整的现代 payload receipt 还必须同时携带精确 public-event count；只有 fingerprint、没有 count 的记录仍属于不完整证据。

早于这些字段产生的旧收据会保持 `payload_unverified`。ChatChat 不会根据今天 archive 里的 Blackboard 重新算一个 fingerprint，然后冒充“当时发送时已经观察到”的证据。

## 缺失证据仍然留在分母

Payload Integrity 的分母来自**真实发生过的正式 Provider transport turn**，而不是只统计 Prompt-memory observer 成功的轮次。

如果 ChatGPT 与 Claude 都有完整 payload receipt，但 Gemini 明明发生了 R3 transport，却没有 Prompt-memory receipt，那么这一轮绝不能显示成“2/2 verified”。正确状态是：3 个真实席位里只有 2 个拥有完整 payload 证据，另一席保持 unverified；同轮 equality 仍然未知，aggregate state 必须是 `payload_unverified`。

这条规则同时覆盖现代观察失败与旧 archive。缺少 observer flag、fingerprint 或 exact event count，都不能让一个真实 Provider turn 从统计里消失。未知证据必须以未知证据的身份继续留在分母。

## 平等参与者的 Payload 对齐

对于同一份 immutable public round，平等 Provider turn 应同时满足：

- public event-ID deck 相同；
- exact serialized public payload fingerprint 相同；
- public payload event count 相同。

同轮 payload 不一致会单独报告为 `peer_payload_drift`。这不自动代表 selector 不公平：event IDs 可能完全一致，但真正序列化进入 Prompt 的公共内容发生了漂移。

Peer payload parity **不会**错误要求席位私有上下文完全一致。`YOUR_PRIOR_EVENTS_JSON`、定向 Peer Inbox、research lane 指令等 actor-local 内容本来就可以不同。这里的 equality claim 只覆盖平等参与者应共享的公共会议 payload。

## Repair Context 不变性

Structured repair 的唯一目的，是修正 Provider 被 parser 拒绝的输出格式。它不能悄悄变成“拿另一份公共记忆重新讨论一次”的第二轮协商。

因此 ChatChat 会对同一 actor / phase / round 的第一次发送与 repair attempt 做两条独立对账：

1. **精确序列化公共 payload**：`eq64` fingerprint + exact public-event count；
2. **公共 selection provenance**：精确的 `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`、`PINNED_OPEN_ISSUE_EVENT_IDS_JSON`、`PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON`、`LATEST_ROUND_EVENT_IDS_JSON` 数组。

Repair 状态含义：

- 没发生 repair → `not_used`；
- repair 发生，并且 **payload 与 selection provenance 都一致** → `matched`；
- payload 或 selection provenance 任一发生变化 → `drift`；
- 历史/残缺 repair 存在，但某一条必要票据缺失 → `unverified`。

UI 会把 **serialized payload drift** 与 **selection-provenance drift** 分开披露，但两者都归入一个程序完整性状态 `repair_deck_drift`。这样用户能知道到底哪里发生了漂移，同时不会产生一个貌似精确的综合分数。

`repair_deck_drift` 是协议完整性失败。它并不判断哪一份上下文更正确；它只说明“这次 repair 已经不再拥有与被修复 turn 相同的信息起点”。

## 冻结历史回放

Live 与 archive 视图都从同一组 transport receipt 字段派生。Full Room 只有在 Public Payload Integrity 从冻结 execution sidecar 重新加载同一 session，并重新得到完整现代 payload receipts 后，才算历史 replay 完成。ChatChat 不会拿今天的 Blackboard 重新 hash，然后冒充“这个值当时发送时已经存在”。

Side Panel 本来没有 History UI，所以其中的 payload-history replay 会明确保持 `not-applicable`，而不是伪装成存在一个历史界面。

## 与其它质量维度严格分开

Serialized payload integrity 不等于：

- stance alignment；
- Provider execution integrity；
- event-ID Memory Coverage；
- bounded-memory coverage gap；
- source / Evidence 质量；
- 答案正确性。

ChatChat 不应该把这些东西揉成一个貌似精确的综合 Trust Score。
