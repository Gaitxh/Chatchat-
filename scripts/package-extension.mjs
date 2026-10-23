import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSafePath, createStoredZip, ZIP_LIMITS } from "./zip-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCUMENTS = ["LOCAL_INSTALL.md", "LOCAL_INSTALL.zh-CN.md", "RELEASE.md", "LOCAL_DESKTOP_ROADMAP.zh-CN.md"];
const digest = (data) => createHash("sha256").update(data).digest("hex");
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const fail = (message) => { throw new Error(`Local package: ${message}`); };

// Read only regular files. Bound traversal and memory before reading any payload.
export function readTree(root, selectedNames) {
  if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) fail("missing directory or symlink");
  const files = [];
  const names = new Set();
  let bytes = 0;
  function visit(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!prefix && selectedNames && !selectedNames.has(entry)) continue;
      const name = assertSafePath(`${prefix}${entry}`);
      const key = name.normalize("NFC").toLowerCase();
      if (names.has(key)) fail("case/Unicode path collision");
      names.add(key);
      // Directories count too, so many empty directories cannot bypass the bound.
      if (names.size > ZIP_LIMITS.files) fail("tree entry count limit");
      const target = path.join(dir, entry);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) fail("symlinks are forbidden");
      if (stat.isDirectory()) visit(target, `${name}/`);
      else {
        if (!stat.isFile() || stat.size > ZIP_LIMITS.fileBytes) fail("non-regular file or file size limit");
        bytes += stat.size;
        if (bytes > ZIP_LIMITS.totalBytes) fail("tree size limit");
        // O_NOFOLLOW also rejects a file changed to a symlink after lstat (where supported).
        const fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
        try {
          const current = fs.fstatSync(fd);
          if (!current.isFile() || current.size !== stat.size) fail("file changed while reading");
          const data = Buffer.alloc(stat.size);
          let read = 0;
          while (read < data.length) {
            const size = fs.readSync(fd, data, read, data.length - read, read);
            if (!size) fail("file changed while reading");
            read += size;
          }
          if (fs.fstatSync(fd).size !== stat.size) fail("file changed while reading");
          files.push({ name, data });
        } finally { fs.closeSync(fd); }
      }
    }
  }
  visit(root);
  return files;
}

function parseJson(data, label) {
  try { return JSON.parse(data.toString("utf8")); } catch { fail(`invalid ${label}`); }
}

function validateBuild(root, built, version) {
  const byName = new Map(built.map(({ name, data }) => [name, data]));
  function required(name) {
    assertSafePath(name);
    const data = byName.get(name);
    if (!data?.length) fail(`missing/empty extension artifact: ${name}`);
    return data;
  }
  const manifest = parseJson(required("manifest.json"), "manifest JSON");
  if (manifest.manifest_version !== 3 || manifest.version !== version) fail("manifest/package version mismatch or not Manifest V3");
  if (typeof manifest.name !== "string" || !manifest.name.trim()) fail("missing extension name");
  if (manifest.host_permissions || !Array.isArray(manifest.optional_host_permissions) || !manifest.optional_host_permissions.length) fail("site permissions must remain optional");
  if (!manifest.action || manifest.action.default_popup) fail("toolbar must launch the room");
  if (!manifest.background?.service_worker || !manifest.side_panel?.default_path) fail("missing worker or Side Panel entry");
  for (const name of [manifest.background.service_worker, manifest.side_panel.default_path, "app/app.html", "content-script.js"]) required(name);
  const icons = (value) => typeof value === "string" ? [value] : Object.values(value ?? {});
  for (const name of [...icons(manifest.icons), ...icons(manifest.action.default_icon)]) required(name);
  for (const script of manifest.content_scripts ?? []) for (const name of [...(script.js ?? []), ...(script.css ?? [])]) required(name);

  // Compare every public asset, not an allowlist. This includes new welcome.*,
  // room-launcher.js and any future public entry automatically copied by Vite.
  for (const { name, data } of readTree(path.join(root, "extension-public"))) {
    if (!required(name).equals(data)) fail(`public asset differs from production build: ${name}`);
  }
  if (!built.some(({ name, data }) => name.startsWith("assets/") && name.endsWith(".js") && data.length)) fail("missing compiled JavaScript assets");
  for (const { name, data } of built.filter(({ name }) => name.endsWith(".html"))) {
    const html = data.toString("utf8");
    if (/\b(?:src|href)\s*=\s*["'][^"']*\/src\//i.test(html)) fail("unbuilt source reference in HTML");
    for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const reference = match[1].split(/[?#]/)[0];
      if (!reference || reference.startsWith("data:")) continue;
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(reference)) fail("remote build asset reference");
      const resolved = reference.startsWith("/") ? reference.slice(1) : path.posix.join(path.posix.dirname(name), reference);
      required(resolved);
    }
  }
}

function sourceMetadata(root) {
  const options = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000, maxBuffer: 1024 * 1024 };
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], options).trim();
    if (path.resolve(top) !== root) return { commit: null, workingTree: "unknown" };
    const commit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], options).trim();
    if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/.test(commit)) fail("invalid commit metadata");
    const modified = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], options).length > 0;
    return { commit, workingTree: modified ? "modified" : "clean" };
  } catch { return { commit: null, workingTree: "unknown" }; }
}

export function buildLocalPackage(root = ROOT) {
  root = path.resolve(root);
  const pkg = parseJson(fs.readFileSync(path.join(root, "package.json")), "package JSON");
  if (pkg.name !== "chatchat" || typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(pkg.version)) fail("invalid package name/version for extension distribution");
  const built = readTree(path.join(root, "dist-extension"));
  validateBuild(root, built, pkg.version);
  const guide = readTree(path.join(root, "packaging"));
  if (!guide.some(({ name, data }) => name === "START-HERE.html" && data.length)) fail("missing START-HERE.html");
  // Only offline HTML/CSS is shipped; no installer scripts or network dependencies.
  if (guide.some(({ name }) => !/\.(html|css)$/.test(name))) fail("guide may only contain HTML/CSS");
  for (const { data } of guide) if (/<script\b|\b(?:src|href)\s*=\s*["']\s*(?:https?:|\/\/)|@import\b|url\s*\(/i.test(data.toString("utf8"))) fail("guide must be offline and script-free");
  const sourceDocs = new Map(readTree(path.join(root, "docs"), new Set(DOCUMENTS)).map(({ name, data }) => [name, data]));
  const docs = DOCUMENTS.map((name) => {
    const data = sourceDocs.get(name);
    if (!data?.length) fail(`missing installation/release document: ${name}`);
    return { name: `docs/${name}`, data };
  });
  const metadata = json({
    schemaVersion: 1,
    product: "ChatChat",
    version: pkg.version,
    distribution: "unsigned-developer-preview",
    signing: "unsigned; no store signature, code signing or notarization",
    source: sourceMetadata(root),
    build: "production Vite extension; complete dist-extension tree",
    install: "manual load-unpacked; no automatic installation or enterprise-policy changes",
    inference: "local orchestration; selected providers perform cloud inference",
    evidence: "packaging checks do not prove provider login or live compatibility",
  });
  const entries = [
    ...built.map(({ name, data }) => ({ name: `extension/${name}`, data })),
    ...guide,
    ...docs,
    { name: "RELEASE-METADATA.json", data: metadata },
  ];
  const payloadNames = new Set([...entries.map(({ name }) => name), "SHA256SUMS"]);
  for (const { name, data } of guide.filter(({ name }) => name.endsWith(".html"))) {
    for (const match of data.toString("utf8").matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const reference = match[1].split(/[?#]/)[0];
      if (!reference) continue;
      const target = path.posix.join(path.posix.dirname(name), reference);
      assertSafePath(target);
      if (!payloadNames.has(target)) fail("missing offline guide link target");
    }
  }
  const sums = Buffer.from(entries.slice().sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(({ name, data }) => `${digest(data)}  ${name}\n`).join(""));
  const filename = `chatchat-${pkg.version}-unsigned-developer-preview.zip`;
  const archive = createStoredZip([...entries, { name: "SHA256SUMS", data: sums }]);
  return {
    filename,
    files: new Map([
      [filename, archive],
      ["RELEASE-METADATA.json", metadata],
      ["SHA256SUMS", Buffer.from(`${digest(archive)}  ${filename}\n${digest(metadata)}  RELEASE-METADATA.json\n`)],
    ]),
    entries: entries.length + 1,
  };
}

export function writeOrCheckPackage(bundle, root = ROOT, check = false) {
  const output = path.join(root, "dist", "local-package");
  // Reject links in destination parents/files rather than following them.
  for (const dir of [root, path.join(root, "dist"), output]) {
    const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) fail("unsafe output directory");
  }
  for (const [name] of bundle.files) {
    assertSafePath(name);
    const target = path.join(output, name);
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) fail("unsafe output file");
  }
  if (!check) fs.mkdirSync(output, { recursive: true });
  for (const [name, data] of bundle.files) {
    const target = path.join(output, name);
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(data)) fail(`missing or inconsistent package output: ${name}`);
    } else fs.writeFileSync(target, data, { flag: "w" });
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== "--check")) fail("usage: node scripts/package-extension.mjs [--check]");
    const bundle = buildLocalPackage();
    writeOrCheckPackage(bundle, ROOT, args[0] === "--check");
    console.log(`✓ ${args[0] === "--check" ? "Verified" : "Packaged"} dist/local-package/${bundle.filename} (${bundle.entries} entries; unsigned developer preview)`);
  } catch (error) {
    // Controlled messages only: never emit filesystem paths or git diagnostics.
    console.error(error.message.startsWith("Local package:") || /^(Unsafe archive|Duplicate archive|Archive file|ZIP )/.test(error.message) ? error.message : "Local package: missing/unreadable input or invalid artifact; run npm run build:extension first.");
    process.exitCode = 1;
  }
}
