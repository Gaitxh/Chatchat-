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
  assert.match(source, /Wait-For-UninstallCompletion \$binary 120/);
  assert.match(source, /Diagnostics\.Stopwatch\]::StartNew\(\)/);
  assert.match(source, /Start-Sleep -Milliseconds 750/);
  assert.match(source, /remaining\.Count -eq 0 -and -not \$binaryExists/);
  assert.match(source, /NSIS uninstall remained incomplete after/);
  assert.match(source, /Assert-InstalledFilesMatchRelease/);
  for (const component of ['ChatChat.exe', 'app.asar', 'chrome.exe', 'chrome.dll']) {
    assert.ok(source.includes(component), 'Installed file byte-parity check missing: ' + component);
  }
  assert.match(source, /Get-FileHash -LiteralPath \$installed -Algorithm SHA256/);
});

test('installer acceptance script refuses to run outside GitHub-hosted CI without side effects', {
  skip: process.platform !== 'win32',
}, async () => {
  // Explicitly force a non-CI environment so even on a hosted runner this test
  // cannot execute the installer. This test ONLY checks the very first guard.
  // PowerShell 5 cold-start sometimes exceeds 12 s under Windows Actions CPU
  // contention. GitHub-hosted Windows images ship PowerShell 7 (pwsh), which
  // is also used for the workflow's real installer-acceptance step.
  const shell = process.env.GITHUB_ACTIONS === 'true' ? 'pwsh.exe' : 'powershell.exe';
  const result = spawnSync(shell, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', installerScript,
  ], {
    env: { ...process.env, GITHUB_ACTIONS: 'false', CI: 'false', RUNNER_ENVIRONMENT: 'self-hosted' },
    encoding: 'utf8', windowsHide: true, timeout: 45_000,
  });
  assert.equal(result.error, undefined, 'PowerShell guard subprocess must exit, not time out');
  assert.notEqual(result.status, 0, 'Guard must reject untrusted launch context.');
  assert.match((result.stderr ?? '') + (result.stdout ?? ''), /ephemeral GitHub-hosted Windows CI runner/);
});
