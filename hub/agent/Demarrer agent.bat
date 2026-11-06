@echo off
chcp 65001 >nul
rem Démarre l'agent Georama en arrière-plan (sans fenêtre). Ne fait rien s'il tourne déjà.
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | Where-Object { $_.CommandLine -like '*agent_georama*' }) { exit 1 } else { exit 0 }"
if errorlevel 1 exit /b 0
start "" "%~dp0.venv\Scripts\pythonw.exe" "%~dp0agent_georama.py"
