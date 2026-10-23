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
      # NSIS may leave InstallLocation empty, and electron-builder may use
      # "chatchat-desktop" rather than "ChatChat" under Programs. Discover
      # the actual binary exactly as the previously-passed install gate does.
      $hasPayload = -not [string]::IsNullOrWhiteSpace($root) -and
        (Test-Path -LiteralPath (Join-Path $root 'ChatChat.exe') -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $root 'resources\app.asar') -PathType Leaf)
      if (-not $hasPayload) {
        $programs=Join-Path $env:LOCALAPPDATA 'Programs'
        $candidates=@()
        if (Test-Path -LiteralPath $programs -PathType Container) {
          $candidates=@(Get-ChildItem -LiteralPath $programs -Filter 'ChatChat.exe' -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match 'ChatChat|chatchat-desktop' -and
              (Test-Path -LiteralPath (Join-Path $_.DirectoryName 'resources\app.asar') -PathType Leaf) })
        }
        if ($candidates.Count -gt 1) { throw "Ambiguous ChatChat installation roots on the disposable runner." }
        if ($candidates.Count -eq 1) { $root=$candidates[0].DirectoryName }
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

# The arbitrary retention sentinel remains a separate installer-level check.
# App-native meeting history is generated below by the pinned 0.10.6
# controller and its compiled core with synthetic, network-free responses.
# Never copy browser sessions, keys, real prompts or user secrets into CI.
$dataDir=Join-Path $env:APPDATA 'ChatChat\controller'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$sentinel=Join-Path $dataDir 'ci-cross-version-history.txt'
if (Test-Path -LiteralPath $sentinel) { throw "Unexpected preexisting upgrade sentinel in disposable runner." }
[IO.File]::WriteAllText($sentinel, 'ChatChat preserved history across reviewed 0.10.6 to 0.10.7 upgrade.')
$sentinelHash=(Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash

$nativeScript=Join-Path $desktop 'scripts/ci-native-upgrade-history.mjs'
$nativeManifest=Join-Path $env:RUNNER_TEMP 'chatchat-native-upgrade-history.json'
& node $nativeScript create
if ($LASTEXITCODE -ne 0) { throw 'Pinned 0.10.6 controller failed to create genuine synthetic meeting history.' }
$nativeProof=Get-Content -LiteralPath $nativeManifest -Raw | ConvertFrom-Json
if ([int]$nativeProof.eventCount -ne 6 -or [int]$nativeProof.positionCount -ne 2) {
  throw 'Old controller did not persist the reviewed six-event meeting fixture.'
}

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
& node $nativeScript verify
if ($LASTEXITCODE -ne 0) {
  throw '0.10.7 controller could not reopen and export 0.10.6 native history without provider sends.'
}
Write-Output 'PASS: actual 0.10.6 -> 0.10.7 NSIS upgrade preserves both sentinel and native controller history.'

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
& node $nativeScript verify
if ($LASTEXITCODE -ne 0) {
  throw 'Final uninstall failed native meeting history load, export or byte-preservation check.'
}
Write-Output 'PASS: 0.10.7 uninstall removed files and registration without erasing the preserved sentinel or native meeting archive.'
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
  nativeMeetingSource = 'pinned 0.10.6 controller and compiled core with synthetic model replies'
  nativeMeetingEventCount = [int]$nativeProof.eventCount
  nativeMeetingPositionCount = [int]$nativeProof.positionCount
  nativeMeetingArchiveSha256 = [string]$nativeProof.archiveSha256
  nativeMeetingLoadExportIntegrity = 'verified by 0.10.7 controller after upgrade and uninstall'
  nativeMeetingUnattendedProviderSends = 0
  finalRegistryRemoved = $true
  finalMainExecutableRemoved = $true
  realProviderAccountsTested = $false
  publisherSigned = $false
}
$reportFile = Join-Path $desktop 'release/CROSS-VERSION-ACCEPTANCE.json'
[IO.File]::WriteAllText($reportFile, ($releaseReport | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
Write-Output ('PASS: cross-version CI evidence saved to ' + $reportFile)
Write-Output 'Only tested on disposable GitHub-hosted Windows CI; real Provider accounts and signed distribution remain unverified.'
