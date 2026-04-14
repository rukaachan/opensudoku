[CmdletBinding()]
param(
  [string]$Repo = $(if ($env:OPEN_SUDOKU_RELEASE_REPO) { $env:OPEN_SUDOKU_RELEASE_REPO } else { "rukaachan/opensudoku" }),
  [string]$Version = "latest",
  [string]$InstallRoot = "$env:LOCALAPPDATA\OpenSudoku",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

function Require-Tool([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required tool '$Name' was not found in PATH."
  }
}

function Get-ReleaseBaseUrl([string]$RepoName, [string]$ReleaseVersion) {
  if ($ReleaseVersion -eq "latest") {
    return "https://github.com/$RepoName/releases/latest/download"
  }
  return "https://github.com/$RepoName/releases/download/$ReleaseVersion"
}

function Add-UserPathIfMissing([string]$PathEntry) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) {
    $parts = $current.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries)
  }
  $normalized = $parts | ForEach-Object { $_.Trim().ToLowerInvariant() }
  if ($normalized -contains $PathEntry.Trim().ToLowerInvariant()) {
    return
  }
  $next = if ([string]::IsNullOrWhiteSpace($current)) { $PathEntry } else { "$current;$PathEntry" }
  [Environment]::SetEnvironmentVariable("Path", $next, "User")
}

function Remove-UserPathEntry([string]$PathEntry) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if ([string]::IsNullOrWhiteSpace($current)) {
    return
  }
  $target = $PathEntry.Trim().ToLowerInvariant()
  $parts = $current.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries) |
    Where-Object { $_.Trim().ToLowerInvariant() -ne $target }
  [Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")
}

if ($Uninstall) {
  $launcherPath = Join-Path $InstallRoot "opensudoku.cmd"
  if (Test-Path $InstallRoot) {
    Write-Host "Removing OpenSudoku install root: $InstallRoot"
    Remove-Item -Path $InstallRoot -Recurse -Force
  }
  Remove-UserPathEntry -PathEntry $InstallRoot
  Write-Host "OpenSudoku uninstall completed."
  if (Test-Path $launcherPath) {
    Write-Host "Warning: launcher still exists at $launcherPath"
  }
  return
}

Require-Tool "bun"
Require-Tool "powershell"

$releaseBaseUrl = Get-ReleaseBaseUrl -RepoName $Repo -ReleaseVersion $Version
$tempDir = Join-Path $env:TEMP ("opensudoku-install-" + [Guid]::NewGuid().ToString("N"))
$manifestPath = Join-Path $tempDir "release-manifest.json"

try {
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

  Write-Host "Downloading release manifest..."
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBaseUrl/release-manifest.json" -OutFile $manifestPath
  $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json

  if (-not $manifest.bundleFile) {
    throw "Release manifest is missing bundleFile."
  }

  $zipPath = Join-Path $tempDir $manifest.bundleFile
  Write-Host "Downloading bundle $($manifest.bundleFile)..."
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBaseUrl/$($manifest.bundleFile)" -OutFile $zipPath

  if ($manifest.bundleSha256) {
    $actual = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $expected = "$($manifest.bundleSha256)".ToLowerInvariant()
    if ($actual -ne $expected) {
      throw "Bundle checksum mismatch. Expected $expected but got $actual"
    }
  }

  $tag = if ($manifest.tag) { "$($manifest.tag)" } else { "v$($manifest.version)" }
  $bundleRoot = [System.IO.Path]::GetFileNameWithoutExtension($manifest.bundleFile)
  $targetVersionRoot = Join-Path (Join-Path $InstallRoot "versions") $tag

  New-Item -ItemType Directory -Path (Join-Path $InstallRoot "versions") -Force | Out-Null
  if (Test-Path $targetVersionRoot) {
    Remove-Item -Path $targetVersionRoot -Recurse -Force
  }

  Write-Host "Extracting bundle..."
  Expand-Archive -Path $zipPath -DestinationPath $targetVersionRoot -Force

  $bundleDir = Join-Path $targetVersionRoot $bundleRoot
  if (-not (Test-Path $bundleDir)) {
    throw "Extracted bundle folder not found: $bundleDir"
  }

  Write-Host "Installing dependencies (frozen lockfile)..."
  Push-Location $bundleDir
  try {
    & bun install --frozen-lockfile
  }
  finally {
    Pop-Location
  }

  $launcherPath = Join-Path $InstallRoot "opensudoku.cmd"
  $launcher = @(
    "@echo off",
    "setlocal",
    "cd /d \"$bundleDir\"",
    "bun run start %*"
  ) -join "`r`n"
  Set-Content -Path $launcherPath -Value $launcher -Encoding Ascii

  Add-UserPathIfMissing -PathEntry $InstallRoot

  Write-Host "OpenSudoku installed successfully."
  Write-Host "Launcher: $launcherPath"
  Write-Host "If PATH was just updated, open a new terminal then run: opensudoku"
}
finally {
  if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
  }
}
