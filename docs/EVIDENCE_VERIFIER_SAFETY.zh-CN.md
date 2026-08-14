# Evidence Verifier 安全边界

ChatChat 会把 AI 参与者声明的每一个 URL 都视为不可信输入。Source Observation 是一个有严格边界的证据观察工具，不是通用浏览器或爬虫。

## 当前 verifier 保证什么

发起请求之前，ChatChat 只接受使用默认端口的普通 `http` / `https` URL。它会拒绝 localhost、单标签内网主机名、常见本地服务后缀、非公网 IPv4 范围，以及非公网 / 过渡用途的 IPv6 字面地址。URL 中嵌入的账号密码和 fragment 也会被移除。

请求不会携带凭据，不发送 referrer，不使用缓存，8 秒超时，最多读取 256 KiB。Verifier **绝不会自动跟随 HTTP 重定向**。如果来源发生跳转，ChatChat 会 fail closed，并要求用户直接提供最终的公开 URL。

“禁止自动跟随重定向”是一条安全不变量：如果先跟随、再检查最终 URL，请求其实已经发出，安全检查就已经太晚了。

## 当前 verifier 不承诺什么

一个看起来是公网的域名，理论上可能随着时间解析到不同地址，也可能解析到非公网基础设施。当前 Stable 浏览器架构不会在 `fetch` 之前预解析并证明 DNS 结果，因此 ChatChat **不会宣称已经彻底解决 DNS rebinding**。

也不要为了“解决”这个限制，悄悄把用户提供的证据域名发送给第三方 DNS 服务。那会引入新的隐私边界，必须经过明确的产品与安全决策。

## 贡献者不变量

Evidence fetch 路径必须保持 `redirect: "manual"`。不要为了短链接兼容或使用便利重新引入 `redirect: "follow"`。如果发现新的非公网地址形式，应当保守地扩展本地 URL 边界，并把 `tests/source-extract.test.mjs` 保持为可执行的安全契约。
