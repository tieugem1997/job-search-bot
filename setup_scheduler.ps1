# setup_scheduler.ps1 - Run as Administrator to schedule daily 08:00 job search
# Usage: .\setup_scheduler.ps1

param(
    [string]$ProjectDir = "D:\Trong\Project\Claude\job-search-automation",
    [string]$TaskName   = "PowerPlatformJobSearch",
    [string]$RunTime    = "08:00AM"
)

$NodeExe    = "C:\Program Files\nodejs\node.exe"
$MainScript = "$ProjectDir\main.js"

if (-not (Test-Path $NodeExe)) {
    Write-Host "ERROR: node.exe not found at $NodeExe" -ForegroundColor Red
    exit 1
}

$action   = New-ScheduledTaskAction -Execute $NodeExe -Argument $MainScript -WorkingDirectory $ProjectDir
$trigger  = New-ScheduledTaskTrigger -Daily -At $RunTime
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable -RunOnlyIfNetworkAvailable

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Daily Power Platform / SharePoint job search to Telegram" -Force

Write-Host "Task '$TaskName' scheduled daily at $RunTime" -ForegroundColor Green
Write-Host "Node: $NodeExe" -ForegroundColor Cyan
Write-Host "Script: $MainScript" -ForegroundColor Cyan
