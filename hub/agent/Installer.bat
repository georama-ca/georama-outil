@echo off
chcp 65001 >nul
setlocal
title Installation de l'agent Georama
set "DEST=%LOCALAPPDATA%\Agent-Georama"
echo.
echo  Agent Georama - installation
echo  ----------------------------
echo  Dossier d'installation : %DEST%
echo.
set "PY="
py -3.12 -c "import sys" >nul 2>&1 && set "PY=py -3.12"
if not defined PY py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>&1 && set "PY=python"
if not defined PY (
  echo  Python est introuvable. Installe Python 3.12 :
  echo  https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe
  start "" "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
  pause
  exit /b 1
)
echo  Python trouvé : %PY%
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0agent_georama.py" "%DEST%\" >nul
copy /Y "%~dp0rendu3mf.py" "%DEST%\" >nul
copy /Y "%~dp0stats.py" "%DEST%\" >nul
copy /Y "%~dp0configurer.py" "%DEST%\" >nul
copy /Y "%~dp0Configurer.bat" "%DEST%\" >nul
copy /Y "%~dp0Demarrer agent.bat" "%DEST%\" >nul
copy /Y "%~dp0Arreter agent.bat" "%DEST%\" >nul
copy /Y "%~dp0Voir le journal.bat" "%DEST%\" >nul
copy /Y "%~dp0LISEZMOI.txt" "%DEST%\" >nul
copy /Y "%~dp0config.exemple.json" "%DEST%\" >nul
if not exist "%DEST%\config.json" copy /Y "%~dp0config.exemple.json" "%DEST%\config.json" >nul
rem Pont vers Georama Production (boutons Aperçu rapide, .3mf et PDF client du hub)
set "PROD=%USERPROFILE%\OneDrive - Georama\04_Operations_et_Ressources_Techniques\05_Georama-production\georama-production"
if exist "%PROD%\georama_prod" copy /Y "%~dp0produire_hub.py" "%PROD%\" >nul
if exist "%PROD%\georama_prod" copy /Y "%~dp0Lancer depuis le hub.vbs" "%PROD%\" >nul
if exist "%PROD%\georama_prod" copy /Y "%~dp0Installer le bouton du hub.cmd" "%PROD%\" >nul
echo  Préparation de l'environnement Python (1 à 3 minutes)...
if not exist "%DEST%\.venv\Scripts\python.exe" %PY% -m venv "%DEST%\.venv"
"%DEST%\.venv\Scripts\python.exe" -m pip install --upgrade pip --quiet --disable-pip-version-check
"%DEST%\.venv\Scripts\python.exe" -m pip install numpy paho-mqtt --quiet --only-binary=:all: --disable-pip-version-check
if errorlevel 1 (
  echo  L'installation des modules a échoué. Envoie une capture de cette fenêtre à Claude.
  pause
  exit /b 1
)
echo  Démarrage automatique avec Windows...
schtasks /Create /TN "Agent Georama" /TR "\"%DEST%\Demarrer agent.bat\"" /SC ONLOGON /RL LIMITED /F >nul
if errorlevel 1 (
  echo  Tâche planifiée refusée : ajout d'un raccourci dans le dossier Démarrage à la place.
  powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Agent Georama.lnk');$s.TargetPath='%DEST%\Demarrer agent.bat';$s.WindowStyle=7;$s.Save()"
)
echo.
choice /C ON /M " Brancher maintenant Wix et l'imprimante (O = oui, N = plus tard)"
if not errorlevel 2 "%DEST%\.venv\Scripts\python.exe" "%DEST%\configurer.py"
echo  Test rapide...
"%DEST%\.venv\Scripts\python.exe" "%DEST%\agent_georama.py" --une-fois
call "%DEST%\Demarrer agent.bat"
echo.
echo  C'est fait. L'agent tourne en arrière-plan et redémarre avec Windows.
echo  Dans le hub (Production), « Ordi de la maison » doit passer à « En ligne » d'ici 1 minute.
echo  Réglages : %DEST%\config.json
echo.
pause
