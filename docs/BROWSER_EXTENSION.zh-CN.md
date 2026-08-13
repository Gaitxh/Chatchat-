# ChatChat 浏览器扩展

**你发起提案，让独立 AI 平等协商。**

ChatChat 直接工作在用户本来就在使用的 AI 网站旁边。用户不需要再注册一个 ChatChat 云端账号，也不需要把会话先发送到 ChatChat 服务器。扩展直接连接浏览器中已经打开、已经登录的 AI 标签页。

## 从源码安装

```bash
npm install
npm run build:extension
```

然后打开 Chrome / Chromium：

```text
chrome://extensions
→ 开发者模式
→ 加载已解压的扩展程序
→ 选择 dist-extension/
```

点击 ChatChat 工具栏按钮即可打开 Side Panel。

## 添加 AI 参与者

可以：

- 打开一个 AI 网站，然后选择“当前标签页参加”；
- 从 ChatChat 已发现的 AI 标签页中选择；
- 粘贴任意 AI URL，让 ChatChat 帮你打开；
- 使用“快速打开”进入已经识别的 Provider。

当前内置识别：

- ChatGPT
- Claude
- Gemini
- DeepSeek
- 元宝
- 通义
- Grok
- Qwen

其他普通 `http/https` AI 网站仍然可以尝试走通用浏览器 Adapter 流程。

“识别”只是方便用户找到入口，并不等于承诺远程网页永远兼容。

## 每个 AI 来源一个平等参与者

主协商体验刻意避免重复席位造成权重膨胀：

```text
ChatGPT      1 位参与者
Claude       1 位参与者
Gemini       1 位参与者
DeepSeek     1 位参与者
```

打开五个 ChatGPT 标签页，不会让 ChatGPT 获得五倍权重。

目标是让**不同 AI 来源作为平等的独立参与者协商**。

单次协商默认最多 8 位参与者。

## 教 ChatChat 认识页面

不同 AI 网站没有统一 DOM/API，因此 ChatChat 提供一个本地 Teach 流程。

每个 AI 页面只需要告诉 ChatChat：

```text
1. 输入框 / Composer
2. 发送按钮
3. 回复区域
```

Recipe 保存的是元素定位，不是用户的聊天正文。

随后运行“验证参与者”：

```text
连通测试
  ↓
结构化协商协议握手
  ↓
READY
```

只有验证通过的参与者才能进入真实协商。

## 发起协商

用户输入一次“用户提案”，然后点击“开始协商”。

ChatChat 自动完成：

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

## AI 之间如何交流

共享空间中的事件是结构化的：

```text
立场
质疑
证据
支持
答辩
追问
修正
让步
不确定
最终立场
```

如果其他参与者的论点或证据足够好，一个 AI 可以明确修改自己的旧立场。

## 没有主席模型

ChatChat 不指定一个 AI 作为“主席”替所有模型写最终判决。

协商结果来自各参与者自己的最终立场，不同意见继续保留。

界面可以很有戏剧感，但底层不能偷偷制造等级。

## 双语

Side Panel 第一版同时提供：

- English
- 简体中文

用户可以在顶部直接切换，语言偏好保存在扩展自己的本地存储中。

## 权限与隐私

扩展把 Provider 域名声明为 **optional host permissions**。

只有当用户主动把某个 AI 来源加入 ChatChat 时，浏览器才会弹出对应网站的权限请求。之后 ChatChat 通过隔离的 content-script bridge 和页面通信。

ChatChat 自己没有中转服务器。

如果参与者是在线 AI，那么用户提案和必要的协商上下文仍然会直接发送给那个 AI Provider。Local-first 的含义是 ChatChat 不再在中间增加一台自己的中央服务器。

## CI 中的真实构建展示

production extension 提供一个只用于 CI 的 deterministic showcase：

```text
extension/sidepanel.html?showcase=consultation&lang=en
extension/sidepanel.html?showcase=consultation&lang=zh
```

它模拟三个已经连接的 AI 参与者，并真正驱动构建后的 Side Panel 完成：

```text
验证
→ 独立意见
→ 共同协商
→ 一位 AI 改口
→ 最终立场
```

因此 README 截图可以来自真实 production build，同时又不需要 CI 登录真实第三方账号，也不会把私人聊天内容放进开源仓库。

## 协商协议

- 中文：[`CONSULTATION_PROTOCOL.zh-CN.md`](CONSULTATION_PROTOCOL.zh-CN.md)
- English：[`CONSULTATION_PROTOCOL.md`](CONSULTATION_PROTOCOL.md)
