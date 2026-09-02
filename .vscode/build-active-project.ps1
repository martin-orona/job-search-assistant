param(
    [Parameter(Mandatory = $true)]
    [string]$ActiveFile
)

$dir = Split-Path -Path $ActiveFile -Parent
$projectFile = $null
$projectType = $null

while ($dir -and (Test-Path $dir)) {
    $csproj = Get-ChildItem -Path $dir -Filter '*.csproj' -File -ErrorAction SilentlyContinue
    if ($csproj) {
        $projectFile = $csproj[0].FullName
        $projectType = 'dotnet'
        break
    }

    $packageJson = Join-Path -Path $dir -ChildPath 'package.json'
    if (Test-Path $packageJson) {
        $projectFile = $packageJson
        $projectType = 'node'
        break
    }

    $parent = Split-Path -Path $dir -Parent
    if ($parent -eq $dir) {
        break
    }
    $dir = $parent
}

if (-not $projectFile) {
    Write-Error "Could not find a .csproj or package.json file for '$ActiveFile'."
    exit 1
}

if ($projectType -eq 'dotnet') {
    Write-Host "Building $projectFile"
    dotnet build $projectFile /property:GenerateFullPaths=true /p:Configuration=Debug
    exit $LASTEXITCODE
}
else {
    $projectDir = Split-Path -Path $projectFile -Parent
    Write-Host "Building $projectDir (pnpm build)"
    Push-Location $projectDir
    try {
        corepack pnpm build
        exit $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
