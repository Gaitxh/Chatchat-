# Only execute in disposable GitHub-hosted Windows CI. Never on a user's daily machine.
$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or $env:RUNNER_OS -ne "Windows" -or $env:CI -ne "true" -or $env:RUNNER_ENVIRONMENT -ne "github-hosted" -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  throw "Installer acceptance is restricted to an ephemeral GitHub-hosted Windows CI runner."
}

$desktop = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$version = (Get-Content (Join-Path $desktop "package.json") -Raw | ConvertFrom-Json).version
$setup = Join-Path $desktop "release\ChatChat-Setup-$version-x64.exe"
if (-not (Test-Path $setup -PathType Leaf)) { throw "Missing Windows setup candidate." }

function Find-ChatChatUninstallEntries {
  @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match '^ChatChat(\s|$)' })
}
function Invoke-Setup([string]$file) {
  # NSIS can launch the desktop application after installation. Start-Process
  # -Wait waits on the process tree, potentially deadlocking while ChatChat is
  # running. Wait ONLY for the installer process, with a hard CI deadline.
  $result = Start-Process -FilePath $file -ArgumentList @('/S') -PassThru
  if (-not $result.WaitForExit(180000)) {
    try { Stop-Process -Id $result.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw "Silent NSIS operation exceeded the 180-second installer process deadline."
  }
  if ($result.ExitCode -ne 0) { throw "Silent NSIS operation failed: $($result.ExitCode)" }
}

if ((Find-ChatChatUninstallEntries).Count -ne 0) { throw "Runner is not clean: ChatChat is already installed." }
Invoke-Setup $setup
$entries = Find-ChatChatUninstallEntries
if ($entries.Count -ne 1) { throw "Expected one current-user uninstall record." }
$entry = $entries[0]
$installRoot = $entry.InstallLocation
if (-not $installRoot -or -not (Test-Path $installRoot)) {
  $exe = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs') -Filter 'ChatChat.exe' -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match 'ChatChat|chatchat-desktop' } | Select-Object -First 1
  if (-not $exe) { throw "ChatChat.exe not found under current-user Programs." }
  $installRoot = $exe.DirectoryName
}
$binary = Join-Path $installRoot 'ChatChat.exe'
$browser = Join-Path $installRoot 'resources\browser\chrome-win64\chrome.exe'
if (-not (Test-Path $binary -PathType Leaf) -or -not (Test-Path $browser -PathType Leaf)) {
  throw "Installed desktop does not contain ChatChat.exe and bundled Chromium."
}
$localRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd([char]92) + [char]92
$installPath = [IO.Path]::GetFullPath($installRoot).TrimEnd([char]92) + [char]92
if (-not $installPath.StartsWith($localRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Installer did not use a current-user installation directory."
}

function Assert-InstalledFilesMatchRelease {
  # The final Setup's nested app-64.7z was already byte-verified at build time.
  # Also verify the on-disk installation, rather than merely finding ChatChat.exe.
  foreach ($relative in @('ChatChat.exe', 'resources\app.asar',
      'resources\browser\chrome-win64\chrome.exe',
      'resources\browser\chrome-win64\chrome.dll')) {
    $expected = Join-Path (Join-Path $desktop 'release\win-unpacked') $relative
    $installed = Join-Path $installRoot $relative
    if (-not (Test-Path -LiteralPath $expected -PathType Leaf) -or
        -not (Test-Path -LiteralPath $installed -PathType Leaf)) {
      throw "Installation is missing a verified application component."
    }
    $sourceHash = (Get-FileHash -LiteralPath $expected -Algorithm SHA256).Hash
    $actualHash = (Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash
    if ($sourceHash -ne $actualHash) {
      throw "Installed application components differ from the reviewed release."
    }
  }
}
Assert-InstalledFilesMatchRelease
Write-Output 'PASS: initial per-user install contains exact verified executable, app ASAR and Chromium.'

# This disposable-runner fixture proves reinstall/uninstall does not erase user history.
$dataPath = Join-Path $env:APPDATA 'ChatChat\controller'
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
$sentinel = Join-Path $dataPath 'ci-preserve-me.txt'
Set-Content -LiteralPath $sentinel -Value 'Do not erase saved meeting data' -Encoding UTF8

function Wait-For-UninstallCompletion([string]$mainExecutable, [int]$timeoutSeconds = 120) {
  # NSIS can start a temporary Un_A helper, then successfully exit its own
  # launcher. The launcher exit is NOT proof that Windows registry cleanup and
  # installed-file deletion have completed. Poll both effects, never sleep a
  # fixed arbitrary duration or mistake an unfinished uninstall for success.
  $clock = [Diagnostics.Stopwatch]::StartNew()
  $nextLogSecond = 0
  while ($true) {
    $remaining = @(Find-ChatChatUninstallEntries)
    $binaryExists = Test-Path -LiteralPath $mainExecutable -PathType Leaf
    if ($remaining.Count -eq 0 -and -not $binaryExists) {
      Write-Output ("PASS: NSIS uninstall finished after {0:N1} s; registration and main binary are absent." -f $clock.Elapsed.TotalSeconds)
      return
    }
    if ($clock.Elapsed.TotalSeconds -ge $timeoutSeconds) {
      # Only print the app's own uninstall-record identifiers for CI diagnosis.
      $identifiers = @($remaining | ForEach-Object { [string]$_.PSChildName }) -join ', '
      throw ("NSIS uninstall remained incomplete after {0} s; registry entries={1}, keys=[{2}], main executable exists={3}." -f
        $timeoutSeconds, $remaining.Count, $identifiers, $binaryExists)
    }
    if ($clock.Elapsed.TotalSeconds -ge $nextLogSecond) {
      Write-Output ("WAIT: uninstall auxiliary cleanup; seconds={0:N1}, registration count={1}, main executable exists={2}" -f
        $clock.Elapsed.TotalSeconds, $remaining.Count, $binaryExists)
      $nextLogSecond += 10
    }
    Start-Sleep -Milliseconds 750
  }
}

function Stop-CiChatChat {
  Get-CimInstance Win32_Process -Filter "name = 'ChatChat.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath, $binary, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Stop-CiChatChat
# Reinstall the exact same build to detect duplicate uninstall entries or broken updates.
Invoke-Setup $setup
if ((Find-ChatChatUninstallEntries).Count -ne 1 -or -not (Test-Path $binary -PathType Leaf)) {
  throw "Reinstall changed the uninstall identity or lost the application."
}
Assert-InstalledFilesMatchRelease
if (-not (Test-Path $sentinel -PathType Leaf)) { throw "Reinstall erased user data." }

# Silent installers can start the app: stop ONLY the executable in this disposable install root.
Stop-CiChatChat
$entry = (Find-ChatChatUninstallEntries)[0]
$uninstall = [string]$entry.UninstallString
if ($uninstall -match '^"([^"]+\.exe)"') { $uninstall = $Matches[1] }
elseif ($uninstall -match '^(.+?\.exe)(?:\s|$)') { $uninstall = $Matches[1] }
if (-not (Test-Path $uninstall -PathType Leaf)) { throw "Installed uninstaller not found." }
Invoke-Setup $uninstall
Wait-For-UninstallCompletion $binary 120
if (-not (Test-Path $sentinel -PathType Leaf)) { throw "Uninstall erased local history." }
if ((Get-Content -LiteralPath $sentinel -Raw) -notmatch 'Do not erase saved meeting data') {
  throw "Uninstall changed the local history sentinel."
}
Write-Output "PASS: silent per-user install, SAME-VERSION reinstall and uninstall with local data preserved."
Write-Output "Not verified by this job: a real cross-version upgrade, manual UI setup, code signing or real Provider logins."
