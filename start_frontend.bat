@echo off
cd /d "%~dp0"
REM ^^^ Vite proje KOKTE ise boyle. Eger frontend klasorunde ise:
REM cd /d "%~dp0frontend"

if not exist package.json (
  echo ERROR: package.json not found in this folder.
  pause
  exit /b
)
if not exist node_modules (
  echo Installing frontend deps...
  call npm install
)
echo Starting Vite on :5173 ...
npm run dev
