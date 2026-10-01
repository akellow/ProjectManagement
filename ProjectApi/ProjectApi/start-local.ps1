$ErrorActionPreference = "Stop"

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$process = Get-Process ProjectApi -ErrorAction SilentlyContinue

if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Stopped existing ProjectApi process."
}

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS = "http://localhost:5083"

Set-Location $projectPath
Write-Host "Starting ProjectApi on http://localhost:5083"
dotnet run --urls "http://localhost:5083"
