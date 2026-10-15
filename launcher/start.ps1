# Cookbook - desktop launcher (Windows)
#
# What the desktop icon runs. It:
#   1. finds Node.js (or, the first time only, downloads the official portable Node.js
#      from nodejs.org into %LOCALAPPDATA%\Cookbook\node and checks its fingerprint),
#   2. starts the Cookbook server in the background (no console window),
#   3. opens Cookbook in its own app window (Edge or Chrome app mode).
# Closing the window stops the server a few minutes later. Clicking the icon again
# while it's running just opens another window.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Windows PowerShell downloads crawl with the progress bar on

$Root = Split-Path -Parent $PSScriptRoot
$ServerJs = Join-Path $Root 'server.js'
$Url = 'http://localhost:3560'
$DataDir = Join-Path $env:LOCALAPPDATA 'Cookbook'
$NodeDir = Join-Path $DataDir 'node'
$Log = Join-Path $DataDir 'server.log'
$ErrLog = Join-Path $DataDir 'server-errors.log'
$MinNodeMajor = 18

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Show-Error([string]$Message) {
    [System.Windows.Forms.MessageBox]::Show($Message, 'Cookbook', 'OK', 'Error') | Out-Null
}

# A small "please wait" window for the one-time Node.js download.
function Show-Splash([string]$Text) {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Cookbook'
    $form.Size = New-Object System.Drawing.Size(420, 140)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::FromArgb(31, 31, 35)
    $form.ForeColor = [System.Drawing.Color]::FromArgb(232, 232, 234)
    $icon = Join-Path $Root 'icons\cookbook.ico'
    if (Test-Path $icon) { $form.Icon = New-Object System.Drawing.Icon($icon) }
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $label.Dock = 'Fill'
    $label.TextAlign = 'MiddleCenter'
    $form.Controls.Add($label)
    $form.Show()
    [System.Windows.Forms.Application]::DoEvents()
    return $form
}

function Test-CookbookRunning {
    try {
        $r = Invoke-RestMethod -Uri "$Url/api/health" -TimeoutSec 2 -UseBasicParsing
        return ($r.app -eq 'cookbook')
    } catch {
        return $false
    }
}

function Get-NodeMajor([string]$NodeExe) {
    try {
        $v = (& $NodeExe --version) 2>$null
        if ($v -match '^v(\d+)\.') { return [int]$Matches[1] }
    } catch { }
    return 0
}

function Find-Node {
    $installed = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($installed -and (Get-NodeMajor $installed.Source) -ge $MinNodeMajor) { return $installed.Source }
    $portable = Join-Path $NodeDir 'node.exe'
    if ((Test-Path $portable) -and (Get-NodeMajor $portable) -ge $MinNodeMajor) { return $portable }
    return $null
}

# One-time: download the current LTS Node.js (portable zip) from nodejs.org and verify it.
function Install-PortableNode {
    $splash = Show-Splash "Setting up Cookbook for the first time...`nDownloading Node.js (about 30 MB, one time only)."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $platform = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'win-arm64' } else { 'win-x64' }

        $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
        $release = $releases | Where-Object { $_.lts -and ($_.files -contains "$platform-zip") } | Select-Object -First 1
        if (-not $release) { throw 'Could not find a Node.js download for this computer.' }

        $version = $release.version
        $zipName = "node-$version-$platform.zip"
        $base = "https://nodejs.org/dist/$version"
        $zipPath = Join-Path $env:TEMP "cookbook-$zipName"

        Invoke-WebRequest -Uri "$base/$zipName" -OutFile $zipPath -UseBasicParsing
        [System.Windows.Forms.Application]::DoEvents()

        # Check the download against nodejs.org's published SHA-256 fingerprints.
        $sums = Invoke-RestMethod -Uri "$base/SHASUMS256.txt" -UseBasicParsing
        $line = ($sums -split "`r?`n") | Where-Object { $_ -match ('\s' + [regex]::Escape($zipName) + '$') } | Select-Object -First 1
        if (-not $line) { throw "No published fingerprint for $zipName." }
        $expected = ($line -split '\s+')[0]
        $actual = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash
        if ($actual -ne $expected) {
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            throw 'The Node.js download was damaged or changed (fingerprint mismatch), so it was not used.'
        }

        $unpack = Join-Path $DataDir 'node-download'
        if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
        Expand-Archive -Path $zipPath -DestinationPath $unpack -Force
        $inner = Get-ChildItem -Path $unpack -Directory | Select-Object -First 1
        if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
        Move-Item -Path $inner.FullName -Destination $NodeDir
        Remove-Item $unpack -Recurse -Force
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        return (Join-Path $NodeDir 'node.exe')
    } finally {
        $splash.Close()
    }
}

try {
    if (-not (Test-Path $ServerJs)) {
        Show-Error "Cookbook's files aren't where the shortcut expects them:`n$Root`n`nIf you moved the folder, run 'Install Cookbook.cmd' again from its new place."
        exit 1
    }

    $node = Find-Node
    if (-not $node) {
        try {
            $node = Install-PortableNode
        } catch {
            Show-Error ("Cookbook needs Node.js and couldn't download it:`n$($_.Exception.Message)`n`n" +
                'Check your internet connection and try again, or install Node.js from https://nodejs.org (LTS) and then click the Cookbook icon again.')
            exit 1
        }
    }

    # Already running? Then the server just opens another app window.
    if (Test-CookbookRunning) {
        Start-Process -FilePath $node -ArgumentList "`"$ServerJs`" --open" -WorkingDirectory $Root -WindowStyle Hidden
        exit 0
    }

    $env:COOKBOOK_AUTOSTOP = '1'
    Start-Process -FilePath $node -ArgumentList "`"$ServerJs`" --open" -WorkingDirectory $Root `
        -WindowStyle Hidden -RedirectStandardOutput $Log -RedirectStandardError $ErrLog

    # Make sure it actually started; explain if not.
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-CookbookRunning) { exit 0 }
    }
    $details = ''
    if (Test-Path $ErrLog) { $details = (Get-Content $ErrLog -Raw -ErrorAction SilentlyContinue) }
    Show-Error ("Cookbook's server didn't start.`n`n$details`n`nFull log: $Log")
    exit 1
} catch {
    Show-Error ("Something went wrong starting Cookbook:`n$($_.Exception.Message)")
    exit 1
}
