# Runs the headless engine tests with Node.
#
# It uses node from the PATH when available, and otherwise falls back to the
# Node that ships with a Visual Studio installation (the "Node.js development"
# component), which is not added to the system PATH.
#
# Usage from this folder:
#   ./run.ps1

$ErrorActionPreference = "Stop"

function Resolve-Node {
    $onPath = Get-Command node -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    $roots = @("$env:ProgramFiles\Microsoft Visual Studio", "${env:ProgramFiles(x86)}\Microsoft Visual Studio")
    foreach ($root in $roots) {
        if (Test-Path $root) {
            $candidate = Get-ChildItem -Path $root -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue -File |
                Select-Object -First 1
            if ($candidate) { return $candidate.FullName }
        }
    }

    return $null
}

$node = Resolve-Node
if (-not $node) {
    Write-Error "node was not found on the PATH or in a Visual Studio installation. Install Node 18 or newer."
    exit 1
}

Write-Host "using node: $node"
Set-Location $PSScriptRoot
& $node --test
exit $LASTEXITCODE
