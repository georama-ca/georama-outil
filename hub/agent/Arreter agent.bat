@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | Where-Object { $_.CommandLine -like '*agent_georama*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Agent Georama arrêté. Pour le relancer : Demarrer agent.bat
pause
