export const PROVIDERS = [
  {
    id: "openai-chatgpt",
    name: "ChatGPT",
    shortName: "GPT",
    monogram: "G",
    startUrl: "https://chatgpt.com/",
    host: "chatgpt.com",
  },
  {
    id: "anthropic-claude",
    name: "Claude",
    shortName: "Claude",
    monogram: "C",
    startUrl: "https://claude.ai/",
    host: "claude.ai",
  },
  {
    id: "google-gemini",
    name: "Gemini",
    shortName: "Gemini",
    monogram: "Gm",
    startUrl: "https://gemini.google.com/app",
    host: "gemini.google.com",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek",
    shortName: "DeepSeek",
    monogram: "D",
    startUrl: "https://chat.deepseek.com/",
    host: "chat.deepseek.com",
  },
  {
    id: "tencent-yuanbao",
    name: "Tencent Yuanbao · 腾讯元宝",
    shortName: "元宝",
    monogram: "元",
    startUrl: "https://yuanbao.tencent.com/",
    host: "yuanbao.tencent.com",
  },
  {
    id: "alibaba-tongyi",
    name: "Qwen / Tongyi · 通义",
    shortName: "Qwen",
    monogram: "Q",
    startUrl: "https://tongyi.aliyun.com/",
    host: "tongyi.aliyun.com",
  },
  {
    id: "xai-grok",
    name: "Grok",
    shortName: "Grok",
    monogram: "X",
    startUrl: "https://grok.com/",
    host: "grok.com",
  },
];

export function detectProvider(urlLike) {
  const url = safeUrl(urlLike);
  const provider = PROVIDERS.find((item) =>
    url.hostname === item.host || url.hostname.endsWith(`.${item.host}`),
  );
  if (provider) {
    return {
      ...provider,
      origin: url.origin,
      inputUrl: url.href,
      kind: "known",
    };
  }

  const name = humanize(url.hostname);
  return {
    id: `custom:${url.hostname}`,
    name,
    shortName: name,
    monogram: name.slice(0, 2),
    startUrl: url.href,
    inputUrl: url.href,
    host: url.hostname,
    origin: url.origin,
    kind: "custom",
  };
}

export function permissionPattern(urlLike) {
  const url = safeUrl(urlLike);
  return `${url.protocol}//${url.host}/*`;
}

export function safeUrl(input) {
  const value = String(input ?? "").trim();
  if (!value) throw new Error("请输入 AI 网站 URL。");
  const normalized = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`;
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ChatChat 插件只连接 http/https AI 页面。");
  }
  url.hash = "";
  return url;
}

export function delegationId(provider) {
  const safe = provider.id.replace(/[^a-z0-9_-]+/gi, "-");
  return `delegation:${safe}`;
}

function humanize(host) {
  return (
    host
      .replace(/^www\./i, "")
      .split(".")[0]
      ?.replace(/[-_]+/g, " ") || "Custom AI"
  );
}
