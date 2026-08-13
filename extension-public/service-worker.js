const MAX_EVIDENCE_BYTES = 256 * 1024;
const EVIDENCE_TIMEOUT_MS = 8_000;
const MAX_DESCRIPTION_CHARS = 360;
const MAX_EXCERPT_CHARS = 720;

const enablePanelOnAction = async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn("ChatChat could not enable action-click side panel behavior", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void enablePanelOnAction();
});

chrome.runtime.onStartup.addListener(() => {
  void enablePanelOnAction();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "VERIFY_EVIDENCE_SOURCE") return undefined;
  verifyEvidenceSource(String(message.url ?? ""))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  return true;
});

async function verifyEvidenceSource(rawUrl) {
  const url = publicEvidenceUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EVIDENCE_TIMEOUT_MS);
  const observedAt = new Date().toISOString();

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "omit",
      redirect: "follow",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.4",
      },
    });

    const finalUrl = publicEvidenceUrl(response.url || url.toString());
    const contentType = (response.headers.get("content-type") ?? "").slice(0, 160);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_EVIDENCE_BYTES * 4) {
      return {
        state: response.ok ? "reachable" : "unavailable",
        observedAt,
        requestedUrl: url.toString(),
        finalUrl: finalUrl.toString(),
        statusCode: response.status,
        contentType,
        bytesRead: 0,
        truncated: true,
        error: "Source response is too large for ChatChat's bounded verifier.",
      };
    }

    const body = await readBoundedText(response, MAX_EVIDENCE_BYTES);
    const observation = isTextualContent(contentType, body.text)
      ? await observeTextSource(body.text, contentType)
      : {};

    return {
      state: response.ok ? "reachable" : "unavailable",
      observedAt,
      requestedUrl: url.toString(),
      finalUrl: finalUrl.toString(),
      statusCode: response.status,
      contentType,
      ...observation,
      bytesRead: body.bytesRead,
      truncated: body.truncated,
      ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
    };
  } catch (error) {
    return {
      state: "unavailable",
      observedAt,
      requestedUrl: url.toString(),
      error: error?.name === "AbortError"
        ? "Source check timed out."
        : "Source could not be reached by the bounded verifier.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function observeTextSource(text, contentType) {
  const html = /html/i.test(contentType) || /<html[\s>]|<title[\s>]|<meta[\s>]/i.test(text);
  const normalizedText = html ? extractReadableText(text) : normalizeVisibleText(text);
  const title = html ? extractTitle(text) : "";
  const description = html ? extractDescription(text) : "";
  const date = html ? extractDateSignal(text) : null;
  const excerpt = normalizedText.slice(0, MAX_EXCERPT_CHARS);
  const bodyHash = await shortSha256(text);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(date ? { pageDate: date.value, pageDateKind: date.kind } : {}),
    ...(bodyHash ? { bodyHash } : {}),
    textCharacters: normalizedText.length,
  };
}

async function readBoundedText(response, maxBytes) {
  if (!response.body) return { text: "", bytesRead: 0, truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;
  let truncated = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - bytesRead;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      bytesRead += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength || bytesRead >= maxBytes) {
        truncated = true;
        break;
      }
    }
    text += decoder.decode();
  } finally {
    if (truncated) await reader.cancel().catch(() => undefined);
    else reader.releaseLock();
  }

  return { text, bytesRead, truncated };
}

function publicEvidenceUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Evidence source must use http or https.");
  }
  url.username = "";
  url.password = "";
  if (isPrivateHost(url.hostname)) {
    throw new Error("ChatChat does not verify localhost or private-network evidence URLs.");
  }
  return url;
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isTextualContent(contentType, text) {
  return /(?:text\/|json|xml|javascript|html)/i.test(contentType) || /^\s*[<{[]/.test(text);
}

function extractTitle(text) {
  const value = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return cleanHtmlText(value).slice(0, 240);
}

function extractDescription(text) {
  const tags = text.match(/<meta\b[^>]*>/gi) ?? [];
  for (const wanted of ["description", "og:description", "twitter:description"]) {
    for (const tag of tags) {
      const name = (attributeValue(tag, "name") || attributeValue(tag, "property")).toLowerCase();
      if (name !== wanted) continue;
      const content = cleanHtmlText(attributeValue(tag, "content"));
      if (content) return content.slice(0, MAX_DESCRIPTION_CHARS);
    }
  }
  return "";
}

function extractDateSignal(text) {
  const tags = text.match(/<meta\b[^>]*>/gi) ?? [];
  const groups = [
    { kind: "published", names: ["article:published_time", "datepublished", "citation_publication_date", "citation_date", "dc.date", "dcterms.date"] },
    { kind: "modified", names: ["article:modified_time", "datemodified", "last-modified", "lastmodified"] },
  ];
  for (const group of groups) {
    for (const tag of tags) {
      const name = (attributeValue(tag, "name") || attributeValue(tag, "property") || attributeValue(tag, "itemprop")).toLowerCase();
      if (!group.names.includes(name)) continue;
      const content = attributeValue(tag, "content").trim();
      if (looksLikeDate(content)) return { kind: group.kind, value: content.slice(0, 80) };
    }
  }

  for (const key of ["datePublished", "dateModified"]) {
    const pattern = new RegExp(`\\"${key}\\"\\s*:\\s*\\"([^\\"]{4,80})\\"`, "i");
    const value = text.match(pattern)?.[1]?.trim();
    if (value && looksLikeDate(value)) {
      return { kind: key === "dateModified" ? "modified" : "published", value };
    }
  }

  const timeTags = text.match(/<time\b[^>]*>/gi) ?? [];
  for (const tag of timeTags) {
    const value = attributeValue(tag, "datetime").trim();
    if (looksLikeDate(value)) return { kind: "page", value: value.slice(0, 80) };
  }
  return null;
}

function extractReadableText(html) {
  return normalizeVisibleText(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizeVisibleText(value) {
  return decodeBasicEntities(value).replace(/\s+/g, " ").trim();
}

function cleanHtmlText(value) {
  return normalizeVisibleText(value.replace(/<[^>]+>/g, " "));
}

function attributeValue(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function looksLikeDate(value) {
  if (!value || value.length < 4) return false;
  return /(?:19|20)\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

async function shortSha256(value) {
  try {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return `sha256:${[...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "";
  }
}

function decodeBasicEntities(value) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_match, digits) => {
      const code = Number(digits);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    });
}

void enablePanelOnAction();