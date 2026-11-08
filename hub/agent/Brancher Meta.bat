@echo off
chcp 65001 >nul
title Brancher les pubs Meta
set "DEST=%LOCALAPPDATA%\Agent-Georama"
if not exist "%DEST%\.venv\Scripts\python.exe" (
  echo  L'agent n'est pas encore installé : lance d'abord Installer.bat.
  pause
  exit /b 1
)
copy /Y "%~dp0brancher_meta.py" "%DEST%\" >nul 2>&1
if exist "%~dp0stats.py" copy /Y "%~dp0stats.py" "%DEST%\" >nul 2>&1
"%DEST%\.venv\Scripts\python.exe" "%DEST%\brancher_meta.py"
echo.
echo  Redémarrage de l'agent...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | Where-Object { $_.CommandLine -like '*agent_georama*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
call "%DEST%\Demarrer agent.bat"
echo  C'est fait. Les pubs Meta arrivent dans le hub d'ici quelques minutes.
pause
