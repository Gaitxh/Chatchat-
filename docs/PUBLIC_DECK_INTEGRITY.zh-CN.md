# 公共议政板逐字同牌完整性

ChatChat 把每一位 AI 参与者都视为平等智囊。如果两个 Provider 虽然拿到了相同的公共事件 ID，却拿到了不同的事件内容，那么“平等”仍然是不完整的。

## 审计什么

对于每一个真实发出的 `RUN_SPEECH` Prompt，ChatChat 会在正常的有界上下文选择器完成公共 Blackboard 快照选择之后，观察其中 `CONSULTATION_EVENTS_JSON` 的原始序列化值。

在同一个 `sessionId + phase + round` 中，各席位第一次发送给 Provider 的 Prompt 会按原始 payload 分组。只有已经观察到的平等席位拿到逐字完全相同的 payload 字符串，才算通过公共牌一致性检查。

这比只比较 `PUBLIC_SNAPSHOT_EVENT_IDS_JSON` 更强：即使 ID 完全相同，只要 actor、stance、confidence、evidence、content 或顺序中的任何内容被改动，都必须判定为不同牌。

## repair 连续性是另一条独立不变量

当 Provider 返回的结构化格式无法解析时，ChatChat 可以要求同一个 Provider 修复回答格式。repair Prompt 可以追加解析错误提示，但不能趁机更换该席位第一次看到的公共 Blackboard 牌面。

因此系统会按 actor 单独检查 repair 连续性，它与“不同席位是否同牌”是两条独立规则。

## 隐私边界

原始公共 payload 只保存在一个有上限的内存审计缓冲区里。ChatChat 不会为了这项证明再持久化一份会议全文副本。

传输回执可以显示一个紧凑的诊断 fingerprint 和 payload 字符数。fingerprint 不是密码学证明，也绝不会用于决定两副牌是否相等；真正的精确相等判断直接比较内存里的原始 payload 字符串。

这项审计不会读取 Provider 的账号凭据、Cookie、隐藏推理、思维链或模型私有状态。

## 产品真实性

在真实模式下，Public Blackboard Deck Integrity 面板描述的是实际发送到 Provider 标签页的 Prompt 观察结果。

在 `?showcase=consultation` 中，面板必须明确标记为 synthetic fixture。合成证据只能证明审计与 UI 链路工作正常，不能证明 ChatGPT、Claude、Gemini 或其他真实 Provider 曾经出席、收到或处理过这副测试牌。

## 这不能证明什么

逐字同牌是一项程序公平性保证。它不能证明公共事件本身一定真实，不能证明多数意见一定正确，不能证明不同 Provider 会对同一段文字作出相同理解，也不能证明有界上下文选择器省略的内容不重要。
