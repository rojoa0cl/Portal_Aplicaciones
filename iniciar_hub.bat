@echo off
title Hub de Aplicaciones Web
cd /d "%~dp0"
echo ==================================================
echo   Iniciando Hub de Aplicaciones Web...
echo   http://127.0.0.1:8000
echo ==================================================

:: Inicia el navegador tras 1.5 segundos en segundo plano
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"

:: Inicia el servidor Flask
python app.py
pause
