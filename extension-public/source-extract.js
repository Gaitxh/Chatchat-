const MAX_DESCRIPTION_CHARS = 360;
const MAX_EXCERPT_CHARS = 720;

export async function observeTextSource(text, contentType) {
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

export function isTextualContent(contentType, text) {
  return /(?:text\/|json|xml|javascript|html)/i.test(contentType) || /^\s*[<{[]/.test(text);
}

export function publicEvidenceUrl(rawUrl) {
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

export function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function extractTitle(text) {
  const value = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return cleanHtmlText(value).slice(0, 240);
}

export function extractDescription(text) {
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

export function extractDateSignal(text) {
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
    if (value && looksLikeDate(value)) return { kind: key === "dateModified" ? "modified" : "published", value };
  }

  const timeTags = text.match(/<time\b[^>]*>/gi) ?? [];
  for (const tag of timeTags) {
    const value = attributeValue(tag, "datetime").trim();
    if (looksLikeDate(value)) return { kind: "page", value: value.slice(0, 80) };
  }
  return null;
}

export function extractReadableText(html) {
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
