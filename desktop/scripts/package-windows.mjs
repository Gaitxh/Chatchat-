import { spawnSync } from "node:child_process";
import { createReadStream, lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertBrowserIntegrity } from "../runtime/browser-integrity.mjs";
import { verifiedOfflineElectronZip } from "./offline-electron-dist.mjs";
import { verifySetupPayload } from "./verify-nsis-payload.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const { getCurrentFuseWire, FuseV1Options } = require("@electron/fuses");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "win32") throw new Error("Build Windows release candidates on Windows.");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const steps = [
  [path.join(root, "scripts/prepare-core.mjs")],
  [path.join(root, "scripts/download-browser.mjs")],
  [path.join(root, "node_modules/electron-builder/cli.js"), "--win", "nsis",
    "--x64", "--publish", "never"],
];
if (process.env.CHATCHAT_ELECTRON_DIST) {
  const zip = await verifiedOfflineElectronZip({
    zipPath: path.resolve(process.env.CHATCHAT_ELECTRON_DIST),
    version: pkg.devDependencies.electron,
    electronPackageRoot: path.join(root, 'node_modules/electron'),
  });
  // The override is only enabled after validating the official pinned hash.
  // CI builds with no override retain the normal upstream Electron download.
  steps[2].push('--config.electronDist=' + zip);
  console.log('Using locally verified Electron ZIP; network fetch unnecessary.');
}
for (let index = 0; index < steps.length; index++) {
  const result = spawnSync(process.execPath, steps[index], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
  if (index === 1) {
    await assertBrowserIntegrity(path.join(root, ".build-cache/browser/chrome-win64/chrome.exe"));
    console.log("Validated every critical pinned Chromium runtime file before packaging.");
  }
}

const unpacked = path.join(root, "release/win-unpacked");
// Verify actual Windows executable fuse bytes, not merely YAML intentions.
const fuseWire = await getCurrentFuseWire(path.join(unpacked, "ChatChat.exe"));
for (const name of ["EnableEmbeddedAsarIntegrityValidation", "OnlyLoadAppFromAsar"]) {
  const index = FuseV1Options[name];
  if (fuseWire?.[index] !== 49) {
    throw new Error("Required Electron fuse is disabled: " + name);
  }
}
console.log("Windows executable enforces embedded ASAR integrity and ASAR-only loading.");
await assertBrowserIntegrity(path.join(unpacked, "resources/browser/chrome-win64/chrome.exe"));
const appAsar = path.join(unpacked, "resources/app.asar");
if (statSync(appAsar).size < 100_000 || statSync(path.join(unpacked, "ChatChat.exe")).size < 10_000_000) {
  throw new Error("Incomplete Windows desktop bundle.");
}
function packagedSourceFiles(relative) {
  const base = path.join(root, relative);
  const result = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    const absolute = path.join(root, name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error("Symlink in packaged application source.");
    if (stat.isDirectory()) result.push(...packagedSourceFiles(name));
    else if (stat.isFile()) {
      // electron-builder deliberately omits declarations and source maps;
      // verify every shipped executable/runtime asset, not non-runtime typings.
      const ext = path.extname(name).toLowerCase();
      if ([".js", ".mjs", ".cjs", ".json", ".html", ".css", ".svg", ".png", ".ico", ".wasm"].includes(ext)) {
        result.push(name.split(path.sep).join("/"));
      }
    }
    else throw new Error("Unexpected non-file in bundled source.");
  }
  return result;
}
const shippedFiles = [
  ...packagedSourceFiles("main"),
  ...packagedSourceFiles("runtime"),
  ...packagedSourceFiles("renderer"),
  ...packagedSourceFiles("generated/src"),
  "runtime-lock.json",
];
for (const filename of shippedFiles) {
  const bundled = asar.extractFile(appAsar, filename.split("/").join(path.sep));
  const source = readFileSync(path.join(root, filename));
  if (!Buffer.from(bundled).equals(source)) {
    throw new Error(`Packaged application is stale or inconsistent: ${filename}`);
  }
}
const playwrightVersion = JSON.parse(
  Buffer.from(asar.extractFile(appAsar, path.join("node_modules", "playwright-core", "package.json"))).toString("utf8")
).version;
if (playwrightVersion !== pkg.dependencies["playwright-core"]) {
  throw new Error("Packaged browser automation library version mismatch.");
}
console.log(`Verified exact ASAR parity for ${shippedFiles.length} application and core files.`);
const artifact = `ChatChat-Setup-${pkg.version}-x64.exe`;
const installer = path.join(root, "release", artifact);
if (statSync(installer).size < 20_000_000) throw new Error("Incomplete Windows Setup.exe.");
const sha256 = createHash("sha256");
for await (const part of createReadStream(installer, { highWaterMark: 1024 * 1024 })) {
  sha256.update(part);
}
const checksum = sha256.digest("hex");
// Examine the actual NSIS Setup.exe without running it. Decompress its
// embedded app-64.7z and require exact byte parity for every installed file.
const actualInstaller = await verifySetupPayload({
  installer,
  reviewedUnpacked: unpacked,
  sevenZip: path.join(root, "node_modules/electron-winstaller/vendor/7z.exe"),
  reportFile: path.join(root, "release/NSIS-PAYLOAD-VERIFICATION.json"),
});
if (actualInstaller.installerSha256 !== checksum) {
  throw new Error("Actual NSIS installer digest changed during payload verification.");
}
console.log("Verified NSIS embedded application payload: "
  + actualInstaller.fileCount + " exact files.");
writeFileSync(path.join(root, "release/SHA256SUMS.txt"),
  `${checksum}  ${artifact}\n`, "utf8");
console.log(`Verified Windows candidate: ${artifact} SHA256=${checksum}`);
console.log("Unsigned developer preview. Signing and actual install/upgrade validation remain separate.");
