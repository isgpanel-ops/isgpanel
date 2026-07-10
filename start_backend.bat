@echo off
cd /d "%~dp0backend"
if not exist server.js (
  echo ERROR: backend\server.js not found.
  pause
  exit /b
)
if not exist node_modules (
  echo Installing backend deps...
  call npm install
)
echo Starting backend on :5001 ...
node server.js
