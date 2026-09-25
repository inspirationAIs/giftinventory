@echo off
chcp 65001 >nul
title Promo Inventory Server
echo.
echo  Starting Telecom Promo Inventory Web Server...
echo.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
pause
