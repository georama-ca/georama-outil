@echo off
chcp 65001 >nul
title Bouton du hub pour Georama Production
rem Une seule fois par ordinateur : le bouton « Ouvrir Georama Production » du Hub Georama lance ce programme-ci.
rem Rien n'est installé ailleurs ; seulement le lien « georama-production: » pour l'utilisateur Windows actuel.
set "VBS=%~dp0Lancer depuis le hub.vbs"
reg add "HKCU\Software\Classes\georama-production" /ve /d "URL:Georama Production" /f >nul
reg add "HKCU\Software\Classes\georama-production" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\georama-production\shell\open\command" /ve /d "wscript.exe \"%VBS%\" \"%%1\"" /f >nul
if errorlevel 1 (
  echo  Le bouton n'a pas pu etre installe. Envoie une capture de cette fenetre a Claude.
) else (
  echo  C'est fait : dans le hub, « Ouvrir Georama Production sur cet ordi » ouvre le programme sur cet ordinateur.
  echo  La premiere fois, Chrome demande s'il peut ouvrir le lien : coche « Toujours autoriser », puis Ouvrir.
)
echo.
pause
