import path from "node:path";
import { createReadStream, readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { createHash } from "node:crypto";

const REQUIRED = ["chrome.exe", "chrome.dll", "resources.pak", "icudtl.dat"];
const ERROR = "The bundled browser is incomplete or damaged. Repair or reinstall ChatChat.";

function lockedManifest() {
  const lock = JSON.parse(readFileSync(new URL("../runtime-lock.json", import.meta.url), "utf8"));
  if (!lock || !Array.isArray(lock.browserRuntimeFiles) ||
    lock.browserRuntimeFiles.length !== REQUIRED.length) throw new Error(ERROR);
  for (const name of REQUIRED) {
    const entry = lock.browserRuntimeFiles.find((item) => item?.name === name);
    if (!entry || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 ||
      typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error(ERROR);
  }
  if (new Set(lock.browserRuntimeFiles.map((item) => item.name)).size !== REQUIRED.length) {
    throw new Error(ERROR);
  }
  return lock.browserRuntimeFiles;
}

/** One-time prelaunch verification of critical files from the pinned archive. */
export async function assertBrowserIntegrity(executablePath, manifest = lockedManifest()) {
  if (typeof executablePath !== "string" || !path.isAbsolute(executablePath) ||
    path.basename(executablePath).toLowerCase() !== "chrome.exe") throw new Error(ERROR);
  const directory = path.dirname(executablePath);
  if (!Array.isArray(manifest) || manifest.length < 1) throw new Error(ERROR);
  for (const entry of manifest) {
    if (!REQUIRED.includes(entry?.name) || !Number.isSafeInteger(entry?.bytes) ||
      entry.bytes < 1 || !/^[0-9a-f]{64}$/.test(entry?.sha256 ?? "")) throw new Error(ERROR);
    const filename = path.join(directory, entry.name);
    let file;
    try { file = await lstat(filename); } catch { throw new Error(ERROR); }
    if (!file.isFile() || file.isSymbolicLink() || file.size !== entry.bytes) throw new Error(ERROR);
    const digest = createHash("sha256");
    try {
      for await (const block of createReadStream(filename, { highWaterMark: 256 * 1024 })) {
        digest.update(block);
      }
    } catch { throw new Error(ERROR); }
    if (digest.digest("hex") !== entry.sha256) throw new Error(ERROR);
  }
  return true;
}
