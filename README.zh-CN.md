<div align="center">
  <img src="assets/readme/chatchat-hero-minimal.svg" width="100%" alt="ChatChat — 一个提案，多种独立思想，共同协商" />

  <p><strong>点一下 ChatChat，让 Full Room 围绕一个提案自动召集一桌 AI。</strong><br />你只提问一次。每个 AI 先独立思考，再平等质疑、拿出证据、修正立场、保留分歧，并告诉你还有什么值得继续追问。</p>

  <p><em>一场礼貌、热闹、带票据、还能回放的思想碰撞。</em></p>

  <p><a href="README.md">English</a> · <a href="docs/BROWSER_EXTENSION.zh-CN.md">浏览器扩展</a> · <a href="docs/CONSULTATION_PROTOCOL.zh-CN.md">协商协议</a> · <a href="https://github.com/Gaitxh/Chatchat-/issues">想法与问题</a></p>
</div>

---

## 三个独白，不叫协商

普通的多模型界面通常停在这里：

```text
你 → ChatGPT
你 → Claude
你 → Gemini
```

ChatChat 会继续往下走：

```text
一个提案
   ↓
密封独立意见
   ↓
共享 Blackboard
   ↓
质疑 · 证据 · 支持 · 答辩
   ↓
机器来源观察
   ↓
修正 · 让步 · 幸存少数意见
   ↓
还有什么没查清？
   ↓
下一步协商 · 本地回放 · 可分享收据
```

这里**没有议长 AI**，没有谁能拿到私有证据通道，也不强迫所有模型最后说同一句话。用户发起提案；每个 AI 都是平等参与者；ChatChat 只负责协调公开的事件协议。

<p align="center"><img src="assets/readme/demo-overview.svg" width="100%" alt="ChatChat 协商产品演示" /></p>

---

## 01 · 先决定“这场会怎么开”

不是每个问题都应该用同一种讨论方式。

<table>
<tr><td><strong>◉ 平衡</strong><br/>实用默认：允许分歧、允许改口，然后给出结果。</td><td><strong>🌿 探索</strong><br/>让更多候选方案活得久一点，不急着形成一致。</td><td><strong>⚖ 决策</strong><br/>把约束和取舍摊开，最后形成可执行建议。</td></tr>
<tr><td><strong>🔎 核验</strong><br/>重点追事实、证据范围、来源日期、缺口与不确定性。</td><td><strong>🧨 压力测试</strong><br/>寻找最强反例和失败条件——但不会为了戏剧效果制造分歧。</td><td><strong>所有 AI 使用同一模式</strong><br/>模式改变会议目标和节奏，不改变任何参与者的地位。</td></tr>
</table>

模式就在提案框上方公开显示。它既会改变会议节奏，也会作为同一份 `MODE_GOAL_JSON` 平等地发给所有参与者。

---

## 02 · 看见一条证据怎样改变会议

一条来源走进会议室，**会议室不会向它下跪。**

```text
R1 · 密封独立意见

ChatGPT  → Browser Extension
Claude   → Web + Extension
Gemini   → Browser Extension

        ↓

⚔ ChatGPT → Claude
  “同时维护两个产品核心，有什么证据值得这个成本？”

📎 Gemini → Blackboard
  developer.chrome.com

        ↓

👁 来源观察

来源状态          来源可达
页面日期          2026-07-14
内容指纹          sha256:…
有限摘录          “Optional permissions can be requested…”

⚠ 来源可达 ≠ 主张已被证明

        ↓

🔎 ChatGPT 继续质疑证据适用范围
   “它能支持权限机制，
    但不能单独证明更强的产品增长结论。”

        ↓

↻ Claude 明确改口

Web + Extension
      ↓
Browser Extension

causedBy: Gemini 的 evidence event
```

同一条证据完全可以同时处于：**来源可达、仍然有争议、而且确实促成了改口**。这是三件不同的事实，所以 ChatChat 不把它们揉成一个绿色“已验证 ✓”。

`ROOM PULSE / 会议脉搏` 看当前公开立场；`LIVE MOMENTS / 关键时刻` 看真实转折；`RELATIONSHIP MAP / 关系战场` 只画有事件 ID 支撑的关系；`CONSULTATION THEATER / 协商剧场` 可以直接打开促成改口的原始事件。

> 可以有戏，但不能编剧情。

---

## 03 · 会议自己知道“还有哪里没查清”

有结果，不代表没问题了。

**Evidence Gap Radar / 证据缺口雷达** 只根据结构化事件找未决问题，例如：

```text
⚔ 主张已经被质疑 · 还没有 evidence 链接
👁 已给来源 · 还没有机器观察
🕒 缺少来源时间信号
🔎 证据仍然被明确质疑
↻ 证据确实促成了某次改口
🧍 最终仍有少数意见存活
```

然后 **NEXT MOVE / 下一步协商** 把这些缺口变成透明的后续选项：

```text
↻ 复核这次由证据触发的改口

这条证据既被明确质疑，
又明确促成了后续 revision，值得单独复核。

[ 作为下一轮提案 ]   [ 查看依据 ]
```

点击后只会**把下一轮提案放进原来的提案框，并预选一个建议模式**。它不会自动发送，也不会偷偷开始下一场会议。你可以先改问题、换模式，再决定是否继续。

所以 ChatChat 可以连续推进一场调查，却不需要凭空制造一个“主持人 AI”。

---

## 04 · 把这场会带走

一场协商结束后，可以压成一张本地 **Consultation Receipt / 协商收据**——保留足够的上下文，却不需要把整段聊天记录都导出去。

<p align="center"><img src="assets/readme/consultation-receipt-demo.svg" width="100%" alt="ChatChat 本地协商收据" /></p>

收据只从结构化事件、最终立场和冻结的证据观察中生成，可以显示：

- 会议模式与最终结果；
- 质疑 / 证据 / 改口数量；
- 明确的 evidence → revision 关键转折；
- 来源可达 / 仍有争议 / 触发改口等不同状态；
- 最终仍然保留的少数意见。

**复制 Markdown** 会生成经过 HTML 安全处理的文本；**导出 SVG** 会直接在浏览器本地生成分享卡。ChatChat 不会自动上传任何内容。

---

## 你可以决定“看多少”

Full Room 有三种观赛模式，而且它们**只改变 UI，不改变底层协商**：

```text
◌ 安静   → 只看提案 + 结果
◉ 直播   → 看公开立场 + 关键转折
⚡ 竞技场 → 关系战场 + 更强动效
```

竞技场尊重 `prefers-reduced-motion`。**会议热度只是互动强度，不是答案质量；100% 对齐也不等于 100% 正确。**

---

## 默认零配置

Full Room 是主产品入口。普通用户第一次使用，应该只感觉到：

```text
1 · 点 ChatChat
2 · 如果浏览器询问站点权限，只确认一次
3 · 哪个 AI 需要登录，就正常登录；ChatChat 会自己续接
4 · 写下一个提案
```

如果浏览器里已经有至少两个已知 AI 来源，ChatChat 会优先使用这些来源，不会为了“凑人数”再多索取额外站点权限；如果数量不够，就自动准备一个小型起步团队，并为它们打开干净会话。站点权限已经授权过以后，后续再次进入会议室可以做到**零配置点击自动恢复**。

底层的页面识别 → 连通握手 → 协商就绪验证都由 ChatChat 自己完成。工具栏按钮会**直接打开或聚焦 Full Room**；Side Panel 保留为可选的紧凑控制器。URL、手工页面定位和其他维修工具都不再出现在小白默认路径里，只留在折叠的 **高级修复**。

AI 账号仍然留在各自浏览器标签页中；ChatChat 没有中转服务器。来源检查使用用户授权后的有限、无凭证读取。历史回放从本地 IndexedDB 读取冻结的会议事件与证据观察，**不会自动重新调用 AI，也不会自动用今天的网页去改写昨天的会议。**

---

## 快速开始

```bash
git clone https://github.com/Gaitxh/Chatchat-.git
cd Chatchat-
npm install
npm run build:extension
```

随后打开 `chrome://extensions` 或 `edge://extensions`，启用**开发者模式**，选择**加载已解压的扩展程序**，并加载 `dist-extension/`。

```bash
npm run check
npm test
npm run dev:web
```

更多细节见 [浏览器扩展指南](docs/BROWSER_EXTENSION.zh-CN.md) 与 [协商协议](docs/CONSULTATION_PROTOCOL.zh-CN.md)。

---

## 人类主导，AI 协作

ChatChat 由 **Gaitxh** 发起并独立维护；项目开发过程中使用了 **OpenAI 的 ChatGPT 与 Codex** 协助产品构思、界面与视觉设计、代码实现、调试、测试和文档打磨。

所有方向和最终变更仍由人类主导、审阅和决定。ChatChat 是独立开源项目，**不代表 OpenAI 官方，也未获得 OpenAI 的赞助、背书或运营支持**。

<div align="center"><strong>一个提案，多种独立思想，共同协商。</strong><br /><sub>证据可以产生影响，但不能自动变成权威。</sub></div>