# 有界公共记忆的程序公平

ChatChat 所说的“平等 AI 参与者”不能只停留在角色文案。Provider Prompt 不可能永远装下整个 Blackboard，所以省略必然发生；真正的制度问题是：**哪些事实可以决定谁被省略、谁被记住。**

这套规则明确拒绝把固定席位发布顺序偷偷变成一种权力来源。

## 三层分配规则

### 1. 最新轮保护

最新公开轮次优先于更老历史。如果最新轮本身就超过 hard budget，ChatChat 按 actor 轮转：所有活跃席位都先拿到自己最新的 1 条事件，任何席位才能拿第 2 条；然后所有仍有事件的席位拿第 2 条，再第 3 条。无法整除的余数只用 `sessionId + round` 的稳定旋转决定。

### 2. 结构化未决问题 Pin

旧的未决 obligation 可以挤掉普通老历史。这里仍保留**结构优先级**：direct question、challenged claim、targeted evidence 等可以高于普通 uncertainty；同一结构优先级内仍然优先更老的 round，避免老问题永远饿死。

但是在 **同一个结构优先级 + 同一个 source round** 的真正平级竞争里，不能再让 Blackboard source index 决定有限 pin budget。ChatChat 会按 source actor 分桶轮转。

每个 issue context group 必须整体进入。若一条 challenge / question 需要连同有限 structural parent 才能被理解，而剩余槽位装不下整组，就整体跳过；不能为了填满最后 1 个槽，把问题本身 pin 进去却把让它可理解的上下文切掉。

这不是“每个 actor 强行分同样 quota”。结构化 obligation 的类型优先级仍然高于 actor balancing。公平只用于解决真正的程序平局。

### 3. 普通 Recency

最新轮和 unresolved pins 分完之后，剩余才是普通近期历史。

ChatChat 会先保留**完整的较新轮次**。只有最后那个装不下的“边界轮”才在活跃席位之间做 seat-balanced allocation。更老一轮的事件，不能仅仅为了让 actor 数字更平均，就反过来挤掉一个原本能完整保留的较新轮次。

## 确定性旋转

当容量无法被活跃席位整除时，ChatChat 使用由 session / round / allocation purpose 派生的稳定旋转。它不会读取：

- Provider 品牌或模型名；
- stance 或多数阵营；
- confidence；
- response latency；
- Evidence 热度；
- 语义“重要程度”；
- Blackboard 发布位置。

因此同一份 immutable public snapshot 必须得到同一组选中 event。

## Blackboard 时间顺序仍是公共事实

Actor balancing 只是内部的“选牌”过程。选中 event set 后，送进 Prompt 之前仍恢复成**真实 Blackboard 时间顺序**。Provider 不会看到一份为了公平而伪造的 round-robin 对话顺序。

## 这套制度能保证什么

- 最新轮爆仓时，不系统性奖励后发布席位；
- 同 rank + 同 round 的 pin 竞争，不系统性奖励先发布席位；
- ordinary recency 的边界轮会在活跃席位之间平衡；
- 单轮不可整除容量下，足够活跃的平等席位最多相差 1 个槽；
- 只发 1 条的安静席位，只要容量够每个活跃席位至少 1 条，就不会被话更多的 AI 完全抹掉；
- 在测试覆盖的同级场景里，整块重排 actor 发布顺序不会改变最终选中 event set。

## 它不保证什么

它不保证整份 Prompt 里每个 actor 的 event 数完全相等。Pin 是 obligation-driven，不是席位配额。它不评估哪条内容“更重要”，不限制发言数量，不改变 stance alignment，也不表示被省略事件不重要，更不等于答案正确性。

程序公平只是协商制度的一个独立质量维度，不应该被揉成一个综合 Trust Score。
