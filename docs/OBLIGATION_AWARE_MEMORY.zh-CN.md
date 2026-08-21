# 未决义务感知的有界记忆调度

Provider Memory Coverage 证明每轮到底有哪些公开事件进入有界 Prompt；Procedural Fairness 防止“配置顺序 / Blackboard 发布顺序”偷偷变成记忆特权。但还剩一个不同的问题：

> **一个结构化、仍未解决的公开义务，在持续高流量轮次里能不能重新获得注意力？还是即使所有 Provider 都公平地拿到同一副牌，它仍然可能永久饿死？**

旧策略在“最新轮自己已经超过 12 条”时，会让最新轮吃掉全部公共上下文槽。这样一来，一个很早、仍未回答的 direct question 可以连续很多轮都无法重新进入 Prompt。

这是一种“公平地交付同一份不完整流程”。对一个真正想把未决事项推进到闭会的 AI 协商会议来说还不够。

## 调度顺序

如果最新轮本身能够放进公共上下文预算，原规则不变：

1. 完整保留最新轮；
2. 剩余容量恢复 canonical-open 的结构化 obligation group；
3. 最后才使用更老的普通 recency。

如果最新轮本身就超过 hard cap，则改成：

> **席位底座 → 未决义务组 → 最新轮额外发言 → 更老普通 recency**

## 1. 平等席位底座

只要 hard cap 在数学上能够覆盖最新轮全部 actor，就先保证每个 actor 至少有一个事件进入下一轮公共 Prompt，然后才允许旧 obligation 使用“额外发言容量”。

因此，一个旧问题不能因为“很早且还没答”就把当前某个可代表席位整席挤掉。

每个 actor 的底座事件选择里，canonical-open 的最新轮 source 优先于普通同轮发言。这仍然是结构化规则，不对 prose、stance、confidence 或模型身份打分。

## 2. Canonical-open obligation group

席位底座之后，剩余容量可以分配给与 Meeting Secretariat / Open Issues / Conflict Resolution Ledger 共用定义的公开未决义务：

- direct / open question；
- 仍等待被质疑方显式回应的 challenge；
- 仍等待目标方回应的 targeted evidence；
- 尚未被结构化解决的 explicit uncertainty。

调度器搬运的是**事件组**，不是 AI 自动总结出的“主题”。一个组会包含 source，并在需要时携带少量 related / parent event，让恢复回来的 challenge / evidence 不会变成失去上下文的悬空指令。

事件组仍然有严格上限，不允许单一 thread 吞掉整个公共记忆。

被调度只代表**记忆覆盖优先级**，不产生权威、真理地位、confidence 加权或票权。

## 3. 最新轮额外发言

完成 obligation 调度后，剩余槽重新交给最新轮。

额外槽按照当前每个 actor 已经获得的 representation 数量继续均衡分配；已经因为 obligation group 被选中的最新轮事件，也会计入这个 actor 的 quota。

因此，在“三个席位、最新轮 18 条、总预算 12”的情况下，如果恢复一条旧 direct question，典型形状会变成：

- 1 条旧未决 direct obligation；
- 11 条最新轮事件；
- 最新轮 3 个 actor 全部仍有代表；
- 总共严格 12 条。

也就是说，旧义务挤掉的是**一个可选的额外发言槽**，而不是一个席位。

## 4. 更老普通 recency

只有最新轮与未决义务都无法吃满预算时，才继续放入普通、更早的近期事件。

## 结构父事件必须一起考虑

有些 obligation 离开它引用的事件就无法理解。例如一个旧 challenge，如果被挑战的 claim 没有一起出现，就只剩一句悬空的“我反对”。

因此调度器复用 conflict memory 的 bounded structural-group 逻辑：

- challenge 可以携带被挑战 parent；
- evidence / reply obligation 可以携带一个相关结构父事件；
- 仍然限制 group 大小，避免无限线程展开。

## 被点名 Provider 怎么处理

所有平等 Provider 仍然收到**同一副公共 deck**。ChatChat 不会为了催答，偷偷给某个席位不同的公共历史。

当一个恢复回来的 obligation 明确指向当前 Provider 时，现有 `CHATCHAT_PINNED_OPEN_ISSUES` 规则会要求该参与者在无关新观点之前处理这条未完成的公开事务，并保留精确 source event id。

后续还可以把这种“恢复义务”做成独立的结构化 inbox item，但公共记忆调度本身是 canonical fact，不能依赖 prose 推断。

## 数学上没有槽时必须诚实

如果最新轮恰好有 12 个不同 actor，而公共 context cap 也是 12，那么席位底座已经占满所有槽。

此时旧 obligation **不能**为了恢复自己而踢掉一个最新轮 actor。

ChatChat 会继续把这条 canonical-open source 显示为 Provider Memory Coverage Gap，而不是假装它已经获得响应机会。

这个 gap 会成为下一层 Closure / Resolution Round policy 的输入：系统可以在后续专门降低公共噪声，给未决 obligation 一个真正的响应机会，而不是暗中破坏席位公平。

## 确定性回归场景

核心测试固定复现下面的压力：

- R1：A → B 一条旧 direct question；
- R2：A、B、C 各发 6 条，共 18 条最新轮公开事件；
- R3：公共 Prompt cap 仍为 12。

必须满足：

- 最终严格 12 条；
- A/B/C 三个最新轮 actor 全部有代表；
- 旧 direct question 被恢复；
- 这一条 obligation 只替换一个可选最新轮额外槽；
- 剩余最新轮 representation 仍保持均衡；
- 即使把 R2 actor block 的发布顺序改掉，以上保证仍不变。

第二个 fixture 使用旧 challenge + 被挑战 parent，两个事件必须作为一个 bounded structural obligation group 一起回来。

第三个 saturation fixture 使用 12 个最新轮 actor：12 个席位底座都必须保留，旧 obligation 不能挤掉其中任何一个。

## 这一层仍然不决定什么时候闭会

这个调度策略只是让未完成的公开事务更有机会真正进入后续 Prompt，并获得响应机会。它不声称“语义上已经讨论充分”，也不直接决定会议结束。

Closure 应该是下一层独立协议：

- canonical unresolved obligation 还没有获得公平响应机会，而且仍有有界安全预算时，继续；
- 绝不无限循环；
- 到 hard safety cap 仍无法解决时，带着精确 unresolved receipts 和明确 stop reason 诚实闭会。

这样“讨论直到完成”才是一套可审计程序，而不是一句魔法口号。
