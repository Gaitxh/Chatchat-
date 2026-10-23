import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertBrowserIntegrity } from '../runtime/browser-integrity.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const LIMIT_MS = 180_000;

function exec7z(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8', timeout: LIMIT_MS, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Unable to examine Windows Setup application archive safely.');
  }
  return result.stdout;
}

async function hashFile(filename) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(filename, { highWaterMark: 1024 * 1024 })) hash.update(part);
  return hash.digest('hex');
}

export function archiveEntryNames(listing) {
  if (typeof listing !== 'string' || listing.length > 32 * 1024 * 1024) throw new Error('Invalid archive listing.');
  const divider = listing.indexOf('----------');
  if (divider < 0) throw new Error('The 7-Zip file listing lacks a valid archive entry separator.');
  const names = listing.slice(divider + 10).split(/\r?\n/)
    .filter((line) => line.startsWith('Path = ')).map((line) => line.slice(7));
  if (!names.length || names.length > 20_000) throw new Error('The application archive is empty or oversized.');
  const duplicates = new Set();
  for (const entry of names) {
    const normalized = entry.replaceAll('\\', '/');
    if (!normalized || normalized.length > 512 || normalized.startsWith('/')
      || /^(?:[a-zA-Z]:|\/\/)/.test(normalized)
      || normalized.includes('\0') || normalized.split('/').some((part) =>
        !part || part === '.' || part === '..' || part.endsWith(' ') || part.endsWith('.'))) {
      throw new Error('Unsafe application archive path.');
    }
    const canonical = normalized.toLowerCase();
    if (duplicates.has(canonical)) throw new Error('Case-insensitive duplicate archive path.');
    duplicates.add(canonical);
  }
  return names;
}

export async function fileTree(directory) {
  const output = new Map();
  async function visit(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      const abs = path.join(current, entry.name);
      const stat = await lstat(abs);
      if (stat.isSymbolicLink()) throw new Error('Symlink in installer application payload.');
      if (stat.isDirectory()) await visit(abs, relative);
      else if (stat.isFile()) {
        const canonical = relative.toLowerCase();
        if (output.has(canonical)) throw new Error('Case-insensitive duplicate application file.');
        output.set(canonical, { path: abs, relative, bytes: stat.size });
      } else throw new Error('Unsupported file type in installer payload.');
    }
  }
  await visit(directory);
  return output;
}

export async function comparePayloadTrees(verifiedUnpacked, extractedPayload) {
  const [expected, actual] = await Promise.all([fileTree(verifiedUnpacked), fileTree(extractedPayload)]);
  if (expected.size < 50 || actual.size !== expected.size) {
    throw new Error('Installer payload file count does not match the reviewed unpacked application.');
  }
  let totalBytes = 0;
  for (const [key, from] of expected) {
    const to = actual.get(key);
    if (!to || to.relative !== from.relative || from.bytes !== to.bytes) {
      throw new Error('Installer payload has a missing, renamed, or different-size application file: ' + from.relative);
    }
    const [left, right] = await Promise.all([hashFile(from.path), hashFile(to.path)]);
    if (left !== right) throw new Error('Installer payload byte mismatch: ' + from.relative);
    totalBytes += to.bytes;
  }
  return { fileCount: actual.size, totalBytes };
}

export async function verifySetupPayload({ installer, reviewedUnpacked, sevenZip, reportFile }) {
  if (process.platform !== 'win32') throw new Error('NSIS extraction verification runs on Windows only.');
  for (const filename of [installer, sevenZip]) {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Missing trusted QA input: ' + path.basename(filename));
  }
  const source = await lstat(reviewedUnpacked);
  if (!source.isDirectory()) throw new Error('Reviewed unpacked application is unavailable.');
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'chatchat-nsis-payload-'));
  let result;
  try {
    const nsisListing = exec7z(sevenZip, ['l', '-slt', installer]);
    if (!/^Type = Nsis\r?$/m.test(nsisListing)) throw new Error('Setup file does not contain an NSIS archive.');
    const outerNames = archiveEntryNames(nsisListing);
    const application = outerNames.find((entry) =>
      entry.replaceAll('\\', '/').toLowerCase() === '$pluginsdir/app-64.7z');
    if (!application) throw new Error('NSIS Setup is missing its expected application payload.');
    const outer = path.join(testRoot, 'nsis');
    const inner = path.join(testRoot, 'app');
    await Promise.all([mkdir(outer, { recursive: true }), mkdir(inner, { recursive: true })]);
    exec7z(sevenZip, ['x', installer, application, '-o' + outer, '-y']);
    const archive = path.join(outer, '$PLUGINSDIR', 'app-64.7z');
    const nestedListing = exec7z(sevenZip, ['l', '-slt', archive]);
    if (!/^Type = 7z\r?$/m.test(nestedListing)) throw new Error('Embedded application payload is not 7z.');
    const innerNames = archiveEntryNames(nestedListing);
    if (!innerNames.some((name) => name.toLowerCase() === 'chatchat.exe')) {
      throw new Error('Embedded payload lacks the desktop executable.');
    }
    exec7z(sevenZip, ['x', archive, '-o' + inner, '-y']);
    const matched = await comparePayloadTrees(reviewedUnpacked, inner);
    await assertBrowserIntegrity(path.join(inner, 'resources', 'browser', 'chrome-win64', 'chrome.exe'));
    result = {
      type: 'ChatChat NSIS payload verification',
      status: 'passed',
      tests: ['NSIS-embedded archive actually extracted', 'Safe archive paths',
        'Every installed application file matches reviewed unpacked bytes',
        'Pinned Chromium critical binary SHA-256 verified'],
      installerSha256: await hashFile(installer),
      appArchiveSha256: await hashFile(archive),
      ...matched,
      installerExecuted: false,
      registryModified: false,
      signedPublisherVerified: false,
      fullInstallerAcceptance: false,
    };
  } finally {
    await rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  }
  if (reportFile) await writeFile(reportFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const result = await verifySetupPayload({
    installer: path.join(root, 'release', 'ChatChat-Setup-' + pkg.version + '-x64.exe'),
    reviewedUnpacked: path.join(root, 'release', 'win-unpacked'),
    sevenZip: path.join(root, 'node_modules', 'electron-winstaller', 'vendor', '7z.exe'),
    reportFile: path.join(root, 'release', 'NSIS-PAYLOAD-VERIFICATION.json'),
  });
  console.log('NSIS application payload verified: ' + result.fileCount
    + ' exact files, ' + result.totalBytes + ' bytes.');
  console.log('Installer SHA-256: ' + result.installerSha256);
  console.log('This is a read-only extraction check, not actual install/uninstall acceptance.');
}
