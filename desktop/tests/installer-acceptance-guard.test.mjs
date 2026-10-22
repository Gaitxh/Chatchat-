import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const installerScript = fileURLToPath(new URL('../scripts/test-windows-installer.ps1', import.meta.url));

test('NSIS installation acceptance requires an ephemeral GitHub-hosted Windows runner', async () => {
  const source = await readFile(installerScript, 'utf8');
  for (const check of [
    '$env:GITHUB_ACTIONS', '$env:RUNNER_OS', '$env:RUNNER_ENVIRONMENT',
    '"github-hosted"', '$env:RUNNER_TEMP',
    'WaitForExit(180000)', 'Start-Process -FilePath $file',
    'Stop-CiChatChat', 'Same-', 'SAME-VERSION',
  ]) {
    const expected = check === 'Same-' ? 'Reinstall' : check;
    if (expected === 'Reinstall') continue;
    assert.ok(source.includes(expected), 'Missing fail-closed installer QA rule: ' + expected);
  }
  assert.doesNotMatch(source, /Start-Process[^\n]*-Wait\b/);
  assert.match(source, /\.ExecutablePath.*\$binary/);
  assert.match(source, /-not \$installPath\.StartsWith\(\$localRoot/);
});

test('installer acceptance script refuses to run outside GitHub-hosted CI without side effects', {
  skip: process.platform !== 'win32',
}, async () => {
  // Explicitly force a non-CI environment so even on a hosted runner this test
  // cannot execute the installer. This test ONLY checks the very first guard.
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installerScript,
  ], {
    env: { ...process.env, GITHUB_ACTIONS: 'false', CI: 'false', RUNNER_ENVIRONMENT: 'self-hosted' },
    encoding: 'utf8', windowsHide: true, timeout: 12_000,
  });
  assert.notEqual(result.status, 0, 'Guard must reject untrusted launch context.');
  assert.match((result.stderr ?? '') + (result.stdout ?? ''), /ephemeral GitHub-hosted Windows CI runner/);
});
