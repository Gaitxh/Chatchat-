import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { assertBrowserIntegrity } from "../runtime/browser-integrity.mjs";

const digest = (text) => createHash("sha256").update(text).digest("hex");
const names = ["chrome.exe", "chrome.dll", "resources.pak", "icudtl.dat"];

test("the pinned browser passes only when every critical file matches its exact SHA-256", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chatchat-bundle-proof-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const manifest = [];
  for (const name of names) {
    const contents = Buffer.from(`controlled-fixture:${name}`);
    await fs.writeFile(path.join(dir, name), contents);
    manifest.push({ name, bytes: contents.length, sha256: digest(contents) });
  }
  const exe = path.join(dir, "chrome.exe");
  assert.equal(await assertBrowserIntegrity(exe, manifest), true);
  // Tamper while preserving file size: a size-only check would miss this.
  await fs.writeFile(path.join(dir, "chrome.dll"), "x".repeat(manifest[1].bytes));
  await assert.rejects(assertBrowserIntegrity(exe, manifest), /damaged/);
  await fs.unlink(path.join(dir, "chrome.dll"));
  await assert.rejects(assertBrowserIntegrity(exe, manifest), /damaged/);
  await assert.rejects(assertBrowserIntegrity(path.join(dir, "other.exe"), manifest), /damaged/);
});

test("the locked production Chromium passes integrity checks at build time", {
  skip: !process.env.CHATCHAT_RENDERER_BROWSER,
}, async () => {
  const executable = process.env.CHATCHAT_RENDERER_BROWSER;
  const expected = path.join("chrome-win64", "chrome.exe").toLowerCase();
  if (!executable.toLowerCase().endsWith(expected)) return;
  assert.equal(await assertBrowserIntegrity(executable), true);
});
