import {
  extractDateSignal,
  extractDescription,
  extractReadableText,
  extractTitle,
  isPrivateHost,
  isTextualContent,
  observeTextSource,
  publicEvidenceUrl,
} from "../extension-public/source-extract.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const html = `<!doctype html><html><head>
<title>  ChatChat &amp; Evidence  </title>
<meta content="A bounded source description." name="description">
<meta content="2026-07-01T12:30:00Z" property="article:published_time">
<script>window.secret = "must not appear";</script>
<style>.secret{display:none}</style>
</head><body><main><h1>Evidence page</h1><p>Visible source text that should survive static extraction.</p></main></body></html>`;

assert(extractTitle(html) === "ChatChat & Evidence", "HTML title should be decoded and normalized.");
assert(extractDescription(html) === "A bounded source description.", "Meta description should work regardless of attribute order.");
const date = extractDateSignal(html);
assert(date?.kind === "published" && date.value.startsWith("2026-07-01"), "Published date meta should become a page date signal.");
const readable = extractReadableText(html);
assert(readable.includes("Visible source text"), "Visible body text should remain.");
assert(!readable.includes("must not appear"), "Script text must not enter the bounded excerpt.");
assert(!readable.includes("display:none"), "Style text must not enter the bounded excerpt.");
assert(isTextualContent("text/html; charset=utf-8", html), "HTML should be classified as textual.");

const observation = await observeTextSource(html, "text/html");
assert(observation.title === "ChatChat & Evidence", "Observation should reuse the exact title extractor.");
assert(observation.description === "A bounded source description.", "Observation should include page description.");
assert(observation.pageDateKind === "published", "Observation should preserve date signal provenance.");
assert(observation.excerpt?.includes("Visible source text"), "Observation should expose a bounded readable excerpt.");
assert(observation.excerpt.length <= 720, "Observation excerpt must stay bounded.");
assert(/^sha256:[0-9a-f]{24}$/.test(observation.bodyHash ?? ""), "Observation should include a short SHA-256 fingerprint.");

const jsonLd = `<script type="application/ld+json">{"dateModified":"2025-01-02T00:00:00Z"}</script><p>Page</p>`;
const jsonDate = extractDateSignal(jsonLd);
assert(jsonDate?.kind === "modified", "JSON-LD dateModified should be recognized as a date signal.");

assert(isPrivateHost("localhost"), "localhost must be blocked.");
assert(isPrivateHost("127.0.0.1"), "loopback IPv4 must be blocked.");
assert(isPrivateHost("192.168.1.10"), "private IPv4 must be blocked.");
assert(!isPrivateHost("developer.chrome.com"), "ordinary public hosts must remain eligible.");
const safe = publicEvidenceUrl("https://user:secret@example.com/report#section");
assert(safe.username === "" && safe.password === "", "Credentials embedded in source URLs must be removed.");
let rejected = false;
try { publicEvidenceUrl("http://10.0.0.8/private"); } catch { rejected = true; }
assert(rejected, "Private network evidence URLs must be rejected.");

console.log("✓ ChatChat service-worker Source Observation extraction tests passed");
