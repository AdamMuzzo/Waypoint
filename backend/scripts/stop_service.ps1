[CmdletBinding()]
param(
    [string]$ServiceName = "WaypointBackend"
)

$ErrorActionPreference = "Stop"

try {
    $svc = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($svc.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName
        Write-Host "Service '$ServiceName' stopped."
    } else {
        Write-Host "Service '$ServiceName' is already stopped."
    }
} catch {
    Write-Error $_
    exit 1
}
