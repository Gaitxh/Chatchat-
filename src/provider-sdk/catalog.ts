import type {
  ProviderAdapterManifest,
  ProviderDetection,
} from "./types.js";

const TAUGHT_BROWSER_VERSION = "0.9.0-taught-browser";

export const BUILT_IN_PROVIDER_MANIFESTS: readonly ProviderAdapterManifest[] = [
  {
    id: "web.chatgpt",
    providerId: "openai-chatgpt",
    displayName: "ChatGPT",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["chatgpt.com"],
    defaultUrl: "https://chatgpt.com/",
    monogram: "G",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.claude",
    providerId: "anthropic-claude",
    displayName: "Claude",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["claude.ai"],
    defaultUrl: "https://claude.ai/",
    monogram: "C",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.gemini",
    providerId: "google-gemini",
    displayName: "Gemini",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["gemini.google.com"],
    defaultUrl: "https://gemini.google.com/app",
    monogram: "Gm",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.deepseek",
    providerId: "deepseek-chat",
    displayName: "DeepSeek",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["chat.deepseek.com"],
    defaultUrl: "https://chat.deepseek.com/",
    monogram: "D",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.yuanbao",
    providerId: "tencent-yuanbao",
    displayName: "Yuanbao · 元宝",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["yuanbao.tencent.com"],
    defaultUrl: "https://yuanbao.tencent.com/",
    monogram: "Yb",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.tongyi",
    providerId: "alibaba-tongyi",
    displayName: "Tongyi · 通义",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["tongyi.aliyun.com"],
    defaultUrl: "https://tongyi.aliyun.com/",
    monogram: "Ty",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
  {
    id: "web.grok",
    providerId: "xai-grok",
    displayName: "Grok",
    version: TAUGHT_BROWSER_VERSION,
    domains: ["grok.com"],
    defaultUrl: "https://grok.com/",
    monogram: "X",
    capabilities: {
      webLogin: true,
      streaming: true,
      councilTurns: true,
    },
  },
];

export function detectProviderUrl(input: string): ProviderDetection {
  const url = normalizeHttpUrl(input);
  const manifest = BUILT_IN_PROVIDER_MANIFESTS.find((candidate) =>
    candidate.domains.some((domain) => hostMatches(url.hostname, domain)),
  );

  if (manifest) {
    return {
      kind: "known",
      manifest,
      normalizedUrl: url.href,
      origin: url.origin,
      hostname: url.hostname,
      displayName: manifest.displayName,
      providerId: manifest.providerId,
      adapterId: manifest.id,
    };
  }

  return {
    kind: "custom",
    manifest: null,
    normalizedUrl: url.href,
    origin: url.origin,
    hostname: url.hostname,
    displayName: humanizeHostname(url.hostname),
    providerId: "custom",
    adapterId: "custom.browser",
  };
}

export function normalizeHttpUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("请输入一个 AI 网站 URL。");

  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("这个 URL 无法解析。");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ChatChat 目前只接受 http/https Provider URL。");
  }

  url.hash = "";
  return url;
}

function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLocaleLowerCase();
  const normalized = domain.toLocaleLowerCase();
  return host === normalized || host.endsWith(`.${normalized}`);
}

function humanizeHostname(hostname: string): string {
  return hostname
    .replace(/^www\./i, "")
    .split(".")[0]
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Custom AI";
}
