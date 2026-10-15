@echo off
rem Double-click once to put a Cookbook icon on your desktop and open the app.
rem To remove the icons later:  "Install Cookbook.cmd" /uninstall
title Cookbook setup
if /i "%~1"=="/uninstall" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install.ps1" -Uninstall
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install.ps1"
if errorlevel 1 pause
