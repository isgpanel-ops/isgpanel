@echo off
set ROOT=%~dp0
start "ISG BACKEND"   cmd /k "%ROOT%start_backend.bat"
start "ISG FRONTEND"  cmd /k "%ROOT%start_frontend.bat"
timeout /t 3 >nul
start "" "http://localhost:5173"
