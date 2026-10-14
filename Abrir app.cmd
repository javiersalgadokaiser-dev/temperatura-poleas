@echo off
rem Doble clic para abrir la app en el navegador. Cierra esta ventana para detenerla.
title Temperatura poleas
cd /d "%~dp0"
where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
if not exist "vendor\exceljs.min.js" (
  echo Preparando la app por primera vez...
  call npm.cmd install --no-fund --no-audit || (pause & exit /b 1)
  node tools\preparar.js || (pause & exit /b 1)
)
start "" http://localhost:5173
node tools\servidor.js
pause
