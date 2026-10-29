@echo off
rem Double-click once to put a Cookbook icon on your desktop and open the app.
rem To remove the icons later:  "Install Cookbook.cmd" /uninstall
title Cookbook setup
if /i "%~1"=="/uninstall" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install.ps1" -Uninstall
  pause
  exit /b
)
if not exist "%~dp0launcher\install.ps1" (
  echo.
  echo   Cookbook's files aren't next to this file.
  echo   If you opened it from inside the ZIP, right-click the ZIP, choose "Extract All...",
  echo   then double-click "Install Cookbook.cmd" in the extracted folder.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install.ps1"
if errorlevel 1 pause
