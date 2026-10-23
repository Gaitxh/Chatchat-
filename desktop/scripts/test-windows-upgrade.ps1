# Real cross-version upgrade acceptance: 0.10.6 -> 0.10.7.
# Executed ONLY by an ephemeral GitHub-hosted Windows Actions runner.
$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or $env:RUNNER_OS -ne "Windows" -or
    $env:CI -ne "true" -or $env:RUNNER_ENVIRONMENT -ne "github-hosted" -or
    [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  throw "Cross-version installer acceptance requires an ephemeral GitHub-hosted Windows CI runner."
}

$desktop = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$previous = (Resolve-Path -LiteralPath $env:CHATCHAT_PREVIOUS_DESKTOP -ErrorAction Stop).Path
$runnerTemp = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([char]92) + [char]92
$previousFull = [IO.Path]::GetFullPath($previous).TrimEnd([char]92) + [char]92
if (-not $previousFull.StartsWith($runnerTemp, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Previous version must be built only under the disposable runner temporary folder."
}

$previousVersion = (Get-Content (Join-Path $previous 'package.json') -Raw | ConvertFrom-Json).version
$newVersion = (Get-Content (Join-Path $desktop 'package.json') -Raw | ConvertFrom-Json).version
if ($previousVersion -ne '0.10.6' -or $newVersion -ne '0.10.7') {
  throw "Upgrade acceptance version pair is not the reviewed 0.10.6 -> 0.10.7 release."
}
$oldSetup = Join-Path $previous 'release\ChatChat-Setup-0.10.6-x64.exe'
$newSetup = Join-Path $desktop 'release\ChatChat-Setup-0.10.7-x64.exe'
foreach ($file in @($oldSetup,$newSetup)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Missing reviewed old/new NSIS setup.' }
}

function Find-ChatChatUninstallEntries {
  @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match '^ChatChat(\s|$)' })
}
function Invoke-Setup([string]$file) {
  $process = Start-Process -FilePath $file -ArgumentList @('/S') -PassThru
  if (-not $process.WaitForExit(180000)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw "Cross-version NSIS process exceeded its bounded 180-second wait."
  }
  if ($process.ExitCode -ne 0) { throw "NSIS installer/uninstaller failed: $($process.ExitCode)" }
}
function Wait-InstalledVersion([string]$version, [int]$timeoutSeconds = 120) {
  $clock=[Diagnostics.Stopwatch]::StartNew()
  while ($clock.Elapsed.TotalSeconds -lt $timeoutSeconds) {
    $entries=@(Find-ChatChatUninstallEntries)
    if ($entries.Count -eq 1 -and [string]$entries[0].DisplayVersion -eq $version) {
      $root=[string]$entries[0].InstallLocation
      if ([string]::IsNullOrWhiteSpace($root) -or -not (Test-Path -LiteralPath $root -PathType Container)) {
        $candidate=Join-Path $env:LOCALAPPDATA 'Programs\ChatChat'
        if (Test-Path -LiteralPath $candidate -PathType Container) { $root=$candidate }
      }
      if (-not [string]::IsNullOrWhiteSpace($root) -and
          (Test-Path -LiteralPath (Join-Path $root 'ChatChat.exe') -PathType Leaf) -and
          (Test-Path -LiteralPath (Join-Path $root 'resources\app.asar') -PathType Leaf)) {
        $local=[IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd([char]92) + [char]92
        $full=[IO.Path]::GetFullPath($root).TrimEnd([char]92) + [char]92
        if (-not $full.StartsWith($local, [StringComparison]::OrdinalIgnoreCase)) {
          throw "Unexpected non-user-local ChatChat installation."
        }
        return $root
      }
    }
    Start-Sleep -Milliseconds 750
  }
  $seen=@(Find-ChatChatUninstallEntries | ForEach-Object { [string]$_.DisplayVersion })
  throw ("Did not observe installed version {0} within {1} seconds; found {2}." -f
    $version, $timeoutSeconds, ($seen -join ','))
}
function Assert-InstalledMatches([string]$root,[string]$reference) {
  foreach($relative in @('ChatChat.exe','resources\app.asar',
        'resources\browser\chrome-win64\chrome.exe',
        'resources\browser\chrome-win64\chrome.dll')) {
    $expected=Join-Path (Join-Path $reference 'release\win-unpacked') $relative
    $installed=Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $expected -PathType Leaf) -or
        -not (Test-Path -LiteralPath $installed -PathType Leaf)) {
      throw "A reviewed application component is missing during the cross-version upgrade."
    }
    if ((Get-FileHash -LiteralPath $expected -Algorithm SHA256).Hash -ne
        (Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash) {
      throw "Installed application files do not match the reviewed version."
    }
  }
}
function Stop-OwnChatChat([string]$root) {
  $target=Join-Path $root 'ChatChat.exe'
  Get-CimInstance Win32_Process -Filter "name = 'ChatChat.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath,$target,[StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
function Wait-Removed([string]$binary,[int]$timeoutSeconds=120) {
  $clock=[Diagnostics.Stopwatch]::StartNew()
  while ($clock.Elapsed.TotalSeconds -lt $timeoutSeconds) {
    if ((Find-ChatChatUninstallEntries).Count -eq 0 -and
        -not (Test-Path -LiteralPath $binary -PathType Leaf)) { return }
    Start-Sleep -Milliseconds 750
  }
  throw "Cross-version uninstaller did not complete registration/file cleanup within the 120-second deadline."
}

if ((Find-ChatChatUninstallEntries).Count -ne 0) {
  throw "Cross-version runner is not clean; refusing to overwrite an earlier ChatChat installation."
}
Invoke-Setup $oldSetup
$installRoot=Wait-InstalledVersion '0.10.6'
Assert-InstalledMatches $installRoot $previous
Write-Output 'PASS: 0.10.6 installed under a per-user location with reviewed bytes.'

# A real local history-like artifact; never create or copy browser login
# sessions, keys, profiles, real AI prompts or user secrets into CI.
$dataDir=Join-Path $env:APPDATA 'ChatChat\controller'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$sentinel=Join-Path $dataDir 'ci-cross-version-history.txt'
if (Test-Path -LiteralPath $sentinel) { throw "Unexpected preexisting upgrade sentinel in disposable runner." }
[IO.File]::WriteAllText($sentinel, 'ChatChat preserved history across reviewed 0.10.6 to 0.10.7 upgrade.')
$sentinelHash=(Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash

Stop-OwnChatChat $installRoot
Invoke-Setup $newSetup
$upgraded=Wait-InstalledVersion '0.10.7'
if (-not [string]::Equals($installRoot,$upgraded,[StringComparison]::OrdinalIgnoreCase)) {
  throw "Upgrade changed the per-user installation identity."
}
Assert-InstalledMatches $upgraded $desktop
if ((Find-ChatChatUninstallEntries).Count -ne 1) {
  throw "Upgrade introduced duplicate or missing uninstall records."
}
if (-not (Test-Path -LiteralPath $sentinel -PathType Leaf) -or
    (Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash -ne $sentinelHash) {
  throw "A version-to-version upgrade removed or modified local meeting data."
}
Write-Output 'PASS: actual 0.10.6 -> 0.10.7 NSIS upgrade preserves user-local history and replaces the reviewed app bytes.'

Stop-OwnChatChat $upgraded
$upgradedEntries = @(Find-ChatChatUninstallEntries)
if ($upgradedEntries.Count -ne 1) { throw "Upgraded installation has no unique uninstall registration." }
$uninstall = [string]$upgradedEntries[0].UninstallString
if ($uninstall -match '^"([^"]+\.exe)"') { $uninstall=$Matches[1] }
elseif ($uninstall -match '^(.+?\.exe)(?:\s|$)') { $uninstall=$Matches[1] }
if (-not (Test-Path -LiteralPath $uninstall -PathType Leaf)) {
  throw "Upgraded NSIS uninstaller was not available."
}
Invoke-Setup $uninstall
Wait-Removed (Join-Path $upgraded 'ChatChat.exe') 120
if (-not (Test-Path -LiteralPath $sentinel -PathType Leaf) -or
    (Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash -ne $sentinelHash) {
  throw "Cross-version final uninstall erased local meeting data."
}
Write-Output 'PASS: 0.10.7 uninstall removed files and registration without erasing the preserved history sentinel.'
$releaseReport = [ordered]@{
  type = 'ChatChat cross-version upgrade acceptance'
  status = 'passed'
  runner = 'ephemeral GitHub-hosted Windows'
  fromVersion = '0.10.6'
  toVersion = '0.10.7'
  previousInstallerSha256 = (Get-FileHash -LiteralPath $oldSetup -Algorithm SHA256).Hash.ToLowerInvariant()
  installedInstallerSha256 = (Get-FileHash -LiteralPath $newSetup -Algorithm SHA256).Hash.ToLowerInvariant()
  initialInstallFileParity = 'passed'
  updatedFileParity = 'passed'
  oldVersionUninstallIdentity = 'replaced'
  localHistorySentinelIntegrity = 'preserved during upgrade and uninstall'
  finalRegistryRemoved = $true
  finalMainExecutableRemoved = $true
  realProviderAccountsTested = $false
  publisherSigned = $false
}
$reportFile = Join-Path $desktop 'release/CROSS-VERSION-ACCEPTANCE.json'
[IO.File]::WriteAllText($reportFile, ($releaseReport | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
Write-Output ('PASS: cross-version CI evidence saved to ' + $reportFile)
Write-Output 'Only tested on disposable GitHub-hosted Windows CI; real Provider accounts and signed distribution remain unverified.'
