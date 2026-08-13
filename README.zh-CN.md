<div align="center">
  <img src="assets/chatchat-avatar-pixel.png" width="132" alt="ChatChat" />

# ChatChat

### **你发起提案，让独立 AI 平等协商。**

把浏览器里已经登录的多个 AI 拉进同一场本地协商会议。
你只发起一次提案；接下来让它们独立思考、互相质疑、提供证据、修改立场，并分别提交自己的最终意见。

[English](README.md) · [浏览器扩展](docs/BROWSER_EXTENSION.zh-CN.md) · [协商协议](docs/CONSULTATION_PROTOCOL.zh-CN.md)

</div>

---

## ChatChat 是什么？

普通的多模型工具通常是：

```text
你
 ├─ 问 AI A
 ├─ 问 AI B
 └─ 问 AI C
        ↓
你自己比较三个答案
```

ChatChat 把它们变成一场真正的 **AI 协商会议**：

```text
                    用户提案
                       │
                       ▼
              ┌─────────────────┐
              │   AI 协商会议    │
              └─────────────────┘
            GPT  Claude  Gemini …
               │    │      │
               └────┼──────┘
                    ▼
                 独立意见
             Round 1 完全密封
                    ▼
                 公开协商
       质疑 · 证据 · 支持 · 答辩
       追问 · 修正 · 让步 · 不确定
                    ▼
               各方最终立场
                    ▼
                  协商结果
        当前一致比例 + 置信度 +
          仍然存在的不同意见
```

**没有主席模型，没有特权参与者。** 每个 AI 来源都作为独立、平等的个体参加协商。

> **先独立，始终平等；证据足够就改口；不同意见不消失。**

---

## 浏览器优先

ChatChat 的主产品是 Chromium Side Panel 浏览器扩展。

浏览器本身已经解决了最麻烦的一件事：你平时使用 AI 的登录态和会话都在那里。

```text
Chrome / Edge / Chromium
  ├── ChatGPT 标签页      正常登录
  ├── Claude 标签页       正常登录
  ├── Gemini 标签页       正常登录
  ├── DeepSeek 标签页     正常登录
  ├── 元宝 / 通义 / Grok / Qwen / …
  └── ChatChat Side Panel
```

ChatChat 不需要你把密码、Cookie 或 session token 复制给另一个服务。

---

## 使用体验

### 1. 添加 AI 参与者

像平时一样打开 AI 网站，然后在 ChatChat Side Panel 里把它们加入协商。

你可以：

- 让当前 AI 标签页参加；
- 从 ChatChat 自动发现的 AI 标签页里选择；
- 粘贴一个 AI URL；
- 使用“快速打开”进入内置识别的 Provider。

当前内置入口识别包括：

**ChatGPT · Claude · Gemini · DeepSeek · 元宝 · 通义 · Grok · Qwen**

普通的自定义 `http/https` AI 网站也可以尝试通用浏览器 Adapter 流程。

### 2. 第一次告诉 ChatChat 页面元素在哪里

AI 网站没有统一 DOM/API，因此每个网站第一次需要教 ChatChat 三个位置：

```text
输入框 / Composer
发送按钮
回复区域
```

之后运行“验证参与者”，系统会进行连通测试和结构化协商协议握手。

### 3. 写一个用户提案

它可以是：

- 一个问题；
- 一个技术决策；
- 一个产品计划；
- 一个研究问题；
- 一个需要验证的观点；
- 一个值得从多个角度讨论的方案。

例如：

> 对于一个开源、本地优先的多 AI 浏览器项目，我们现在最应该优先做什么，才能同时提高实用性和传播力？请比较不同路线，并主动质疑缺少依据的假设。

### 4. 开始协商

之后全部自动完成：

```text
独立意见
   ↓
共同协商
   ↓
最终立场
   ↓
协商结果
```

用户不需要再手动发送 Round 2。

---

## 各个 AI 是平等参与者

主协商模式中，**每个 AI 来源只有一个平等参与者席位**。

```text
ChatGPT   1 位参与者
Claude    1 位参与者
Gemini    1 位参与者
DeepSeek  1 位参与者
```

打开五个 ChatGPT 标签页，不会让 ChatGPT 获得五倍权威。

ChatChat 想组合的是**不同 AI 来源的独立观点**，而不是通过复制同一个 Provider 制造一个多数派。

单次协商目前最多支持 **8 位平等参与者**。

---

## Round 1 真正独立

第一轮意见完全密封。

每个参与者都会收到同一个“用户提案”，但看不到其他 AI 的回答。

只有等这一批 AI 全部完成之后，系统才会一次性把结构化事件发布到共享协商空间。

后续轮次采用同一快照并行回应：

```text
协商快照 N
    │
 ┌──┼──┐
 ▼  ▼  ▼
AI A AI B AI C
 │  │  │
 └──┼──┘
    ▼
统一发布这一批事件
    ▼
协商快照 N + 1
```

哪个 AI 网站响应更快，并不会因此获得隐藏的“先发言特权”。

---

## 共享空间不是普通聊天记录

ChatChat 的 Blackboard 保存结构化事件：

```text
argument       立场 / 论点
challenge      质疑
evidence       证据
support        支持
defense        答辩
question       追问
revision       修正立场
concede        让步
uncertain      不确定
final_position 最终立场
```

因此这样的过程会成为明确事件：

```text
Gemini 质疑一个观点
       ↓
Claude 提供证据
       ↓
ChatGPT 重新评估
       ↓
↻ 改变立场
```

**改口是进展，不是失败。**

---

## 没有主席模型替所有人“拍板”

ChatChat 不会指定一个 AI 作为主席，让它把其他模型的意见重新包装成一个拥有特殊地位的“最终答案”。

每个参与者都会提交自己的 `final_position`。

界面显示：

- 当前一致 / 共识比例；
- 置信度；
- 每个参与者自己的最终立场；
- 明确发生过的修正；
- 最终仍然保留的少数 / 不同意见。

如果 AI 们最后仍然不同意，ChatChat 就把这种不同意展示出来。

---

## 中文 + English

ChatChat 从第一版就按国际开源项目设计。

主 Side Panel 同时提供：

- **简体中文**
- **English**

顶部可以直接切换语言。

事件协议保持语言无关，所以以后继续增加其他语言时，不需要重新造一套协商引擎。

[English README](README.md)

---

## Local-first 隐私模型

ChatChat 自己**没有中转服务器**。

```text
你的浏览器
  ├── ChatChat Side Panel
  ├── 扩展自己的本地配置
  ├── ChatGPT 标签页 ─────→ OpenAI
  ├── Claude 标签页 ──────→ Anthropic
  ├── Gemini 标签页 ──────→ Google
  └── 其他 AI 标签页 ─────→ 对应 Provider
```

不存在：

```text
用户 → ChatChat Server → AI Provider
```

不过边界必须说清楚：如果参与者是在线 AI，那么 ChatChat 发送给它的用户提案和协商上下文依然会直接发送到这个 AI Provider 的网页。

Local-first 的含义是 **ChatChat 不再在中间增加一台自己的中央服务器**，不是让在线 AI magically 变成本地模型。

只有当你主动添加某个 AI 来源时，ChatChat 才会请求那个网站对应的 **optional host permission**。

---

## 安装浏览器扩展

需要 Node.js 20+ 和 Chromium 系浏览器。

```bash
npm install
npm run build:extension
```

然后：

```text
chrome://extensions
→ 开发者模式
→ 加载已解压的扩展程序
→ 选择 dist-extension/
```

点击 ChatChat 工具栏按钮即可打开 Side Panel。

对于贡献者，CI 也会上传每个 PR 真正构建出来的 unpacked extension artifact。

[完整浏览器扩展指南](docs/BROWSER_EXTENSION.zh-CN.md)

---

## ChatChat 如何和 AI 标签页通信？

```text
ChatChat Side Panel
       │
       │ 用户选择后请求对应网站权限
       ▼
隔离的 content-script bridge
       │
       ├─ 用户教过的输入框
       ├─ 用户教过的发送按钮
       └─ 用户教过的回复区域
       │
       ▼
浏览器里已经登录的 AI 网页
```

通用 bridge 有意保持狭窄，不需要读取用户密码或认证 token。

远程 AI 网页和其他 AI 的文本都被当作不可信外部内容。

---

## 开源项目结构

```text
extension-public/
  manifest.json
  service-worker.js
  content-script.js

extension/
  sidepanel.html

src/
  consultation/     平等参与者语义
  i18n/             中文 + English 产品文案
  extension/        Side Panel 产品界面
  core/             Blackboard + Orchestrator + 事件协议
  provider-sdk/     URL catalog + Teach + 结构化 bridge
  validation/       隐私安全的验证元数据
  theater/          影响关系 / Replay 基础
  history/          本地事件历史基础
```

仓库里仍然保留以前实验过的 Desktop/Tauri 代码，但**浏览器扩展是当前主产品，也是默认 CI 验证目标**。

---

## 产品原则

1. **用户只发起一次提案。**
2. **每个 AI 都是平等参与者。**
3. **Round 1 完全密封。**
4. **准确性高于说服欲。**
5. **多数只是信息，不是权威。**
6. **改口是一种功能。**
7. **最终不同意见继续保留。**
8. **Browser first。**
9. **Local-first，但不假装在线 AI 是离线的。**
10. **中文和 English 都是一等界面。**
11. **界面可以有戏剧感，协议必须冷静。**

[产品原则](docs/PRODUCT_PRINCIPLES.md) · [协商协议](docs/CONSULTATION_PROTOCOL.zh-CN.md)

---

## 参与开源开发

我们欢迎：

- 更多 AI 网站；
- 更多语言；
- 更好的协商机制；
- “谁影响了谁”的可视化；
- Replay；
- 更安全、更稳定的浏览器 Adapter。

```bash
npm install
npm run check
npm test
npm run build:extension
```

主 Side Panel 的新功能应同时维护中文和英文，并继续遵守平等参与者语义。

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

<div align="center">

**ChatChat — 一个提案，多种独立思想。**

MIT

</div>
