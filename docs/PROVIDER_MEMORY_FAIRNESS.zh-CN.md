# Provider 公共记忆程序公平

Provider Memory Coverage 回答“**这一轮到底有哪些公开事件进入了 Provider Prompt**”。程序公平回答的是另一件事：

> **当 ChatChat 构造并交付这副有界公共记忆时，平等参与者是否获得了公平、内部一致的程序待遇？**

它不是模型质量分，不判断答案正确，不给 Provider 可信度排名，也不会因为某个观点被保留就给它更多票权。

## 为什么需要这一层

完整 Blackboard 可以持续增长，但 Provider Prompt 的公共上下文预算是有限的。此前，“保护最新轮”的实现如果最新轮本身超过 12 条，会直接取最后 12 条。

问题在于：同轮参与者虽然并行生成，但 Blackboard 最终会按参与者配置顺序发布各自 contribution block。因此在一个爆量轮次里，简单 tail slice 会让**发布靠后的席位天然更容易被记住**。

例如三个平等参与者在 R2 各合法提交 6 条：

- R2 一共 18 条公开事件；
- R3 公共 Prompt 只有 12 个槽；
- 简单取最后 12 条，可能让最早发布席位的 6 条全部消失；
- 更隐蔽的是，R3 所有 Provider 仍然会拿到“同一副偏置的牌”。

所以“所有人看到同一副牌”还不够。**这副牌本身怎样被构造，也必须公平。**

## 最新轮的席位均衡分配

当最新轮本身超过 hard cap 时，`selectProviderContextEvents()` 不再按发布时间尾部截取，而是：

1. 按 actor 分组；
2. 使用 `sessionId + round + actorId` 的稳定 hash 建立确定性 actor 顺序，而不是 Provider 配置顺序或 Blackboard 发布顺序；
3. 在预算可以覆盖所有 actor 时，任何 actor 获得第二个槽之前，先让每个最新轮 actor 获得一个槽；
4. 余下 quota 继续按稳定顺序轮转；
5. 每个 actor 自己的 quota 内，canonical-open 的同轮 source 优先于普通 recency；
6. 选完以后恢复 Blackboard 原始时间顺序再进入 Prompt。

因此“三个 actor、18 条最新轮事件、12 个槽”的形状会从旧算法可能出现的 `0/6/6`，变成 `4/4/4`。

如果最新轮 actor 数量本身就超过 hard cap，则数学上不可能人人至少一条。ChatChat 会显式保存 `latestRoundOmittedActorIds`，把会议标为 `representation_limited`，而不是继续说“公平已验证”。

这种均衡只影响**记忆覆盖**，不产生权威、票权、真理地位、置信度加成或发言优先级。

## 不只比较 event IDs，还比较 actual public payload

“event IDs 一样”仍然不足以证明公共记忆真的一样。理论上，一个 wrapper 或序列化 bug 可以保留相同 IDs，却改变正文、stance、confidence、target/reference 等字段。

因此只读 Prompt observer 会对每个真实 `RUN_SPEECH` Prompt 中规范化后的 **`CONSULTATION_EVENTS_JSON` 实际 payload**计算 fingerprint。

这个 fingerprint：

- 使用确定性的 FNV-1a 64-bit；
- 同步计算，不向 transport path 增加异步 WebCrypto；
- 只保存 hash + 规范化字符数，不额外持久化一份 Prompt 或 Blackboard 正文；
- 明确**不是**密码学安全哈希、真实性签名、语义相似度或内容身份标识。

同一轮平等 Provider 必须拥有相同的 actual public-payload fingerprint；否则状态就是 `public_payload_mismatch`。

## Prompt metadata 不能给自己作证

`PUBLIC_SNAPSHOT_EVENT_IDS_JSON` 很有用，但它只是 Prompt 自己声明的 metadata，不能成为“实际 payload 的证明”。

Prompt observer 会独立从 `CONSULTATION_EVENTS_JSON` 再解析一遍事件 IDs，并分别保存：

- `declaredSnapshotEventIds` —— metadata 宣称有哪些 IDs；
- transport receipt 的 `snapshotEventIds` —— 从实际 public JSON 中恢复出的 IDs；
- `snapshotMetadataMatchesPayload` —— 两者是否按顺序精确一致。

两者不同就是 `prompt_metadata_drift`。即使所有 Provider 最终拿到的实际 public payload 彼此相同，也不能把这种自洽性错误混成“peer fairness 没问题所以一切正常”。

当前 23,500 字符 Prompt guard 不会静默裁剪 public JSON：完整 Prompt 超预算时会明确失败。但 metadata parity 仍然必须长期审计，防止未来 wrapper/refactor 产生“两套现实”。

## Selector actor coverage 与 actual Prompt actor coverage 分开取证

Selector audit 能看到完整 Blackboard，因此知道：

- 最新轮原本有哪些 actor；
- selector 代表了哪些 actor；
- 哪些 actor 因数学上的 hard cap 无法被代表。

actual Prompt observer 只能诚实证明 Prompt 里真正出现了哪些 latest-round actor，不能凭空知道被省略的人。

两条证据保持独立。selector actor coverage 与 actual Prompt coverage 不一致时，状态为 `selector_actor_drift`。

## Repair 只能修格式，不能换牌

结构化输出 repair 的职责只是把模型输出修成机器可读格式，不应改变这名参与者正在面对的会议状态。

一旦发生 repair，ChatChat 会比较第一次与 repair Prompt 的：

- actual public event IDs；
- declared snapshot IDs；
- metadata↔payload parity；
- pinned event IDs；
- canonical pin-source IDs；
- protected latest-round IDs；
- actual represented actors；
- public-payload fingerprint。

任何变化都会成为 `repair_context_drift`。

因此不能出现“第一次回答看的是一副牌，格式失败后 repair 又偷偷换成另一副牌，然后系统还说只是格式修复”。

## 程序公平状态

状态是离散、可解释的，不计算虚假的 Fairness 92%：

- `verified` —— 每个可审计 turn 都有 actual Prompt；平等 Provider 的 actual public payload 相同；metadata 与 actual IDs 一致；selector actor coverage 与 actual Prompt 一致；repair 不换牌；最新轮 actor 可完整代表；
- `representation_limited` —— hard cap 数学上无法代表所有最新轮 actor；
- `public_payload_mismatch` —— 同轮平等 Provider 实际收到的规范化 public JSON 不同；
- `prompt_metadata_drift` —— Prompt 自报 snapshot IDs 与实际 public payload IDs 不一致；
- `repair_context_drift` —— 格式 repair 改变了公共 deck；
- `selector_actor_drift` —— selector 声称的 actor representation 与 actual Prompt 不一致；
- `prompt_unverified` —— 有现代 selector audit，但 actual Prompt 证明不完整；
- `legacy_unverified` —— 旧 archive 产生时没有现代公平 provenance，绝不事后升级。

## Durable history

程序公平继续复用 Attendance / Provider Memory 的本地 execution sidecar，不建立第四套数据库。

现代 receipt 会冻结：

- actual public payload IDs；
- 独立的 declared snapshot IDs；
- metadata parity；
- public-payload fingerprint；
- actual represented latest-round actors；
- selector 的 full/selected/omitted actor sets；
- first / repair attempt 元数据。

Full Room 打开历史时不会重新调用任何 Provider。History proof 只有在同一个 session 能重新构造 `data-provider-memory-fairness-view="archive"`，并保持原来的现代 `verified` 事实时才完成。

Side Panel 没有 History UI，因此 replay 明确为 `not-applicable`，但存储耐久性仍然单独验证。

## Chromium 压力证明

专用 synthetic `fairness-proof=overfull` 场景只使用生产协议允许的 contribution：

- 三个平等 Provider 席位；
- 正常 R2 contribution + 额外 5 条合法 argument，使每席位恰好 6 条；
- 这与生产 parser 的 `MAX_CONTRIBUTIONS = 6` 完全一致，不构造不可能发生的测试输入；
- R2 一共 18 条公开事件；
- R3 公共 Prompt 仍严格只有 12 条；
- production selector 必须保留三个 R2 actor；
- 三个 R3 seat 都必须有 actual Prompt receipt；
- 三者 actual public-payload fingerprint 必须相同；
- Prompt 自报 IDs 必须与 actual public JSON IDs 一致；
- selector actor coverage 必须与 actual Prompt coverage 一致；
- repair-context mismatch 必须为 0。

fixture 自己不能写成功 marker。只有读取 production Fairness / Provider Memory DOM 的 guard 才能完成证明。

DOM 与 PNG 来自同一个 Chromium DevTools Protocol 页面，截图还必须通过非空白像素内容检查。

这个 fixture 证明的是 ChatChat 的程序，不是第三方模型的智力或答案正确性。

## 这一层仍然没有解决什么

程序代表公平不等于“所有旧 obligation 都一定有槽位”。当最新轮持续爆量时，一场会议可以 seat-fair，却仍然出现 Memory Coverage Gap。

下一层应该做的是 **Obligation-aware Memory Scheduling**：先保证最新轮 actor representation，再把剩余容量给 canonical-open obligation group，最后才给同轮额外 recency。这样旧的 direct question / challenge / evidence / uncertainty 不会在持续高流量中永久饿死。

而“什么时候闭会”又是另一层。后续 Closure Policy 应该根据结构化 unresolved obligation + 有界安全预算决定，而不是从 prose 猜“大家差不多聊完了”。
