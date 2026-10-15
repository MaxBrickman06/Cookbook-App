# Cookbook - one-time setup (Windows)
# Puts a Cookbook icon on the desktop and in the Start menu, then opens the app.
# Run it by double-clicking "Install Cookbook.cmd" in the project folder.
# Pass -Uninstall to remove the icons (and optionally the downloaded Node.js and app data).

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Start = Join-Path $PSScriptRoot 'start.ps1'
$Icon = Join-Path $Root 'icons\cookbook.ico'
$DataDir = Join-Path $env:LOCALAPPDATA 'Cookbook'

# GetFolderPath follows OneDrive's "Desktop backup", so the icon lands on the desktop you actually see.
$Desktop = [Environment]::GetFolderPath('Desktop')
$StartMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Cookbook.lnk'
$DesktopLink = Join-Path $Desktop 'Cookbook.lnk'

if ($Uninstall) {
    foreach ($link in @($DesktopLink, $StartMenu)) {
        if (Test-Path $link) { Remove-Item $link -Force; Write-Host "Removed $link" }
    }
    if (Test-Path $DataDir) {
        $answer = Read-Host "Also delete Cookbook's downloaded Node.js and saved app data in $DataDir? (y/N)"
        if ($answer -match '^[yY]') { Remove-Item $DataDir -Recurse -Force; Write-Host 'Deleted.' }
    }
    Write-Host 'Cookbook icons removed.'
    exit 0
}

if (-not (Test-Path (Join-Path $Root 'server.js'))) {
    Write-Host "Can't find Cookbook's files next to this script ($Root)." -ForegroundColor Red
    exit 1
}

# Files downloaded as a ZIP from GitHub are marked "from the internet"; clear that so the launcher can run.
Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\\.git\\' } |
    Unblock-File -ErrorAction SilentlyContinue

$PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Start`""

$shell = New-Object -ComObject WScript.Shell
foreach ($path in @($DesktopLink, $StartMenu)) {
    $s = $shell.CreateShortcut($path)
    $s.TargetPath = $PowerShellExe
    $s.Arguments = $Arguments
    $s.WorkingDirectory = $Root
    $s.IconLocation = "$Icon,0"
    $s.WindowStyle = 7          # start minimized, so no console flashes up
    $s.Description = 'Cookbook - recipes, fridge and shopping lists'
    $s.Save()
}

Write-Host ''
Write-Host '  Cookbook is set up!' -ForegroundColor Green
Write-Host "  - Desktop icon:    $DesktopLink"
Write-Host '  - Start menu:      Cookbook'
Write-Host ''
Write-Host '  Opening Cookbook now. Next time, just double-click the Cookbook icon.'
Write-Host '  (If you move this project folder, run Install Cookbook.cmd again.)'
Write-Host ''

Start-Process -FilePath $PowerShellExe -ArgumentList $Arguments -WindowStyle Hidden
Start-Sleep -Seconds 3
