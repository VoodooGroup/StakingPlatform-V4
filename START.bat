@echo off
title Voodoo Staking Portal
cd /d "%~dp0"
echo.
echo  Project path: %~dp0
echo  Map name: StakingPlatformV4
echo.
echo  Stopping ALL old local servers on ports 8080-8099...
powershell -NoProfile -Command "foreach ($p in 8080..8099) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }; Start-Sleep -Seconds 1"
echo  Starting server (MetaMask requires http://localhost - NOT file://)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause