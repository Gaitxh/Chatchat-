import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifiedOfflineElectronZip } from '../scripts/offline-electron-dist.mjs';

test('offline Windows Electron package only accepts pinned version, architecture and official SHA-256', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatchat-offline-electron-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const moduleRoot = path.join(root, 'electron');
  await mkdir(moduleRoot);
  const archive = path.join(root, 'electron-v45.0.0-win32-x64.zip');
  const bytes = Buffer.alloc(1_000_029, 74);
  const digest = createHash('sha256').update(bytes).digest('hex');
  await writeFile(archive, bytes);
  await writeFile(path.join(moduleRoot, 'checksums.json'),
    JSON.stringify({ 'electron-v45.0.0-win32-x64.zip': digest }));
  assert.equal(await verifiedOfflineElectronZip({
    zipPath: archive, version: '45.0.0', electronPackageRoot: moduleRoot,
  }), archive);

  await assert.rejects(verifiedOfflineElectronZip({
    zipPath: archive, version: '45.0.1', electronPackageRoot: moduleRoot,
  }), /version|architecture/);
  const arm = path.join(root, 'electron-v45.0.0-win32-arm64.zip');
  await writeFile(arm, bytes);
  await assert.rejects(verifiedOfflineElectronZip({
    zipPath: arm, version: '45.0.0', electronPackageRoot: moduleRoot,
  }), /version|architecture/);

  bytes[0] ^= 0xff;
  await writeFile(archive, bytes);
  await assert.rejects(verifiedOfflineElectronZip({
    zipPath: archive, version: '45.0.0', electronPackageRoot: moduleRoot,
  }), /SHA-256/);
});

test('offline distribution without a package-authored checksum must fail closed', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatchat-offline-checksum-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const moduleRoot = path.join(root, 'electron');
  await mkdir(moduleRoot);
  const archive = path.join(root, 'electron-v45.0.0-win32-x64.zip');
  await writeFile(archive, Buffer.alloc(1_000_005, 99));
  await writeFile(path.join(moduleRoot, 'checksums.json'), '{}');
  await assert.rejects(verifiedOfflineElectronZip({
    zipPath: archive, version: '45.0.0', electronPackageRoot: moduleRoot,
  }), /trusted pinned release/);
});
