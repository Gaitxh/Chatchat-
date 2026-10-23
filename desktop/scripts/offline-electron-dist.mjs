import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

const HASH = /^[a-f0-9]{64}$/;

/**
 * An explicit, local-only Electron release ZIP for Windows build machines
 * without reliable network access. Version AND SHA-256 must match the
 * checksums distributed with the pinned electron npm package.
 */
export async function verifiedOfflineElectronZip({ zipPath, version, electronPackageRoot }) {
  if (typeof zipPath !== 'string' || !path.isAbsolute(zipPath)
    || typeof version !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)
    || typeof electronPackageRoot !== 'string') {
    throw new Error('Offline Electron dist path and exact version are required.');
  }
  const expectedFile = 'electron-v' + version + '-win32-x64.zip';
  if (path.basename(zipPath) !== expectedFile) {
    throw new Error('The offline Electron ZIP version or target architecture does not match.');
  }
  let info;
  let checksums;
  try {
    info = await lstat(zipPath);
    checksums = JSON.parse(await readFile(path.join(electronPackageRoot, 'checksums.json'), 'utf8'));
  } catch {
    throw new Error('Cannot inspect the offline Electron distribution or checksum manifest.');
  }
  const expected = checksums?.[expectedFile];
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1_000_000
    || typeof expected !== 'string' || !HASH.test(expected)) {
    throw new Error('The offline Electron archive is not a trusted pinned release.');
  }
  const digest = createHash('sha256');
  for await (const buffer of createReadStream(zipPath, { highWaterMark: 1024 * 1024 })) digest.update(buffer);
  if (digest.digest('hex') !== expected) {
    throw new Error('Offline Electron archive SHA-256 does not match the pinned package checksum.');
  }
  return zipPath;
}
