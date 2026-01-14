[CmdletBinding()]
param(
    [string]$ServiceName = "WaypointBackend"
)

$ErrorActionPreference = "Stop"

function Resolve-NssmPath {
    $candidates = @()
    if ($env:NSSM_PATH) {
        $candidates += $env:NSSM_PATH
    }
    $candidates += (Join-Path $PSScriptRoot "tools\\nssm.exe")
    $candidates += (Join-Path $PSScriptRoot "..\\tools\\nssm.exe")

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "nssm.exe not found. Set NSSM_PATH or place nssm.exe in backend\\scripts\\tools\\."
}

try {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Host "Service '$ServiceName' not found."
        exit 0
    }

    if ($svc.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName
    }

    $nssm = Resolve-NssmPath
    & $nssm remove $ServiceName confirm

    Write-Host "Service '$ServiceName' removed."
} catch {
    Write-Error $_
    exit 1
}
