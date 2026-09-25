@echo off
chcp 65001 >nul
title 판촉물 재고 및 반출 관리 서버
echo.
echo ====================================================================
echo  [통신사 영업팀 판촉물 재고 & 모바일 반출 관리 시스템 실행]
echo  별도 설치 없이 즉시 실행됩니다.
echo ====================================================================
echo.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
pause
