# Provider 出席与执行审计

ChatChat 的 Provider Attendance & Execution Audit（会议出席与执行审计）回答的不是“UI 有没有把这个 AI 画在席位上”，而是一个更严格的问题：

> 对于这位参与者的这一轮，ChatChat 能不能从**真正发送给 Provider 页面的公共会议快照**一路追到结构化解析，再追到最终进入公共 Blackboard 的具体事件？

它是执行与 provenance 审计，不展示、也不推断模型隐藏的思维链。

## 什么才叫“已验证轮次”

只有下面这些事实都可以观察到，一轮才标记为 **已验证**：

1. ChatChat 对一个明确的 `sessionId`、phase、round 启动了该参与者的回合。
2. 真正生成的 Provider Prompt 标明这个 session，并携带 `PUBLIC_SNAPSHOT_EVENT_IDS_JSON`。
3. 浏览器 bridge 对选中的真实标签页执行了 `RUN_SPEECH`。
4. Provider 页面返回了响应。
5. 响应通过结构化 consultation parser；如果第一次格式不合法，则必须是同一个 Provider 在唯一一次 repair 后通过。
6. 该参与者这一轮产生的一条或多条真实事件 ID 被观察到进入公共 Blackboard。

**只有页面返回文本，不算“已验证出席”。** 如果还没有完成解析与发布，状态只会停在“已捕获页面响应”。

## 审计状态

- `轮次已开始`：orchestrator 已经要求这个席位回应。
- `Prompt 已发送`：真实浏览器 bridge 已经把本轮 Prompt 发给目标标签页。
- `已捕获页面响应`：页面返回了文字；但此时还不能声称它已经成为会议发言。
- `已解析，等待发布`：结构化解析已经成功，但还没有观察到 Blackboard 发布。
- `已验证`：页面响应完成解析，而且一个或多个精确事件 ID 已经进入 Blackboard。
- `已验证 · 修复后`：第一次 Provider 回答解析失败，同一个 Provider 收到一次 repair prompt；第二次通过解析，并有事件进入 Blackboard。
- `FALLBACK`：传输、页面状态或解析失败后，ChatChat 发布了明确的零置信度 fallback。它绝不能冒充“Provider 已经完成推理”。
- `失败`：在形成有效 Provider 公开发言之前，执行链已经失败。

## “这个 AI 到底看到了什么”怎样证明

每一个正式 consultation Prompt 现在都包含：

```text
SESSION_ID: session_...
PHASE: debate
ROUND: 3
YOUR_ACTOR_ID: extension:anthropic-claude:...
PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["event_...", "event_...", ...]
```

`PUBLIC_SNAPSHOT_EVENT_IDS_JSON` 来自同一份被序列化到 `CONSULTATION_EVENTS_JSON` 的公共事件切片。执行审计 UI 是从**真正交给 `RUN_SPEECH` 的 Prompt 字符串**里读取这些字段，不是会后反推。

因此 ChatChat 可以严格证明类似这样的事实：

> Claude 的 R3 Prompt 里确实包含了 R1 各方立场，以及当时已经公开的 R2 challenge / evidence 事件。

它不能证明 Claude 在内部“怎样想”这些内容。它证明的是：**这些内容确实在送进 Claude 页面那一轮的 Prompt 里。**

## Repair 也必须留下票据

如果第一次 Provider 回复无法通过结构化 parser，ChatChat 会记录 `repair_requested`，并让**同一个 Provider**收到且只收到一次 repair prompt。

只有第二次回复真的解析成功，而且产生的事件又真的进入 Blackboard，UI 才会显示 **已验证 · 修复后**。

所以 repair 不再是一个被隐藏起来的技术细节，也不会把一次失败的首答悄悄洗成一条“干净”的会议发言。

## Fallback 不能冒充 Provider 发言

`BrowserConsultationAgent` 仍然保持 fail-soft：某个 Provider 的 transport / 页面 / parser 出错，不应该把整场会一起炸掉，因此 ChatChat 会发布明确的 `uncertain`，或者在 Final 阶段发布置信度为 0 的 `Uncertain`。

即使这条 fallback 本身进入 Blackboard，审计仍然把这一轮标记成 **FALLBACK**，不会计入“已验证 Provider 出席”。因为那条内容是 ChatChat 的失败说明，不是 Provider 成功完成该轮协商的证据。

## Synthetic showcase 的边界

`?showcase=consultation` 仍然使用 deterministic synthetic Provider speech，以便真实 Chromium 可以稳定重复 UI / 协议门禁。

Attendance Audit 也会在这个 Demo 中完整渲染，用来测试审计机制本身；但页面继续醒目标记 `DEMO · SYNTHETIC`，明确说明第三方模型并没有真的出席。

live-deliberation Chromium guard 还必须亲眼看到至少一条：

- 状态为 `published` 或 `repaired`；
- Prompt 公共快照事件数大于 0；
- Blackboard 发布事件数大于 0。

这证明**审计链和产品 UI 在真实 Chromium 中端到端工作**，但不会把 synthetic fixture 偷换成真实 Provider 推理。

## Durable execution receipt

一场协商闭会时，ChatChat 现在会把原始执行证据冻结成一个本地 IndexedDB sidecar，并使用和 consultation archive 相同的 `sessionId`：

- 该 session 的全部 Provider transport records；
- 该 session 的全部 parse / repair / fallback audit events；
- 当时是 `live-provider-tabs` 还是真正的 `synthetic-showcase`。

sidecar 数据库是 `chatchat-provider-execution-history-v1`。它会和普通 consultation archive、冻结 Evidence history 并行保存；只有三者都完成之后，系统才广播 `chatchat:consultation-history-updated`。

这里保存的是**原始审计票据**，不是 UI 当时算出来的 `12/12 已验证` 数字。打开历史记录时，ChatChat 会重新组合：

1. 冻结的 transport receipt；
2. 冻结的 parse / repair / fallback receipt；
3. consultation archive 中冻结的 Blackboard events。

再重新推导 Provider Attendance model。这样以后 UI 算法升级，旧会议仍然可以从原始票据重新解释，而不是把旧版派生数字当成不可修改的历史事实。

## 历史回放

Consultation History 卡片现在会显示已验证 Provider 轮次、repair、fallback 和失败数量。打开一场旧会议，会展开 `LOCAL · EXECUTION RECEIPT`：逐席、逐轮查看 snapshot 数量、页面响应、解析结果、Blackboard 发布数量，以及精确 snapshot / published event IDs。

历史执行回放会产生 **0 次 Provider 调用**。浏览器重启后也不会为了“补票据”重新问今天的 Provider 页面昨天发生了什么。

在 execution receipt 功能出现之前生成的旧 archive 仍然有效；它们只会明确显示“这条记录早于 durable Provider execution receipt”，不会编造缺失 provenance。

## 浏览器持久化证明

现有 History Chromium guard 现在把 execution durability 也纳入同一条产品契约。只有它从同一个 session 中同时读到：

- `chatchat-consultation-history-v1 / archives`；以及
- `chatchat-provider-execution-history-v1 / receipts`

才会把 history persistence 标记为 complete。

execution receipt 还必须真实包含 transport records、parse/repair records、至少一个非空 peer-visible Prompt snapshot，以及至少一个 `structured_parsed` 事件。这些检查直接从闭会后的 IndexedDB 读取，而不是从 live DOM 猜出来。
