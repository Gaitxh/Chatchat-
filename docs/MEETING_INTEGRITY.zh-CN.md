# 会议执行完整性

ChatChat 明确把三个很容易混在一起的概念拆开：

1. **立场对齐度**：最终立场中，有多少参与者使用了同一个归一化 stance 标签。
2. **Meeting Execution Integrity / 会议执行完整性**：被选中的 Provider 轮次有没有真的完成“页面响应 → 结构化解析 → Blackboard 发布”这条可审计执行链。
3. **答案正确性**：建议到底是不是真的、是不是好建议。ChatChat 不会为它凭空编一个百分比。

高对齐度不能弥补 Provider 没有充分参与；反过来，100% 执行完整性也不能证明一个全票结论就是正确答案。

## 状态

`verified`
: 所有可审计 Provider 轮次都完成了执行链，没有 fallback、失败或未闭环状态。

`verified_after_repair`
: 所有轮次最终都完成了，但一个或多个 Provider 回答需要唯一一次结构化 repair。Repair 必须继续可见，因为第一次回答并没有形成有效的公共会议发言。

`degraded`
: 至少一轮进入 ChatChat fallback 或发生硬执行失败。最终立场分布仍可以显示，但产品必须明确警告：**这个对齐比例不是“所有 Provider 都完整参与以后形成的共识”。**

`incomplete`
: 仍有轮次没有进入终态审计类别。即使结果页已经有建议，也应把它视为暂定结果，而不是完整覆盖所有 Provider 的终局。

`waiting`
: 还没有任何可审计 Provider 轮次。

## 它不评价什么

Meeting Integrity 不评价智力、真伪、推理质量、研究质量、说服力，也不读取隐藏思维链。它只做机械的执行 provenance。

它能给出的最强正面结论是：

> 这些 Provider 轮次的页面确实返回了响应，响应通过了结构化 consultation parser，并产生了这些精确的公共 Blackboard 事件。

## Synthetic showcase

`?showcase=consultation` 也会渲染同一张 Integrity 卡，方便 Chromium 验证真实产品 UI。但页面会明确标成 synthetic。

Synthetic 的 `12/12 verified` 只意味着 deterministic fixture 完成了这条执行协议，**不意味着真实 ChatGPT、Claude、Gemini 或其他第三方模型实际出席。**

## 和 Provider Attendance 的关系

Meeting Integrity 直接由 canonical Provider Attendance & Execution Audit 推导，不维护第二套“谁算出席”的判断标准。逐席逐轮 provenance、Prompt snapshot、repair/fallback 和 durable execution receipt 规则见 [Provider 出席与执行审计](PROVIDER_ATTENDANCE_AUDIT.zh-CN.md)。
