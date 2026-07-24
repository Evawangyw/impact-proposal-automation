$ErrorActionPreference = "Stop"

$Node = "C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$NodeModules = "C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
$PnpmNodeModules = "C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Runner = Join-Path $ProjectRoot "outputs\impact-proposal-standalone-runner.mjs"

$env:NODE_PATH = "$NodeModules;$PnpmNodeModules"
Write-Host "Starting Impact Proposal Runner..."
Write-Host "UI: http://127.0.0.1:8798/"
Write-Host "Project: $ProjectRoot"
Write-Host "Please keep this window open."
& $Node $Runner
