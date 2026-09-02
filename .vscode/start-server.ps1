$ErrorActionPreference = 'Stop'

$port = 5000
$serverProject = Join-Path $PSScriptRoot '..\src\Server\Server.csproj'
$serverWorkingDirectory = Join-Path $PSScriptRoot '..\src\Server'

if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath dotnet -ArgumentList @('run', '--project', $serverProject) -WorkingDirectory $serverWorkingDirectory | Out-Null
}

$deadline = (Get-Date).AddSeconds(60)
while (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
    if ((Get-Date) -gt $deadline) {
        throw "Server did not start listening on port $port."
    }

    Start-Sleep -Milliseconds 500
}
