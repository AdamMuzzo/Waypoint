[CmdletBinding()]
param(
    [string]$ServiceName = "WaypointBackend"
)

$ErrorActionPreference = "Stop"

try {
    $svc = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($svc.Status -ne "Running") {
        Start-Service -Name $ServiceName
        Write-Host "Service '$ServiceName' started."
    } else {
        Write-Host "Service '$ServiceName' is already running."
    }
} catch {
    Write-Error $_
    exit 1
}
