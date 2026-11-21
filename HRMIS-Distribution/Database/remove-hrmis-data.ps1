<#
.SYNOPSIS
    Haros HRMIS — Complete Local Data Removal (Administrator confirmation required)

.DESCRIPTION
    Permanently deletes ALL Haros HRMIS user data stored under
    %LOCALAPPDATA%\HRMIS, including:
      - SQLite database (Database\hrmis.db)
      - Automatic backups (Backups\)
      - Documents, Reports, Logs, Attachments
      - Chromium/Electron local state

    This is a SEPARATE, explicit procedure. The normal Windows uninstaller
    NEVER deletes this data. Run only when HRMIS data must be wiped entirely
    (e.g. decommissioning a workstation).

    Requires an elevated PowerShell session (Run as Administrator).
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$dataRoot = Join-Path $env:LOCALAPPDATA 'HRMIS'

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Haros HRMIS - Complete Data Removal" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will PERMANENTLY DELETE all Haros HRMIS data:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  $dataRoot" -ForegroundColor White
Write-Host ""
Write-Host "  - Employee records, users, permissions, audit logs" -ForegroundColor Gray
Write-Host "  - SQLite database and all automatic backups" -ForegroundColor Gray
Write-Host "  - Documents, reports, attachments, logs" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $dataRoot)) {
    Write-Host "Data directory does not exist. Nothing to remove." -ForegroundColor Green
    exit 0
}

# Show what will be deleted
$size = (Get-ChildItem $dataRoot -Recurse -Force -ErrorAction SilentlyContinue |
         Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round(($size / 1MB), 2)
Write-Host "Total data size: $sizeMB MB" -ForegroundColor White
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'DELETE' to permanently remove ALL HRMIS data"
    if ($confirm -ne 'DELETE') {
        Write-Host "Aborted. No data was removed." -ForegroundColor Yellow
        exit 1
    }
}

try {
    Remove-Item -Path $dataRoot -Recurse -Force -ErrorAction Stop
    Write-Host ""
    Write-Host "All Haros HRMIS data has been permanently removed." -ForegroundColor Green
    Write-Host "Path: $dataRoot" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "ERROR: Could not remove all data: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Ensure Haros HRMIS is not running and you have administrator rights." -ForegroundColor Yellow
    exit 1
}
