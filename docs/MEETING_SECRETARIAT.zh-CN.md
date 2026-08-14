# ChatChat 大会秘书处

ChatChat 的 Meeting Secretariat（大会秘书处）只是协商协议之上的**确定性视图**。它不是议长、主持人、裁判，也不是额外的 AI 参与者。

## 它要回答什么

在协商进行时，用户不应该被迫通读整个事件流才能弄清两件事：

1. **为什么大会还在继续这一轮？**
2. **现在还有哪些结构化议题没有得到明确回应？**

## Live Agenda

协商引擎通过可选的 `CouncilPhaseUpdate.reason` 公开机器可读的继续原因：

- `sealed_start`：开始彼此不可见的独立第一轮。
- `initial_debate`：独立意见已经进入共享快照，开始共同协商。
- `fresh_signal_follow_up`：上一批并行回应刚刚产生新的观点、质疑、证据、改口、追问或不确定性；同行在同一批次里不可能提前看到这些新事件，因此必须得到下一次公开回应机会。
- `minimum_debate_rounds`：当前协商模式要求更多公开讨论轮次。
- `alignment_not_reached`：描述性的立场对齐度尚未达到阈值。
- `finalizing_stable_alignment`：最低公开讨论要求满足、对齐度达到阈值，并且上一批次没有新增必须给同行回应机会的信号。
- `finalizing_round_budget`：达到当前模式的硬轮次边界；系统不会假装剩余分歧已经消失。

当原因是 `fresh_signal_follow_up` 时，`triggerEventIds` 会携带真正触发下一轮的公开事件 ID。UI 因此可以把“为什么继续”追溯到原始事件，而不是会后编一个解释。

对齐度始终只是描述性遥测数据。多数意见不会因此获得权威，也不会让任何参与者得到更多发言权或投票权。

## Open Issues

开放议题直接从公开 Blackboard 事件图推导。ChatChat 不会再叫一个模型来判断某个问题“听起来是不是已经解决”。

直接追问、定向质疑和定向证据，只有在**真正被点名的参与者**发布了指向那条具体请求的结构化回应之后才会销账。语义相似的普通文字不算，第三方替答也不算。

明确的不确定性会继续保留，直到同一个参与者按照 `src/consultation/open-issues.ts` 中的保守规则记录更高置信度的结构化 revision 或 final position。

因此，一场会议完全可能在达到轮次边界时仍然保留开放议题。ChatChat 会如实展示这种状态，而不是把它改写成虚假的“已经形成共识”。

## 共享回应规则

`src/consultation/structured-response.ts` 同时服务 Peer Exchange Queue 和 Open Issues。这样两个界面不会对“某个 AI 到底有没有回答同行”给出互相冲突的答案。

## 真实浏览器证据

Live-deliberation Chromium 产品门禁现在只有在真实浏览器亲眼观察到以下两个事实后才能完成：

- 一次带精确触发事件的 `fresh_signal_follow_up` Agenda；
- 至少一个带原始事件 ID 的 Open Issue。

这两个要求是在已有的 sealed/debate、研究、证据、revision、直接回复、关系图和 Peer Exchange 生命周期证据之上继续叠加的。
