# Only execute in disposable GitHub-hosted Windows CI. Never on a user's daily machine.
$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or $env:RUNNER_OS -ne "Windows" -or $env:CI -ne "true") {
  throw "Installer acceptance is restricted to an ephemeral Windows CI runner."
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
  $result = Start-Process -FilePath $file -ArgumentList @('/S') -Wait -PassThru
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
if (-not ([IO.Path]::GetFullPath($installRoot)).StartsWith([IO.Path]::GetFullPath($env:LOCALAPPDATA), [StringComparison]::OrdinalIgnoreCase)) {
  throw "Installer did not use a per-user install root."
}

# This disposable-runner fixture proves reinstall/uninstall does not erase user history.
$dataPath = Join-Path $env:APPDATA 'ChatChat\controller'
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
$sentinel = Join-Path $dataPath 'ci-preserve-me.txt'
Set-Content -LiteralPath $sentinel -Value 'Do not erase saved meeting data' -Encoding UTF8

function Stop-CiChatChat {
  Get-CimInstance Win32_Process -Filter "name = 'ChatChat.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($installRoot, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Stop-CiChatChat
# Reinstall the exact same build to detect duplicate uninstall entries or broken updates.
Invoke-Setup $setup
if ((Find-ChatChatUninstallEntries).Count -ne 1 -or -not (Test-Path $binary -PathType Leaf)) {
  throw "Reinstall changed the uninstall identity or lost the application."
}
if (-not (Test-Path $sentinel -PathType Leaf)) { throw "Reinstall erased user data." }

# Silent installers can start the app: stop ONLY the executable in this disposable install root.
Stop-CiChatChat
$entry = (Find-ChatChatUninstallEntries)[0]
$uninstall = [string]$entry.UninstallString
if ($uninstall -match '^"([^"]+\.exe)"') { $uninstall = $Matches[1] }
elseif ($uninstall -match '^(.+?\.exe)(?:\s|$)') { $uninstall = $Matches[1] }
if (-not (Test-Path $uninstall -PathType Leaf)) { throw "Installed uninstaller not found." }
Invoke-Setup $uninstall
if ((Find-ChatChatUninstallEntries).Count -ne 0) { throw "Uninstall registry entry remains." }
if (Test-Path $binary -PathType Leaf) { throw "Uninstall left the main executable." }
if (-not (Test-Path $sentinel -PathType Leaf)) { throw "Uninstall erased local history." }
Write-Output "PASS: silent per-user install/reinstall/uninstall with local data preserved."
