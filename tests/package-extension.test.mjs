import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { buildLocalPackage, readTree, writeOrCheckPackage } from "../scripts/package-extension.mjs";
import { assertSafePath, createStoredZip, crc32, ZIP_LIMITS } from "../scripts/zip-store.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (data) => createHash("sha256").update(data).digest("hex");
const binary = Buffer.from(Array.from({ length: 256 }, (_, index) => index));

// Independent bit-at-a-time CRC and ZIP reader: verify the archive bytes, not
// merely the writer's internal representation or the presence of a ZIP suffix.
function independentCrc(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function unzip(data) {
  const end = data.length - 22;
  assert.equal(data.readUInt32LE(end), 0x06054b50);
  assert.equal(data.readUInt16LE(end + 4), 0);
  assert.equal(data.readUInt16LE(end + 6), 0);
  assert.equal(data.readUInt16LE(end + 20), 0);
  const count = data.readUInt16LE(end + 10);
  assert.equal(data.readUInt16LE(end + 8), count);
  let central = data.readUInt32LE(end + 16);
  assert.equal(central + data.readUInt32LE(end + 12), end);
  const centralStart = central;
  const files = new Map();
  let nextLocal = 0;
  for (let index = 0; index < count; index++) {
    assert.equal(data.readUInt32LE(central), 0x02014b50);
    assert.equal(data.readUInt16LE(central + 8), 0x0800);
    assert.equal(data.readUInt16LE(central + 10), 0);
    assert.equal(data.readUInt16LE(central + 12), 0);
    assert.equal(data.readUInt16LE(central + 14), 0x21);
    const crc = data.readUInt32LE(central + 16);
    const size = data.readUInt32LE(central + 24);
    assert.equal(data.readUInt32LE(central + 20), size);
    const length = data.readUInt16LE(central + 28);
    assert.equal(data.readUInt16LE(central + 30), 0);
    assert.equal(data.readUInt16LE(central + 32), 0);
    assert.equal(data.readUInt32LE(central + 38), 0);
    const local = data.readUInt32LE(central + 42);
    assert.equal(local, nextLocal);
    const nameBytes = data.subarray(central + 46, central + 46 + length);
    const name = nameBytes.toString("utf8");
    assert.ok(!files.has(name));
    assert.equal(data.readUInt32LE(local), 0x04034b50);
    assert.equal(data.readUInt16LE(local + 6), 0x0800);
    assert.equal(data.readUInt16LE(local + 8), 0);
    assert.equal(data.readUInt16LE(local + 10), 0);
    assert.equal(data.readUInt16LE(local + 12), 0x21);
    assert.equal(data.readUInt32LE(local + 14), crc);
    assert.equal(data.readUInt32LE(local + 18), size);
    assert.equal(data.readUInt32LE(local + 22), size);
    assert.equal(data.readUInt16LE(local + 26), length);
    assert.equal(data.readUInt16LE(local + 28), 0);
    assert.deepEqual(data.subarray(local + 30, local + 30 + length), nameBytes);
    const body = data.subarray(local + 30 + length, local + 30 + length + size);
    assert.equal(body.length, size);
    assert.equal(independentCrc(body), crc);
    files.set(name, body);
    nextLocal = local + 30 + length + size;
    central += 46 + length;
  }
  assert.equal(nextLocal, centralStart);
  assert.equal(central, end);
  return files;
}

function put(root, name, data) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}

function fixture(t) {
  const base = path.join(repo, ".chatchat");
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, "package-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  put(root, "package.json", JSON.stringify({ name: "chatchat", version: "0.9.0" }));
  const manifest = { manifest_version: 3, name: "ChatChat", version: "0.9.0", action: {}, optional_host_permissions: ["https://*/*"], background: { service_worker: "service-worker.js" }, side_panel: { default_path: "extension/sidepanel.html" } };
  const publicFiles = new Map([
    ["manifest.json", JSON.stringify(manifest)],
    ["service-worker.js", 'import "./room-launcher.js";'],
    ["content-script.js", "// isolated bridge fixture"],
    ["room-launcher.js", "export const fixture = true;"],
    ["welcome.html", '<link rel="stylesheet" href="welcome.css"><script src="welcome.js"></script>'],
    ["welcome.css", "body { color: black; }"],
    ["welcome.js", "// welcome fixture"],
    ["binary.dat", binary],
  ]);
  for (const [name, data] of publicFiles) {
    put(root, `extension-public/${name}`, data);
    put(root, `dist-extension/${name}`, data);
  }
  for (const name of ["app/app.html", "extension/sidepanel.html"]) put(root, `dist-extension/${name}`, '<script type="module" src="/assets/room.js"></script><link rel="stylesheet" href="/assets/room.css">');
  put(root, "dist-extension/assets/room.js", "// compiled fixture");
  put(root, "dist-extension/assets/room.css", "body { margin: 0; }");
  put(root, "dist-extension/assets/extra/nested.bin", binary);
  for (const { name, data } of readTree(path.join(repo, "packaging"))) put(root, `packaging/${name}`, data);
  for (const name of ["LOCAL_INSTALL.md", "LOCAL_INSTALL.zh-CN.md", "RELEASE.md", "LOCAL_DESKTOP_ROADMAP.zh-CN.md"]) put(root, `docs/${name}`, fs.readFileSync(path.join(repo, "docs", name)));
  return root;
}

function rewriteManifest(root, change) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "dist-extension/manifest.json")));
  change(manifest);
  for (const dir of ["dist-extension", "extension-public"]) put(root, `${dir}/manifest.json`, JSON.stringify(manifest));
}

test("stored ZIP round-trips binary, empty and UTF-8 entries with standard CRC and deterministic headers", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const entries = [{ name: "extension/字节.bin", data: binary }, { name: "empty", data: Buffer.alloc(0) }, { name: "a.txt", data: Buffer.from("one") }];
  const archive = createStoredZip(entries);
  assert.deepEqual(archive, createStoredZip([...entries].reverse()));
  const extracted = unzip(archive);
  for (const { name, data } of entries) assert.deepEqual(extracted.get(name), data);
  const corrupt = Buffer.from(archive);
  corrupt[30 + Buffer.byteLength("a.txt")] ^= 0xff;
  assert.throws(() => unzip(corrupt));
});

test("ZIP rejects traversal, platform-unsafe paths, collisions and bounded-size violations", () => {
  for (const name of ["/absolute", "../escape", "a/../escape", "a/./b", "a//b", "a\\b", "C:/file", "x\0y", "x\ny", "a/", "a.", "a ", "CON", "aux.txt", "x/LPT1.txt", "x?.js", "x".repeat(241), `${"a/".repeat(24)}file`]) assert.throws(() => assertSafePath(name), /Unsafe archive path/);
  const entry = (name, data = Buffer.alloc(0)) => ({ name, data });
  for (const entries of [[entry("A"), entry("a")], [entry("é"), entry("e\u0301")], [entry("a"), entry("a/b")]]) assert.throws(() => createStoredZip(entries), /Duplicate|collision/);
  assert.throws(() => createStoredZip([]), /count limit/);
  assert.throws(() => createStoredZip(Array.from({ length: ZIP_LIMITS.files + 1 }, (_, index) => entry(`f${index}`))), /count limit/);
  const large = Buffer.alloc(ZIP_LIMITS.fileBytes + 1);
  assert.throws(() => createStoredZip([entry("large", large)]), /file size limit/);
  const chunk = large.subarray(0, ZIP_LIMITS.fileBytes);
  assert.throws(() => createStoredZip(Array.from({ length: 5 }, (_, index) => entry(`f${index}`, chunk))), /total size limit/);
});

test("package includes the whole production tree, offline bilingual guide and verifiable checksums", (t) => {
  const root = fixture(t);
  const bundle = buildLocalPackage(root);
  assert.equal(bundle.filename, "chatchat-0.9.0-unsigned-developer-preview.zip");
  assert.deepEqual(bundle.files.get(bundle.filename), buildLocalPackage(root).files.get(bundle.filename));
  const files = unzip(bundle.files.get(bundle.filename));
  const built = readTree(path.join(root, "dist-extension"));
  assert.deepEqual([...files.keys()].filter((name) => name.startsWith("extension/")).sort(), built.map(({ name }) => `extension/${name}`).sort());
  for (const { name, data } of built) assert.deepEqual(files.get(`extension/${name}`), data);
  const guide = files.get("START-HERE.html").toString("utf8");
  assert.match(guide, /lang="zh-CN"/);
  assert.match(guide, /Unsigned developer preview/);
  assert.match(guide, /same browser profile/);
  assert.doesNotMatch(guide, /<script\b|https?:\/\//);
  const metadata = JSON.parse(files.get("RELEASE-METADATA.json"));
  assert.equal(metadata.version, "0.9.0");
  assert.equal(metadata.distribution, "unsigned-developer-preview");
  assert.deepEqual(metadata.source, { commit: null, workingTree: "unknown" });
  assert.ok(!JSON.stringify(metadata).includes(repo));
  const verify = (checksums, payload) => {
    const lines = checksums.toString("utf8").trim().split("\n");
    assert.equal(lines.length, payload.size);
    for (const line of lines) {
      const [, hash, name] = /^([a-f\d]{64})  (.+)$/.exec(line);
      assert.ok(payload.has(name));
      assert.equal(sha(payload.get(name)), hash);
    }
  };
  const inner = new Map(files);
  inner.delete("SHA256SUMS");
  verify(files.get("SHA256SUMS"), inner);
  verify(bundle.files.get("SHA256SUMS"), new Map([...bundle.files].filter(([name]) => name !== "SHA256SUMS")));
  writeOrCheckPackage(bundle, root);
  writeOrCheckPackage(bundle, root, true);
  put(root, `dist/local-package/${bundle.filename}`, "tampered");
  assert.throws(() => writeOrCheckPackage(bundle, root, true), /inconsistent/);
  assert.equal(fs.readFileSync(path.join(root, "dist/local-package", bundle.filename), "utf8"), "tampered");
});

test("package fails on missing builds, inconsistent manifests, public assets and compiled entry assets", (t) => {
  const cases = [
    ["no build", (root) => fs.rmSync(path.join(root, "dist-extension"), { recursive: true }), /missing directory/],
    ["version", (root) => rewriteManifest(root, (manifest) => { manifest.version = "0.9.1"; }), /version mismatch/],
    ["permissions", (root) => rewriteManifest(root, (manifest) => { manifest.host_permissions = ["https://*/*"]; }), /permissions/],
    ["missing worker", (root) => fs.unlinkSync(path.join(root, "dist-extension/service-worker.js")), /missing\/empty/],
    ["missing new welcome", (root) => fs.unlinkSync(path.join(root, "dist-extension/welcome.js")), /missing\/empty/],
    ["stale public launcher", (root) => put(root, "extension-public/room-launcher.js", "// changed"), /differs/],
    ["missing compiled asset", (root) => fs.unlinkSync(path.join(root, "dist-extension/assets/room.css")), /missing\/empty/],
    ["uncompiled HTML", (root) => put(root, "dist-extension/app/app.html", '<script src="/src/main.ts"></script>'), /unbuilt/],
    ["remote HTML", (root) => put(root, "dist-extension/app/app.html", '<script src="https://example.invalid/script.js"></script>'), /remote/],
    ["missing guide", (root) => fs.unlinkSync(path.join(root, "packaging/START-HERE.html")), /missing START/],
    ["missing offline stylesheet", (root) => fs.unlinkSync(path.join(root, "packaging/start-here.css")), /guide link/],
    ["missing document", (root) => fs.unlinkSync(path.join(root, "docs/LOCAL_INSTALL.md")), /missing installation/],
    ["guide script", (root) => put(root, "packaging/START-HERE.html", '<script src="local.js"></script>'), /script-free/],
  ];
  for (const [name, change, expected] of cases) {
    const root = fixture(t);
    change(root);
    assert.throws(() => buildLocalPackage(root), expected, name);
    assert.ok(!fs.existsSync(path.join(root, "dist/local-package")), "failure must not create output");
  }
});

test("filesystem inputs and destinations reject file/directory/broken symlinks", (t) => {
  for (const target of ["dist-extension/assets/link.bin", "dist-extension/linked-dir", "dist-extension/broken"]) {
    const root = fixture(t);
    const destination = target.endsWith("linked-dir") ? path.join(root, "extension-public") : target.endsWith("broken") ? path.join(root, "missing") : path.join(root, "extension-public/binary.dat");
    fs.symlinkSync(destination, path.join(root, target));
    assert.throws(() => buildLocalPackage(root), /symlinks/);
  }
  const root = fixture(t);
  const bundle = buildLocalPackage(root);
  fs.mkdirSync(path.join(root, "dist/local-package"), { recursive: true });
  fs.symlinkSync(path.join(root, "missing"), path.join(root, "dist/local-package", bundle.filename));
  assert.throws(() => writeOrCheckPackage(bundle, root), /unsafe output file/);
  assert.ok(!fs.existsSync(path.join(root, "missing")));
  fs.unlinkSync(path.join(root, "dist/local-package", bundle.filename));
  fs.rmdirSync(path.join(root, "dist/local-package"));
  fs.symlinkSync(path.join(root, "extension-public"), path.join(root, "dist/local-package"));
  assert.throws(() => writeOrCheckPackage(bundle, root), /unsafe output directory/);
});

test("tree traversal rejects case collisions and file-size overflow before reading", (t) => {
  const root = fixture(t);
  put(root, "dist-extension/UPPER.js", "one");
  put(root, "dist-extension/upper.js", "two");
  const archiveRoot = path.join(root, "dist-extension");
  const caseVariants = fs.readdirSync(archiveRoot).filter((name) => name.toLowerCase() === "upper.js");
  if (caseVariants.length === 2) {
    // Case-sensitive filesystems can hold both names: readTree must reject them.
    assert.throws(() => readTree(archiveRoot), /collision/);
    fs.unlinkSync(path.join(archiveRoot, "UPPER.js"));
  } else {
    // Windows' default case-insensitive filesystem aliases those two names.
    // Keep cross-platform collision protection covered at the ZIP entry layer.
    assert.equal(caseVariants.length, 1);
    assert.throws(() => createStoredZip([
      { name: "UPPER.js", data: Buffer.from("one") },
      { name: "upper.js", data: Buffer.from("two") },
    ]), /Duplicate archive path/);
  }
  fs.truncateSync(path.join(root, "dist-extension/upper.js"), ZIP_LIMITS.fileBytes + 1);
  assert.throws(() => readTree(path.join(root, "dist-extension")), /size limit/);
});
