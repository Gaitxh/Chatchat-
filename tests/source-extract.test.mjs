import fs from "node:fs";
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

for (const host of [
  "localhost",
  "api.localhost",
  "printer.local",
  "dev.localdomain",
  "router.lan",
  "home.arpa",
  "nas.home.arpa",
  "intranet",
  "0.0.0.0",
  "10.0.0.1",
  "100.64.0.1",
  "100.127.255.254",
  "127.0.0.1",
  "169.254.1.10",
  "172.16.0.1",
  "172.31.255.254",
  "192.168.1.10",
  "198.18.0.1",
  "224.0.0.1",
  "[::]",
  "[::1]",
  "[fc00::1]",
  "[fd12:3456::1]",
  "[fe80::1]",
  "[fec0::1]",
  "[ff02::1]",
  "[2001:db8::1]",
  "[2002:7f00:1::1]",
  "[::ffff:127.0.0.1]",
]) {
  assert(isPrivateHost(host), `${host} must be rejected as a non-public Evidence host.`);
}

assert(!isPrivateHost("developer.chrome.com"), "ordinary public hosts must remain eligible.");
assert(!isPrivateHost("2606:4700:4700::1111"), "ordinary global IPv6 hosts must remain eligible.");

const safe = publicEvidenceUrl("https://user:secret@example.com/report#section");
assert(safe.username === "" && safe.password === "", "Credentials embedded in source URLs must be removed.");
assert(safe.hash === "", "Evidence URL fragments should not enter verifier requests or provenance URLs.");

for (const unsafeUrl of [
  "http://10.0.0.8/private",
  "http://100.64.10.20/private",
  "http://intranet/report",
  "http://[fc00::10]/private",
  "http://[::ffff:127.0.0.1]/private",
  "https://example.com:8443/report",
  "http://example.com:8080/report",
]) {
  let rejected = false;
  try { publicEvidenceUrl(unsafeUrl); } catch { rejected = true; }
  assert(rejected, `${unsafeUrl} must be rejected before the Evidence verifier fetches it.`);
}

assert(
  publicEvidenceUrl("https://example.com:443/report").toString() === "https://example.com/report",
  "Explicit default HTTPS ports should normalize to the ordinary public URL.",
);

const serviceWorker = fs.readFileSync(new URL("../extension-public/service-worker.js", import.meta.url), "utf8");
assert(serviceWorker.includes('redirect: "manual"'), "Evidence fetch must never automatically follow redirects.");
assert(!serviceWorker.includes('redirect: "follow"'), "The old redirect-following Evidence fetch must not return.");
assert(serviceWorker.includes('response.type === "opaqueredirect"'), "Manual redirect responses must fail closed before body inspection.");
assert(serviceWorker.includes("ChatChat does not follow redirects for safety"), "Users should receive an explicit safe final-URL instruction for redirects.");

console.log("✓ ChatChat service-worker Source Observation extraction tests passed");
console.log("✓ ChatChat Evidence URL boundary rejects redirects and non-public literal targets");
