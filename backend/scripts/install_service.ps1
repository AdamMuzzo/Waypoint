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
    $backendDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $venvDir = Join-Path $backendDir ".venv"
    $requirements = Join-Path $backendDir "requirements.txt"
    $logDir = Join-Path $backendDir "logs"

    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        throw "Service '$ServiceName' already exists. Run uninstall_service.ps1 first."
    }

    $pythonCmd = (Get-Command python -ErrorAction Stop).Path

    if (-not (Test-Path $venvDir)) {
        Write-Host "Creating virtual environment at $venvDir..."
        & $pythonCmd -m venv $venvDir
    }

    $venvPython = Join-Path $venvDir "Scripts\\python.exe"
    if (-not (Test-Path $venvPython)) {
        throw "Virtual env python not found at $venvPython"
    }

    Write-Host "Upgrading pip..."
    & $venvPython -m pip install --upgrade pip

    if (-not (Test-Path $requirements)) {
        throw "requirements.txt not found at $requirements"
    }

    Write-Host "Installing requirements..."
    & $venvPython -m pip install -r $requirements

    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $nssm = Resolve-NssmPath

    $bindHost = if ($env:WAYPOINT_HOST) { $env:WAYPOINT_HOST } else { "0.0.0.0" }
    $port = if ($env:WAYPOINT_PORT) { $env:WAYPOINT_PORT } else { "8000" }

    & $nssm install $ServiceName $venvPython "-m" "uvicorn" "app.main:app" "--host" $bindHost "--port" $port
    & $nssm set $ServiceName AppDirectory $backendDir
    & $nssm set $ServiceName AppStdout (Join-Path $logDir "waypoint-service.out.log")
    & $nssm set $ServiceName AppStderr (Join-Path $logDir "waypoint-service.err.log")
    & $nssm set $ServiceName AppRotateFiles 1
    & $nssm set $ServiceName AppRotateOnline 1

    Write-Host "Service '$ServiceName' installed."
    Write-Host "Use start_service.ps1 to start it."
} catch {
    Write-Error $_
    exit 1
}
