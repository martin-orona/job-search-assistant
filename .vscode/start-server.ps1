param(
    [switch]$KillExistingInstance,
    [int]$Port = 5000
)

$ErrorActionPreference = 'Stop'

$serverProject = Join-Path $PSScriptRoot '..\src\Server\Server.csproj'
$serverWorkingDirectory = Join-Path $PSScriptRoot '..\src\Server'
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($listener) {
    $ownerPid = $listener.OwningProcess
    Write-Host "Server already running on port $Port (PID $ownerPid)."

    if (-not $KillExistingInstance) {
        Write-Host "Skipping startup because the port is already in use."
        return
    }

    $shutdownUri = "http://localhost:$Port/api/v1/admin/kill-self"
    try {
        Invoke-RestMethod -Method Post -Uri $shutdownUri -UseBasicParsing -ErrorAction Stop | Out-Null
        Write-Host "Requested the running server to shut itself down via the admin endpoint."
    }
    catch {
        Write-Host "Admin shutdown request failed. Attempting to kill the running server process (PID $ownerPid)."
        Stop-Process -Id $ownerPid -Force -ErrorAction Stop
    }

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) -and ((Get-Date) -lt $deadline)) {
        Start-Sleep -Milliseconds 250
    }

    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        throw "Server on port $Port is still running after the shutdown request."
    }

    Write-Host "Server shutdown completed. Starting a fresh instance on port $Port."
}
else {
    Write-Host "No server is currently listening on port $Port. Starting server..."
}

Start-Process -FilePath dotnet -ArgumentList @('run', '--project', $serverProject, '--urls', "http://localhost:$Port") -WorkingDirectory $serverWorkingDirectory | Out-Null

$deadline = (Get-Date).AddSeconds(60)
while (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
    if ((Get-Date) -gt $deadline) {
        throw "Server did not start listening on port $Port."
    }

    Start-Sleep -Milliseconds 500
}

Write-Host "Server is running on port $Port."
