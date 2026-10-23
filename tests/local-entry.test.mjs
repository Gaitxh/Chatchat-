import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert(!html.includes("history.replaceState"), "Web entry must not silently enter a demo.");
assert(!/<script\b/i.test(html), "Installation entry must not execute model, extension or fixture code.");
assert(!html.includes("consultation-showcase-bootstrap"), "No synthetic bridge on the ordinary web entry.");
assert(!html.includes("consultation-panel.tsx"), "Ordinary website must not pretend to be an installed extension.");
for (const phrase of ["不是真实会议", "START-HERE.html", "extension/", "Developer preview", "selected providers receive", "same browser profile"]) {
  assert(html.includes(phrase), `Missing installation/safety copy: ${phrase}`);
}
assert(/<details lang="en">/.test(html), "English instructions must remain available.");
assert(/<html lang="zh-CN">/.test(html), "Primary language must be declared.");
console.log("✓ Plain web entry is an honest bilingual installation guide, not an implicit synthetic meeting");
