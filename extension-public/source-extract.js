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
  if (url.port) {
    throw new Error("ChatChat evidence verification only allows the default http/https port.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("ChatChat does not verify localhost, private-network, or non-public evidence URLs.");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  return url;
}

export function isPrivateHost(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (host.includes("%")) return true;
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".localdomain")
    || host.endsWith(".lan")
    || host === "home.arpa"
    || host.endsWith(".home.arpa")
  ) return true;

  // Single-label names are ordinary intranet/service-discovery hosts, not public
  // evidence locations. Public IPv6 literals are handled separately below.
  if (!host.includes(".") && !host.includes(":")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part < 0 || part > 255)) return true;
    return isNonPublicIpv4(parts);
  }

  if (host.includes(":")) {
    const words = parseIpv6Words(host);
    return !words || isNonPublicIpv6(words);
  }

  return false;
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

function normalizeHost(hostname) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
}

function isNonPublicIpv4(parts) {
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || (a === 100 && b >= 64 && b <= 127)
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function parseIpv6Words(host) {
  let value = host;
  if (value.includes("%")) return null;

  // Accept a dotted IPv4 tail defensively even though URL normalisation usually
  // converts it into hexadecimal words before this function is reached.
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    if (lastColon < 0) return null;
    const ipv4 = value.slice(lastColon + 1).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) return null;
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part < 0 || part > 255)) return null;
    const high = ((parts[0] << 8) | parts[1]).toString(16);
    const low = ((parts[2] << 8) | parts[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }

  const compression = value.indexOf("::");
  if (compression !== -1 && value.indexOf("::", compression + 2) !== -1) return null;

  const leftText = compression === -1 ? value : value.slice(0, compression);
  const rightText = compression === -1 ? "" : value.slice(compression + 2);
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  if (compression === -1 && left.length !== 8) return null;
  if (compression !== -1 && left.length + right.length >= 8) return null;

  const parse = (part) => /^[0-9a-f]{1,4}$/i.test(part) ? Number.parseInt(part, 16) : Number.NaN;
  const leftWords = left.map(parse);
  const rightWords = right.map(parse);
  if ([...leftWords, ...rightWords].some((word) => !Number.isFinite(word))) return null;

  if (compression === -1) return leftWords;
  const fill = new Array(8 - leftWords.length - rightWords.length).fill(0);
  return [...leftWords, ...fill, ...rightWords];
}

function isNonPublicIpv6(words) {
  if (words.length !== 8) return true;
  if (words.every((word) => word === 0)) return true;
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true;

  const first = words[0];
  if ((first & 0xfe00) === 0xfc00) return true; // Unique-local fc00::/7.
  if ((first & 0xffc0) === 0xfe80) return true; // Link-local fe80::/10.
  if ((first & 0xffc0) === 0xfec0) return true; // Deprecated site-local range.
  if ((first & 0xff00) === 0xff00) return true; // Multicast ff00::/8.

  // Documentation and transition mechanisms are not useful evidence endpoints
  // and can encapsulate IPv4 addresses in surprising ways.
  if (first === 0x2001 && (words[1] === 0 || words[1] === 0x0db8)) return true;
  if (first === 0x2002) return true;
  if (first === 0x0064 && words[1] === 0xff9b) return true;

  // IPv4-compatible and IPv4-mapped forms are unnecessary for a verifier and
  // are rejected rather than trying to infer public reachability through them.
  if (words.slice(0, 6).every((word) => word === 0)) return true;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) return true;

  return false;
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