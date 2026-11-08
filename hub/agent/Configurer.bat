@echo off
chcp 65001 >nul
title Configuration de l'agent Georama
set "DEST=%LOCALAPPDATA%\Agent-Georama"
if not exist "%DEST%\.venv\Scripts\python.exe" (
  echo  L'agent n'est pas encore installé : lance d'abord Installer.bat.
  pause
  exit /b 1
)
copy /Y "%~dp0configurer.py" "%DEST%\" >nul 2>&1
"%DEST%\.venv\Scripts\python.exe" "%DEST%\configurer.py"
echo.
echo  Redémarrage de l'agent avec les nouveaux réglages...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | Where-Object { $_.CommandLine -like '*agent_georama*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
call "%DEST%\Demarrer agent.bat"
echo  C'est fait. Dans le hub, la carte « Ordi de la maison » se met à jour d'ici 1 minute.
pause
