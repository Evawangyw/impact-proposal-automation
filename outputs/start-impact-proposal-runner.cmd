@echo off
cd /d "%~dp0.."
echo Starting Impact Proposal Runner...
echo UI: http://127.0.0.1:8798/
echo Log: %CD%\outputs\impact-proposal-runner-8798.log
echo Keep this window open.
set "NODE_PATH=C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules"
"C:\Users\eva.wang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%CD%\outputs\impact-proposal-standalone-runner.mjs" 1>>"%CD%\outputs\impact-proposal-runner-8798.log" 2>>&1
echo Runner stopped. Press any key to close.
pause >nul
