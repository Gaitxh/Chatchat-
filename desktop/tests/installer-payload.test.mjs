import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { archiveEntryNames, comparePayloadTrees } from '../scripts/verify-nsis-payload.mjs';

const list = (...entries) => '7-Zip test fixture\nPath = fake.7z\nType = 7z\n----------\n'
  + entries.map((name) => 'Path = ' + name + '\nSize = 1\n\n').join('');

test('installer archive parser rejects traversal, absolute, duplicate and case-alias paths', () => {
  assert.deepEqual(archiveEntryNames(list('ChatChat.exe', 'resources\\app.asar')),
    ['ChatChat.exe', 'resources\\app.asar']);
  for (const input of [
    list('../AppData/secrets.json'),
    list('resources\\..\\settings'),
    list('C:\\Windows\\System32\\driver.dll'),
    list('/etc/private'),
    list('dir/../outside'),
    list('dir//file'),
    list('dir/./file'),
    list('bad '),
    list('resources\\APP.ASAR', 'resources\\app.asar'),
  ]) assert.throws(() => archiveEntryNames(input));
  assert.throws(() => archiveEntryNames('invalid output'));
});

test('installer payload must match every byte and every case-sensitive installed file', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatchat-payload-test-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }));
  const original = path.join(root, 'built');
  const extracted = path.join(root, 'payload');
  await Promise.all([mkdir(original), mkdir(extracted)]);
  for (let i = 0; i < 55; i++) {
    const name = 'resource-' + String(i).padStart(3, '0') + '.dat';
    const bytes = 'fixture data item ' + i;
    await Promise.all([
      writeFile(path.join(original, name), bytes),
      writeFile(path.join(extracted, name), bytes),
    ]);
  }
  let result = await comparePayloadTrees(original, extracted);
  assert.equal(result.fileCount, 55);
  await writeFile(path.join(extracted, 'resource-008.dat'), 'tampered fixture!');
  await assert.rejects(comparePayloadTrees(original, extracted), /size|byte mismatch/);
  await writeFile(path.join(extracted, 'resource-008.dat'), 'fixture data item 8');
  await writeFile(path.join(extracted, 'unreviewed-extra.dll'), 'extra file');
  await assert.rejects(comparePayloadTrees(original, extracted), /file count/);
  result = await comparePayloadTrees(original, original);
  assert.equal(result.fileCount, 55);
});
